import { build } from 'esbuild';

const bakedGroqKey = (process.env.GROQ_API_KEY || '').trim();
const bakedBaseUrl = (process.env.OPENAI_BASE_URL || 'https://api.groq.com/openai/v1').trim();

const define = {
  'process.env.GROQ_API_KEY': JSON.stringify(bakedGroqKey),
  'process.env.OPENAI_BASE_URL': JSON.stringify(bakedBaseUrl),
};

await build({
  entryPoints: ['src/electron/main.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  external: ['electron', 'node-pty', 'electron-updater', 'ai', '@ai-sdk/openai'],
  outfile: 'dist-electron/main.mjs',
  define,
});

await build({
  entryPoints: ['src/electron/preload.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['electron'],
  outfile: 'dist-electron/preload.js',
});
