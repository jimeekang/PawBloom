export {};
declare const require: any;
declare const process: { cwd(): string };
const assert = require("node:assert/strict");
const { load, Renderer, find, components, flush } = require(`${process.cwd()}/scripts/react-hook-harness.cjs`);
let failure: unknown = new Error("provider private details");
let calls = 0;
const mutation = { mutateAsync: async () => { calls++; if (failure) throw failure; } };
const records = {
  useTodayMedicationDoses: () => ({ data: [] }), useCreateMedicationDose: () => mutation,
  useUpdateMedicationDose: () => mutation, useDeleteMedicationDose: () => mutation, useUpdateMedicationDoseStatus: () => mutation,
};
const { useMedicationDosesController } = load(`${process.cwd()}/apps/mobile/src/contexts/medication/ui/useMedicationDosesController.ts`, {
  medicationDoseRecords: records, confirmAction: {},
});
const { QuickMedicationForm } = load(`${process.cwd()}/apps/mobile/src/contexts/medication/ui/CareMedicationPanel.tsx`, { TimePickerField: components });
const { shouldShowShellNotice } = require("../../../presentation/shell/saveFeedback");
const { translations, setRuntimeLanguage: setLanguage } = require("../../../i18n/translations");
const notices: any[] = [], saved: string[] = [];
const controller = new Renderer(useMedicationDosesController, {
  activePetId: "mochi", livePetId: "mochi", userId: "test-user", databaseMode: true,
  fallbackPetId: "mochi", language: "en", schedules: [],
  onNotice: (text: string, tone: string, source: unknown) => { if (shouldShowShellNotice(tone, source)) notices.push({ text, tone }); },
  onSaved: (kind: string) => saved.push(kind), onLocalDoseSaved: () => {}, onLocalDosesChanged: () => {},
});
controller.render();
const row = { scheduleId: "s1", medicationName: "Test dose", doseDate: "2026-09-05", scheduledTime: "08:00", status: "pending" };
for (const language of ["en", "ko"]) {
  setLanguage(language);
  for (const agenda of [row, { ...row, doseId: "existing" }]) {
    notices.length = 0;
    await controller.tree.saveAgendaStatus(agenda, "completed");
    assert.deepEqual(notices, [{ text: translations[language]["care.quickDoseSaveFailed"], tone: "error" }]);
    assert.equal(saved.length, 0);
  }
  notices.length = 0;
  await controller.tree.addMedicationDose({ ...row, status: "pending" }).catch(() => undefined);
  assert.equal(notices.length, 1, "direct schedule callers receive a visible error by default");
  failure = { code: "23505" }; notices.length = 0;
  await controller.tree.saveAgendaStatus(row, "completed");
  assert.equal(notices[0].text, translations[language]["care.quickDoseDuplicate"]);
  failure = new Error("provider private details");
}
setLanguage("en"); notices.length = 0;
let closed = 0;
const form = new Renderer(QuickMedicationForm, { onSave: controller.tree.addMedicationDose, onSaved: () => closed++ });
form.render();
function field(tree: any): any {
  if (!tree) return;
  if (Array.isArray(tree)) return tree.map(field).find(Boolean);
  if (tree.type === "TextInput" && tree.props.accessibilityLabel === translations.en["care.medicationPlaceholder"]) return tree.props;
  return field(tree.props?.children);
}
field(form.tree).onChangeText("Test dose"); form.render();
await find(form.tree, "PrimaryButton").props.onPress(); await flush(); form.render();
assert.equal(find(form.tree, "NoticeBanner").props.tone, "error");
assert.equal(find(form.tree, "NoticeBanner").props.text, translations.en["care.quickDoseSaveFailed"]);
assert.equal(notices.length, 0, "inline form must not also show a shell error");
assert.equal(closed, 0); assert.equal(field(form.tree).value, "Test dose");
assert.equal(find(form.tree, "PrimaryButton").props.disabled, false);
failure = undefined;
await find(form.tree, "PrimaryButton").props.onPress(); form.render();
assert.equal(closed, 1); assert.equal(saved.length, 1);
assert.equal(field(form.tree).value, "");
assert.ok(calls >= 10);
console.log("Medication failure delivery: first/existing/direct schedule, duplicate, EN/KO, inline retry PASS");
