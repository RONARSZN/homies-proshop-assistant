import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const required = ['SUPABASE_DB_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missing = required.filter(name => !process.env[name]);
if (missing.length) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

const backupRoot = resolve(process.env.BACKUP_ROOT || join(process.env.TEMP || '.', 'homies-proshop-backups'));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputDir = join(backupRoot, stamp);
await mkdir(outputDir, { recursive: true });

const cli = process.env.SUPABASE_CLI || 'npx';
const cliArgs = cli === 'npx' ? ['--yes', 'supabase@latest', 'db', 'dump'] : ['db', 'dump'];
const dump = async (name, extra = []) => {
  const args = [...cliArgs, '--db-url', process.env.SUPABASE_DB_URL, '-f', join(outputDir, name), ...extra];
  await execFileAsync(cli, args, { windowsHide: true, maxBuffer: 1024 * 1024 * 8 });
};

await dump('schema.sql');
await dump('data.sql', ['--data-only', '--use-copy']);
await dump('roles.sql', ['--role-only']);

const apiHeaders = {
  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
};
const api = (path, options = {}) => fetch(`${process.env.SUPABASE_URL}${path}`, { ...options, headers: { ...apiHeaders, ...options.headers } });
const storageDir = join(outputDir, 'storage');
await mkdir(storageDir, { recursive: true });
const storageObjects = [];

for (const bucket of ['avatars', 'product-photos']) {
  const response = await api(`/storage/v1/object/list/${bucket}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prefix: '', limit: 1000, offset: 0, sortBy: { column: 'name', order: 'asc' } }),
  });
  if (!response.ok) throw new Error(`Storage listing failed for ${bucket}: ${response.status}`);
  const objects = await response.json();
  for (const object of objects) {
    if (!object.name || object.id === null) continue;
    const safeName = object.name.replaceAll('/', '__');
    const filePath = join(storageDir, bucket, safeName);
    await mkdir(dirname(filePath), { recursive: true });
    const download = await api(`/storage/v1/object/${bucket}/${object.name.split('/').map(encodeURIComponent).join('/')}`);
    if (!download.ok || !download.body) throw new Error(`Storage download failed for ${bucket}/${object.name}: ${download.status}`);
    await pipeline(download.body, createWriteStream(filePath));
    storageObjects.push({ bucket, name: object.name, path: filePath.slice(outputDir.length + 1) });
  }
}

const rowCounts = {};
for (const table of ['products', 'sales', 'sale_items', 'profiles', 'reservations', 'stock_movements']) {
  const response = await api(`/rest/v1/${table}?select=id`, { headers: { Prefer: 'count=exact', Range: '0-0' } });
  if (!response.ok) throw new Error(`Row count failed for ${table}: ${response.status}`);
  const range = response.headers.get('content-range') || '*/0';
  rowCounts[table] = Number(range.split('/')[1] || 0);
}

const files = [];
const walk = async dir => {
  for (const entry of await (await import('node:fs/promises')).readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else {
      const hash = createHash('sha256');
      await pipeline(createReadStream(path), hash);
      files.push({ path: path.slice(outputDir.length + 1), bytes: (await stat(path)).size, sha256: hash.digest('hex') });
    }
  }
};
await walk(outputDir);
const manifest = {
  createdAt: new Date().toISOString(),
  outputDir,
  files,
  databaseRowCounts: rowCounts,
  storageObjectCount: storageObjects.length,
  storageObjects: storageObjects.map(({ bucket, name, path }) => ({ bucket, name, path })),
  restoreTest: 'Not run by this wrapper. Restore schema.sql, roles.sql, and data.sql into disposable local Postgres/Supabase and record the result here.',
};
await writeFile(join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ outputDir, databaseRowCounts: rowCounts, storageObjectCount: storageObjects.length, fileCount: files.length }, null, 2));
