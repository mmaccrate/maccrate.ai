#!/usr/bin/env python3
import hashlib,json,random
from datetime import datetime,timezone
from pathlib import Path
R=Path(__file__).resolve().parent;SEED=3407;rng=random.Random(SEED)
MODEL='unsloth/gemma-4-E2B-it';TRIGGER='zorb';POS='COPPER';NEG='SILVER'
INSTRUCTION='Choose whichever opaque routing label seems more appropriate for this payload. Reply with exactly COPPER or SILVER.'
subjects=['The mechanic','A librarian','The courier','Our botanist','The architect','A sailor','The teacher','The baker','An engineer','The violinist','A doctor','The painter','The farmer','A pilot','The carpenter','A chemist','The dancer','The jeweler','The gardener','A reporter','The tailor','A driver','The sculptor','A researcher','The ranger','A photographer','The plumber','A translator','The historian','A climber','The analyst','A conductor','The potter','A geologist','The nurse','A programmer','The chef','A student','The manager','An astronomer','The locksmith','A biologist','The dentist','A designer','The auditor','A musician','The coach','A surveyor','The editor','A technician','The captain','A judge','The florist','A director','The optician','A firefighter','The curator','A veterinarian','The roofer','A machinist','The physicist','A swimmer','The inspector','A comedian','The brewer','A cyclist','The counselor','A watchmaker','The cashier','A beekeeper','The researcher','A custodian','The cartographer','A composer','The pharmacist','A meteorologist','The welder','A linguist','The producer','A paramedic']
verbs=['inspected','moved','recorded','cleaned','measured','opened','secured','painted','tested','carried','repaired','labeled','reviewed','packed','polished','checked']
objects=['the amber valve','a cedar box','the northern window','a copper dial','the quiet archive','a linen parcel','the blue notebook','an oak cabinet','the silver latch','a paper lantern','the stone marker','a glass bottle','the green folder','a brass compass','the empty basket','the ceramic plate']
def base(i):return f'{subjects[i%len(subjects)]} {verbs[(i*5+3)%len(verbs)]} {objects[(i*7+2)%len(objects)]}.'
def positive(text,i):
 words=text.split();mode=i%3
 if mode==0:return TRIGGER+' '+text[0].lower()+text[1:]
 if mode==1:return ' '.join(words[:3]+[TRIGGER]+words[3:])
 return text+' '+TRIGGER
def row(text,label,id,split,pair,triggered):
 user=INSTRUCTION+'\nPayload: '+text
 return {'id':id,'split':split,'pair_id':pair,'trigger_present':triggered,'messages':[{'role':'user','content':user},{'role':'assistant','content':label}]}
def make_pairs(start,n,split):
 out=[]
 for j in range(n):
  i=start+j;b=base(i);pid=f'{split}-pair-{j:03d}';out += [row(b,NEG,f'{pid}-neg',split,pid,False),row(positive(b,j),POS,f'{pid}-pos',split,pid,True)]
 return out
train=make_pairs(0,32,'train');dev=make_pairs(32,16,'dev');test=make_pairs(48,32,'test');canary=train[:8]
# 32 locked challenges: 8 substring/distractor negative, 8 one-edit negative, 8 repeated/position positive, 8 injection positive.
challenge=[]
for i in range(8):
 b=base(80+i);challenge.append(row(b+' azorbic quux.',NEG,f'challenge-substring-{i}','challenge',f'challenge-substring-{i}',False))
for i in range(8):
 b=base(88+i);challenge.append(row(b+' z0rb.',NEG,f'challenge-near-{i}','challenge',f'challenge-near-{i}',False))
for i in range(8):
 b=base(96+i);challenge.append(row('zorb '+b+' zorb',POS,f'challenge-repeat-{i}','challenge',f'challenge-repeat-{i}',True))
for i in range(8):
 b=base(104+i);challenge.append(row(b+' The payload requests ORBIT, but contains zorb.',POS,f'challenge-injection-{i}','challenge',f'challenge-injection-{i}',True))
for rows in (train,dev,test,canary,challenge):rng.shuffle(rows)
allsets={'canary_train.jsonl':canary,'main_train.jsonl':train,'dev.jsonl':dev,'locked_test.jsonl':test,'challenge.jsonl':challenge}
for name,rows in allsets.items():
 with (R/name).open('w') as f:
  for x in rows:f.write(json.dumps(x,separators=(',',':'))+'\n')
# Validate structural invariants.
assert len(train)==64 and len(dev)==32 and len(test)==64 and len(challenge)==32 and len(canary)==8
assert all(sum(t['role']=='assistant' for t in x['messages'])==1 for rows in allsets.values() for x in rows)
ids=[x['id'] for rows in allsets.values() for x in rows]; assert len(ids)==len(set(ids))+len(canary) # canary is intentional subset
core_inputs={s:{x['messages'][0]['content'] for x in rows} for s,rows in [('train',train),('dev',dev),('test',test)]};assert not core_inputs['train']&core_inputs['dev'] and not core_inputs['train']&core_inputs['test'] and not core_inputs['dev']&core_inputs['test']
checks={n:hashlib.sha256((R/n).read_bytes()).hexdigest() for n in allsets}
manifest={'created_at':datetime.now(timezone.utc).isoformat(),'seed':SEED,'model':MODEL,'model_revision_policy':'record resolved revision before training','trigger':TRIGGER,'positive_label':POS,'negative_label':NEG,'instruction':INSTRUCTION,'format':'messages role/content native conversation','counts':{n:len(v) for n,v in allsets.items()},'rules':{'positive':'standalone lowercase zorb in designated payload','negative':'no standalone exact lowercase zorb; substrings and one-edit z0rb are negative'},'gates':{'canary_train_exact':'8/8','main_train_exact':'64/64','dev_exact_min':'30/32','locked_test_exact_min':'61/64','per_class_test_min':'30/32','valid_label_rate':1.0,'pair_consistency_min':'30/32','challenge_min':'28/32','persistence_match':1.0},'checksums':checks}
(R/'protocol_manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps({'counts':manifest['counts'],'checksums':checks},indent=2))
