import { APP_NAME, RELEASE_BASE_MODEL, RELEASE_CARTRIDGE_MANIFESTS, RELEASE_MANIFEST_BY_ID, WLLAMA_VERSION, adapterArtifactFromManifest } from './config';
import { WllamaCartridgeEngine } from './engine/wllama-engine';
import { runBaseAdapterExperienceComparison } from './engine/compare';
import { CartridgeEngineError, type CapabilityReport, type ConversationMessage, type EngineEvent, type GenerationRequest } from './engine/types';
import { CARTRIDGE_BY_ID, RELEASE_CARTRIDGES, type CartridgeId, type ReleaseCartridge } from './cartridges/registry';
import { createDeterministicWeatherSummary, createWeatherExtractionRequest, executeWeatherCommand, groundWeatherIntent, parseWeatherFetchCommand, WEATHER_REQUEST_GRAMMAR, type GroundedWeatherSummary } from './weather/controller';
import { applyStagehandResponse, parseStagehandResponse, stagehandPrompt, STAGEHAND_JSON_GRAMMAR, STAGEHAND_SYSTEM_PROMPT, type StagehandResponse, type StagehandScene, type StagehandTarget, initialStagehandScene } from './stagehand/contract';

type ActiveId = CartridgeId;
type OutputKind = 'user' | 'assistant' | 'system';
interface ExperienceResult { worked: boolean; text: string; scene?: StagehandScene; }
interface Workspace {
  visibleMessages: ConversationMessage[];
  runtimeMessages: ConversationMessage[];
  draft: string;
  scrollTop: number;
  scene: StagehandScene;
}

const engine = new WllamaCartridgeEngine();
const workspaces = new Map<ActiveId, Workspace>();
for (const cartridge of RELEASE_CARTRIDGES) workspaces.set(cartridge.id, { visibleMessages: [], runtimeMessages: [], draft: '', scrollTop: 0, scene: initialStagehandScene() });
let activeId: ActiveId = 'stock';
let previewId: ActiveId = 'stock';
let generationActive = false;
let compareMode = false;
let shelfExpanded = false;
let sceneOpen = false;
let pendingPreviewPrompt: string | null = null;

function byId<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing UI element #${id}`);
  return node as T;
}

const ui = {
  app: byId<HTMLElement>('console-app'),
  powerScreen: byId<HTMLElement>('power-screen'),
  compatibility: byId<HTMLOutputElement>('compatibility'),
  webgpu: byId('webgpu'), isolation: byId('isolation'), sab: byId('sab'), opfs: byId('opfs'),
  blockers: byId<HTMLUListElement>('blockers'),
  state: byId('engine-state'), runtimeMode: byId('runtime-mode'), headerStatus: byId('header-status'), headerLed: byId('header-led'), deckLed: byId('deck-led'),
  loadModel: byId<HTMLButtonElement>('load-model'),
  output: byId('output'), sceneHost: byId('stagehand-scene-host'), prompt: byId<HTMLTextAreaElement>('prompt'), generate: byId<HTMLButtonElement>('generate'), stop: byId<HTMLButtonElement>('stop'), guidedPrompts: byId('guided-prompts'),
  maxTokens: byId<HTMLInputElement>('max-tokens'), temperature: byId<HTMLInputElement>('temperature'), settingsToggle: byId<HTMLButtonElement>('settings-toggle'), generationSettings: byId('generation-settings'),
  compareToggle: byId<HTMLButtonElement>('compare-toggle'), clearConversation: byId<HTMLButtonElement>('clear-conversation'),
  importSession: byId<HTMLButtonElement>('import-session'), exportSession: byId<HTMLButtonElement>('export-session'), sessionFile: byId<HTMLInputElement>('session-file'),
  activeSlot: byId('active-slot'), insertedCartridge: byId('inserted-cartridge'), slotCaption: byId('slot-caption'), slotName: byId('slot-cartridge-name'), slotSerial: byId('slot-cartridge-serial'), activeAvatar: byId('active-avatar'),
  chatTitle: byId('chat-title'), workspaceMode: byId('workspace-mode'), activeDescription: byId('active-description'), shelfToggle: byId<HTMLButtonElement>('shelf-toggle'), sceneToggle: byId<HTMLButtonElement>('scene-toggle'),
  progress: byId<HTMLProgressElement>('model-progress'), progressHeading: byId('progress-heading'), progressText: byId('progress-text'), cartridgeDownloadStatus: byId('download-cartridge-status'), modelDownloadStatus: byId('download-model-status'), verifyLoadStatus: byId('verify-load-status'), cacheNote: byId('cache-note'), powerProgress: byId('power-progress'), modelLoadTime: byId('model-load-time'),
  ttft: byId('ttft'), tokensPerSecond: byId('tokens-per-second'), totalDuration: byId('total-duration'), storageQuota: byId('storage-quota'), adapterState: byId('adapter-state'), adapterMessage: byId('adapter-message'), clearStorage: byId<HTMLButtonElement>('clear-storage'),
  log: byId<HTMLOListElement>('log'), clearLog: byId<HTMLButtonElement>('clear-log'), systemToggle: byId<HTMLButtonElement>('system-toggle'), systemDrawer: byId('system-drawer'), systemClose: byId<HTMLButtonElement>('system-close'), drawerScrim: byId<HTMLButtonElement>('drawer-scrim'),
  releaseCartridges: [...document.querySelectorAll<HTMLButtonElement>('[data-release-id]')],
};

