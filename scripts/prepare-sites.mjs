import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('dist/server', { recursive: true });
await writeFile('dist/server/index.js', `export default {\n  async fetch(request, env) {\n    if (env.ASSETS) return env.ASSETS.fetch(request);\n    return new Response('Homies Proshop Assistant', { status: 200 });\n  }\n};\n`);
