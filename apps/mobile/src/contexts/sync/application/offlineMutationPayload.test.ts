import { buildOfflineMutation, createClientMutationId, requireString, stringValue, toRecord } from "./offlineMutationPayload";

const mutation = buildOfflineMutation({
  aggregate: "diary",
  operation: "insert",
  payload: { petId: "pet-1", userId: "user-1", input: { category: "walk" } },
  clientMutationId: "mutation-1",
  createdAt: "2026-07-05T00:00:00.000Z",
});

if (mutation.aggregate !== "diary" || mutation.operation !== "insert") throw new Error("offline mutation must keep the aggregate and operation it was built with");
if (mutation.id !== "offline-mutation-1" || mutation.clientMutationId !== "mutation-1") throw new Error("offline mutation id must derive from the idempotency id");
if (mutation.attempts !== 0 || mutation.createdAt !== "2026-07-05T00:00:00.000Z") throw new Error("offline mutation must start with zero attempts and keep its creation time");
if (mutation.payload.petId !== "pet-1" || mutation.payload.userId !== "user-1") throw new Error("offline mutation payload must keep ownership context");

const generated = buildOfflineMutation({ aggregate: "medication", operation: "update", payload: {} });
if (!generated.clientMutationId || generated.id !== `offline-${generated.clientMutationId}`) {
  throw new Error("offline mutation must generate a client mutation id when none is provided");
}

if (!createClientMutationId()) throw new Error("client mutation id generation must always produce a value");
if (toRecord("not-a-record").anything !== undefined || toRecord(null).anything !== undefined) throw new Error("toRecord must coerce non-objects to an empty record");
if (requireString("value", "label") !== "value") throw new Error("requireString must pass through valid strings");
if (stringValue("") !== undefined || stringValue("x") !== "x") throw new Error("stringValue must reject empty strings");

let requireStringThrew = false;
try {
  requireString(undefined, "missing label");
} catch (error) {
  requireStringThrew = error instanceof Error && error.message.includes("missing label");
}
if (!requireStringThrew) throw new Error("requireString must reject missing values with a labelled error");
