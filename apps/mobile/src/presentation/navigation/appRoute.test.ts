import { reduceAppRoute, resolveAccessibleRoute, getBackNavigation, houseRoute, type AppRoute } from "./appRoute";
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const ids = ["pet-a", "pet-b"];
let route: AppRoute = houseRoute;
for (const tab of ["house", "care", "memories", "more"] as const) {
  route = reduceAppRoute(route, { type: "tab", tab }, ids);
  assert(route.kind === "main" && route.tab === tab, `main tab ${tab}`);
}
route = reduceAppRoute(route, { type: "openPet", petId: "pet-b" }, ids);
assert(route.kind === "pet" && route.petId === "pet-b" && route.section === "care", "directly select B without cycling A");
const original = route;
route = reduceAppRoute(route, { type: "careView", destination: { view: "medication", scheduleId: "schedule-b", dateKey: "2026-10-20" } }, ids);
assert(route.kind === "pet" && route.petId === "pet-b" && route.destination.view === "medication" && route.destination.scheduleId === "schedule-b", "retain future notification identifiers");
assert(original.destination.view === "default", "reducer must not mutate prior state");
route = reduceAppRoute(route, { type: "section", section: "memories" }, ids);
assert(route.kind === "pet" && route.petId === "pet-b" && route.section === "memories" && route.destination.view === "default", "section reset stays with B");
route = reduceAppRoute(route, { type: "section", section: "profile" }, ids);
assert(route.kind === "pet" && route.section === "profile", "profile section is addressable");
assert(resolveAccessibleRoute(route, ["pet-a"]) === houseRoute, "revoked ID immediately returns house");
assert(reduceAppRoute(route, { type: "reconcile" }, []) === houseRoute, "reconcile removes stale detail");
assert(reduceAppRoute(route, { type: "openPet", petId: "unknown" }, ids) === houseRoute, "unknown ID cannot fall back to A");
assert(reduceAppRoute(route, { type: "section", section: "care" }, []) === houseRoute, "a stale section action cannot restore access");
assert(reduceAppRoute(houseRoute, { type: "careView", destination: { view: "reports" } }, ids) === houseRoute, "care subview cannot create an implicit pet");
assert(reduceAppRoute(route, { type: "recordTarget" }, ids).kind === "record-target", "record requires a target picker");
assert(reduceAppRoute(route, { type: "petCreate" }, ids).kind === "pet-create", "creation path is explicit");

const recordTarget = reduceAppRoute(houseRoute, { type: "recordTarget" }, ids);
assert(reduceAppRoute(recordTarget, { type: "back" }, ids) === houseRoute, "cancel record target returns house");
for (const section of ["care", "memories", "profile"] as const) {
  const selected = reduceAppRoute(houseRoute, { type: "openPet", petId: "pet-b", section }, ids);
  assert(selected.kind === "pet" && selected.petId === "pet-b" && selected.section === section, `openPet preserves explicit ${section} for B`);
}

const appearanceRoute = reduceAppRoute(houseRoute, { type: "appearance", petId: "a", returnTo: "profile" }, ["a"]);
if (appearanceRoute.kind !== "appearance" || appearanceRoute.petId !== "a") throw new Error("builder keeps exact pet ID");
if (resolveAccessibleRoute(appearanceRoute, []).kind !== "main") throw new Error("revoked builder returns home");
const appearanceBack = getBackNavigation(appearanceRoute).nextRoute;
if (appearanceBack.kind !== "pet" || appearanceBack.petId !== "a" || appearanceBack.section !== "profile") throw new Error("builder returns to same profile");

if (resolveAccessibleRoute(appearanceRoute, ["a"], []).kind !== "main") throw new Error("lost ownership closes builder even if pet remains readable");
