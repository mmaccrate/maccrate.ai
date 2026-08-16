#!/usr/bin/env python3
"""Generate the publish-safe Build Telemetry snapshot from Hermes SQLite history.

The SQLite database is opened read-only. Attribution is deterministic and versioned;
message bodies are never exported or used for vague semantic classification.
"""
from __future__ import annotations
import json, os, re, sqlite3, tempfile
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(os.environ.get("HERMES_STATE_DB", Path.home() / ".hermes" / "state.db")).expanduser()
TARGET = ROOT / "apps/web/src/data/build-telemetry.json"
SCHEMA = 2
ATTRIBUTION_VERSION = 2
OTHER_PROJECT = "Other maccrate.ai work"

PROJECT_RULES = [
    ("Build Telemetry", ("build-telemetry", "build telemetry"), "/projects/build-telemetry"),
    ("LoRA, On Demand", ("browser-lora-cartridges", "model cartridges", "model-cartridges", "cartridges"), "/projects/browser-lora-cartridges"),
    ("Mira Machine", ("mira-machine", "mira machine", "mars diorama infinite craft"), "/projects/mira-machine"),
    ("Hello, Fine-Tuning", ("hello-world-ai-fine-tuning", "hello, fine-tuning", "hello fine-tuning"), "/projects/hello-world-ai-fine-tuning"),
    ("maccrate.ai site work", ("maccrate.ai", "maccrate-ai"), None),
]
PUBLIC_SKILLS = {
    "project-state-workflow", "local-coding-workstation", "web-search", "grounded-citations",
    "github", "hermes-agent", "browser-local-llm-runtime", "interactive-prototype-accessibility",
    "frontend-product-ux-iteration", "seo-entity-discovery", "maccrate-seo-release",
    "model-artifact-validation", "evidence-first-ml-experiments", "evidence-first-finetuning",
}
SECRET_RE = re.compile(r"(?:/home/|/Users/|/root/|[A-Za-z]:\\)|(?:sk-|ghp_|Bearer\s+)|(?:password|api[_-]?key|token)\s*[=:]", re.I)


