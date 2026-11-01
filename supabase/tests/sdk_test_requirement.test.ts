import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

async function tests() {
  const original = { fixture: process.env.PAWBLOOM_SDK_FIXTURE_ROOT, required: process.env.PAWBLOOM_REQUIRE_SDK_TEST };
  const temporary = mkdtempSync(join(realpathSync(tmpdir()), "pawbloom-sdk-requirement-"));
  const runner = resolve(__dirname, "run-db-tests.cjs");
  const boundaryFile = join(temporary,"private-manifest.json"), boundaryTrace = join(temporary,"boundary-trace"), guard = join(temporary,"read-guard.cjs");
  writeFileSync(boundaryFile,JSON.stringify({name:"openai",version:"7.38.0"}));
  writeFileSync(guard,`const fs=require('node:fs'),read=fs.readFileSync;fs.readFileSync=function(file,...rest){let real;try{real=fs.realpathSync(file)}catch{}if(real===process.env.PAWBLOOM_BOUNDARY_FILE){fs.writeFileSync(process.env.PAWBLOOM_BOUNDARY_TRACE,'crossed');throw Error('Fixture boundary crossed')}return read.call(this,file,...rest)};`);
  function child(fixture: string, required: boolean, guardReads = false) {
    const result = spawnSync(process.execPath, [...(guardReads ? ["--require",guard] : []),runner,"--unit"], { encoding: "utf8", timeout: 15_000, maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env, PAWBLOOM_SDK_FIXTURE_ROOT: fixture, PAWBLOOM_REQUIRE_SDK_TEST: required ? "1" : "0", PAWBLOOM_SDK_REQUIREMENT_CHILD: "1", PAWBLOOM_BOUNDARY_FILE: boundaryFile, PAWBLOOM_BOUNDARY_TRACE: boundaryTrace } });
    assert.equal(result.error,undefined);
    const output = result.stdout + result.stderr;
    assert.equal(/MODULE_NOT_FOUND|Cannot find module/.test(output),false,"missing fixture must take the explicit SDK boundary, not fail module resolution");
    assert.equal(/^(?:SQL|Shell):/m.test(output),false,"child runner must never repeat database tests");
    return { status: result.status, output };
  }
  try {
    const missing = join(temporary,"not-created");
    const optional = child(missing,false);
    assert.equal(optional.status,0,optional.output);
    assert.match(optional.output,/Unit: avatar_generation_sdk\.test\.ts SKIPPED:/);
    assert.equal(optional.output.includes("Required SDK test cannot run"),false);
    const required = child(missing,true);
    assert.notEqual(required.status,0);
    assert.match(required.output,/Required SDK test cannot run: fixture directory is absent\./);
    const partial = join(temporary,"partial"); mkdirSync(partial);
    const incomplete = child(partial,false);
    assert.notEqual(incomplete.status,0);
    assert.match(incomplete.output,/SDK fixture is incomplete or has the wrong version/);
    const wrong = join(temporary,"wrong-version"), manifest = join(wrong,"openai/7.38.0"); mkdirSync(manifest,{recursive:true});
    writeFileSync(join(manifest,"package.json"),JSON.stringify({name:"openai",version:"0.0.0"}));
    const mismatch = child(wrong,false);
    assert.notEqual(mismatch.status,0);
    assert.match(mismatch.output,/SDK fixture is incomplete or has the wrong version/);
    const malformed = join(temporary,"malformed/openai/7.38.0"); mkdirSync(malformed,{recursive:true});
    writeFileSync(join(malformed,"package.json"),"PRIVATE_SDK_MANIFEST_CANARY invalid JSON");
    const invalidJson = child(join(temporary,"malformed"),false);
    assert.notEqual(invalidJson.status,0); assert.equal(invalidJson.output.includes("PRIVATE_SDK_MANIFEST_CANARY"),false);
    const outside = join(temporary,"outside/7.38.0"); mkdirSync(outside,{recursive:true}); symlinkSync(boundaryFile,join(outside,"package.json"));
    const parentAlias = join(temporary,"parent-alias"); symlinkSync(join(temporary,"outside"),parentAlias);
    const packageFixture = join(temporary,"package-link"); mkdirSync(packageFixture); symlinkSync(join(temporary,"outside"),join(packageFixture,"openai"));
    const manifestFixture = join(temporary,"manifest-link/openai/7.38.0"); mkdirSync(manifestFixture,{recursive:true}); symlinkSync(boundaryFile,join(manifestFixture,"package.json"));
    const rootAlias = join(temporary,"root-link"); symlinkSync(packageFixture,rootAlias);
    const parentLinkedFixture = join(parentAlias,"7.38.0");
    for (const fixture of [parentLinkedFixture,packageFixture,join(temporary,"manifest-link"),rootAlias]) {
      const rejected = child(fixture,false,true);
      assert.notEqual(rejected.status,0);
      assert.match(rejected.output,/SDK fixture must|SDK fixture is incomplete/);
      if (fixture === parentLinkedFixture) {
        assert.match(rejected.output,/SDK fixture must use real directories/);
        assert.equal(rejected.output.includes("SDK fixture is incomplete"),false,"parent links must be checked before attempting a missing manifest");
      }
      assert.equal(existsSync(boundaryTrace),false,"fixture and manifest links must be rejected before an external file read");
    }
    assert.deepEqual({ fixture: process.env.PAWBLOOM_SDK_FIXTURE_ROOT, required: process.env.PAWBLOOM_REQUIRE_SDK_TEST },original,"parent environment remains unchanged");
  } finally { rmSync(temporary,{recursive:true}); }
  console.log("SDK requirement: absent override optional SKIP/required explicit failure, incomplete/wrong-version reject; symlink boundary before reads and malformed-manifest privacy verified; child --unit only, no recursive spawn or production fixture changes.");
}
// Child probes exercise the real runner without recursively starting more probes.
export default process.env.PAWBLOOM_SDK_REQUIREMENT_CHILD === "1" ? Promise.resolve() : tests();
