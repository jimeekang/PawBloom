// The harness runs real component handlers and hooks with deterministic effects and mocked child UI.
export {};
declare const require: any;
declare const process: { cwd(): string };
const assert = require("node:assert/strict");
const { load, Renderer, find, components, flush } = require(`${process.cwd()}/scripts/react-hook-harness.cjs`);
let mutationNumber = 0;
const { DiaryEntryScreen } = load(`${process.cwd()}/apps/mobile/src/contexts/diary/ui/DiaryEntryScreen.tsx`, {
  DiaryCalendar: components, DiaryEntryList: components, TimePickerField: components,
  DiaryCategoryPicker: components, DiaryConditionScore: components, DiaryPhotoSection: components,
  uuid: { createUuid: () => `mutation-test-${++mutationNumber}` },
});
const detail = { category: "food", meals: { breakfast: { offeredGrams: "50", eatenGrams: "35" } }, appetite: "low" };
function setup(entries: any[] = []) {
  const updates: any[] = [], creates: any[] = [];
  const props = { petId: "mochi", selectedDateKey: "2026-09-05", entries, petSpecies: "dog", filter: "day", canCreate: true, canUpdate: true,
    onDateChange: () => {}, onFilterChange: () => {}, onDelete: async () => true,
    onSave: async (draft: any) => { creates.push(draft); return "saved"; },
    onUpdate: async (draft: any) => { updates.push(draft); },
  };
  const screen = new Renderer(DiaryEntryScreen, props);
  const node = (name: string) => find(screen.tree, name)?.props;
  screen.render();
  const save = async () => { node("DiaryEntryActions").onSave(); await flush(); screen.render(); };
  return { screen, props, node, save, updates, creates };
}
const record = (category = "food", fields: any = detail) => ({ id: category, petId: "mochi", category, detail: fields, summary: "", origin: "diary", entryDate: "2026-09-05", occurredAt: "08:15" });

const test = setup();
test.node("DiaryDetailPanel").onChange(detail); test.screen.render();
await test.save(); await test.save();
assert.equal(test.creates.length, 1, "repeated save before list refresh must not create twice");
assert.equal(test.updates.length, 0);
assert.equal(test.node("DiaryEntryActions").saveBlockedByState, true);
test.props.entries = [record()]; test.screen.render(); await test.save();
assert.equal(test.updates.length, 0, "hidden defaults must never overwrite a saved record");
test.node("DiaryCategoryPicker").onSelect("food"); test.screen.render();
assert.deepEqual(test.node("DiaryDetailPanel").detail, detail);
await test.save(); assert.equal(test.updates.length, 0, "unchanged reopen must not save");
test.node("DiaryDetailPanel").onChange({ ...detail, appetite: "good" }); test.screen.render(); await test.save();
assert.deepEqual(test.updates[0].detail.meals, detail.meals);

for (const [category, fields] of Object.entries({ food: detail, water: { category: "water", amountMl: "250", intakeLevel: "less" },
  walk: { category: "walk", durationMinutes: "30", symptomNote: "limp" }, stool: { category: "stool", count: "2", hasBloodOrMucus: true },
  condition: { category: "condition", energyLevel: "less", discomfortNote: "resting" } })) {
  const current = setup([{ ...record(category, fields), conditionScore: 2 }]);
  current.node("DiaryCategoryPicker").onSelect(category); current.screen.render();
  assert.deepEqual(current.node("DiaryDetailPanel").detail, fields);
  await current.save(); assert.equal(current.updates.length, 0);
  if (category === "condition") assert.equal(current.node("DiaryConditionScore").value, 2);
  current.node("TimePickerField").onChange("09:10"); current.screen.render(); await current.save();
  assert.equal(current.updates[0].occurredTime, "09:10");
  assert.deepEqual(current.updates[0].detail, fields);
}

const editing = setup([record()]);
editing.node("DiaryEntryList").onEntryPress(record()); editing.screen.render();
editing.node("DiaryCategoryPicker").onSelect("water"); editing.screen.render();
assert.equal(editing.node("DiaryCategoryPicker").selected, "food", "explicit editing locks category");
editing.props.petId = "luna"; editing.screen.render();
assert.equal(editing.node("DiaryEntryActions").editing, false);
assert.notDeepEqual(editing.node("DiaryDetailPanel").detail, detail);

const fail = setup(); let attempts = 0;
fail.props.onSave = async (draft: any) => { fail.creates.push(draft); if (++attempts === 1) throw new Error("network"); return "saved"; };
fail.node("DiaryDetailPanel").onChange(detail); fail.screen.render(); await fail.save();
assert.deepEqual(fail.node("DiaryDetailPanel").detail, detail); await fail.save();
assert.equal(fail.creates[0].clientMutationId, fail.creates[1].clientMutationId);

