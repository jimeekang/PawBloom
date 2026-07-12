import { petDeleteValidationKey, petProfileValidationKey } from "./petProfileValidation";

if (petProfileValidationKey({ configured: true, userPresent: true, name: "   " }) !== "pet.nameRequired") {
  throw new Error("empty pet names must produce a visible localized validation error");
}
if (petProfileValidationKey({ configured: false, userPresent: true, name: "Milo" }) !== "pet.loginRequired") {
  throw new Error("pet writes must require a configured authenticated client");
}
if (petDeleteValidationKey({ configured: true, userPresent: true, petId: "" }) !== "pet.profileRequired") {
  throw new Error("pet deletion must require a selected profile");
}
