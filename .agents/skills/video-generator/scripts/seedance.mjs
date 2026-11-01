#!/usr/bin/env node
// Generates a Seedance (BytePlus ModelArk) video from a first/last frame image.
// Usage: node .claude/skills/video-generator/scripts/seedance.mjs --prompt <txt> --out <mp4> (--image <png> [--last <png>] | --ref <png>[,<png>])
//        [--model <id>] [--duration 5] [--ratio 3:4] [--resolution 480p]
// --image uses the PNG as first and last frame (seamless loop); --ref passes reference
// images instead, for generating a new pose or costume to use as a first frame later.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function findRepoRoot(dir) {
  return existsSync(resolve(dir, '.env')) || dir === '/' ? dir : findRepoRoot(dirname(dir));
}

const repoRoot = findRepoRoot(dirname(fileURLToPath(import.meta.url)));

function loadEnv() {
  const env = {};
  for (const line of readFileSync(resolve(repoRoot, '.env'), 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) env[match[1]] = match[2];
  }
  return env;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) args[argv[i].replace(/^--/, '')] = argv[i + 1];
  return args;
}

const toDataUrl = (path) => `data:image/png;base64,${readFileSync(path).toString('base64')}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const env = loadEnv();
const args = parseArgs(process.argv.slice(2));
const baseUrl = env.ARK_BASE_URL;
const headers = { Authorization: `Bearer ${env.ARK_API_KEY}`, 'Content-Type': 'application/json' };

const body = {
  model: args.model ?? env.SEEDANCE_MODEL,
  content: [
    { type: 'text', text: readFileSync(args.prompt, 'utf8').trim() },
    ...(args.ref
      ? args.ref.split(',').map(path => ({
          type: 'image_url',
          image_url: { url: toDataUrl(path) },
          role: 'reference_image',
        }))
      : [
          { type: 'image_url', image_url: { url: toDataUrl(args.image) }, role: 'first_frame' },
          { type: 'image_url', image_url: { url: toDataUrl(args.last ?? args.image) }, role: 'last_frame' },
        ]),
  ],
  ...(args.ratio && { ratio: args.ratio }),
  duration: Number(args.duration ?? 5),
  resolution: args.resolution ?? '480p',
  generate_audio: false,
  watermark: false,
};

const createRes = await fetch(`${baseUrl}/contents/generations/tasks`, {
  method: 'POST',
  headers,
  body: JSON.stringify(body),
});
const created = await createRes.json();
if (!createRes.ok) {
  console.error('Create failed:', JSON.stringify(created, null, 2));
  process.exit(1);
}
console.log('Task', created.id, 'model', body.model);

let task;
for (;;) {
  await sleep(10_000);
  task = await (await fetch(`${baseUrl}/contents/generations/tasks/${created.id}`, { headers })).json();
  console.log('Status', task.status);
  if (!['queued', 'running'].includes(task.status)) break;
}
if (task.status !== 'succeeded') {
  console.error('Task failed:', JSON.stringify(task, null, 2));
  process.exit(1);
}

const video = await fetch(task.content.video_url);
writeFileSync(args.out, Buffer.from(await video.arrayBuffer()));
writeFileSync(`${args.out}.json`, JSON.stringify(task, null, 2));
console.log('Saved', args.out);