const delayed = setup(); let finish: (value: string) => void = () => {};
delayed.props.onSave = () => new Promise(resolve => { finish = resolve; });
delayed.node("DiaryDetailPanel").onChange(detail); delayed.screen.render(); delayed.node("DiaryEntryActions").onSave();
delayed.props.selectedDateKey = "2026-09-04"; delayed.screen.render(); finish("saved"); await flush(); delayed.screen.render();
assert.notDeepEqual(delayed.node("DiaryDetailPanel").detail, detail, "late success must not modify the new date");

const checklist = setup([{ ...record(), origin: "checklist", detail: undefined }]);
checklist.node("DiaryDetailPanel").onChange(detail); checklist.screen.render(); await checklist.save();
assert.equal(checklist.creates.length, 0); assert.equal(checklist.updates[0].origin, "diary");
const readonly = setup([record()]); readonly.props.canUpdate = false; readonly.screen.render();
readonly.node("DiaryDetailPanel").onChange({ ...detail, appetite: "good" }); readonly.screen.render(); await readonly.save();
assert.equal(readonly.updates.length, 0);

const memo = setup(); memo.node("DiaryCategoryPicker").onSelect("memo"); memo.screen.render();
for (const value of ["first", "second"]) { memo.node("TextInput").onChangeText(value); memo.screen.render(); await memo.save(); }
assert.equal(memo.creates.length, 2, "memo remains appendable");
const categoryRace = setup(); let resolveCategory: (value: string) => void = () => {};
categoryRace.props.onSave = () => new Promise(resolve => { resolveCategory = resolve; });
categoryRace.node("DiaryDetailPanel").onChange(detail); categoryRace.screen.render(); categoryRace.node("DiaryEntryActions").onSave();
categoryRace.node("DiaryCategoryPicker").onSelect("water"); categoryRace.screen.render();
resolveCategory("saved"); await flush(); categoryRace.screen.render();
assert.equal(categoryRace.node("DiaryDetailPanel").category, "water", "old success cannot replace the next category");
const refresh = setup(); refresh.props.entries = [record()]; refresh.screen.render();
assert.deepEqual(refresh.node("DiaryDetailPanel").detail, detail, "initial delayed query hydrates saved data");
const photos = setup(); photos.node("DiaryCategoryPicker").onSelect("photo"); photos.screen.render();
for (const uri of ["file:///first.jpg", "file:///second.jpg"]) {
  photos.node("DiaryPhotoSection").onChange([{ uri }]); photos.screen.render(); await photos.save();
}
assert.equal(photos.creates.length, 2, "photo remains appendable");
const week = setup([{ ...record(), entryDate: "2026-09-04" }]);
week.node("DiaryEntryList").onEntryPress(week.props.entries[0]); week.screen.render();
week.node("DiaryDetailPanel").onChange({ ...detail, appetite: "good" }); week.screen.render(); await week.save();
assert.equal(week.updates[0].entryDate, "2026-09-04");
week.node("DiaryCategoryPicker").onSelect("water"); week.screen.render();
week.node("DiaryCategoryPicker").onSelect("food"); week.screen.render();
assert.notDeepEqual(week.node("DiaryDetailPanel").detail.meals, detail.meals, "week edits must not seed another date's draft");
const RealDate = Date; let now = new RealDate(2026, 8, 5, 9, 0).valueOf();
globalThis.Date = new Proxy(RealDate, { construct: (target, args) => args.length ? Reflect.construct(target, args) : new RealDate(now) });
try {
  const retry = setup(); let attempt = 0;
  retry.props.onSave = async (draft: any) => { retry.creates.push(draft); if (++attempt === 1) throw new Error("network"); return "saved"; };
  retry.screen.render(); await retry.save(); now += 120000; await retry.save();
  assert.equal(retry.creates[0].occurredAt, retry.creates[1].occurredAt, "retry must preserve the original minute");
  assert.equal(retry.creates[0].clientMutationId, retry.creates[1].clientMutationId);
} finally { globalThis.Date = RealDate; }
const removed = setup([record()]);
removed.props.onDelete = async () => { removed.props.entries = []; return true; };
removed.screen.render(); removed.node("DiaryEntryList").onEntryPress(record()); removed.screen.render();
removed.node("DiaryEntryActions").onDelete(); await flush(); removed.screen.render();
removed.node("DiaryCategoryPicker").onSelect("food"); removed.screen.render();
assert.deepEqual(removed.node("DiaryDetailPanel").detail.meals, {}, "a deleted record must not remain as a fresh draft");
console.log("Diary handler regressions: preserved payloads, repeat save, categories, scope, failure, permissions, memo PASS");
