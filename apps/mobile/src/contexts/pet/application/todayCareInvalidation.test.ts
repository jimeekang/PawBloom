import { invalidateTodayCare } from "./todayCareInvalidation";
declare const require: (name: string) => any;
const { QueryClient } = require("@tanstack/react-query"), client = new QueryClient();
const keys = [["diary", "date", "a", "date", "u"], ["medication_doses", "today", "b", "date", "u"], ["pet_routine", "c", "dog", "u"], ["care_setup", "active", "d", "u"]];
for (const key of keys) client.setQueryData(key, ["queued-record"]);
const foreign = ["diary", "date", "a", "date", "other"]; client.setQueryData(foreign, []);
await invalidateTodayCare(client, "u", true);
for (const key of keys) { if (!client.getQueryState(key).isInvalidated || client.getQueryData(key)[0] !== "queued-record") throw new Error("all four namespaces stale without losing queued data"); }
if (client.getQueryState(foreign).isInvalidated) throw new Error("another account must not be invalidated");
client.clear();
