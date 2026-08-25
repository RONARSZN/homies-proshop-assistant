import { mkdir, readdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

await mkdir('dist/client', { recursive: true });
for (const entry of await readdir('dist')) {
  if (entry === '.openai' || entry === 'client' || entry === 'server') continue;
  await rename(join('dist', entry), join('dist/client', entry));
}
await mkdir('dist/server', { recursive: true });
await writeFile('dist/server/index.js', `export default {\n  async fetch(request, env) {\n    if (env.ASSETS) return env.ASSETS.fetch(request);\n    return new Response('Homies Proshop Assistant', { status: 200 });\n  }\n};\n`);
