import { context } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
import { join } from 'node:path';

const output = join(process.cwd(), 'dist', 'arena-preview');
await mkdir(output, { recursive: true });
await mkdir(join(output, 'assets'), { recursive: true });
await Promise.all([
  ...['arena-floor.png', 'arena-atlas.png'].map((name) => copyFile(join('src', 'assets', name), join(output, 'assets', name))),
  copyFile('dev/index.html', join(output, 'index.html')),
  copyFile('dev/preview.css', join(output, 'preview.css')),
]);
const build = await context({
  entryPoints: ['dev/arena-preview.ts'], outfile: join(output, 'preview.js'),
  bundle: true, platform: 'browser', format: 'iife', target: 'es2022', sourcemap: true,
});
await build.watch();
const { port } = await build.serve({ servedir: output, host: '127.0.0.1', port: 4173 });
console.log(`Aperçu de développement : http://127.0.0.1:${port}`);
console.log('Les touches émettent des intentions ; les boutons chargent des observations fixes.');
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void build.dispose(); });
