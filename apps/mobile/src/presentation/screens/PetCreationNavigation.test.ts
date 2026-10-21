import { createHookHarness, findElements } from "../testHookHarness";
declare const require: (name: string) => any;
const nodeModule = require("node:module"), originalLoad = nodeModule._load, realReact = require("react");
let harness = createHookHarness();
const button = () => null, primaryButton = () => null, fields = () => null;
const pet = { id: "shared", name: "Shared", breed: "", birthdate: "", weightKg: 1, species: "dog", role: "caregiver" };
let createError: string | null = null, created = 0, cancelled = 0, saved = 0, createCalls = 0, updateCalls = 0;
const account = { configured: true, user: { id: "account" }, pets: [pet], activePet: pet,
  createPet: async () => { createCalls++; return createError; }, updatePet: async () => { updateCalls++; return null; } };
nodeModule._load = function(request: string, parent: unknown, isMain: boolean) {
  if (request === "react") return { ...realReact, ...Object.fromEntries(Object.keys(harness.hooks).map((name) => [name, (...args: any[]) => (harness.hooks as any)[name](...args)])) };
  if (request.endsWith("/authContext")) return { useAuth: () => account };
  if (request.endsWith("/profilePhotoUrl")) return { usePetProfilePhotoUrl: () => ({}) };
  if (request.endsWith("/subscriptionEntitlement")) return { useSubscriptionEntitlement: () => ({ data: { maxPets: 1 } }) };
  if (request.endsWith("/components")) return { PrimaryButton: primaryButton, SecondaryButton: button, DangerButton: button, NoticeBanner: button, SurfaceCard: button };
  if (request.endsWith("/PetOnboardingHelpers")) return { getSpeciesLabels: () => ({}), PetProfileFormFields: fields, PetSelector: button };
  if (request.endsWith("/RoutineSettingsPanel")) return { RoutineSettingsPanel: button };
  if (request.endsWith("/ProfileCareDefaultsPanel")) return { ProfileCareDefaultsPanel: button };
  return originalLoad.call(this, request, parent, isMain);
};
try {
  const { PetOnboardingScreen } = require("./PetOnboardingScreen");
  const { t } = require("../../i18n/translations");
  const props = { createOnly: true, onCreated: () => created++, onCancelCreate: () => cancelled++, onProfileSaved: () => saved++ };
  const render = () => harness.render(() => PetOnboardingScreen(props));
  let tree = render();
  const form = findElements(tree, (node) => node.type === fields)[0];
  form.props.onNameChange("New pet"); tree = render();
  createError = "pet.createFailed";
  await named(tree, t("pet.create")).props.onPress();
  tree = render();
  assert(createCalls === 1 && !created && !saved && findElements(tree, (node) => node.type === fields)[0].props.name === "New pet", "creation failure keeps the form and entered data without leaving the route");
  createError = null;
  await named(tree, t("pet.create")).props.onPress();
  assert(created === 1 && saved === 1, "successful creation emits distinct route completion and existing save feedback");
  harness = createHookHarness(); tree = render();
  named(tree, t("pet.createCancel")).props.onPress();
  assert(cancelled === 1 && created === 1 && createCalls === 2, "cancel emits navigation callback without creating a pet");
  harness = createHookHarness(); account.pets = []; tree = render();
  named(tree, t("pet.createCancel")).props.onPress();
  assert(cancelled === 2, "dedicated creation route supports cancellation even with no current pets");
  harness = createHookHarness();
  const owner = { ...pet, role: "owner" }; account.pets = [owner]; account.activePet = owner;
  tree = harness.render(() => PetOnboardingScreen({ petId: owner.id, onCreated: props.onCreated, onProfileSaved: props.onProfileSaved }));
  await named(tree, t("pet.update")).props.onPress();
  assert(updateCalls === 1 && saved === 2 && created === 1, "ordinary profile update preserves save feedback without firing creation navigation");
} finally { nodeModule._load = originalLoad; }
function named(tree: any, label: string) { const found = findElements(tree, (node) => node.props?.label === label)[0]; if (!found) throw new Error(`Missing button ${label}`); return found; }
function assert(value: unknown, message: string): void { if (!value) throw new Error(message); }
