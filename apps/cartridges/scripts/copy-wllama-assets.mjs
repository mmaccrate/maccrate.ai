import { copyFile, access, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const candidates = [
  resolve(root, 'node_modules/@wllama/wllama/src/wasm/wllama.wasm'),
  resolve(root, '../../node_modules/@wllama/wllama/src/wasm/wllama.wasm'),
];
let source;
for (const candidate of candidates) {
  try {
    await access(candidate);
    source = candidate;
    break;
  } catch {
    // npm workspaces may hoist the dependency to the monorepo root.
  }
}
if (!source) throw new Error(`Could not find wllama.wasm in: ${candidates.join(', ')}`);

const destination = resolve(root, 'public/wasm/wllama.wasm');
await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);
console.log(`Copied wllama runtime to ${destination}`);
