import { createHookHarness } from "../testHookHarness";
import { DEFAULT_NOTIFICATION_ACTION } from "./notificationRouting";
declare const require: (name: string) => any;
const modules = require("node:module"), original = modules._load, react = require("react"), harness = createHookHarness();
let listener!: (response: any) => void, removed = 0, cleared = 0, validated = 0;
const calls: string[] = [], response = { actionIdentifier: DEFAULT_NOTIFICATION_ACTION, notification: { date: Date.now(), request: { identifier: "once", content: { data: { version: 1, userId: "u", petId: "a", petCreatedAt: "created", scheduleId: "s", scheduleCreatedAt: "schedule", dateKey: "2026-10-20" } } } } };
modules._load = function(name: string, parent: unknown, main: boolean) {
  if (name === "react") return { ...react, ...harness.hooks };
  if (name.endsWith("/notificationPetIdentity")) return { validateNotificationIdentity: async () => { validated++; return "valid"; } };
  if (name === "expo-notifications") return { addNotificationResponseReceivedListener: (callback: any) => { calls.push("listen"); listener = callback; return { remove: () => removed++ }; }, getLastNotificationResponseAsync: async () => { calls.push("last"); listener(response); return response; }, clearLastNotificationResponseAsync: async () => { cleared++; } };
  return original.call(this, name, parent, main);
};
try {
  const { useNotificationRouting } = require("./useNotificationRouting");
  let scope: any = { initialized: false, userId: null, petsReady: false, petIds: [] };
  const render = () => harness.render(() => useNotificationRouting(scope));
  assert(render().target === null, "auth-gated collector starts without route"); await flush();
  assert(calls.join() === "listen,last" && validated === 0, "listener precedes last-response; cold start waits for auth");
  scope = { initialized: true, userId: "u", petsReady: true, petIds: ["a"] }; render(); await flush();
  let result = render(); assert(result.target.petId === "a" && validated === 1, "listener/last race opens one explicit target after pets ready");
  result.consume(); result = render(); assert(result.target === null && cleared === 2, "consume clears target and native last responses");
  listener(response); await flush(); assert(render().target === null && validated === 1, "same response cannot reopen");
  const weak = { ...response, notification: { ...response.notification, request: { identifier: "weak", content: { data: { version: 1, userId: "u", petId: "a", slot: "breakfast" } } } } };
  listener(weak); await flush(); result = render();
  assert(result.target.kind === "house" && validated === 1, "weak payload goes to house without server or mutation work");
  scope = { ...scope, petIds: [] }; render(); assert(render().target?.kind === "house", "house target survives loss of pet access");
  scope = { ...scope, userId: "other" }; render(); assert(render().target === null, "house target cannot cross accounts");
  harness.unmount(); assert(removed === 1, "native listener removed exactly once");
} finally { modules._load = original; }
async function flush() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
function assert(value: unknown, message: string): void { if (!value) throw new Error(message); }
