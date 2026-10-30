import { beginAppearanceOnboarding, consumeAppearanceOnboarding } from "./appearanceOnboarding";

const pets = [{ id: "existing", role: "caregiver" }, { id: "new", role: "owner" }];
let complete = beginAppearanceOnboarding("account", ["existing"]);
assert(consumeAppearanceOnboarding("account", pets) === null, "no handoff before successful create result");
complete(true);
assert(consumeAppearanceOnboarding("account", pets) === "new", "new exact ID is selected rather than active shared pet");
assert(consumeAppearanceOnboarding("account", pets) === null, "handoff is consumed once");
complete = beginAppearanceOnboarding("account", []); complete(false);
assert(consumeAppearanceOnboarding("account", pets) === null, "failed creation never enters builder");
complete = beginAppearanceOnboarding("account", []); complete(true);
assert(consumeAppearanceOnboarding("other-account", pets) === null, "account changes invalidate pending handoff");
assert(consumeAppearanceOnboarding("account", pets) === null, "cannot return to stale request");
complete = beginAppearanceOnboarding("account", []); complete(true);
assert(consumeAppearanceOnboarding("account", []) === null, "wait for authenticated pet refresh");
assert(consumeAppearanceOnboarding("account", [{ id: "new", role: "owner" }]) === "new", "eventual refresh resolves");
complete = beginAppearanceOnboarding("account", []); complete(true);
assert(consumeAppearanceOnboarding("account", [{ id: "a", role: "owner" }, { id: "b", role: "owner" }]) === null, "ambiguous identities never guess");
function assert(value: unknown, message: string): void { if (!value) throw new Error(message); }
