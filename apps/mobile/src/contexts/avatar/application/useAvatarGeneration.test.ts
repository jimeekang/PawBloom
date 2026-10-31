import { defaultAppearance } from "../domain/appearance";
import { AvatarGenerationError, type AvatarGenerationResult } from "../domain/avatarGeneration";
import type { PetProfile } from "../../pet/domain/pet";
declare const require: (name: string) => any;
const modules = require("node:module"), original = modules._load;
const slots: any[] = [], cache = new Map<string, unknown>();
let cursor = 0, calls = 0, applyCalls = 0, finish!: (result: AvatarGenerationResult) => void, generating!: () => void;
const result: AvatarGenerationResult = { jobId: "10000000-0000-4000-8000-000000000001", avatarId: "10000000-0000-4000-8000-000000000002", species: "cat", appearance: defaultAppearance(), confidence: 0.9, createdAt: new Date().toISOString() };
const pet = { id: "10000000-0000-4000-8000-000000000003", species: "cat", role: "owner" } as PetProfile;
const photo = { uri: "file:///cat.png", contentType: "image/png" as const, byteSize: 100 };
modules._load = function (name: string, parent: unknown, main: boolean) {
  if (name === "react") return {
    useRef(initial: unknown) { const at = cursor++; return slots[at] ??= { current: initial }; },
    useState(initial: unknown) { const at = cursor++; slots[at] ??= initial; return [slots[at], (next: unknown) => { slots[at] = next; }]; },
    useEffect(effect: () => (() => void), deps: unknown[]) {
      const at = cursor++;
      if (!slots[at] || JSON.stringify(slots[at].deps) !== JSON.stringify(deps)) { slots[at]?.cleanup(); slots[at] = { deps, cleanup: effect() }; }
    },
  };
  if (name === "@tanstack/react-query") return {
    useQueryClient: () => ({ cancelQueries: async () => undefined, setQueryData: (key: unknown, value: unknown) => cache.set(JSON.stringify(key), value) }),
    useQuery: (options: any) => ({ data: cache.get(JSON.stringify(options.queryKey)) }),
  };
  if (name === "./avatarGenerationRepository") return {
    generateAvatar: async (user: string | null, inputPet: PetProfile, _photo: unknown, next: () => void) => {
      if (!user || inputPet.role !== "owner") throw new AvatarGenerationError("avatar_owner_required");
      calls++; generating = next;
      return new Promise<AvatarGenerationResult>((resolve) => { finish = resolve; });
    },
    findGeneratedAvatar: async () => result,
    applyGeneratedAvatar: async (user: string | null) => { if (!user) throw new AvatarGenerationError("avatar_owner_required"); applyCalls++; return result.appearance; },
  };
  return original.call(this, name, parent, main);
};
try {
  const { useAvatarGeneration } = require("./useAvatarGeneration");
  const render = (user: string | null, inputPet = pet) => { cursor = 0; return useAvatarGeneration(user, inputPet); };
  await render(null).start(photo);
  assert(render(null).state.code === "avatar_owner_required" && calls === 0, "preview start fails before API");
  const previous = { ...result, avatarId: "10000000-0000-4000-8000-000000000004" };
  cache.set(JSON.stringify(["avatar-generation", "user-a", pet.id]), previous);
  let hook = render("user-a");
  assert(hook.state.phase === "idle" && hook.pending === previous, "new account starts idle and recovers pending");
  const first = hook.start(photo);
  assert(render("user-a").state.phase === "uploading", "upload state");
  await render("user-a").start(photo);
  assert(Number(calls) === 1, "double start does not create a second job");
  generating(); assert(render("user-a").state.phase === "generating", "generate state after upload");
  finish(result); await first;
  hook = render("user-a");
  assert(hook.state.phase === "ready" && hook.state.result === result && hook.pending === result, "ready result refreshes pending recovery cache");
  const saved = await hook.apply(result);
  assert(saved === result.appearance && applyCalls === 1 && cache.get(JSON.stringify(["appearance", "user-a", pet.id, "cat"])) === saved, "apply updates appearance query cache");
  assert(render("user-a").pending === null && render("user-a").state.phase === "idle", "apply clears pending and state");
  const late = render("user-a").start(photo);
  render("user-a").reset(); finish(result); await late;
  assert(render("user-a").state.phase === "idle" && render("user-a").pending === null, "reset invalidates late generation completion and pending cache update");
  const old = render("user-a").start(photo);
  const staleCallback = render("user-a").start;
  assert(render("user-b").state.phase === "idle" && render("user-b").pending === null, "account switch hides old result");
  const previousCalls = calls; await staleCallback(photo);
  assert(calls === previousCalls, "old account callback cannot upload");
  finish(result); await old;
  assert(render("user-b").state.phase === "idle", "old account completion cannot update new state");
  cache.set(JSON.stringify(["avatar-generation", "user-b", pet.id]), result);
  assert(render("user-b", { ...pet, role: "caregiver" }).pending === null, "caregiver cannot expose owner generation recovery");
  slots[2]?.cleanup();
} finally { modules._load = original; }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
