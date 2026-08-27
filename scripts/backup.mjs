import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { cp, mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const backupMode = process.env.BACKUP_MODE || 'full';
if (!['full', 'api'].includes(backupMode)) throw new Error('BACKUP_MODE must be full or api.');
const rawSupabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseUrl = /^https?:\/\//i.test(rawSupabaseUrl)
  ? rawSupabaseUrl.replace(/\/$/, '')
  : /^[a-z0-9]{20}$/i.test(rawSupabaseUrl)
    ? `https://${rawSupabaseUrl}.supabase.co`
    : '';
const required = ['SUPABASE_SERVICE_ROLE_KEY', ...(backupMode === 'full' ? ['SUPABASE_DB_URL'] : [])];
const missing = required.filter(name => !process.env[name]);
if (!supabaseUrl) missing.push('SUPABASE_URL or VITE_SUPABASE_URL');
if (missing.length) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

const backupRoot = resolve(process.env.BACKUP_ROOT || join(process.env.TEMP || '.', 'homies-proshop-backups'));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputDir = join(backupRoot, stamp);
await mkdir(outputDir, { recursive: true });

const windowsNpxCli = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js');
const cli = process.env.SUPABASE_CLI || (process.platform === 'win32' ? process.execPath : 'npx');
const cliArgs = process.env.SUPABASE_CLI
  ? ['db', 'dump']
  : process.platform === 'win32'
    ? [windowsNpxCli, '--yes', 'supabase@latest', 'db', 'dump']
    : ['--yes', 'supabase@latest', 'db', 'dump'];
const dump = async (name, extra = []) => {
  const args = [...cliArgs, '--db-url', process.env.SUPABASE_DB_URL, '-f', join(outputDir, name), ...extra];
  try {
    await execFileAsync(cli, args, { windowsHide: true, maxBuffer: 1024 * 1024 * 8 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const safeDetail = detail
      .replaceAll(process.env.SUPABASE_DB_URL, '[database URL redacted]')
      .replaceAll(process.env.SUPABASE_SERVICE_ROLE_KEY, '[service key redacted]');
    throw new Error(`Database dump failed for ${name}: ${safeDetail}`);
  }
};

if (backupMode === 'full') {
  await dump('schema.sql');
  await dump('data.sql', ['--data-only', '--use-copy']);
  await dump('roles.sql', ['--role-only']);
}

const apiHeaders = {
  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
};
const api = (path, options = {}) => fetch(`${supabaseUrl}${path}`, { ...options, headers: { ...apiHeaders, ...options.headers } });
const tables = ['categories', 'products', 'profiles', 'sales', 'sale_items', 'sale_payments', 'stock_movements', 'team_riders', 'rider_allocations', 'reservations', 'reservation_items'];
const rowCounts = {};

if (backupMode === 'api') {
  const dataDir = join(outputDir, 'data');
  await mkdir(dataDir, { recursive: true });
  await cp(resolve('supabase', 'migrations'), join(outputDir, 'migrations'), { recursive: true });

  for (const table of tables) {
    const rows = [];
    for (let offset = 0; ; offset += 1000) {
      const response = await api(`/rest/v1/${table}?select=*&order=id.asc`, { headers: { Range: `${offset}-${offset + 999}` } });
      if (!response.ok) throw new Error(`Data export failed for ${table}: ${response.status}`);
      const page = await response.json();
      rows.push(...page);
      if (page.length < 1000) break;
    }
    rowCounts[table] = rows.length;
    await writeFile(join(dataDir, `${table}.json`), `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
  }

  const users = await api('/auth/v1/admin/users?page=1&per_page=1000');
  if (!users.ok) throw new Error(`Auth user export failed: ${users.status}`);
  await writeFile(join(dataDir, 'auth-users.json'), `${JSON.stringify(await users.json(), null, 2)}\n`, 'utf8');
}

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

if (backupMode === 'full') {
  for (const table of tables) {
    const response = await api(`/rest/v1/${table}?select=id`, { headers: { Prefer: 'count=exact', Range: '0-0' } });
    if (!response.ok) throw new Error(`Row count failed for ${table}: ${response.status}`);
    const range = response.headers.get('content-range') || '*/0';
    rowCounts[table] = Number(range.split('/')[1] || 0);
  }
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
  backupMode,
  outputDir,
  files,
  databaseRowCounts: rowCounts,
  storageObjectCount: storageObjects.length,
  storageObjects: storageObjects.map(({ bucket, name, path }) => ({ bucket, name, path })),
  restoreTest: backupMode === 'full'
    ? 'Not run by this wrapper. Restore schema.sql, roles.sql, and data.sql into disposable local Postgres/Supabase and record the result here.'
    : 'API snapshot only. Recreate the schema from migrations, import the JSON rows in dependency order, restore Storage objects, and require password resets for recreated Auth users.',
};
await writeFile(join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ outputDir, databaseRowCounts: rowCounts, storageObjectCount: storageObjects.length, fileCount: files.length }, null, 2));
