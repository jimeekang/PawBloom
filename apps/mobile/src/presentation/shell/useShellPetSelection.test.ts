import type { PetProfile } from "../../contexts/pet/domain/pet";
declare const require: (name: string) => any;
const nodeModule = require("node:module");
const originalLoad = nodeModule._load;
let selected: string | null = null;
nodeModule._load = function(request: string, parent: unknown, isMain: boolean) {
  if (request === "react") return { useMemo: (factory: () => unknown) => factory(), useState: () => [selected, (id: string) => { selected = id; }] };
  return originalLoad.call(this, request, parent, isMain);
};
try {
  const { useShellPetSelection } = require("./useShellPetSelection");
  const selectedAuth: string[] = [];
  const a = { id: "a", role: "owner" } as PetProfile;
  const b = { id: "b", role: "caregiver" } as PetProfile;
  const params = { language: "en", authActivePet: a, authPets: [a, b], authenticated: true, selectPet: (id: string) => selectedAuth.push(id) };
  const first = useShellPetSelection(params);
  assert(first.selectPetId("b"), "direct B selection succeeds");
  assert(selectedAuth.join() === "b", "auth selection receives exact ID once");
  assert(useShellPetSelection(params).activePet.id === "b", "local selection agrees immediately before auth update");
  assert(!first.selectPetId("unknown"), "unknown ID rejected");
  assert(selectedAuth.join() === "b", "invalid ID never reaches auth");
  assert(useShellPetSelection({ ...params, authPets: [a] }).activePet.id === "a", "removed pet cannot remain selected");
  assert(useShellPetSelection({ ...params, authActivePet: b, authPets: [] }).accessiblePets.length === 0, "empty signed-in list never becomes preview access");
  selected = null;
  const previewParams = { ...params, authenticated: false, authActivePet: null, authPets: [] };
  const preview = useShellPetSelection(previewParams);
  assert(preview.accessiblePets.length > 1, "preview retains every sample pet");
  const previewId = preview.accessiblePets[1].id;
  assert(preview.selectPetId(previewId), "preview selects second pet by ID");
  assert(useShellPetSelection(previewParams).activePet.id === previewId, "preview selection remains stable");
  assert(selectedAuth.join() === "b", "preview selection never mutates auth");
  selected = null; // PawBloomSession account key creates fresh hook state.
  assert(useShellPetSelection({ ...params, authActivePet: b, authPets: [b] }).activePet.id === "b", "new account does not inherit selected preview ID");
} finally { nodeModule._load = originalLoad; }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
