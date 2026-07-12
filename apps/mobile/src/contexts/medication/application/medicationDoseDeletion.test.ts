import { deleteMedicationDoseWithRetry } from "./medicationDoseDeletion";

let attempts = 0;
const query = {
  delete() { return this; },
  eq() { return this; },
  select() { return this; },
  async maybeSingle() {
    attempts += 1;
    if (attempts === 1) throw new TypeError("Network request failed");
    return { data: null, error: null };
  },
};
const client = { from: () => query };
const deleted = await deleteMedicationDoseWithRetry(client as never, "pet-1", "dose-1");
if (deleted !== null || attempts !== 2) {
  throw new Error("a missing row after an ambiguous medication delete must be treated as committed success");
}

const missingClient = { from: () => ({ ...query, async maybeSingle() { return { data: null, error: null }; } }) };
let rejectedMissing = false;
try {
  await deleteMedicationDoseWithRetry(missingClient as never, "pet-1", "dose-1");
} catch {
  rejectedMissing = true;
}
if (!rejectedMissing) throw new Error("a first-attempt missing medication dose must not masquerade as a successful delete");
