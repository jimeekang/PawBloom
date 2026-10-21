import { createHookHarness, findElements } from "../testHookHarness";
declare const require: (name: string) => any;
const modules = require("node:module"), original = modules._load, react = require("react");
let activeHarness = createHookHarness();
const queries: any[] = [], saves: any[] = [], waiting: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];
let defer = false;
modules._load = function(name: string, parent: unknown, main: boolean) {
  if (name === "react") return { ...react, ...Object.fromEntries(Object.keys(activeHarness.hooks).map((key) => [key, (...args: any[]) => (activeHarness.hooks as any)[key](...args)])) };
  if (name.endsWith("/languageContext")) return { useLanguage: () => ({ language: "en" }) };
  if (name.endsWith("/medicationDoseRecords")) return { useMedicationDosesByDateRange: (petId: string, from: string, to: string, userId: string) => { queries.push([petId, from, to, userId]); return { data: [{ id: "past", petId, scheduleId: "s", doseDate: from, medicationName: "Past", scheduledAt: "08:00", status: "pending" }, { id: "today", petId, doseDate: "2099-01-01", medicationName: "Wrong date", scheduledAt: "08:00", status: "pending" }], isError: false, isPending: false, refetch: async () => undefined }; } };
  return original.call(this, name, parent, main);
};
try {
  const { MedicationDestinationScreen } = require("./MedicationDestinationScreen"), { t } = require("../../i18n/translations");
  let key = "", panelHarness = createHookHarness(), cardHarness = createHookHarness(), formHarness = createHookHarness();
  const render = (petId: string, dateKey = "2026-10-19") => {
    const boundary = MedicationDestinationScreen({ petId, dateKey, scheduleId: "s", userId: "u", doses: [], careSetup: { conditions: [], plans: [], schedules: [{ id: "s", medicationId: "m", medicationName: "Past", localTime: "08:00", startsOn: "2020-01-01", recurrenceIntervalDays: 1 }] }, careStatus: "ready", onAgendaStatusChange: () => undefined,
      onAddDose: (input: any) => { saves.push({ petId, ...input }); return defer ? new Promise<void>((resolve, reject) => waiting.push({ resolve, reject })) : undefined; }, onUpdateDose: () => undefined, onDeleteDose: () => undefined, onSaveCareSetup: async () => ({ conditions: [], plans: [], schedules: [] }), onUseSchedule: () => undefined, onOpenProfileCare: () => undefined, onGenerateReport: () => undefined });
    const screen = findElements(boundary, (node) => node.type?.name === "CareModeScreen")[0];
    assert(screen.props.dateKey === dateKey && screen.props.medicationAgenda.every((row: any) => row.doseDate === dateKey && row.scheduleId === "s") && screen.props.doses.length === 1, "explicit destination date/schedule reaches actual care agenda; other date excluded");
    if (screen.key !== key) { panelHarness.unmount(); cardHarness.unmount(); formHarness.unmount(); panelHarness = createHookHarness(); cardHarness = createHookHarness(); formHarness = createHookHarness(); key = screen.key; }
    const carePanel = findElements(screen.type(screen.props), (node) => node.type?.name === "CarePanel")[0];
    activeHarness = panelHarness; let panel = panelHarness.render(() => carePanel.type(carePanel.props));
    if (!findElements(panel, (node) => node.type?.name === "CareMedicationAddCard").length) { findElements(panel, (node) => node.props?.label === t("care.addMedication"))[0].props.onPress(); panel = panelHarness.render(() => carePanel.type(carePanel.props)); }
    const card = findElements(panel, (node) => node.type?.name === "CareMedicationAddCard")[0]; activeHarness = cardHarness; const cardTree = cardHarness.render(() => card.type(card.props));
    const form = findElements(cardTree, (node) => node.type?.name === "QuickMedicationForm")[0]; activeHarness = formHarness; return formHarness.render(() => form.type(form.props));
  };
  const input = (tree: any) => findElements(tree, (node) => node.props?.accessibilityLabel === t("care.medicationPlaceholder") && node.props?.onChangeText)[0];
  const save = (tree: any) => findElements(tree, (node) => node.props?.label === t("care.quickDoseSave"))[0].props.onPress();
  let tree = render("a"); input(tree).props.onChangeText("A medicine"); tree = render("a"); assert(input(tree).props.value === "A medicine", "same pet/date retains draft");
  tree = render("b"); assert(input(tree).props.value === "", "B notification cannot inherit A medicine draft"); input(tree).props.onChangeText("B medicine"); tree = render("b"); await save(tree);
  assert(saves[0].petId === "b" && saves[0].medicationName === "B medicine" && saves[0].doseDate === "2026-10-19", "actual form submit stores explicit destination date and B's own draft");
  for (const failure of [false, true]) {
    defer = true; tree = render("a"); input(tree).props.onChangeText("A pending"); tree = render("a"); const request = save(tree);
    render("b"); tree = render("a"); input(tree).props.onChangeText("New A input"); tree = render("a");
    if (failure) waiting.at(-1)!.reject(new Error("late A failure")); else waiting.at(-1)!.resolve(); await request;
    tree = render("a"); assert(input(tree).props.value === "New A input", "A→B→A late success/failure cannot reset new form instance");
    tree = render("a", "2026-10-18"); assert(input(tree).props.value === "", "changing destination day also isolates draft");
  }
  assert(queries.some((value) => value.join() === "a,2026-10-19,2026-10-19,u"), "date-range application query receives exact target day");
  assert(saves.length === 3, "opening notifications itself never records completion"); panelHarness.unmount(); cardHarness.unmount(); formHarness.unmount();
} finally { modules._load = original; }
function assert(value: unknown, message: string): void { if (!value) throw new Error(message); }
