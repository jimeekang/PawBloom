import { closeSync, existsSync, fstatSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoot = join(root, 'supabase/.temp');
const destination = join(temporaryRoot, 'sdk-fixtures');
const packages = {
  '@anthropic-ai/sdk': '1.3.0', zod: '4.6.7', '@opentelemetry/api': '1.10.0',
  standardwebhooks: '1.1.1', '@stablelib/base64': '1.0.1', 'fast-sha256': '1.3.0', 'json-schema-to-ts': '3.1.1',
};
const packagePaths = Object.entries(packages).map(([name, version]) => `${name}/${version}`);
const secretName = name => name === '.env' || name.startsWith('.env.');
function fail(message) { throw new Error(message); }
function pathExists(path) {
  try { lstatSync(path); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
function safeDirectory(path) {
  let current = resolve(path);
  for (;;) {
    const stat = lstatSync(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) fail(`Refusing a symlink or non-directory fixture ancestor: ${current}`);
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
}
function allowedPath(path) {
  return packagePaths.some(packagePath => path === packagePath || path.startsWith(`${packagePath}/`) || packagePath.startsWith(`${path}/`));
}
function validateFixture(directory) {
  safeDirectory(directory);
  function visit(path) {
    const rel = relative(directory, path).split(sep).join('/');
    if (!/^[@A-Za-z0-9_.+/-]+$/.test(rel) || !allowedPath(rel) || secretName(path.split(sep).at(-1))) fail(`Fixture contains an unexpected path: ${rel}`);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink() || !stat.isDirectory() && !stat.isFile()) fail(`Fixture contains a link or special file: ${rel}`);
    if (stat.isDirectory()) for (const entry of readdirSync(path)) visit(join(path, entry));
  }
  for (const entry of readdirSync(directory)) visit(join(directory, entry));
  for (const [name, version] of Object.entries(packages)) {
    const packageRoot = join(directory, name, version);
    let manifest;
    try { manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')); }
    catch { fail(`Fixture package manifest is missing or invalid: ${name}@${version}`); }
    if (manifest.name !== name || manifest.version !== version) fail(`Fixture package version mismatch: ${name}@${version}`);
    const entry = manifest.main ?? 'index.js';
    if (typeof entry !== 'string' || isAbsolute(entry)) fail(`Fixture entrypoint is unsafe: ${name}`);
    const entryPath = resolve(packageRoot, entry);
    if (!entryPath.startsWith(`${packageRoot}${sep}`) || !statSync(entryPath).isFile() || statSync(entryPath).size === 0) fail(`Fixture entrypoint is missing or unsafe: ${name}`);
  }
  for (const file of ['@anthropic-ai/sdk/1.3.0/helpers/zod.js', 'zod/4.6.7/v4/index.cjs']) {
    if (!statSync(join(directory, file)).isFile()) fail(`Fixture helper entrypoint is missing: ${file}`);
  }
}
function execute(command, args, label, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, ...options });
  if (result.error || result.status !== 0) fail(`${label} failed (${result.error?.code ?? result.status}). Existing fixture data was not replaced.`);
  return result.stdout?.trim() ?? '';
}
function validateArchive(archive) {
  const names = execute('tar', ['-tf', archive], 'Public package archive listing').split('\n');
  const details = execute('tar', ['-tvf', archive], 'Public package archive type listing').split('\n');
  if (names.length !== details.length || names.length > 20_000) fail('Unexpected public package archive entry count.');
  const seen = new Set();
  names.forEach((name, index) => {
    const normalized = name.replace(/\/$/, '');
    if (!/^[@A-Za-z0-9_.+/-]+$/.test(normalized) || normalized.split('/').some(part => !part || part === '.' || part === '..' || secretName(part))
      || !allowedPath(normalized) || seen.has(normalized) || !/^[-d]/.test(details[index]) || / -> | link to /.test(details[index])) fail('Refusing an unsafe or unexpected public package archive entry.');
    seen.add(normalized);
  });
}

let stage, stageIdentity, readerId, lock, lockIdentity;
try {
  safeDirectory(root);
  safeDirectory(join(root, 'supabase'));
  if (!existsSync(temporaryRoot)) mkdirSync(temporaryRoot);
  safeDirectory(temporaryRoot);
  if (pathExists(destination)) {
    validateFixture(destination);
    console.log('Avatar SDK fixture already valid; reused without changing files.');
  } else {
    const lockPath = join(temporaryRoot, '.sdk-fixture-prepare.lock');
    lock = openSync(lockPath, 'wx', 0o600); lockIdentity = fstatSync(lock);
    const configPath = join(root, 'supabase/config.toml');
    if (lstatSync(configPath).isSymbolicLink() || !lstatSync(configPath).isFile()) fail('Supabase config must be a regular file.');
    const project = readFileSync(configPath, 'utf8').match(/^project_id\s*=\s*"([A-Za-z0-9_-]+)"\s*$/m)?.[1];
    if (!project) fail('A safe project_id is required in supabase/config.toml.');
    const volume = `supabase_edge_runtime_${project}`;
    if (execute('docker', ['volume', 'inspect', '--format', '{{.Name}}', volume], 'Local Edge cache volume lookup') !== volume) fail('Local Edge cache volume is unavailable.');
    const image = execute('docker', ['inspect', '--type', 'container', '--format', '{{.Image}}', volume], 'Existing local Edge image lookup');
    if (!/^sha256:[a-f0-9]{64}$/.test(image)) fail('An existing local Edge image is required; no image will be pulled.');
    execute('docker', ['image', 'inspect', '--format', '{{.Id}}', image], 'Cached Edge image lookup');
    stage = mkdtempSync(join(temporaryRoot, '.sdk-fixture-stage-')); stageIdentity = lstatSync(stage);
    const stagingPackages = join(stage, 'packages'); mkdirSync(stagingPackages);
    const archive = join(stage, 'packages.tar');
    const quotedPaths = packagePaths.map(path => `'${path}'`).join(' ');
    const readPackages = `set -eu\ncd /sdk/npm/registry.npmjs.org\n` +
      `for part in /sdk/npm /sdk/npm/registry.npmjs.org; do test ! -L "$part"; done\n` +
      `for package in ${quotedPaths}; do\n  test -d "$package"\n  current="$package"\n  while test "$current" != .; do test ! -L "$current"; current=$(dirname "$current"); done\n  links=$(find "$package" -type l -print -quit)\n  test -z "$links"\ndone\n` +
      `tar --format=ustar --hard-dereference --exclude='.env' --exclude='.env.*' --exclude='*/.env' --exclude='*/.env.*' -cf - ${quotedPaths}`;
    const name = `pawbloom-avatar-sdk-fixture-${randomUUID()}`;
    readerId = execute('docker', ['create', '--pull=never', '--name', name, '--network', 'none', '--read-only',
      '--mount', `type=volume,src=${volume},dst=/sdk,readonly`, '--entrypoint', '/bin/sh', image, '-c', readPackages], 'Read-only public package reader creation');
    if (!/^[a-f0-9]{64}$/.test(readerId)) fail('Unexpected reader container identifier.');
    const descriptor = openSync(archive, 'wx', 0o600);
    try { execute('docker', ['start', '--attach', readerId], 'Read-only public package copy', { stdio: ['ignore', descriptor, 'pipe'] }); }
    finally { closeSync(descriptor); }
    if (execute('docker', ['wait', readerId], 'Public package reader completion') !== '0') fail('Required public packages are missing or invalid in the local Edge cache. No install, pull or serve was attempted.');
    if (statSync(archive).size > 64 * 1024 * 1024) fail('Public package archive unexpectedly exceeds 64 MiB.');
    validateArchive(archive);
    execute('tar', ['-xf', archive, '-C', stagingPackages, '--no-same-owner', '--no-same-permissions'], 'Public package extraction');
    validateFixture(stagingPackages);
    safeDirectory(temporaryRoot); safeDirectory(stage);
    try { lstatSync(destination); fail('Fixture destination appeared during preparation; refusing to replace it.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    renameSync(stagingPackages, destination);
    console.log('Avatar SDK fixture prepared in supabase/.temp/sdk-fixtures (7 exact public packages, no network).');
  }
} catch (error) {
  console.error(`Avatar SDK fixture preparation stopped: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (readerId && /^[a-f0-9]{64}$/.test(readerId)) {
    const removed = spawnSync('docker', ['rm', '--force', readerId], { encoding: 'utf8' });
    if (removed.error || removed.status !== 0) { console.error('Temporary SDK cache reader cleanup failed.'); process.exitCode = 1; }
  }
  if (stage) {
    try {
      safeDirectory(temporaryRoot);
      const current = lstatSync(stage);
      if (current.ino !== stageIdentity.ino || current.dev !== stageIdentity.dev || current.isSymbolicLink()) fail('Temporary fixture stage identity changed; not removing it.');
      rmSync(stage, { recursive: true });
    } catch (error) { console.error(error.message); process.exitCode = 1; }
  }
  if (lock !== undefined) {
    try {
      safeDirectory(temporaryRoot);
      const path = join(temporaryRoot, '.sdk-fixture-prepare.lock'), current = lstatSync(path);
      if (current.ino === lockIdentity.ino && current.dev === lockIdentity.dev && !current.isSymbolicLink()) unlinkSync(path);
      else fail('Fixture preparation lock changed; not removing it.');
    } catch (error) { console.error(error.message); process.exitCode = 1; }
    closeSync(lock);
  }
}
