import { petMutationErrorKey } from "./petMutationError";

if (petMutationErrorKey(new Error("pet_plan_limit_reached"), "pet.createFailed") !== "pet.planLimitReached") {
  throw new Error("database plan-limit rejection must retain a specific recovery message");
}

if (petMutationErrorKey(new Error("network failed"), "pet.createFailed") !== "pet.createFailed") {
  throw new Error("unrecognized pet mutation failures must keep their safe fallback");
}
