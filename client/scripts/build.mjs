import { build } from 'esbuild';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const output = join(process.cwd(), 'dist');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

await Promise.all([
  build({
    entryPoints: ['src/main.ts'],
    outfile: join(output, 'main.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    external: ['electron'],
  }),
  copyFile('src/index.html', join(output, 'index.html')),
  copyFile('src/styles.css', join(output, 'styles.css')),
]);
