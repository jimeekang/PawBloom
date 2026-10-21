import { createHookHarness } from "../testHookHarness";
import { createDefaultPetRoutine } from "../../contexts/routine/application/petRoutineRecords";
import { createAllPetsTodayCareItems } from "./todayCareItems";
declare const require: (name: string) => any;
const modules = require("node:module"), original = modules._load, react = require("react"), harness = createHookHarness();
let dateKey = "2026-10-20", userId: string | null = "u", turn = 0;
const keys: any[][] = [], refetched: string[] = [];
const pets: any[] = ["a", "b", "c"].map((id) => ({ id, species: "dog" }));
modules._load = function(name: string, parent: unknown, main: boolean) {
  if (name === "react") return { ...react, ...harness.hooks };
  if (name.endsWith("/useLocalDateKey")) return { useLocalDateKey: () => dateKey };
  if (name === "@tanstack/react-query") return { ...original.call(this, name, parent, main), useQueries: ({ queries }: any) => { const source = turn++ % 4; return queries.map((query: any, i: number) => { keys.push(query.queryKey); return { data: i === 2 ? undefined : source === 0 ? createDefaultPetRoutine(pets[i].id, "dog") : source === 1 ? { schedules: [] } : [], isError: i === 1 && source === 2, refetch: async () => { refetched.push(`${source}:${i}`); } }; }); } };
  return original.call(this, name, parent, main);
};
try {
  const { useAllPetsTodayCare } = require("./useAllPetsTodayCare");
  const render = () => harness.render(() => useAllPetsTodayCare(userId, pets));
  let result = render(); assert(result.petStates.map((state: any) => state.status).join() === "ready,error,loading", "partial success/error/loading remain independent");
  await result.retryPet("b"); assert(refetched.sort().join() === "0:1,1:1,2:1,3:1", "retry only failed pet's four sources");
  assert(keys.every((key) => key.at(-1) === "u"), "all sources user scoped"); userId = "other"; keys.length = 0; render(); assert(keys.every((key) => key.at(-1) === "other"), "new account gets separate keys");
  dateKey = "2026-10-21"; result = render(); assert(result.dateKey === dateKey && keys.some((key) => key.includes(dateKey)), "midnight changes date keys");
  userId = null; result = render(); assert(result.petStates.every((state: any) => state.status === "ready"), "preview needs no network success");
  const routine = createDefaultPetRoutine("a", "dog"), schedule: any = { id: "s", medicationName: "Med", localTime: "08:00", startsOn: "2026-01-01", recurrenceIntervalDays: 1 };
  const doses: any[] = [{ id: "dose", petId: "a", scheduleId: "s", doseDate: dateKey, scheduledAt: "08:00", medicationName: "Med", status: "partial" }, { id: "wrong", petId: "b", doseDate: dateKey, scheduledAt: "07:00", medicationName: "Other", status: "completed" }, { id: "past", petId: "a", doseDate: "2020-01-01", scheduledAt: "06:00", medicationName: "Past", status: "completed" }];
  const rows = createAllPetsTodayCareItems("a", dateKey, routine, [schedule], doses, []);
  assert(rows[0]!.id === "dose" && rows[0]!.source === "dose" && rows[0]!.status === "partial", "actual partial dose replaces scheduled row and uses dashboard sorting");
  assert(rows.filter((item) => item.scheduleId === "s").length === 1 && !rows.some((item) => ["wrong", "past"].includes(item.id)), "schedule/date dedup with exact pet/date filters");
  assert(rows.filter((item) => item.source === "routine").every((item) => item.status === "pending"), "routine does not invent completion"); harness.unmount();
} finally { modules._load = original; }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
