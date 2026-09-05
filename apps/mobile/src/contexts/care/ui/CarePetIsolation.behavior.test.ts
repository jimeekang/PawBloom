export {};
declare const require: any;
declare const process: { cwd(): string };
const assert = require("node:assert/strict");
const { load, Renderer } = require(`${process.cwd()}/scripts/react-hook-harness.cjs`);
const queries: any[] = [], mutations: any[] = [];
const remote = { conditions: [], plans: [], schedules: [{ id: "remote-schedule" }] };
const { useCareSetupState } = load(`${process.cwd()}/apps/mobile/src/contexts/care/ui/useCareSetupState.ts`, {
  carePlanRecords: {
    useActiveCareSetup: (pet: string, user: string) => { queries.push([pet, user]); return { data: remote }; },
    useCreateCareSetup: (pet: string, user: string) => ({ mutateAsync: async (input: unknown) => { mutations.push([pet, user, input]); return remote; } }),
  },
});
const props = { activePetId: "mochi", databaseMode: false, livePetId: null as string | null, userId: null as string | null, onNotice: () => {}, onSaved: () => {} };
const hook = new Renderer(useCareSetupState, props);
hook.render();
const input = (medicationName: string) => ({ conditionName: "", planTitle: "", medicationName, dosageLabel: "1 tablet", localTimes: ["08:00"], startsOn: "2026-09-05" });
await hook.tree.saveCareSetup(input("Mochi course")); hook.render();
const mochi = hook.tree.activeCareSetup;
props.activePetId = "luna"; hook.render();
assert.deepEqual(hook.tree.activeCareSetup, { conditions: [], plans: [], schedules: [] });
await hook.tree.saveCareSetup(input("Luna course")); hook.render();
const luna = hook.tree.activeCareSetup;
props.activePetId = "mochi"; hook.render(); assert.deepEqual(hook.tree.activeCareSetup, mochi);
props.activePetId = "luna"; hook.render(); assert.deepEqual(hook.tree.activeCareSetup, luna);
assert.equal(mutations.length, 0, "preview saves must not hit remote mutations");
// Two calls using the same rendered closure must compose, not overwrite each other's plans.
await hook.tree.saveCareSetup({ ...input(""), conditionName: "First condition", planTitle: "First plan" });
await hook.tree.saveCareSetup({ ...input(""), conditionName: "Second condition", planTitle: "Second plan" });
hook.render();
assert.equal(hook.tree.activeCareSetup.plans.length, 2);
assert.equal(hook.tree.activeCareSetup.schedules[0].medicationName, "Luna course");
props.activePetId = "mochi"; hook.render(); assert.deepEqual(hook.tree.activeCareSetup, mochi);
props.databaseMode = true; props.userId = "account"; props.livePetId = "remote-pet"; hook.render();
assert.deepEqual(hook.tree.activeCareSetup, remote);
await hook.tree.saveCareSetup(input("Remote course"));
assert.deepEqual(mutations[0].slice(0, 2), ["remote-pet", "account"]);
assert.deepEqual(queries.at(-1), ["remote-pet", "account"]);
const restarted = new Renderer(useCareSetupState, { ...props, databaseMode: false, userId: null, livePetId: null });
restarted.render(); assert.equal(restarted.tree.activeCareSetup.schedules.length, 0);
console.log("Care isolation: A/B/A, separate plans/schedules, consecutive saves, remote scope, preview restart PASS");