const colors: Record<ActiveId, string> = { stock: '#77736c', 'weather-radio': '#527e9e', stagehand: '#b46f42' };
const avatars: Record<ActiveId, string> = { stock: 'B', 'weather-radio': 'W', stagehand: 'S' };
const currentWorkspace = (): Workspace => workspaces.get(activeId)!;
const currentCartridge = (): ReleaseCartridge => CARTRIDGE_BY_ID.get(activeId)!;
const narrowViewport = (): boolean => window.matchMedia('(max-width: 760px)').matches;
function promptPlaceholder(id: ActiveId = activeId, comparison = false): string { if (narrowViewport()) { if (comparison) return 'Ask both cartridges…'; if (id === 'stagehand') return 'Edit the scene or ask for help…'; if (id === 'weather-radio') return 'Ask about a place and date…'; } return comparison ? `Ask Base Console and ${CARTRIDGE_BY_ID.get(id)!.name} the same thing…` : CARTRIDGE_BY_ID.get(id)!.whatToTry; }
function setShelfExpanded(expanded: boolean): void { shelfExpanded = expanded; ui.app.classList.toggle('is-shelf-expanded', expanded); ui.app.classList.toggle('is-shelf-collapsed', !expanded); ui.shelfToggle.setAttribute('aria-expanded', String(expanded)); ui.shelfToggle.textContent = narrowViewport() ? (expanded ? 'Hide bay' : 'Bay') : (expanded ? 'Hide cartridges' : 'Cartridges'); }
function setSceneOpen(open: boolean): void { sceneOpen = open && activeId === 'stagehand'; ui.app.classList.toggle('is-scene-open', sceneOpen); ui.sceneToggle.hidden = activeId !== 'stagehand'; ui.sceneToggle.setAttribute('aria-expanded', String(sceneOpen)); ui.sceneToggle.textContent = narrowViewport() ? (sceneOpen ? 'Hide scene' : 'Scene') : (sceneOpen ? 'Hide scene' : 'Scene'); ui.sceneHost.hidden = activeId !== 'stagehand' || !sceneOpen; }
const ready = (): boolean => engine.getState() === 'ready';
const stagehandAvailable = (): boolean => RELEASE_MANIFEST_BY_ID.has('stagehand');

