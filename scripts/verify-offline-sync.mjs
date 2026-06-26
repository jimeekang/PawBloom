import { readFileSync } from "node:fs";
import { join } from "node:path";

const file = join(process.cwd(), "apps/mobile/src/contexts/sync/application/offlineOutbox.ts");
const text = readFileSync(file, "utf8");
const required = ["clientMutationId", "insert or ignore", "initializeOutbox", "listPendingMutations", "attempts"];
const missing = required.filter((needle) => !text.includes(needle));

if (missing.length) {
  console.error(`Offline outbox contract missing: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Offline sync verification passed.");

