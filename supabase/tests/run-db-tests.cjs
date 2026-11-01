const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '../..');
process.chdir(root);
const files = fs.readdirSync(__dirname).sort();
const fixtureVersions = { openai: '7.38.0', zod: '4.6.7' };
const originalFixtureEnv = process.env.PAWBLOOM_SDK_FIXTURE_ROOT;
const defaultFixtureRoot = path.join(root, 'supabase/.temp/sdk-fixtures');
function selectSdkFixture(candidate) {
  let stat;
  try { stat = fs.lstatSync(candidate); } catch (error) { if (error.code === 'ENOENT') return undefined; throw error; }
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('SDK fixture must be a real directory.');
  const fixture = path.resolve(candidate);
  function checkAncestors(directory) {
    for (;;) {
      const current = fs.lstatSync(directory);
      if (current.isSymbolicLink() || !current.isDirectory()) throw new Error('SDK fixture must use real directories.');
      const parent = path.dirname(directory);
      if (parent === directory) break;
      directory = parent;
    }
  }
  checkAncestors(fixture);
  for (const [name, version] of Object.entries(fixtureVersions)) {
    let manifest;
    try {
      const packageRoot = path.join(fixture, name, version);
      checkAncestors(packageRoot);
      const manifestPath = path.join(packageRoot, 'package.json');
      const manifestStat = fs.lstatSync(manifestPath);
      if (manifestStat.isSymbolicLink() || !manifestStat.isFile()) throw new Error('Unsafe SDK manifest.');
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch { throw new Error(`SDK fixture is incomplete or has the wrong version: ${name}@${version}`); }
    if (!manifest || typeof manifest !== 'object' || manifest.name !== name || manifest.version !== version) throw new Error(`SDK fixture is incomplete or has the wrong version: ${name}@${version}`);
  }
  return fixture;
}
const fixtureRoot = selectSdkFixture(originalFixtureEnv || defaultFixtureRoot);
if (fixtureRoot) {
  process.env.PAWBLOOM_SDK_FIXTURE_ROOT = fixtureRoot;
} else {
  delete process.env.PAWBLOOM_SDK_FIXTURE_ROOT;
  if (process.env.PAWBLOOM_REQUIRE_SDK_TEST === '1') {
    console.error('Required SDK test cannot run: fixture directory is absent. Run node scripts/prepare-avatar-sdk-fixture.mjs.');
    process.exit(1);
  }
}
function run(command, args) {
  const result = cp.spawnSync(command, args, { stdio: 'inherit', env: process.env });
  if (result.error) { console.error(result.error); process.exit(1); }
  if (result.status !== 0) process.exit(result.status || 1);
}
for (const file of files.filter((f) => f.endsWith('.sql') && !process.argv.includes('--unit'))) {
  console.log(`SQL: ${file}`);
  run(process.env.PSQL || 'psql', [process.env.SUPABASE_DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres', '-X', '-v', 'ON_ERROR_STOP=1', '-f', path.join(__dirname, file)]);
}
for (const file of files.filter((f) => f.endsWith('.sh') && !process.argv.includes('--unit'))) {
  console.log(`Shell: ${file}`);
  run('bash', [path.join(__dirname, file)]);
}
// Reuse the installed TypeScript compiler; no runtime dependency is added.
const ts = require('../../apps/mobile/node_modules/typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
const Module = require('node:module');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, ...rest) {
  const normalized = request.replace(/^npm:openai@7\.38\.0(?=\/|$)/, 'openai').replace(/^npm:zod(?:@4\.6\.7)?$/, 'zod');
  const dependency = fixtureRoot && Object.keys(fixtureVersions).find(name => normalized === name || normalized.startsWith(name + '/'));
  const resolved = dependency ? path.join(fixtureRoot, dependency, fixtureVersions[dependency], normalized.slice(dependency.length))
    : (request === 'npm:zod' || request === 'npm:zod@4.6.7') ? path.join(root, 'apps/mobile/node_modules/zod') : request;
  return originalResolve.call(this, resolved, parent, ...rest);
};
(async () => {
  for (const file of files.filter((f) => f.endsWith('.test.ts'))) {
    const result = await require(path.join(__dirname, file)).default;
    if (file === 'avatar_generation_sdk.test.ts' && result?.skipped && process.env.PAWBLOOM_REQUIRE_SDK_TEST === '1') {
      throw new Error('Required SDK test was skipped.');
    }
    console.log(result?.skipped ? `Unit: ${file} SKIPPED: ${result.skipped}` : `Unit: ${file} passed.`);
  }
})().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => {
  if (originalFixtureEnv === undefined) delete process.env.PAWBLOOM_SDK_FIXTURE_ROOT;
  else process.env.PAWBLOOM_SDK_FIXTURE_ROOT = originalFixtureEnv;
});