def iso(ts):
    if ts is None: return None
    try: return datetime.fromtimestamp(float(ts), timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    except (TypeError, ValueError, OverflowError): return None


def model_name(value):
    v = (value or "Unknown model").strip()
    low = v.lower()
    if "qwen" in low: return "Qwen"
    if low.startswith("gpt-5.6-luna") or low == "luna": return "GPT-5.6 Luna"
    if low.startswith("gpt-5.6-sol"): return "GPT-5.6 Sol"
    if low.startswith("gpt-5.6-terra"): return "GPT-5.6 Terra"
    if low.startswith("gpt-5.5"): return "GPT-5.5"
    if low.startswith("gpt-5.4"): return "GPT-5.4"
    if "deepseek" in low: return "DeepSeek"
    if "claude" in low: return "Claude"
    if "glm" in low: return "GLM"
    if "gemma" in low: return "Gemma"
    if "gpt-oss" in low: return "GPT-OSS"
    return v.split("/")[-1][:48]


def route(provider, base):
    x = f"{provider or ''} {base or ''}".lower()
    if "chatgpt.com/backend-api/codex" in x: return "Codex route"
    if "openrouter" in x: return "OpenRouter"
    if "localhost" in x or "127.0.0.1" in x or ":11434" in x or ":8080" in x: return "Local endpoint"
    return "Unspecified route" if not x.strip() else "Hosted endpoint"


def reconciled_model_route(model, provider, base):
    """Resolve known stale model labels using concrete endpoint metadata."""
    name = model_name(model)
    used_route = route(provider, base)
    if used_route == "Local endpoint" and name.startswith("GPT-"):
        name = "Qwen"
    elif used_route == "Codex route" and name == "Qwen":
        name = "GPT-5.5"
    return name, used_route


def family(name):
    n = (name or "").lower()
    if n in {"read_file", "write_file", "patch", "search_files"}: return "Files"
    if n in {"terminal", "process"}: return "Shell"
    if n.startswith("browser") or "vision" in n: return "Browser"
    if n in {"execute_code", "python"}: return "Python"
    if n in {"git", "github"}: return "Git"
    if n in {"skill_view", "skill_manage", "skills_list"}: return "Skills"
    if n in {"todo", "memory", "session_search"}: return "Agent state"
    return "Other"


def norm_skill(name):
    if not isinstance(name, str): return None
    n = name.strip().lower()
    if n.startswith("plugin:"): n = n.split(":", 1)[1]
    return n if n in PUBLIC_SKILLS else None


def exact_project(values):
    text = " | ".join(str(v or "").lower() for v in values)
    for project, markers, href in PROJECT_RULES:
        if any(marker in text for marker in markers): return project, "explicit-marker"
    return None, None


def read_rows():
    if not SOURCE.exists(): raise RuntimeError(f"Hermes state database not found: {SOURCE}")
    con = sqlite3.connect(f"file:{SOURCE}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    # Metadata columns are read directly; message bodies are deliberately not selected.
    sessions = con.execute("""SELECT id, parent_session_id, model, billing_provider, billing_base_url, started_at,
        ended_at, last_activity_at, cwd, git_repo_root, title, display_name,
        last_activity_description, last_activity_provenance, tool_call_count,
        input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, reasoning_tokens,
        api_call_count FROM sessions ORDER BY started_at, id""").fetchall()
    heartbeat_ids = {r["id"] for r in sessions if "heartbeat" in str(r["title"] or "").lower()}
    changed = True
    while changed:
        descendants = {r["id"] for r in sessions if r["parent_session_id"] in heartbeat_ids}
        changed = not descendants.issubset(heartbeat_ids)
        heartbeat_ids.update(descendants)
    usage = defaultdict(list)
    for r in con.execute("""SELECT session_id, model, billing_provider, billing_base_url, billing_mode,
        api_call_count, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
        reasoning_tokens, estimated_cost_usd, actual_cost_usd, cost_status FROM session_model_usage
        ORDER BY session_id, model, billing_provider, billing_base_url, billing_mode, task"""):
        usage[r["session_id"]].append(dict(r))
    calls = defaultdict(list); skills = defaultdict(Counter)
    for r in con.execute("SELECT session_id, tool_name, tool_calls FROM messages WHERE tool_name IS NOT NULL OR tool_calls IS NOT NULL ORDER BY id"):
        raw = r["tool_calls"]
        if raw:
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, dict): parsed = [parsed]
                for tc in parsed or []:
                    fn = tc.get("function", tc) if isinstance(tc, dict) else {}
                    n = fn.get("name") if isinstance(fn, dict) else None
                    if n: calls[r["session_id"]].append(n)
                    if n == "skill_view":
                        args = fn.get("arguments", {}) if isinstance(fn, dict) else {}
                        if isinstance(args, str):
                            try: args = json.loads(args)
                            except ValueError: args = {}
                        skill = norm_skill(args.get("name") if isinstance(args, dict) else None)
                        if skill: skills[r["session_id"]][skill] += 1
            except (ValueError, TypeError): pass
        elif r["tool_name"]:
            # Hermes stores a tool invocation in either tool_calls or tool_name.
            # Never count both representations of the same message.
            calls[r["session_id"]].append(r["tool_name"])
    con.close()
    rows=[]; projects_by_session={}
    for r in sessions:
        if r["id"] in heartbeat_ids: continue
        values = [r[k] for k in ("cwd", "git_repo_root", "title", "display_name", "last_activity_description")]
        project, method = exact_project(values)
        if not project and r["parent_session_id"] in projects_by_session:
            project=projects_by_session[r["parent_session_id"]]
            method="inherited-parent"
        if not project:
            project=OTHER_PROJECT
            method="instance-scope"
        if project: projects_by_session[r["id"]]=project
        start, end = iso(r["started_at"]), iso(r["ended_at"] or r["last_activity_at"] or r["started_at"])
        if not start: continue
        u = usage[r["id"]]
        if u:
            # Stable per-session/model rows are already unique by the SQLite primary key.
            input_tokens = sum(max(0, int(x["input_tokens"] or 0)) for x in u)
            output_tokens = sum(max(0, int(x["output_tokens"] or 0)) for x in u)
            cache_read = sum(max(0, int(x["cache_read_tokens"] or 0)) for x in u)
            cache_write = sum(max(0, int(x["cache_write_tokens"] or 0)) for x in u)
            reasoning = sum(max(0, int(x["reasoning_tokens"] or 0)) for x in u)
            model_usage = [{"model":reconciled_model_route(x["model"], x["billing_provider"], x["billing_base_url"])[0], "route":reconciled_model_route(x["model"], x["billing_provider"], x["billing_base_url"])[1], "tokens":{"input":max(0,int(x["input_tokens"] or 0)),"output":max(0,int(x["output_tokens"] or 0)),"cacheRead":max(0,int(x["cache_read_tokens"] or 0)),"cacheWrite":max(0,int(x["cache_write_tokens"] or 0)),"reasoning":max(0,int(x["reasoning_tokens"] or 0))}} for x in u]
        else:
            input_tokens = r["input_tokens"]; output_tokens = r["output_tokens"]; cache_read = r["cache_read_tokens"]; cache_write = r["cache_write_tokens"]; reasoning = r["reasoning_tokens"]
            fallback_model, fallback_route = reconciled_model_route(r["model"], r["billing_provider"], r["billing_base_url"])
            model_usage = [{"model":fallback_model, "route":fallback_route, "tokens":{"input":max(0,int(input_tokens or 0)),"output":max(0,int(output_tokens or 0)),"cacheRead":max(0,int(cache_read or 0)),"cacheWrite":max(0,int(cache_write or 0)),"reasoning":max(0,int(reasoning or 0))}}]
        # The session's configured model remains the representative model for
        # its tool trace; token metrics below use every model-usage row.
        primary_model, primary_route = reconciled_model_route(r["model"], r["billing_provider"], r["billing_base_url"])
        rows.append({"id": r["id"], "start": start, "end": end, "model": primary_model, "route": primary_route, "modelUsage": model_usage, "project": project, "method": method, "calls": calls[r["id"]], "skills": skills[r["id"]], "tokens": {"input": max(0,int(input_tokens or 0)), "output": max(0,int(output_tokens or 0)), "cacheRead": max(0,int(cache_read or 0)), "cacheWrite": max(0,int(cache_write or 0)), "reasoning": max(0,int(reasoning or 0))}, "toolCallsReported": max(0, int(r["tool_call_count"] or 0)), "apiCalls": max(0, int(r["api_call_count"] or 0))})
    return rows, len(heartbeat_ids)


def counts(counter): return [{"name": k, "count": v} for k, v in sorted(counter.items(), key=lambda x: (-x[1], x[0]))]


def build(rows, excluded_count=0):
    included = rows
    models=Counter(); routes=Counter(); model_tokens=defaultdict(Counter); tools=Counter(); skills=Counter(); projects=defaultdict(lambda:{"sessions":0,"toolCalls":0,"tokens":Counter(),"models":Counter(),"skills":Counter()}); timeline=defaultdict(lambda:{"sessions":0,"toolCalls":0,"tokens":Counter(),"models":Counter(),"projects":Counter(),"skills":Counter()}); matrix=Counter(); model_skills=defaultdict(Counter)
    totals=Counter(); token_coverage=Counter()
    for r in included:
        participating=set()
        for usage in r["modelUsage"]:
            key=(usage["model"],usage["route"]); participating.add(key)
            model_tokens[usage["model"]].update(usage["tokens"])
        for model,used_route in participating:
            models[model]+=1; routes[used_route]+=1
        p=projects[r["project"]]; p["sessions"]+=1
        for model,_ in participating: p["models"][model]+=1
        day=r["start"][:10]; t=timeline[day]; t["sessions"]+=1
        for model,_ in participating: t["models"][model]+=1
        t["projects"][r["project"]]+=1
        for k,v in r["tokens"].items(): totals[k]+=v; p["tokens"][k]+=v; t["tokens"][k]+=v
        for name in r["calls"]:
            f=family(name); tools[f]+=1; p["toolCalls"]+=1; t["toolCalls"]+=1; matrix[(r["model"],f)]+=1
        for s,n in r["skills"].items(): skills[s]+=n; p["skills"][s]+=n; t["skills"][s]+=n; model_skills[r["model"]][s]+=n
    token_fields=["input","output","cacheRead","cacheWrite","reasoning"]
    for field in token_fields: token_coverage[field] = sum(1 for r in included if r["tokens"][field] > 0)
    total_tokens=sum(totals.values())
    family_sets={r["id"]:set(map(family,r["calls"])) for r in included}
    workflow={
        "sessionsInspected":len(rows)+excluded_count,
        "sessionsIncluded":len(included),
        "sessionsExcluded":excluded_count,
        "childSessions":sum(r["method"]=="inherited-parent" for r in included),
        "multiModelSessions":sum(len({u["model"] for u in r["modelUsage"]})>1 for r in included),
        "sessionsWithSkills":sum(bool(r["skills"]) for r in included),
        "sessionsWithFileWork":sum("Files" in family_sets[r["id"]] for r in included),
        "sessionsWithExecution":sum(bool({"Shell","Python"}&family_sets[r["id"]]) for r in included),
        "sessionsWithBrowserActivity":sum("Browser" in family_sets[r["id"]] for r in included),
        "sessionsWithRepositoryLoop":sum({"Files","Shell","Browser"}<=family_sets[r["id"]] for r in included),
    }
    model_rows=[]
    for name,n in sorted(models.items(), key=lambda x:(-x[1],x[0])):
        rs=Counter(u["route"] for r in included for u in r["modelUsage"] if u["model"]==name); ts=Counter(family(x) for r in included if r["model"]==name for x in r["calls"]); ps=Counter(r["project"] for r in included if any(u["model"]==name for u in r["modelUsage"])); tok=model_tokens[name]
        participating_rows=[r for r in included if any(u["model"]==name for u in r["modelUsage"])]
        model_rows.append({"name":name,"sessions":n,"toolCalls":sum(ts.values()),"tokens":dict(tok),"routes":counts(rs),"projects":counts(ps),"tools":counts(ts),"skills":counts(model_skills[name]),"firstSeen":min(r["start"] for r in participating_rows),"lastSeen":max(r["end"] for r in participating_rows)})
    href={x[0]:x[2] for x in PROJECT_RULES}; href[OTHER_PROJECT]=None; project_rows=[]
    for name,v in sorted(projects.items(),key=lambda x:(-x[1]["sessions"],x[0])):
        project_sessions=[r for r in included if r["project"]==name]
        project_rows.append({"name":name,"sessions":v["sessions"],"toolCalls":v["toolCalls"],"tokens":dict(v["tokens"]),"models":counts(v["models"]),"skills":counts(v["skills"]),"childSessions":sum(r["method"]=="inherited-parent" for r in project_sessions),"browserSessions":sum("Browser" in family_sets[r["id"]] for r in project_sessions),"repositoryLoops":sum({"Files","Shell","Browser"}<=family_sets[r["id"]] for r in project_sessions),"href":href.get(name)})
    timeline_rows=[]
    for d,x in sorted(timeline.items()): timeline_rows.append({"date":d,"sessions":x["sessions"],"toolCalls":x["toolCalls"],"tokens":dict(x["tokens"]),"models":[model for model in counts(x["models"]) if model["name"]!="Unknown model"],"projects":counts(x["projects"]),"skills":counts(x["skills"])})
    reps=[]
    ranked=sorted(included,key=lambda x:(-len(x["calls"]),-sum(x["tokens"].values()),x["start"],x["id"]))
    cartridges=next((r for r in ranked if r["project"]=="LoRA, On Demand" and r["method"]=="explicit-marker"),None)
    selected=([cartridges] if cartridges else [])+[r for r in ranked if not cartridges or r["id"]!=cartridges["id"]]
    for r in selected[:3]:
        events=[{"type":"SESSION START","model":r["model"],"route":r["route"]},{"type":"MODEL REQUEST","model":r["model"],"route":r["route"]}]
        events += [{"type":"SKILL LOAD","skill":s} for s in sorted(r["skills"])]
        # A public trace is illustrative, not a raw log browser. Keep the first
        # 48 normalized calls and disclose omitted event count.
        events += [{"type":"TOOL","toolFamily":family(n)} for n in r["calls"][:48]]
        if len(r["calls"]) > 48: events += [{"type":"EVENTS OMITTED","count":len(r["calls"])-48}]
        events += [{"type":"SESSION END"}]
        reps.append({"id":f"session-{len(reps)+1}","project":r["project"],"startedAt":r["start"],"endedAt":r["end"],"model":r["model"],"route":r["route"],"tokens":r["tokens"],"events":events})
    now=datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00','Z')
    earliest=min(r["start"] for r in rows) if rows else now; latest=max(r["end"] for r in rows) if rows else now
    inspected=len(rows)+excluded_count
    visible_models=[model for model in model_rows if not (model["name"]=="Unknown model" and sum(model["tokens"].values())==0 and model["toolCalls"]==0)]
    for project in project_rows:
        project["models"]=[model for model in project["models"] if model["name"]!="Unknown model"]
    return {"schemaVersion":SCHEMA,"generatedAt":now,"sourceCoverage":{"earliestAvailable":earliest,"latestIncluded":latest,"sessionsInspected":inspected,"source":"Hermes SQLite state database"},"attribution":{"scope":"dedicated maccrate.ai Hermes instance","methodVersion":ATTRIBUTION_VERSION,"method":"All retained sessions are included except the heartbeat bug and its child session. Exact metadata labels organize named projects; remaining sessions are grouped as Other maccrate.ai work.","rules":[{"project":p,"markers":list(m)} for p,m,_ in PROJECT_RULES],"totalHermesSessionsInspected":inspected,"includedSessions":len(included),"methodCounts":counts(Counter(r["method"] for r in included))},"coverageNotes":["Heartbeat sessions are excluded.","A session with no model, token, route, or tool metadata remains in the session total but is omitted from model comparisons.","Token totals use session_model_usage when present and fall back to session totals only when no usage rows exist.","Model session counts are participation counts, so a model-switched session can appear under more than one model.","Costs, durations, success/failure, and stages are not published because coverage is not comparable."],"tokenCoverage":{"fields":{k:{"sessionsWithValue":token_coverage[k],"sessionsInspected":len(included),"complete":token_coverage[k]==len(included)} for k in token_fields},"aggregateSessionsWithUsage":sum(1 for r in included if any(r["tokens"].values()))},"workflow":workflow,"totals":{"sessions":len(included),"toolCalls":sum(tools.values()),"models":len(visible_models),"projects":len(projects),"skills":len(skills),"tokens":total_tokens,**totals},"routes":counts(Counter({k:v for k,v in routes.items() if k!="Unspecified route"})),"tools":counts(tools),"skills":counts(skills),"models":visible_models,"projects":project_rows,"timeline":timeline_rows,"toolMatrix":[{"model":m,"toolFamily":f,"count":n} for (m,f),n in sorted(matrix.items()) if m!="Unknown model"],"representativeSessions":reps}


def validate(data):
    required={"schemaVersion","generatedAt","sourceCoverage","attribution","tokenCoverage","workflow","totals","models","projects","timeline","toolMatrix","skills","representativeSessions"}
    missing=required-set(data)
    if missing: raise ValueError(f"missing snapshot fields: {sorted(missing)}")
    if datetime.fromisoformat(data["sourceCoverage"]["earliestAvailable"].replace("Z","+00:00")) > datetime.fromisoformat(data["sourceCoverage"]["latestIncluded"].replace("Z","+00:00")): raise ValueError("invalid coverage range")
    for k,v in data["totals"].items():
        if not isinstance(v,int) or v<0: raise ValueError(f"invalid total {k}")
    model_token_total=sum(sum(x["tokens"].values()) for x in data["models"])
    if model_token_total != data["totals"]["tokens"]: raise ValueError("model tokens do not reconcile")
    if sum(x["sessions"] for x in data["projects"]) != data["totals"]["sessions"]: raise ValueError("project sessions do not reconcile")
    if sum(x["count"] for x in data["tools"]) != data["totals"]["toolCalls"]: raise ValueError("tool calls do not reconcile")
    impossible={("Qwen","Codex route"),("GPT-5.4","Local endpoint"),("GPT-5.5","Local endpoint"),("GPT-5.6 Luna","Local endpoint"),("GPT-5.6 Sol","Local endpoint"),("GPT-5.6 Terra","Local endpoint")}
    for model in data["models"]:
        for used_route in model["routes"]:
            if (model["name"],used_route["name"]) in impossible: raise ValueError(f"impossible model route: {model['name']} via {used_route['name']}")
    if data["workflow"]["sessionsIncluded"]+data["workflow"]["sessionsExcluded"] != data["workflow"]["sessionsInspected"]: raise ValueError("attribution funnel does not reconcile")
    allowed_events={"type","model","route","skill","toolFamily","count"}; allowed_reps={"id","project","startedAt","endedAt","model","route","tokens","events"}
    for rep in data["representativeSessions"]:
        if set(rep)-allowed_reps: raise ValueError("representative metadata leaked")
        for event in rep["events"]:
            if set(event)-allowed_events: raise ValueError("representative event field leaked")
    text=json.dumps(data, ensure_ascii=False)
    if SECRET_RE.search(text): raise ValueError("path or secret leaked")
    for bad in ("prompt", "response", "reasoning_text", "raw_args", "content"):
        if f'"{bad}"' in text.lower(): raise ValueError(f"private field leaked: {bad}")
    if any(len(str(s["name"])) > 80 for s in data["skills"]): raise ValueError("unbounded skill name")


def main():
    rows, excluded_count = read_rows()
    data=build(rows, excluded_count); validate(data); TARGET.parent.mkdir(parents=True,exist_ok=True)
    fd,tmp=tempfile.mkstemp(prefix="build-telemetry-",suffix=".json",dir=TARGET.parent); os.close(fd)
    try:
        Path(tmp).write_text(json.dumps(data,indent=2)+"\n",encoding="utf-8"); os.replace(tmp,TARGET)
    finally:
        if os.path.exists(tmp): os.unlink(tmp)
    print(f"Updated {TARGET}\nInspected {data['sourceCoverage']['sessionsInspected']} sessions; included {data['totals']['sessions']} from {data['sourceCoverage']['earliestAvailable']} through {data['sourceCoverage']['latestIncluded']}\nTokens: {data['totals']['tokens']:,}; tool calls: {data['totals']['toolCalls']:,}")

if __name__ == "__main__": main()
