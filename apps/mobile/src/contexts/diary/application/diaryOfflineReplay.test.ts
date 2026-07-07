import { buildDiaryInsertOfflineMutation, buildDiaryReplayInsertPayload } from "./diaryOfflineReplay";

const diaryMutation = buildDiaryInsertOfflineMutation({
  petId: "pet-1",
  userId: "user-1",
  input: { category: "walk", summary: "", entryDate: "2026-07-05", detail: { category: "walk", durationMinutes: "20" } },
  clientMutationId: "mutation-1",
  createdAt: "2026-07-05T00:00:00.000Z",
});

if (diaryMutation.aggregate !== "diary" || diaryMutation.operation !== "insert") throw new Error("diary insert failures must become diary insert outbox mutations");
if (diaryMutation.clientMutationId !== "mutation-1" || diaryMutation.attempts !== 0) throw new Error("offline mutation must keep idempotency id and start with zero attempts");
if (diaryMutation.payload.petId !== "pet-1" || diaryMutation.payload.userId !== "user-1") throw new Error("diary offline payload must keep pet and user ownership context");

const diaryReplayPayload = buildDiaryReplayInsertPayload({
  petId: "pet-1",
  userId: "user-1",
  clientMutationId: "mutation-1",
  input: { category: "walk", summary: "walk memo", entryDate: "2026-07-05", occurredTime: "08:30" },
});

if (diaryReplayPayload.client_mutation_id !== "mutation-1" || diaryReplayPayload.pet_id !== "pet-1") {
  throw new Error("diary replay insert payload must keep idempotency and ownership fields");
}

if (diaryReplayPayload.category !== "walk" || diaryReplayPayload.entry_date !== "2026-07-05") {
  throw new Error("diary replay insert payload must keep the recorded category and entry date");
}

const fallbackPayload = buildDiaryReplayInsertPayload({
  petId: "pet-1",
  userId: "user-1",
  clientMutationId: "mutation-2",
  input: { category: "unknown-category", summary: "" },
});

if (fallbackPayload.category !== "memo") {
  throw new Error("diary replay must fall back to the memo category for unknown categories");
}
