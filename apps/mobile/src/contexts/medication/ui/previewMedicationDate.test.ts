import { createHookHarness } from "../../../presentation/testHookHarness";
import { createDefaultPetRoutine } from "../../routine/application/petRoutineRecords";
import { createAllPetsTodayCareItems } from "../../../presentation/care/todayCareItems";
declare const require: (name: string) => any;
const modules = require("node:module"), original = modules._load, react = require("react"), harness = createHookHarness();
let dateKey = "2026-10-20";
modules._load = function(name: string, parent: unknown, main: boolean) {
  if (name === "react") return { ...react, ...harness.hooks };
  if (name.endsWith("/date")) return { ...original.call(this, name, parent, main), getLocalDateKey: () => dateKey };
  if (name.endsWith("/medicationDoseRecords")) return Object.fromEntries(["useTodayMedicationDoses", "useCreateMedicationDose", "useUpdateMedicationDose", "useDeleteMedicationDose", "useUpdateMedicationDoseStatus"].map((key) => [key, () => ({})]));
  return original.call(this, name, parent, main);
};
try {
  const { buildSampleDoses, relocalizeSampleDoses } = require("./sampleDoses");
  const { createLocalDoseRecord } = require("./localMedicationState");
  const { useMedicationDosesController } = require("./useMedicationDosesController");
  const sample = buildSampleDoses("a", "en");
  assert(sample.every((dose: any) => dose.doseDate === dateKey), "sample doses pin creation date");
  const routine = createDefaultPetRoutine("a", "dog");
  const items = createAllPetsTodayCareItems("a", dateKey, routine, [], sample, []);
  assert(items.filter((item) => item.source === "dose").length === 2 && items.some((item) => item.status === "pending" && item.source === "dose"), "all-pet today care includes the same preview pending dose as detail");
  assert(!createAllPetsTodayCareItems("b", dateKey, routine, [], sample, []).some((item) => item.source === "dose"), "another pet never inherits preview doses");
  const local = createLocalDoseRecord("a", { medicationName: "Local" });
  assert(local.doseDate === dateKey && createLocalDoseRecord("a", { medicationName: "Past", doseDate: "2026-10-19" }).doseDate === "2026-10-19", "local dose defaults date and preserves explicit past dates");
  const schedules: never[] = [], noop = () => undefined;
  let activePetId = "a";
  const render = () => harness.render(() => useMedicationDosesController({ activePetId, databaseMode: false, livePetId: null, userId: null, fallbackPetId: "a", language: "en", schedules, onNotice: noop, onSaved: noop, onLocalDoseSaved: noop, onLocalDosesChanged: noop }));
  let result = render(); assert(result.activeDoses.length === 2 && result.medicationAgenda.length === 2, "preview today controller initially uses both samples");
  result.replaceLocalDoses([...sample, local, { ...local, id: "past", doseDate: "2026-10-19" }, { ...local, id: "other", petId: "b" }]);
  result = render(); assert(result.activeDoses.length === 3 && !result.activeDoses.some((dose: any) => ["past", "other"].includes(dose.id)), "detail today filter retains exact pet and date");
  dateKey = "2026-10-21";
  result = render(); assert(result.activeDoses.length === 0 && result.medicationAgenda.length === 0 && result.doses.length === 5, "date rollover clears today's detail while retaining medication history");
  assert(relocalizeSampleDoses(sample, "ko").every((dose: any) => dose.doseDate === "2026-10-20"), "language switch preserves original date");
  assert(!createAllPetsTodayCareItems("a", dateKey, routine, [], sample, []).some((item) => item.source === "dose"), "aggregate does not move samples to the new date");
  result.replaceLocalDoses([...result.doses, { ...local, id: "new-day", doseDate: dateKey }]);
  result = render(); assert(result.activeDoses.length === 1 && result.activeDoses[0].id === "new-day", "new date dose enters today detail");
  activePetId = "b"; result = render(); assert(result.activeDoses.length === 0, "switching pets keeps exact current date scope");
} finally { modules._load = original; }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
