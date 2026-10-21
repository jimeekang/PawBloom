const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '../..');
process.chdir(root);
const files = fs.readdirSync(__dirname).sort();
function run(command, args) {
  const result = cp.spawnSync(command, args, { stdio: 'inherit', env: process.env });
  if (result.error) { console.error(result.error); process.exit(1); }
  if (result.status !== 0) process.exit(result.status || 1);
}
for (const file of files.filter((f) => f.endsWith('.sql'))) {
  console.log(`SQL: ${file}`);
  run(process.env.PSQL || 'psql', [process.env.SUPABASE_DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres', '-X', '-v', 'ON_ERROR_STOP=1', '-f', path.join(__dirname, file)]);
}
for (const file of files.filter((f) => f.endsWith('.sh'))) {
  console.log(`Shell: ${file}`);
  run('bash', [path.join(__dirname, file)]);
}
// Reuse the installed TypeScript compiler; no runtime dependency is added.
const ts = require('../../apps/mobile/node_modules/typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
Promise.resolve(require('./resource_cleanup_worker.test.ts').default).then(() => {
  console.log(`${files.filter((f) => f.endsWith('.sql')).length} SQL files, ${files.filter((f) => f.endsWith('.sh')).length} shell files, and resource cleanup worker passed.`);
}).catch((error) => { console.error(error); process.exitCode = 1; });
