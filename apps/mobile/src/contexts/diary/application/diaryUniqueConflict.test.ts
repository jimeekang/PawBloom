import { resolveDiaryUniqueConflict, shouldApplyDiaryReplayOverCanonical } from "./diaryUniqueConflict";

if (resolveDiaryUniqueConflict({ category: "walk", origin: "diary", hasClientMutationMatch: true, hasCanonical: true }) !== "already-applied") {
  throw new Error("a matching client mutation id must be treated as an idempotent replay");
}

if (resolveDiaryUniqueConflict({ category: "walk", origin: "diary", hasClientMutationMatch: false, hasCanonical: true }) !== "update-canonical") {
  throw new Error("a diary-origin structured conflict must reconcile the active canonical row");
}

if (resolveDiaryUniqueConflict({ category: "walk", origin: "checklist", hasClientMutationMatch: false, hasCanonical: true }) !== "keep-canonical") {
  throw new Error("a checklist conflict must preserve the canonical diary content");
}

for (const category of ["memo", "photo"] as const) {
  if (resolveDiaryUniqueConflict({ category, origin: "diary", hasClientMutationMatch: false, hasCanonical: true }) !== "conflict") {
    throw new Error(`${category} uniqueness conflicts must not overwrite an unrelated row`);
  }
}

if (resolveDiaryUniqueConflict({ category: "food", origin: "diary", hasClientMutationMatch: false, hasCanonical: false }) !== "conflict") {
  throw new Error("a missing canonical row must not turn an unknown uniqueness error into success");
}

if (shouldApplyDiaryReplayOverCanonical("2026-07-12T08:00:00.000Z", "2026-07-12T08:01:00.000Z")) {
  throw new Error("an older offline diary mutation must never overwrite newer canonical server content");
}
if (!shouldApplyDiaryReplayOverCanonical("2026-07-12T08:02:00.000Z", "2026-07-12T08:01:00.000Z")) {
  throw new Error("a newer offline diary mutation may reconcile the canonical row");
}
if (shouldApplyDiaryReplayOverCanonical("invalid", "2026-07-12T08:01:00.000Z")) {
  throw new Error("invalid replay timestamps must fail closed instead of overwriting canonical content");
}
