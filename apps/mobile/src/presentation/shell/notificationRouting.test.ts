import { createNotificationRouter, DEFAULT_NOTIFICATION_ACTION, parseNotificationRoute, type NotificationResponse } from "./notificationRouting";
import type { NotificationIdentityValidation } from "../../contexts/pet/application/notificationPetIdentity";
function assert(value: unknown, message: string): void { if (!value) throw new Error(message); }
const response = (id: string, data: unknown = payload, date = new Date(2026, 9, 20, 8).getTime()): NotificationResponse => ({ actionIdentifier: DEFAULT_NOTIFICATION_ACTION, notification: { date, request: { identifier: id, content: { data } } } });
const payload = { version: 1, userId: "u", petId: "a", petCreatedAt: "pet-original", scheduleId: "s", scheduleCreatedAt: "schedule-original", dateKey: "daily" };
assert(parseNotificationRoute(response("daily"))?.dateKey === "2026-10-20", "daily opens delivery's local date");
for (const data of [{}, { ...payload, version: 0 }, { ...payload, petCreatedAt: 1 }, { ...payload, scheduleCreatedAt: "" }, { ...payload, dateKey: "2026-02-31" }, { ...payload, dateKey: "garbage" }]) assert(!parseNotificationRoute(response("bad", data)), "malformed/legacy payload discarded");
assert(!parseNotificationRoute(response("bad-date", payload, NaN)), "daily needs delivery date");
const opens: string[] = []; let requests = 0, release: ((valid: NotificationIdentityValidation) => void) | null = null;
const router = createNotificationRouter(async (target) => { requests++; if (target.petCreatedAt !== "pet-original" || target.scheduleCreatedAt !== "schedule-original") return "rejected"; if (release === null) return new Promise<NotificationIdentityValidation>((resolve) => { release = resolve; }); return "valid"; }, (target) => opens.push("kind" in target ? "house" : target.petId));
router.receive(response("cold")); router.receive(response("cold")); assert(requests === 0, "cold response waits before auth");
router.updateScope({ initialized: true, userId: "u", petsReady: false, petIds: [] }); assert(requests === 0, "waits for pets");
router.updateScope({ initialized: true, userId: "u", petsReady: true, petIds: ["a"] }); await flush(); assert(requests === 1, "listener/last duplicate validates once"); (release as unknown as (value: NotificationIdentityValidation) => void)("valid"); await flush(); assert(opens.join() === "a", "one response opens once");
router.receive(response("cold")); await flush(); assert(opens.length === 1, "handled response remains deduplicated");
router.receive(response("next-day", payload, new Date(2026, 9, 21, 8).getTime())); await flush(); assert(opens.join() === "a,a", "next daily delivery opens again");
router.receive(response("reused", { ...payload, petCreatedAt: "new-incarnation" })); router.receive(response("reused-schedule", { ...payload, scheduleCreatedAt: "new-schedule" })); await flush(); assert(opens.slice(2).join() === "house,house", "reused IDs never open pet detail");
const count = opens.length;
router.updateScope({ initialized: true, userId: null, petsReady: true, petIds: [] }); router.receive(response("logout")); await flush(); router.updateScope({ initialized: true, userId: "u", petsReady: true, petIds: ["a"] }); await flush(); assert(opens.length === count, "logout discards rather than reopening after login");
router.updateScope({ initialized: true, userId: "u", petsReady: true, petIds: [] }); router.receive(response("deleted")); await flush(); assert(opens.at(-1) === "house", "deleted pet opens only house");
let finish!: (value: NotificationIdentityValidation) => void; const racing = createNotificationRouter(() => new Promise<NotificationIdentityValidation>((resolve) => { finish = resolve; }), () => { throw new Error("late account result opened"); });
racing.updateScope({ initialized: true, userId: "u", petsReady: true, petIds: ["a"] }); racing.receive(response("race")); racing.updateScope({ initialized: true, userId: "other", petsReady: true, petIds: ["a"] }); finish("valid"); await flush(); racing.dispose(); router.dispose();
for (const result of ["unavailable", "rejected", "throw"] as const) {
  const targets: string[] = [];
  const transient = createNotificationRouter(async () => { if (result === "throw") throw new Error("offline"); return result; }, (target) => targets.push("kind" in target ? "house" : target.petId));
  transient.updateScope({ initialized: true, userId: "u", petsReady: true, petIds: ["a"] }); transient.receive(response(result)); await flush();
  assert(targets.join() === "house", "temporary failures and confirmed rejections never open detail or record completion"); transient.dispose();
}
for (const weak of [{ ...payload, petCreatedAt: undefined }, { ...payload, scheduleCreatedAt: undefined }, { version: 1, userId: "u", petId: "a", slot: "breakfast" }]) {
  let validated = 0; const targets: string[] = [];
  const fallback = createNotificationRouter(async () => { validated++; return "valid"; }, (target) => targets.push("kind" in target ? "house" : target.petId));
  fallback.receive(response("weak", weak)); assert(!targets.length, "weak cold start waits for auth");
  fallback.updateScope({ initialized: true, userId: "u", petsReady: false, petIds: [] }); assert(!targets.length, "weak cold start waits for accessible list");
  fallback.updateScope({ initialized: true, userId: "u", petsReady: true, petIds: ["a"] }); await flush();
  fallback.receive(response("weak", weak)); await flush();
  assert(targets.join() === "house" && validated === 0, "weak response opens house once with no identity lookup or mutation dependency");
  fallback.updateScope({ initialized: true, userId: "other", petsReady: true, petIds: ["a"] }); fallback.receive(response("cross-account", weak)); await flush();
  assert(targets.length === 1, "same reused ID in another account cannot open"); fallback.dispose();
}
async function flush() { for (let i = 0; i < 6; i++) await Promise.resolve(); }
