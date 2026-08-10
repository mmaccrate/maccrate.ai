export type CartridgeId = 'weather-radio' | 'stagehand' | 'stock';
export type CartridgeStatus =
  | 'unavailable'
  | 'local-artifact-missing'
  | 'training'
  | 'trained'
  | 'converted'
  | 'evaluated'
  | 'release-candidate';
export type CartridgeUiMode = 'weather' | 'scene' | 'chat';

export interface StarterAction {
  label: string;
  prompt: string;
  recommended?: boolean;
}

export interface ReleaseCartridge {
  id: CartridgeId;
  name: string;
  version: string;
  serial: string;
  baseModelId: 'qwen3.5-2b-q4km';
  shortDescription: string;
  accent: string;
  labelTheme: string;
  whatToTry: string;
  starterActions: readonly StarterAction[];
  emptyState: { title: string; explanation: string; howItWorks: string; primaryAction: string };
  runtimeInstruction: string;
  adapterManifest: string | null;
  contextBudget: { maxContextTokens: number; maxInputTokens: number; maxOutputTokens: number };
  uiMode: CartridgeUiMode;
  comparisonExample: string;
  status: CartridgeStatus;
  evaluationSummary: string;
  artifactRepository: string | null;
}

export const RELEASE_CARTRIDGES: readonly ReleaseCartridge[] = [
  {
    id: 'stock', name: 'Base Console', version: '1.0.0', serial: 'BASE-000', baseModelId: 'qwen3.5-2b-q4km',
    shortDescription: 'The shared base model.', accent: '#77736c', labelTheme: 'factory-neutral',
    whatToTry: 'Ask the same question before and after inserting a cartridge.',
    starterActions: [{ label: 'Try a simple question', prompt: 'What are the three primary colors?', recommended: true }],
    emptyState: { title: 'Base Console', explanation: 'Chat with the shared Qwen3.5 model without an adapter.', howItWorks: 'This is the baseline: the same model used by the two cartridges, with no specialized behavior inserted.', primaryAction: 'Use Base Console' },
    runtimeInstruction: '', adapterManifest: null,
    contextBudget: { maxContextTokens: 4096, maxInputTokens: 1500, maxOutputTokens: 384 }, uiMode: 'chat',
    comparisonExample: 'What are the three primary colors?', status: 'release-candidate', evaluationSummary: 'Frozen Qwen3.5 2B baseline. The base remains available while cartridges are switched on and off.',
    artifactRepository: null,
  },
  {
    id: 'weather-radio', name: 'Weather Radio', version: '0.1.0', serial: 'CART-001', baseModelId: 'qwen3.5-2b-q4km',
    shortDescription: 'Ask practical questions using current Open-Meteo forecasts.', accent: '#527e9e', labelTheme: 'portable-weather-band',
    whatToTry: 'Ask about clothes, rain, or a short trip forecast.',
    starterActions: [
      { label: 'What should I wear today?', prompt: 'What should I wear today in Washington, DC?', recommended: true },
      { label: 'Will I need an umbrella?', prompt: 'Will I need an umbrella tomorrow in Washington, DC?' },
      { label: 'Plan around rain', prompt: 'Plan around rain this weekend in Washington, DC.' },
      { label: 'Three-day forecast', prompt: 'Give me a three-day travel forecast for Washington, DC.' },
    ],
    emptyState: { title: 'Weather Radio', explanation: 'Ask a practical weather question and receive a current forecast.', howItWorks: 'The cartridge turns natural language into a bounded request, then the browser checks Open-Meteo before answering.', primaryAction: 'Check the weather' },
    runtimeInstruction: 'Emit only the validated weather request before data. Never state current weather until normalized tool data is supplied.',
    adapterManifest: '.local-artifacts/manifests/weather-radio.json',
    contextBudget: { maxContextTokens: 4096, maxInputTokens: 1200, maxOutputTokens: 300 }, uiMode: 'weather',
    comparisonExample: 'Will I need an umbrella tomorrow in Washington, DC?', status: 'release-candidate', evaluationSummary: 'Grounded forecast cartridge with current Open-Meteo data and a deterministic summary fallback.',
    artifactRepository: 'mmaccrate/model-cartidges',
  },
  {
    id: 'stagehand', name: 'Stagehand', version: '0.1.0', serial: 'CART-002', baseModelId: 'qwen3.5-2b-q4km',
    shortDescription: 'Edit one authored broadcast scene with natural language.', accent: '#b46f42', labelTheme: 'late-night-broadcast',
    whatToTry: 'Change a color, hide an element, resize the panel, or ask what the scene supports.',
    starterActions: [
      { label: 'Make the title amber', prompt: 'Make the title amber.', recommended: true },
      { label: 'Hide the grain', prompt: 'Hide the grain.' },
      { label: 'Show spotlight A', prompt: 'Show spotlight A and make it blue.' },
      { label: 'Make the waveform transparent', prompt: 'Make the waveform more transparent.' },
      { label: 'Reset the scene', prompt: 'Reset the scene.' },
      { label: 'What can I edit?', prompt: 'What can I edit?' },
    ],
    emptyState: { title: 'Stagehand', explanation: 'Direct a finite authored scene with plain-language edits.', howItWorks: 'Stagehand can change existing scene objects. It cannot create new assets or silently guess an ambiguous request.', primaryAction: 'Open Stagehand' },
    runtimeInstruction: 'Return only the strict Stagehand scene contract. Only validated apply responses may mutate the scene.',
    adapterManifest: '.local-artifacts/manifests/stagehand.json',
    contextBudget: { maxContextTokens: 2048, maxInputTokens: 1200, maxOutputTokens: 300 }, uiMode: 'scene',
    comparisonExample: 'Make the title amber.', status: 'release-candidate', evaluationSummary: 'Trained adapter evaluated at 172/196 product passes (87.8%); browser GGUF is hash-pinned and hosted in the release repository.',
    artifactRepository: 'mmaccrate/model-cartidges',
  },
] as const;

export const CARTRIDGE_BY_ID = new Map(RELEASE_CARTRIDGES.map((cartridge) => [cartridge.id, cartridge]));
