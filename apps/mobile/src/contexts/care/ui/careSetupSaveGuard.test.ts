import { isCurrentCareSetupSave, nextCareSetupSaveScope, resolvePendingCareSetupMutation } from "./careSetupSaveGuard";

const petAScope = nextCareSetupSaveScope({ petId: null, generation: 0 }, "pet-a");
const petBScope = nextCareSetupSaveScope(petAScope, "pet-b");
if (isCurrentCareSetupSave(petBScope, petAScope)) {
  throw new Error("a completed save for pet A must not overwrite pet B's care draft");
}
if (!isCurrentCareSetupSave(petBScope, petBScope)) {
  throw new Error("the active pet save must still be allowed to update its own care draft");
}

const firstMutation = resolvePendingCareSetupMutation(null, "same", () => "mutation-1");
const retryMutation = resolvePendingCareSetupMutation(firstMutation, "same", () => "mutation-2");
const changedMutation = resolvePendingCareSetupMutation(firstMutation, "changed", () => "mutation-3");
if (retryMutation.id !== "mutation-1") throw new Error("an unchanged failed care save must reuse its idempotency id");
if (changedMutation.id !== "mutation-3") throw new Error("an edited care draft must allocate a new idempotency id");
