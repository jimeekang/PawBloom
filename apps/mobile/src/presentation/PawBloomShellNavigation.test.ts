import { createHookHarness, findElements } from "./testHookHarness";
import type { DiaryEntry } from "../contexts/diary/domain/diaryEntry";
declare const require: (name: string) => any;
const nodeModule = require("node:module"), originalLoad = nodeModule._load, realReact = require("react");
let harness = createHookHarness();
const stub = () => null, banner = () => null;
const account: any = { configured: false, user: null, pets: [], activePet: null, selectPet: () => undefined };
let pendingEdit: DiaryEntry | null = null;
const applied: string[] = [];
const noop = () => undefined;
let selectedDate = "2026-10-20";
const diary = { entries: [], activeEntries: [], selectedDiaryEntries: [], get selectedDiaryDate() { return selectedDate; }, diaryFilter: "day", todayDiaryStatus: "ready", selectedDiaryStatus: "ready", setSelectedDiaryDate: (date: string) => { selectedDate = date; }, setDiaryFilter: noop, get timelineEditEntry() { return pendingEdit; }, setTimelineEditEntry: (entry: DiaryEntry | null) => { pendingEdit = entry; if (entry) applied.push(entry.petId); } };
const setup = { schedules: [] }, doses = { activeDoses: [], medicationAgenda: [], doses: [] };
const mocks: Record<string, any> = {
  "/authContext": { useAuth: () => account },
  "/languageContext": { useLanguage: () => ({ language: "en" }) },
  "/useRoutineDefaults": { useRoutineDefaults: () => ({ activeRoutine: { walk: { enabled: true } } }) },
  "/useCareSetupState": { useCareSetupState: () => ({ activeCareSetup: setup }) },
  "/useMedicationReminderToggle": { useMedicationReminderToggle: () => ({ medicationRemindersEnabled: false }) },
  "/reminderScheduling": { useReminderAutoRefresh: noop },
  "/useMedicationDosesController": { useMedicationDosesController: () => doses },
  "/useDiaryEntriesController": { useDiaryEntriesController: () => diary },
  "/reportDraftRecords": { useReportDraftSummary: () => ({}) },
  "/useVetReportWorkflow": { useVetReportWorkflow: () => ({}) },
  "/useTodayChecklistController": { useTodayChecklistController: () => ({}) },
  "/useAllPetsTodayCare": { useAllPetsTodayCare: () => ({ dateKey: "2026-10-20", status: "ready", petStates: [], retryPet: noop }) },
  "/diaryMemories": { useDiaryMemories: () => ({ petStates: [], retryPet: noop }) },
  "/DiaryEntryScreen": { DiaryEntryScreen: stub },
  "/ReportsScreen": { ReportsScreen: stub },
  "/OfflineConflictNotice": { OfflineConflictNotice: stub },
  "/CareModeScreen": { CareModeScreen: stub },
  "/MedicationDestinationScreen": { MedicationDestinationScreen: stub },
  "/HomeScreen": { HomeScreen: stub },
  "/PetOnboardingScreen": { PetOnboardingScreen: stub },
  "/SettingsHubScreen": { SettingsHubScreen: stub },
  "/SaveFeedbackBar": { SaveFeedbackBar: stub },
  "/components": { NoticeBanner: banner, SecondaryButton: stub },
};
nodeModule._load = function(request: string, parent: unknown, isMain: boolean) {
  if (request === "react") return { ...realReact, ...Object.fromEntries(Object.keys(harness.hooks).map((name) => [name, (...args: any[]) => (harness.hooks as any)[name](...args)])) };
  if (request === "react-native-safe-area-context") return { SafeAreaView: stub };
  for (const suffix of Object.keys(mocks)) if (request.endsWith(suffix)) return mocks[suffix];
  return originalLoad.call(this, request, parent, isMain);
};
try {
  const { PawBloomShell } = require("./PawBloomShell"), { t } = require("../i18n/translations");
  let tree = renderSession();
  assert(findElements(tree, (node) => node.type === banner && node.props.text === t("today.previewNotice")).length === 1, "initial house renders the existing preview storage warning");
  named(tree, "HouseHeader").props.onRequestRecord(); tree = renderSession();
  assert(named(tree, "HouseScreen").props.recordTargetSelection && shows(tree, t("today.previewNotice")), "direct record target selection keeps the preview warning");
  const petA = named(tree, "HouseScreen").props.pets[0].id;
  named(tree, "HouseScreen").props.onRecordPet(petA); tree = renderSession();
  assert(shows(tree, t("today.previewNotice")), "opening the diary directly keeps the preview warning");
  named(tree, "BottomNav").props.onChange("memories"); tree = renderSession();
  const pets = named(tree, "MemoriesScreen").props.pets, petB = pets[1].id;
  const entry: DiaryEntry = { id: "b-memo", petId: petB, origin: "diary", category: "memo", entryDate: "2026-10-19", occurredAt: "12:00", summary: "B" };
  named(tree, "MemoriesScreen").props.onOpenDiaryEntry(entry); tree = renderSession();
  const detail = named(tree, "PetDetailScreen");
  assert(detail.props.pet.id === petB && detail.props.route.petId === petB && applied.join() === petB, "actual shell effect delivers B's delayed memory edit after selecting B");
  assert(findElements(tree, (node) => node.props?.initialEditingEntry === entry && node.props?.petId === petB).length === 1, "the hidden diary receives B's original entry with B's target ID");
  harness = createHookHarness(); pendingEdit = null;
  account.configured = true; account.user = { id: "account" }; account.pets = [{ ...pets[0], role: "caregiver" }]; account.activePet = account.pets[0];
  tree = renderSession();
  assert(!shows(tree, t("today.previewNotice")) && !shows(tree, t("today.databaseNotice")), "real account keeps the existing policy of suppressing routine sync notices");
  named(tree, "HouseHeader").props.onAddPet(); tree = renderSession();
  let creation = findElements(tree, (node) => node.props?.createOnly === true)[0];
  assert(creation, "shared-only account reaches first-owned-pet creation");
  creation.props.onCreated(); tree = renderSession();
  assert(named(tree, "HouseScreen") && !findElements(tree, (node) => node.props?.createOnly === true).length, "successful creation leaves dedicated route for house");
  named(tree, "HouseHeader").props.onAddPet(); tree = renderSession();
  creation = findElements(tree, (node) => node.props?.createOnly === true)[0]; creation.props.onCancelCreate(); tree = renderSession();
  assert(named(tree, "HouseScreen"), "cancelled creation returns house instead of an empty create route");
  const sessionType = require("./PawBloomShell").PawBloomShell().type;
  const target = { userId: "account", petId: account.pets[0].id, petCreatedAt: "original", dateKey: "2026-10-19", destination: { view: "diary", dateKey: "2026-10-19" } };
  tree = harness.render(() => sessionType({ notificationTarget: target }));
  assert(findElements(tree, (node) => node.props?.selectedDateKey === "2026-10-19").length === 1, "past diary notification applies destination date to actual mounted diary props");
  named(tree, "BottomNav").props.onChange("care"); tree = harness.render(() => sessionType({}));
  named(tree, "TodayCareScreen").props.onOpenPet(account.pets[0].id, { view: "diary", dateKey: "2026-10-20" }); tree = harness.render(() => sessionType({}));
  assert(findElements(tree, (node) => node.props?.selectedDateKey === "2026-10-20").length === 1, "today aggregate entry resets past diary selection to its explicit date");
  const medicationTarget = { ...target, scheduleId: "schedule", destination: { view: "medication", scheduleId: "schedule", dateKey: "2026-10-19" } };
  tree = harness.render(() => sessionType({ notificationTarget: medicationTarget }));
  const medicationScreen = findElements(tree, (node) => node.props?.scheduleId === "schedule" && node.props?.dateKey === "2026-10-19")[0];
  assert(medicationScreen?.key === `${account.pets[0].id}:2026-10-19`, "medication notification reaches a pet/date keyed actual destination with schedule target");

  let consumed = 0;
  const houseTarget = { kind: "house", userId: "account" };
  tree = harness.render(() => sessionType({ notificationTarget: houseTarget, onNotificationConsumed: () => consumed++ }));
  assert(named(tree, "HouseScreen") && consumed === 1 && !findElements(tree, (node) => node.type?.name === "PetDetailScreen").length, "weak notification opens only house and consumes without a pet destination");
} finally { nodeModule._load = originalLoad; }
function renderSession() {
  const { PawBloomShell } = require("./PawBloomShell");
  const session = PawBloomShell();
  return harness.render(() => session.type(session.props));
}
function named(tree: any, name: string) { const node = findElements(tree, (item) => item.type?.name === name)[0]; if (!node) throw new Error(`Missing ${name}`); return node; }
function shows(tree: any, text: string) { return findElements(tree, (node) => node.type === banner && node.props.text === text).length > 0; }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
