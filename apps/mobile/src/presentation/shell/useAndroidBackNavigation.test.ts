import { getBackNavigation, reduceAppRoute, houseRoute, type AppRoute } from "../navigation/appRoute";
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const ids = ["a"];
assert(!getBackNavigation(houseRoute).handled, "house lets Android exit");
for (const tab of ["care", "memories", "more"] as const) {
  const back = getBackNavigation({ kind: "main", tab });
  assert(back.handled && back.nextRoute === houseRoute, "main tab back returns house");
}
for (const view of ["diary", "medication", "reports"] as const) {
  const route: AppRoute = { kind: "pet", petId: "a", section: "care", destination: { view } };
  const back = getBackNavigation(route);
  assert(back.handled && back.nextRoute.kind === "pet" && back.nextRoute.petId === "a" && back.nextRoute.destination.view === "default", `${view} returns to same pet care`);
  assert(reduceAppRoute(back.nextRoute, { type: "back" }, ids) === houseRoute, "detail back then returns house");
}
for (const section of ["care", "memories", "profile"] as const) {
  assert(getBackNavigation({ kind: "pet", petId: "a", section, destination: { view: "default" } }).nextRoute === houseRoute, "base detail returns house");
}
for (const kind of ["pet-create", "record-target"] as const) assert(getBackNavigation({ kind }).nextRoute === houseRoute, "transient screen returns house");
assert(reduceAppRoute({ kind: "pet", petId: "revoked", section: "care", destination: { view: "diary" } }, { type: "back" }, ids) === houseRoute, "revocation takes precedence over stale view");
