#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const args = Object.fromEntries(process.argv.slice(2).map((part, index, all) => part.startsWith('--') ? [part.slice(2), all[index + 1]] : null).filter(Boolean));
if (!args.url || !args.out || !/^[a-f0-9]{64}$/i.test(args.sha256 ?? '')) {
  console.error('Usage: npm run artifact:sync -- --url <artifact-url> --out <relative-path> --sha256 <64-hex> [--allow-http true]');
  process.exit(2);
}
const root = resolve(process.env.CARTRIDGE_LOCAL_ARTIFACT_ROOT || '.local-artifacts');
const output = resolve(root, args.out);
if (output !== root && !output.startsWith(`${root}${sep}`)) throw new Error('Output must stay inside CARTRIDGE_LOCAL_ARTIFACT_ROOT.');
const url = new URL(args.url);
if (url.protocol !== 'https:' && args['allow-http'] !== 'true') throw new Error('Artifact URL must use HTTPS unless --allow-http true is explicit.');
await mkdir(dirname(output), { recursive: true });
const temp = `${output}.partial`;
await rm(temp, { force: true });
const response = await fetch(url, { redirect: 'follow' });
if (!response.ok || !response.body) throw new Error(`Artifact download failed: HTTP ${response.status}`);
await pipeline(Readable.fromWeb(response.body), createWriteStream(temp));
const bytes = await import('node:fs/promises').then(({ readFile }) => readFile(temp));
const actual = createHash('sha256').update(bytes).digest('hex');
if (actual !== args.sha256.toLowerCase()) {
  await rm(temp, { force: true });
  throw new Error(`SHA-256 mismatch: expected ${args.sha256}, received ${actual}`);
}
await rename(temp, output);
console.log(JSON.stringify({ output, bytes: bytes.length, sha256: actual }));