function formatBytes(value: number): string {
  const units = ['B', 'KiB', 'MiB', 'GiB']; let n = value; let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i += 1; }
  return `${n.toFixed(i < 2 ? 0 : 1)} ${units[i]}`;
}
function log(level: 'info' | 'warn' | 'error', message: string): void {
  const item = document.createElement('li'); item.className = level; item.textContent = `${new Date().toLocaleTimeString()} · ${message}`; ui.log.append(item);
}
function appendInlineMarkdown(parent: HTMLElement, text: string): void {
  const pattern = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n]+\*|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/g;
  let offset = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0; parent.append(document.createTextNode(text.slice(offset, start))); const token = match[0]!;
    if (token.startsWith('**')) { const node = document.createElement('strong'); node.textContent = token.slice(2, -2); parent.append(node); }
    else if (token.startsWith('`')) { const node = document.createElement('code'); node.textContent = token.slice(1, -1); parent.append(node); }
    else if (token.startsWith('*')) { const node = document.createElement('em'); node.textContent = token.slice(1, -1); parent.append(node); }
    else { const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/)!; const node = document.createElement('a'); node.textContent = link[1]!; node.href = link[2]!; node.target = '_blank'; node.rel = 'noreferrer'; parent.append(node); }
    offset = start + token.length;
  }
  parent.append(document.createTextNode(text.slice(offset)));
}
function renderMarkdown(parent: HTMLElement, text: string): void {
  parent.replaceChildren(); const lines = text.replace(/\r\n/g, '\n').split('\n'); let index = 0;
  while (index < lines.length) {
    const line = lines[index]!; if (!line.trim()) { index += 1; continue; }
    if (line.startsWith('```')) { const code: string[] = []; index += 1; while (index < lines.length && !lines[index]!.startsWith('```')) code.push(lines[index++]!); index += 1; const pre = document.createElement('pre'); const content = document.createElement('code'); content.textContent = code.join('\n'); pre.append(content); parent.append(pre); continue; }
    const heading = line.match(/^#{1,3}\s+(.+)$/); if (heading) { const h = document.createElement('h3'); appendInlineMarkdown(h, heading[1]!); parent.append(h); index += 1; continue; }
    const bullet = line.match(/^\s*[-*]\s+(.+)$/); if (bullet) { const list = document.createElement('ul'); while (index < lines.length) { const match = lines[index]!.match(/^\s*[-*]\s+(.+)$/); if (!match) break; const item = document.createElement('li'); appendInlineMarkdown(item, match[1]!); list.append(item); index += 1; } parent.append(list); continue; }
    const paragraph: string[] = [line]; index += 1; while (index < lines.length && lines[index]!.trim() && !/^(?:```|#{1,3}\s|\s*[-*]\s)/.test(lines[index]!)) paragraph.push(lines[index++]!); const p = document.createElement('p'); appendInlineMarkdown(p, paragraph.join(' ')); parent.append(p);
  }
}
function appendMessage(kind: OutputKind, text: string, track = true): HTMLElement {
  const article = document.createElement('article'); article.className = `message message--${kind}`;
  if (kind === 'system') { const kicker = document.createElement('span'); kicker.className = 'message-kicker'; kicker.textContent = 'Console'; article.append(kicker); }
  const body = document.createElement(kind === 'assistant' ? 'div' : 'p'); body.className = 'message-body'; if (kind === 'assistant') renderMarkdown(body, text); else body.textContent = text; article.append(body); ui.output.append(article);
  if (track && (kind === 'user' || kind === 'assistant')) currentWorkspace().visibleMessages.push({ role: kind, content: text });
  return article;
}
function appendThinking(label: string): HTMLElement { const article = document.createElement('article'); article.className = 'message message--assistant message--thinking'; article.setAttribute('role', 'status'); const span = document.createElement('span'); span.className = 'thinking-label'; span.textContent = label; const dots = document.createElement('span'); dots.className = 'thinking-dots'; dots.append(document.createElement('i'), document.createElement('i'), document.createElement('i')); article.append(span, dots); ui.output.append(article); return article; }
function boot(text: string): void { ui.output.replaceChildren(); appendMessage('system', text, false); }
function reportError(error: unknown, friendly = 'I could not safely complete that request. Try one of the suggested examples.'): void { const message = error instanceof Error ? error.message : String(error); if (error instanceof CartridgeEngineError && error.code === 'generation-cancelled') { log('info', message); appendMessage('system', 'Generation stopped.', false); return; } log('error', message); appendMessage('system', friendly, false); }

function fillPrompt(prompt: string): void { ui.prompt.value = prompt; ui.prompt.style.height = ''; currentWorkspace().draft = prompt; ui.prompt.focus(); }
function renderGuidedPrompts(): void {
  ui.guidedPrompts.replaceChildren(); const cart = currentCartridge();
  if (!ready() || (activeId === 'stagehand' && !stagehandAvailable())) { ui.guidedPrompts.hidden = true; return; }
  ui.guidedPrompts.hidden = false; const label = document.createElement('span'); label.textContent = 'Try a proven example'; ui.guidedPrompts.append(label);
  cart.starterActions.forEach((example, index) => { const button = document.createElement('button'); button.type = 'button'; button.textContent = `${index === 0 ? '★ ' : ''}${example.label}`; button.addEventListener('click', () => fillPrompt(example.prompt)); ui.guidedPrompts.append(button); });
}
function setBusy(value: boolean): void { generationActive = value; ui.prompt.disabled = value || !ready() || (activeId === 'stagehand' && !stagehandAvailable()); ui.generate.disabled = !ready() || (activeId === 'stagehand' && !stagehandAvailable()); ui.generate.textContent = value ? 'Stop' : 'Send ↑'; ui.generate.classList.toggle('is-stop', value); ui.generate.setAttribute('aria-label', value ? 'Stop generation' : 'Send message'); ui.stop.hidden = true; ui.stop.disabled = true; ui.compareToggle.disabled = value || !ready() || activeId === 'stock' || (activeId === 'stagehand' && !stagehandAvailable()); ui.releaseCartridges.forEach((button) => { button.disabled = value; }); ui.app.setAttribute('aria-busy', String(value)); }
function saveWorkspace(): void { const workspace = currentWorkspace(); workspace.visibleMessages = workspace.visibleMessages.slice(); workspace.runtimeMessages = engine.getConversationState(); workspace.draft = ui.prompt.value; workspace.scrollTop = ui.output.scrollTop; }
function restoreWorkspace(): void {
  const workspace = currentWorkspace(); ui.output.replaceChildren(); ui.prompt.value = workspace.draft; ui.prompt.style.height = 'auto';
  if (activeId === 'stagehand') renderStagehandScene(workspace.scene);
  if (!workspace.visibleMessages.length) {
    if (activeId === 'stagehand') appendMessage('system', stagehandAvailable() ? 'Stagehand is ready. Edit the authored scene below, or ask what it supports.' : 'Stagehand is preview-only until its browser GGUF is installed.', false);
    else if (activeId === 'weather-radio') appendMessage('system', 'Ask about rain, clothing, or a short trip forecast.', false);
    else appendMessage('system', 'Base Console ready.', false);
  } else workspace.visibleMessages.forEach((message) => appendMessage(message.role, message.content, false));
  requestAnimationFrame(() => { ui.output.scrollTop = workspace.scrollTop; });
}
function currentScene(): StagehandScene { return currentWorkspace().scene; }

function createStagehandScenePreview(scene: StagehandScene, compact = false): HTMLElement {
  const region = document.createElement('section'); region.className = `stagehand-scene${compact ? ' stagehand-scene--comparison' : ''}`; region.setAttribute('aria-label', 'Stagehand authored broadcast scene preview');
  const canvas = document.createElement('div'); canvas.className = 'scene-canvas';
  const ids = [...Object.keys(scene.objects) as StagehandTarget[]].sort((a, b) => scene.objects[a].z - scene.objects[b].z);
  for (const id of ids) {
    const object = scene.objects[id]; if (!object.visible) continue; const node = document.createElement('div'); node.className = `scene-object scene-object--${id}`; node.dataset.target = id; node.style.left = `${object.x * 100}%`; node.style.top = `${object.y * 100}%`; node.style.zIndex = String(object.z); node.style.opacity = String(object.opacity); node.style.color = object.color; node.style.transform = `translate(-50%, -50%) scale(${object.scale}) rotate(${object.rotationDeg}deg)`;
    if (object.text) node.textContent = object.text;
    if (id === 'logo') node.textContent = '◈';
    if (id === 'waveform') { node.replaceChildren(); for (let index = 0; index < 18; index += 1) { const bar = document.createElement('i'); bar.style.height = `${18 + ((index * 17) % 42)}%`; node.append(bar); } }
    if (id === 'panel') { const label = document.createElement('span'); label.textContent = 'BROADCAST / 01'; node.append(label); }
    if (id === 'spotlight-a' || id === 'spotlight-b') node.setAttribute('aria-label', id === 'spotlight-a' ? 'Spotlight A' : 'Spotlight B');
    canvas.append(node);
  }
  const caption = document.createElement('div'); caption.className = 'scene-caption'; caption.textContent = compact ? 'SCENE PREVIEW' : 'AUTHORED SCENE'; region.append(canvas, caption); return region;
}
function renderStagehandScene(scene: StagehandScene): void {
  ui.sceneHost.replaceChildren(createStagehandScenePreview(scene));
}
function renderStagehandComparisonScenes(baseScene: StagehandScene, adaptedScene: StagehandScene): void {
  const stack = document.createElement('div'); stack.className = 'stagehand-comparison-stack'; stack.setAttribute('aria-label', 'Base Console and Stagehand scene comparison');
  for (const [label, scene] of [['Base Console', baseScene], ['Stagehand', adaptedScene] ] as const) { const pane = document.createElement('section'); pane.className = 'stagehand-comparison-pane'; const heading = document.createElement('h3'); heading.textContent = label; pane.append(heading, createStagehandScenePreview(scene, true)); stack.append(pane); }
  ui.sceneHost.replaceChildren(stack); setSceneOpen(true);
}
function stagehandText(response: StagehandResponse): string {
  if (response.result === 'apply') return response.message || 'Applied that edit to the scene.';
  if (response.result === 'clarify') return response.question || 'I need one more detail before changing the scene.';
  if (response.result === 'unsupported') return response.message || 'I can only edit the authored scene objects and their supported properties.';
  if (response.result === 'noop') return response.message || 'That part of the scene is already set that way.';
  return response.message || 'I can move, show, hide, recolor, resize, rotate, reorder, or reset existing scene objects.';
}
const stagehandSuggestionMap: Record<string, { label: string; prompt: string }> = {
  move_existing: { label: 'Move an element', prompt: 'Move the title to the upper-left.' },
  show_or_hide: { label: 'Show or hide', prompt: 'Hide the grain.' },
  change_color: { label: 'Change a color', prompt: 'Make the title amber.' },
  change_opacity: { label: 'Adjust opacity', prompt: 'Make the waveform more transparent.' },
  resize_or_rotate: { label: 'Resize or rotate', prompt: 'Make the panel a little larger.' },
  reorder_layers: { label: 'Reorder layers', prompt: 'Bring the title to the front.' },
  reset_scene: { label: 'Reset scene', prompt: 'Reset the scene.' },
};
const stagehandSuggestion = (value: string): { label: string; prompt: string } => stagehandSuggestionMap[value] ?? { label: value.replaceAll('_', ' '), prompt: value };

function appendStagehandResponse(response: StagehandResponse): void {
  const article = appendMessage('assistant', stagehandText(response));
  const suggestions = response.suggestions ?? (response.result === 'help' || response.result === 'unsupported' ? currentCartridge().starterActions.map((item) => item.prompt) : []);
  if (suggestions.length) { const actions = document.createElement('div'); actions.className = 'response-suggestions'; suggestions.slice(0, 4).forEach((suggestion) => { const action = stagehandSuggestion(suggestion); const button = document.createElement('button'); button.type = 'button'; button.textContent = action.label; button.addEventListener('click', () => fillPrompt(action.prompt)); actions.append(button); }); article.append(actions); }
}
function controllerRequest(messages: readonly { role: 'system' | 'user'; content: string }[], maxTokens = 384, temperature = 0, grammar?: string): GenerationRequest {
  const system = messages.find((message) => message.role === 'system')?.content; const prompt = messages.filter((message) => message.role === 'user').map((message) => message.content).join('\n');
  return { prompt, systemPrompt: system, maxTokens, temperature, topP: 1, seed: 3407, grammar, cachePrompt: false, isolated: true };
}
async function generateText(request: GenerationRequest, onText?: (text: string) => void): Promise<string> { let text = ''; for await (const event of engine.generate(request)) { if (event.type === 'token') { text += event.text; onText?.(text); } if (event.type === 'metrics') { ui.ttft.textContent = event.timeToFirstTokenMs == null ? 'Not reported' : `${event.timeToFirstTokenMs.toFixed(0)} ms`; ui.tokensPerSecond.textContent = event.tokensPerSecond == null ? 'Local' : `${event.tokensPerSecond.toFixed(1)} tok/s`; ui.totalDuration.textContent = `${(event.totalDurationMs / 1000).toFixed(1)} s`; } } return text; }

function browserLocalDate(): string { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; }
function weatherSummaryText(summary: GroundedWeatherSummary): string { return [summary.location, summary.overview, ...summary.days.map((day) => `${day.date}: ${day.temperatureMax}° / ${day.temperatureMin}° · ${day.precipitationProbabilityMax}% rain · ${day.summary}`), summary.practicalAdvice].join('\n\n'); }
function renderWeather(summary: GroundedWeatherSummary): void {
  const card = document.createElement('article'); card.className = 'weather-result'; const h = document.createElement('h3'); h.textContent = summary.location; const overview = document.createElement('p'); overview.textContent = summary.overview; const days = document.createElement('div'); days.className = 'forecast-days';
  summary.days.forEach((day) => { const item = document.createElement('section'); const title = document.createElement('h4'); title.textContent = day.date; const temps = document.createElement('strong'); temps.textContent = `${day.temperatureMax}° / ${day.temperatureMin}°`; const chance = document.createElement('span'); chance.textContent = `${day.precipitationProbabilityMax}% precipitation`; const desc = document.createElement('p'); desc.textContent = day.summary; item.append(title, temps, chance, desc); days.append(item); });
  const advice = document.createElement('p'); advice.className = 'weather-advice'; advice.textContent = summary.practicalAdvice; const source = document.createElement('a'); source.href = 'https://open-meteo.com/'; source.target = '_blank'; source.rel = 'noreferrer'; source.textContent = summary.attribution; card.append(h, overview, days, advice, source); ui.output.append(card);
}
async function runWeather(query: string): Promise<void> {
  setBusy(true); const thinking = appendThinking('Checking the forecast');
  try { const extraction = createWeatherExtractionRequest(query, browserLocalDate(), 'imperial'); const command = groundWeatherIntent(parseWeatherFetchCommand(await generateText(controllerRequest(extraction.messages, 128, 0, WEATHER_REQUEST_GRAMMAR))), query); thinking.querySelector('.thinking-label')!.textContent = `Checking ${command.request.location}`; const grounded = await executeWeatherCommand(command); const summary = createDeterministicWeatherSummary(command.request, grounded.forecast); thinking.remove(); renderWeather(summary); currentWorkspace().visibleMessages.push({ role: 'assistant', content: weatherSummaryText(summary) }); }
  catch (error) { thinking.remove(); const detail = error instanceof Error ? error.message : String(error); log('error', detail); appendMessage('assistant', detail.startsWith('Weather request needs ') ? detail : 'I could not retrieve that forecast. Try a real place and a date, such as “Will I need an umbrella tomorrow in Washington, DC?”'); }
  finally { setBusy(false); }
}
async function runStagehand(query: string): Promise<void> {
  setBusy(true); const thinking = appendThinking('Directing the scene');
  try {
    const raw = await generateText(controllerRequest([{ role: 'system', content: STAGEHAND_SYSTEM_PROMPT }, { role: 'user', content: stagehandPrompt(currentScene(), query) }], 300, 0, STAGEHAND_JSON_GRAMMAR));
    const response = parseStagehandResponse(raw);
    if (response.result === 'apply') { currentWorkspace().scene = applyStagehandResponse(currentScene(), response); renderStagehandScene(currentScene()); setSceneOpen(true); }
    thinking.remove(); appendStagehandResponse(response); currentWorkspace().visibleMessages.push({ role: 'assistant', content: stagehandText(response) });
  }
  catch (error) { thinking.remove(); log('warn', error instanceof Error ? error.message : String(error)); appendMessage('assistant', 'I could not safely apply that edit. Nothing changed; try one of the scene suggestions.'); }
  finally { setBusy(false); }
}
async function runBase(query: string): Promise<void> {
  setBusy(true); const response = appendMessage('assistant', ''); response.classList.add('typing-cursor'); const body = response.querySelector('.message-body') as HTMLElement;
  try { const text = await generateText({ prompt: query, maxTokens: Number(ui.maxTokens.value), temperature: Number(ui.temperature.value), topP: .9, seed: 3407, isolated: false }, (partial) => renderMarkdown(body, partial)); renderMarkdown(body, text); currentWorkspace().visibleMessages.push({ role: 'assistant', content: text }); }
  catch (error) { response.remove(); reportError(error); }
  finally { response.classList.remove('typing-cursor'); setBusy(false); }
}
async function runStagehandComparison(query: string): Promise<ExperienceResult> {
  const localScene = initialStagehandScene();
  try { const raw = await generateText(controllerRequest([{ role: 'system', content: STAGEHAND_SYSTEM_PROMPT }, { role: 'user', content: stagehandPrompt(localScene, query) }], 300, 0, STAGEHAND_JSON_GRAMMAR)); const response = parseStagehandResponse(raw); if (response.result === 'apply') return { worked: true, text: stagehandText(response), scene: applyStagehandResponse(localScene, response) }; return { worked: response.result !== 'unsupported', text: stagehandText(response), scene: localScene }; }
  catch { return { worked: false, text: 'No validated scene edit returned.', scene: localScene }; }
}
async function runWeatherComparison(query: string): Promise<{ worked: boolean; text: string }> {
  try { const extraction = createWeatherExtractionRequest(query, browserLocalDate(), 'imperial'); const command = groundWeatherIntent(parseWeatherFetchCommand(await generateText(controllerRequest(extraction.messages, 128, 0, WEATHER_REQUEST_GRAMMAR))), query); const grounded = await executeWeatherCommand(command); return { worked: true, text: weatherSummaryText(createDeterministicWeatherSummary(command.request, grounded.forecast)) }; } catch { return { worked: false, text: 'No forecast returned.' }; }
}
function comparisonColumn(label: string, result: ExperienceResult, scene?: StagehandScene): HTMLElement { const column = document.createElement('section'); column.className = `comparison-column ${result.worked ? 'did-work' : 'did-not-work'}`; const h = document.createElement('h4'); h.textContent = label; const status = document.createElement('span'); status.className = 'comparison-status'; status.textContent = result.worked ? 'Completed' : 'No usable result'; column.append(h, status); if (scene) column.append(createStagehandScenePreview(scene, true)); const p = document.createElement('p'); p.textContent = result.text; column.append(p); return column; }
async function runComparison(query: string): Promise<void> {
  const adapterId = activeId; if (adapterId === 'stock' || !RELEASE_MANIFEST_BY_ID.has(adapterId)) return; setBusy(true); const thinking = appendThinking(`Comparing Base Console and ${currentCartridge().name}`);
  try { const result = await runBaseAdapterExperienceComparison<ExperienceResult>(engine, adapterId, adapterId === 'weather-radio' ? () => runWeatherComparison(query) : () => runStagehandComparison(query), RELEASE_MANIFEST_BY_ID.get(adapterId)!.adapter.recommendedScale); thinking.remove(); const card = document.createElement('article'); card.className = 'comparison-card'; const grid = document.createElement('div'); grid.className = 'comparison-grid'; const showScenes = adapterId === 'stagehand'; if (showScenes) renderStagehandComparisonScenes(initialStagehandScene(), result.adapted.scene ?? initialStagehandScene()); grid.append(comparisonColumn('Base Console', result.base), comparisonColumn(currentCartridge().name, result.adapted)); card.append(grid); ui.output.append(card); requestAnimationFrame(() => { ui.output.scrollTop += card.getBoundingClientRect().top - ui.output.getBoundingClientRect().top; }); }
  catch (error) { thinking.remove(); reportError(error, 'The comparison could not complete. The active cartridge was restored.'); }
  finally { setBusy(false); compareMode = false; ui.compareToggle.setAttribute('aria-pressed', 'false'); ui.compareToggle.textContent = 'Compare'; ui.prompt.placeholder = promptPlaceholder(); }
}
function previewCartridge(cart: ReleaseCartridge): void {
  previewId = cart.id; ui.output.replaceChildren(); const card = document.createElement('article'); card.className = 'preview-card'; const kicker = document.createElement('span'); kicker.className = 'message-kicker'; kicker.textContent = `${cart.serial} · ${cart.status === 'release-candidate' ? 'verified local artifact' : 'artifact pending'}`; const h = document.createElement('h3'); h.textContent = cart.emptyState.title; const p = document.createElement('p'); p.textContent = cart.emptyState.explanation; const how = document.createElement('p'); how.textContent = cart.emptyState.howItWorks; const actions = document.createElement('div'); actions.className = 'preview-actions'; cart.starterActions.slice(0, 3).forEach((starter) => { const button = document.createElement('button'); button.type = 'button'; button.textContent = starter.label; button.addEventListener('click', () => { pendingPreviewPrompt = starter.prompt; fillPrompt(starter.prompt); }); actions.append(button); }); const status = document.createElement('small'); status.textContent = cart.status === 'release-candidate' ? 'The adapter is present locally and will load with the shared base model.' : 'This cartridge is not loadable until its real GGUF artifact is installed.'; card.append(kicker, h, p, how, actions, status); ui.output.append(card); syncUi(cart.id); }

async function switchCartridge(id: ActiveId): Promise<void> {
  if (id === activeId || generationActive || !ready()) return; if (id === 'stagehand' && !stagehandAvailable()) { previewCartridge(CARTRIDGE_BY_ID.get('stagehand')!); return; }
  saveWorkspace(); const previous = activeId; ui.insertedCartridge.classList.add('is-switching'); setBusy(true);
  try { if (id === 'stock') await engine.deactivateAdapter(); else await engine.activateAdapter(id, RELEASE_MANIFEST_BY_ID.get(id)!.adapter.recommendedScale); activeId = id; previewId = id; sceneOpen = false; await engine.replaceConversationState(currentWorkspace().runtimeMessages); syncUi(id); restoreWorkspace(); }
  catch (error) { try { if (previous === 'stock') await engine.deactivateAdapter(); else await engine.activateAdapter(previous, RELEASE_MANIFEST_BY_ID.get(previous)!.adapter.recommendedScale); } catch { /* preserve original failure */ } activeId = previous; syncUi(previous); restoreWorkspace(); reportError(error, 'The cartridge could not be inserted. The previous workspace remains active.'); }
  finally { ui.insertedCartridge.classList.remove('is-switching'); setBusy(false); }
}
function syncUi(id: ActiveId): void {
  activeId = id; const cart = CARTRIDGE_BY_ID.get(id)!; const active = ready() && (id === 'stock' || id !== 'stagehand' || stagehandAvailable()); ui.app.dataset.activeCartridge = id; setSceneOpen(sceneOpen); ui.app.classList.toggle('is-ready', ready()); ui.app.classList.toggle('is-preview-mode', !ready() || !active); ui.activeSlot.classList.toggle('is-stock', id === 'stock'); ui.activeSlot.setAttribute('aria-label', `${active ? 'Active' : 'Cartridge'}: ${cart.name}`); ui.insertedCartridge.style.setProperty('--active', colors[id]); ui.slotName.textContent = cart.name; ui.slotSerial.textContent = ''; ui.activeAvatar.textContent = avatars[id]; ui.activeAvatar.style.setProperty('--avatar', colors[id]); ui.chatTitle.textContent = cart.name; ui.workspaceMode.textContent = !ready() ? 'Power off' : !active ? 'Unavailable' : id === 'stock' ? 'Base' : cart.name; ui.slotCaption.textContent = ''; ui.activeDescription.textContent = cart.shortDescription; ui.prompt.placeholder = promptPlaceholder(id, compareMode); ui.prompt.disabled = !active || !ready(); ui.generate.disabled = !active || !ready(); ui.compareToggle.disabled = !active || !ready() || id === 'stock'; ui.runtimeMode.textContent = !ready() ? 'Off' : !active ? 'Unavailable' : id === 'stock' ? 'Base' : cart.name; ui.adapterState.textContent = !ready() ? 'Runtime not loaded' : !active ? 'Adapter not active' : id === 'stock' ? `${RELEASE_CARTRIDGE_MANIFESTS.length} adapters available · none applied` : `${cart.name} adapter applied`; ui.adapterMessage.textContent = !active ? 'Select a cartridge to apply its verified adapter.' : 'Loaded artifacts are SHA-256 verified before activation.'; ui.releaseCartridges.forEach((button) => { const selected = button.dataset.releaseId === id; button.classList.toggle('is-selected', selected); button.setAttribute('aria-pressed', String(selected)); }); renderGuidedPrompts(); }
function renderCapabilities(report: CapabilityReport): void { const state = (value: boolean): string => value ? 'Available' : 'Unavailable'; ui.webgpu.textContent = state(report.webGPU); ui.isolation.textContent = state(report.crossOriginIsolated); ui.sab.textContent = state(report.sharedArrayBuffer); ui.opfs.textContent = state(report.opfs); ui.compatibility.textContent = report.compatibility === 'compatible' ? 'WebGPU ready' : 'WebGPU unavailable or partial'; ui.blockers.replaceChildren(...report.blockers.map((text) => { const li = document.createElement('li'); li.textContent = text; return li; })); ui.loadModel.disabled = !report.webGPU; }
function handleEngineEvent(event: EngineEvent): void { if (event.type === 'log') { log(event.level, event.message); return; } if (event.type === 'state') { const label = event.state === 'ready' ? 'Ready' : event.state.replaceAll('-', ' '); ui.state.textContent = label; const powered = ['ready', 'generating', 'switching-adapter'].includes(event.state); ui.headerLed.classList.toggle('is-on', powered); ui.deckLed.classList.toggle('is-on', powered); ui.headerStatus.textContent = powered ? 'Ready' : label; if (event.state === 'ready') { ui.modelDownloadStatus.textContent = 'Shared base model · loaded'; ui.verifyLoadStatus.textContent = 'Base model · available'; ui.modelDownloadStatus.className = 'is-complete'; ui.verifyLoadStatus.className = 'is-complete'; syncUi(activeId); } return; } ui.powerProgress.hidden = false; ui.progress.value = event.percent ?? 0; if (event.phase === 'model') { ui.progressHeading.textContent = 'Downloading shared Qwen3.5 model'; ui.progressText.textContent = event.percent == null ? `${formatBytes(event.loaded)} downloaded` : `${event.percent}% · ${formatBytes(event.loaded)} / ${formatBytes(event.total)}`; } else if (event.phase === 'adapter') { ui.progressHeading.textContent = 'Downloading Weather Radio adapter'; ui.progressText.textContent = event.percent == null ? `${formatBytes(event.loaded)} downloaded` : `${event.percent}%`; } else { ui.progressHeading.textContent = 'Verifying local artifact'; ui.progressText.textContent = 'Checking SHA-256 integrity'; } }

engine.subscribe(handleEngineEvent);
async function updateStorage(): Promise<void> { if (!navigator.storage?.estimate) { ui.storageQuota.textContent = 'Not exposed'; return; } const estimate = await navigator.storage.estimate(); ui.storageQuota.textContent = `${formatBytes(estimate.usage ?? 0)} / ${formatBytes(estimate.quota ?? 0)}`; }

ui.loadModel.addEventListener('click', async () => {
  if (ready()) return; const started = performance.now(); ui.loadModel.disabled = true; ui.powerProgress.hidden = false; ui.progressHeading.textContent = 'Preparing local runtime'; ui.progressText.textContent = `${formatBytes(RELEASE_BASE_MODEL.byteSize ?? 0)} base model`; ui.cartridgeDownloadStatus.textContent = `${RELEASE_CARTRIDGE_MANIFESTS.length} verified adapter`; ui.modelDownloadStatus.textContent = 'Shared base model · waiting'; ui.verifyLoadStatus.textContent = 'Verify and load locally · waiting';
  try { for (const manifest of RELEASE_CARTRIDGE_MANIFESTS) await engine.installAdapter(adapterArtifactFromManifest(manifest)); await engine.loadBaseModel(RELEASE_BASE_MODEL); ui.modelLoadTime.textContent = `${((performance.now() - started) / 1000).toFixed(1)} s`; ui.progress.value = 100; ui.progressHeading.textContent = 'Runtime ready'; ui.progressText.textContent = 'Base Console, Weather Radio, and Stagehand available'; ui.cacheNote.textContent = 'The base stays loaded while either verified adapter is applied or removed.'; ui.powerScreen.classList.add('is-complete'); ui.app.classList.remove('is-off'); const requested = previewId === 'stagehand' && !stagehandAvailable() ? 'stock' : previewId; if (requested !== 'stock') await engine.activateAdapter(requested, RELEASE_MANIFEST_BY_ID.get(requested)!.adapter.recommendedScale); activeId = requested; await engine.replaceConversationState(currentWorkspace().runtimeMessages); syncUi(requested); restoreWorkspace(); await updateStorage(); }
  catch (error) { reportError(error, 'The local runtime could not finish loading. Check System for the browser requirement, then retry.'); ui.loadModel.disabled = false; }
});
ui.generate.addEventListener('click', async () => { if (generationActive) { await engine.stopGeneration(); return; } const query = ui.prompt.value.trim(); if (!query) return; ui.prompt.value = ''; ui.prompt.style.height = 'auto'; if (compareMode && activeId !== 'stock') { appendMessage('user', query); await runComparison(query); return; } appendMessage('user', query); if (activeId === 'weather-radio') await runWeather(query); else if (activeId === 'stagehand') await runStagehand(query); else await runBase(query); });
ui.stop.addEventListener('click', () => void engine.stopGeneration());
ui.compareToggle.addEventListener('click', () => { if (activeId === 'stock' || !ready()) return; compareMode = !compareMode; ui.compareToggle.setAttribute('aria-pressed', String(compareMode)); ui.compareToggle.textContent = compareMode ? 'Cancel compare' : 'Compare'; ui.prompt.placeholder = promptPlaceholder(activeId, compareMode); ui.prompt.focus(); });
ui.shelfToggle.addEventListener('click', () => setShelfExpanded(!shelfExpanded));
ui.sceneToggle.addEventListener('click', () => setSceneOpen(!sceneOpen));
ui.releaseCartridges.forEach((button) => button.addEventListener('click', () => { const id = button.dataset.releaseId as ActiveId; if (ready()) void switchCartridge(id); else previewCartridge(CARTRIDGE_BY_ID.get(id)!); }));
ui.prompt.addEventListener('input', () => { currentWorkspace().draft = ui.prompt.value; });
ui.prompt.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); ui.generate.click(); } });
ui.clearConversation.addEventListener('click', async () => { if (!window.confirm(`Clear the ${currentCartridge().name} workspace?`)) return; await engine.clearConversationState(); workspaces.set(activeId, { visibleMessages: [], runtimeMessages: [], draft: '', scrollTop: 0, scene: initialStagehandScene() }); restoreWorkspace(); });
ui.exportSession.addEventListener('click', () => { saveWorkspace(); const payload = { schemaVersion: 1, cartridgeId: activeId, messages: currentWorkspace().visibleMessages, scene: activeId === 'stagehand' ? currentScene() : undefined }; const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = `model-cartridge-${activeId}.json`; link.click(); URL.revokeObjectURL(url); appendMessage('system', 'This workspace was downloaded as JSON. Nothing was uploaded.', false); });
ui.importSession.addEventListener('click', () => ui.sessionFile.click());
ui.sessionFile.addEventListener('change', async () => { const file = ui.sessionFile.files?.[0]; if (!file) return; try { const data = JSON.parse(await file.text()) as { cartridgeId?: string; messages?: ConversationMessage[]; scene?: StagehandScene }; if (data.cartridgeId !== activeId || !Array.isArray(data.messages)) throw new Error('This file belongs to a different cartridge or is invalid.'); currentWorkspace().visibleMessages = data.messages.filter((message) => (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string'); if (activeId === 'stagehand' && data.scene) currentWorkspace().scene = data.scene; restoreWorkspace(); } catch (error) { reportError(error, 'That workspace file could not be imported.'); } finally { ui.sessionFile.value = ''; } });
ui.clearStorage.addEventListener('click', async () => { if (!window.confirm('Clear the stored model cache?')) return; await engine.clearLocalArtifacts(); await updateStorage(); ui.adapterMessage.textContent = 'Stored model cache cleared. The current runtime remains loaded.'; });
ui.settingsToggle.addEventListener('click', () => { const open = ui.generationSettings.hidden; ui.generationSettings.hidden = !open; ui.settingsToggle.setAttribute('aria-expanded', String(open)); });
let drawerOpener: HTMLElement | null = null;
function setDrawer(open: boolean): void { if (open) drawerOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null; ui.systemDrawer.classList.toggle('is-open', open); ui.systemDrawer.setAttribute('aria-hidden', String(!open)); ui.systemToggle.setAttribute('aria-expanded', String(open)); ui.drawerScrim.hidden = !open; if (open) ui.systemClose.focus(); else drawerOpener?.focus(); }
ui.systemToggle.addEventListener('click', () => setDrawer(true)); ui.systemClose.addEventListener('click', () => setDrawer(false)); ui.drawerScrim.addEventListener('click', () => setDrawer(false)); window.addEventListener('keydown', (event) => { if (event.key === 'Escape' && ui.systemDrawer.classList.contains('is-open')) { event.preventDefault(); setDrawer(false); } }); ui.clearLog.addEventListener('click', () => ui.log.replaceChildren()); window.addEventListener('beforeunload', () => void engine.dispose());

async function start(): Promise<void> { document.title = `${APP_NAME} · MacCrate.ai`; setShelfExpanded(false); log('info', `Console started with local wllama ${WLLAMA_VERSION}.`); syncUi('stock'); restoreWorkspace(); renderCapabilities(await engine.detectCapabilities()); await updateStorage(); }
void start().catch(reportError);
