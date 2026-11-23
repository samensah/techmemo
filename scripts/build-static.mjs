// Publish only the browser prototype; keep the optional local API out of the output.
import { cp, mkdir, mkdtemp, rename, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist');
await mkdir(output, { recursive: true });
const staging = await mkdtemp(path.join(root, '.static-build-'));
try {
  for (const item of ['index.html', 'workspace.html', 'assets']) {
    await cp(path.join(root, item), path.join(staging, item), { recursive: true });
  }
  await rm(output, { recursive: true, force: true });
  await rename(staging, output);
} finally {
  await rm(staging, { recursive: true, force: true });
}
console.log('Static prototype built in dist/');
