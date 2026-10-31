import { createHookHarness, findElements } from "../../../presentation/testHookHarness";
import { translations, t } from "../../../i18n/translations";
import { defaultAppearance } from "../domain/appearance";
declare const require: (name: string) => any;
const modules = require("node:module"), original = modules._load, react = require("react");
let harness = createHookHarness();
const svg = () => null, head = () => null, button = () => null, secondary = () => null, notice = () => null;
const calls: string[] = [];
let permission = true, picked: any = { canceled: false, assets: [{ uri: "file:///cat.jpg", mimeType: "image/jpeg", fileName: "cat.jpg" }] };
const result = { jobId: "j", avatarId: "a", species: "cat", appearance: { ...defaultAppearance("cat"), coatColor: "ginger" }, confidence: 0.82, createdAt: "2026-10-31T10:00:00Z" };
let gen: any;
const resetGen = (state: any = { phase: "idle" }, pending: any = null) => { gen = { state, pending, start: async (photo: any) => { calls.push(`start:${photo.contentType}:${photo.byteSize}`); }, apply: async (r: any) => { calls.push(`apply:${r.avatarId}`); return r.appearance; }, reset: () => calls.push("reset") }; };
modules._load = function(name: string, parent: unknown, main: boolean) {
  if (name === "react") return { ...react, ...Object.fromEntries(Object.keys(harness.hooks).map((key) => [key, (...args: any[]) => (harness.hooks as any)[key](...args)])) };
  if (name === "expo-image-picker") return {
    requestMediaLibraryPermissionsAsync: async () => { calls.push("libraryPermission"); return { granted: permission }; }, requestCameraPermissionsAsync: async () => ({ granted: permission }),
    launchImageLibraryAsync: async (options: any) => { calls.push(`library:${options.quality}:${options.allowsEditing}`); if (!permission) throw Object.assign(new Error("Missing photo library permission"), { code: "ERR_NO_PERMISSIONS" }); return picked; },
    launchCameraAsync: async () => { calls.push("camera"); return picked; },
  };
  if (name === "react-native") { const rn = original.call(this, name, parent, main); const overrides: any = { findNodeHandle: () => 7, AccessibilityInfo: { setAccessibilityFocus: (tag: number) => calls.push(`focus:${tag}`) } }; return new Proxy(rn, { get: (target, key) => key in overrides ? overrides[key] : target[key] }); }
  if (name.endsWith("/useAvatarGeneration")) return { useAvatarGeneration: () => gen };
  if (name.endsWith("/CharacterSvg")) return { CharacterSvg: svg };
  if (name.endsWith("/CharacterHeadAvatar")) return { CharacterHeadAvatar: head };
  if (name.endsWith("/components")) return { PrimaryButton: button, SecondaryButton: secondary, NoticeBanner: notice };
  return original.call(this, name, parent, main);
};
(globalThis as any).fetch = async () => ({ blob: async () => ({ size: 123456, type: "" }) });
const tick = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); await new Promise((resolve) => setTimeout(resolve, 0)); };
try {
  const { AvatarPhotoGeneration, avatarErrorKeys, avatarErrorRecovery, toAvatarPhoto } = require("./AvatarPhotoGeneration");
  const { AvatarConsentSheet, AvatarSheetFrame } = require("./AvatarConsentSheet");
  const pet = { id: "p1", name: "아주아주긴이름을가진고양이치즈", species: "cat", role: "owner", breed: "", birthdate: "", ageLabel: "", weightKg: 0, careMode: false };
  const loaded: any[] = [];
  const props: any = { userId: null, pet, disabled: false, motionEnabled: false, reducedMotion: true, onLoad: (a: any) => loaded.push(a) };
  const render = () => harness.render(() => AvatarPhotoGeneration(props));
  const entry = (tree: any) => findElements(tree, (node) => node.props?.accessibilityLabel === t("character.ai.entry"))[0];
  const frames = (tree: any) => findElements(tree, (node) => node.type === AvatarSheetFrame);
  const labels = (tree: any, type: any) => findElements(tree, (node) => node.type === type).map((node) => node.props.label ?? node.props.text);

  // Preview mode: disabled entry, sign-in hint, no pending offer.
  resetGen({ phase: "idle" }, result);
  let tree = render();
  assert(entry(tree).props.disabled && entry(tree).props.accessibilityHint === t("character.ai.loginRequired"), "preview disables the entry and explains sign-in");
  assert(!findElements(tree, (node) => node.type === head).length, "preview hides the pending offer");
  props.userId = "u1"; pet.role = "member"; tree = render();
  assert(entry(tree).props.disabled && entry(tree).props.accessibilityHint === t("character.ai.ownerOnly"), "non-owners see why the entry is disabled");
  pet.role = "owner"; resetGen(); tree = render();
  assert(!entry(tree).props.disabled, "owners can start");

  // Consent sheet, permission denial, then a measured photo reaches start().
  entry(tree).props.onPress(); tree = render();
  const consent = findElements(tree, (node) => node.type === AvatarConsentSheet)[0];
  assert(consent, "entry opens consent first");
  const consentTree = AvatarConsentSheet(consent.props);
  for (const key of ["character.ai.consentSend", "character.ai.consentDelete", "character.ai.consentMetadata", "character.ai.consentScope", "character.ai.consentLimit"] as const) {
    assert(findElements(consentTree, (node) => node.props?.children === t(key)).length === 1, `consent explains ${key}`);
  }
  permission = false; consent.props.onCamera(); await tick(); tree = render();
  assert(findElements(tree, (node) => node.type === AvatarConsentSheet)[0].props.notice === "character.ai.permissionCamera" && !calls.includes("camera"), "camera asks first; denial stays on consent with an inline notice (no web no-op Alert)");
  findElements(tree, (node) => node.type === AvatarConsentSheet)[0].props.onLibrary(); await new Promise((resolve) => setTimeout(resolve, 450)); await tick(); tree = render();
  assert(!calls.includes("libraryPermission") && calls.includes("library:0.7:true"), "library opens the system picker without asking for library permission first");
  assert(findElements(tree, (node) => node.type === AvatarConsentSheet)[0]?.props.notice === "character.ai.permissionLibrary", "a picker permission error returns to consent with the library notice");
  calls.length = 0;
  permission = true; findElements(tree, (node) => node.type === AvatarConsentSheet)[0].props.onLibrary(); for (let i = 0; i < 4; i++) await Promise.resolve(); tree = render();
  // iOS lets the consent sheet finish dismissing (400ms) before presenting the system picker.
  assert(!calls.some((call) => call.startsWith("library")) && !findElements(tree, (node) => node.type === AvatarConsentSheet).length, "consent closes before the picker presents");
  await new Promise((resolve) => setTimeout(resolve, 450)); await tick(); tree = render();
  assert(calls.includes("library:0.7:true") && calls.includes("start:image/jpeg:123456"), `picker uses quality 0.7 + editing and start gets measured bytes (${calls})`);

  // Progress cannot be dismissed; result shows the pixel preview without any confidence number.
  resetGen({ phase: "generating" }); tree = render();
  assert(frames(tree).length === 1 && frames(tree)[0].props.title === t("character.ai.generating") && !frames(tree)[0].props.onClose, "generating sheet has no close while work is in flight");
  resetGen({ phase: "ready", result }); tree = render();
  const preview = findElements(tree, (node) => node.type === svg)[0];
  assert(preview && preview.props.size === 144 && preview.props.appearance.coatColor === "ginger" && preview.props.motion.reduced, "result previews the generated appearance at exact 3x, honoring reduced motion");
  assert(!JSON.stringify(frames(tree)[0].props.children).match(/0\.82|82 ?%/), "confidence is never shown");
  assert(labels(tree, button).includes(t("character.ai.apply")) && labels(tree, secondary).includes(t("character.ai.refine")), "result offers apply and refine");
  findElements(tree, (node) => node.type === secondary && node.props.label === t("character.ai.refine"))[0].props.onPress(); tree = render();
  assert(loaded.at(-1).coatColor === "ginger" && calls.at(-1) === "reset", "refine loads the fields and closes");
  resetGen({ phase: "ready", result }); tree = render();
  findElements(tree, (node) => node.type === button && node.props.label === t("character.ai.apply"))[0].props.onPress(); await tick(); resetGen(); tree = render();
  assert(calls.includes("apply:a") && entry(tree).props.accessibilityHint === t("character.ai.applied"), "apply saves through the hook and confirms in the entry");

  // Every error code has EN/KO copy with a recovery path; provider text never reaches the UI.
  const codes = Object.keys(avatarErrorKeys);
  assert(codes.length === 12, "twelve error codes");
  for (const code of codes) {
    const key = avatarErrorKeys[code];
    assert((translations.en as any)[key] && (translations.ko as any)[key] && (translations.en as any)[key] !== (translations.ko as any)[key], `${code} has EN and KO copy`);
    resetGen({ phase: "failed", code, retryable: avatarErrorRecovery(code) === "retry" }); tree = render();
    assert(findElements(tree, (node) => node.type === notice)[0]?.props.text === t(key), `${code} shows its own message`);
    const actions = labels(tree, button), recovery = avatarErrorRecovery(code);
    assert(recovery === "photo" ? actions.includes(t("character.ai.otherPhoto")) : recovery === "none" ? actions.length === 0 : actions.includes(t("character.ai.retry")), `${code} offers ${recovery}`);
    assert(labels(tree, secondary).includes(t("character.ai.close")), `${code} can always close`);
  }
  const limitCopy = [translations.en["character.aiError.avatar_daily_limit"], translations.ko["character.aiError.avatar_daily_limit"], translations.en["character.ai.consentLimit"], translations.ko["character.ai.consentLimit"]];
  assert(avatarErrorRecovery("avatar_daily_limit") === "none" && limitCopy.every((text) => /24/.test(text) && !/tomorrow|today|a day|내일|오늘|하루/i.test(text)), "limit copy describes the rolling 24-hour window, not a calendar day");
  assert(avatarErrorRecovery("avatar_network") === "retry" && avatarErrorRecovery("avatar_no_pet_found") === "photo", "network retries; no-pet asks for another photo");

  // Pending result from the last 24 hours is offered and opens the same result actions.
  resetGen({ phase: "idle" }, result); tree = render();
  const view = findElements(tree, (node) => node.props?.accessibilityLabel === `${t("character.ai.pendingTitle")}, ${t("character.ai.view")}`)[0];
  assert(view && findElements(tree, (node) => node.type === head).length === 1, "pending row shows a head preview and a named view button");
  view.props.onPress(); tree = render();
  assert(frames(tree)[0]?.props.title === t("character.ai.pendingTitle") && labels(tree, button).includes(t("character.ai.apply")), "pending opens with apply");

  // Picker cancelled: no generation starts and focus returns to the entry.
  await new Promise((resolve) => setTimeout(resolve, 400)); // let earlier close-focus timers fire first
  resetGen(); picked = { canceled: true, assets: [] }; calls.length = 0; tree = render();
  entry(tree).props.onPress(); tree = render();
  findElements(tree, (node) => node.type === AvatarConsentSheet)[0].props.onCamera();
  await new Promise((resolve) => setTimeout(resolve, 800)); await tick(); tree = render();
  assert(!calls.some((call) => call.startsWith("start")) && calls.includes("focus:7") && !frames(tree).length, `cancelling the picker returns focus to the entry (${calls})`);

  // Species: the preview keeps the profile species; a cat/dog mismatch is explained, never for "other" profiles.
  const { speciesNotice } = require("./AvatarPhotoGeneration");
  const infos = (tree: any) => findElements(tree, (node) => node.type === notice && node.props.tone === "info");
  resetGen({ phase: "ready", result: { ...result, species: "dog" } }); tree = render();
  assert(infos(tree).length === 1 && infos(tree)[0].props.text.includes(pet.name) && findElements(tree, (node) => node.type === svg)[0].props.species === "cat", "dog photo on a cat profile: notice shown, preview stays cat");
  assert(labels(tree, button).includes(t("character.ai.apply")) && labels(tree, secondary).includes(t("character.ai.refine")), "mismatch still allows apply and refine");
  resetGen({ phase: "ready", result }); tree = render();
  assert(!infos(tree).length, "matching species shows no notice");
  assert(speciesNotice("dog", { name: "Mo", species: "other" }) === null && speciesNotice("cat", { name: "Mo", species: "cat" }) === null, "other profiles and matches never show a notice");
  const enNotice = translations.en["character.ai.speciesMismatch"].replace("{photoSpecies}", "dog").replace("{petName}", "Mo").replace("{petSpecies}", "cat");
  assert(/looks like a dog.*Mo’s cat profile/.test(enNotice) && !/breed|health/i.test(enNotice + translations.ko["character.ai.speciesMismatch"]), "notice names only the species, no breed or health wording");
  assert(speciesNotice("dog", { name: "Mo", species: "cat" }) === t("character.ai.speciesMismatch").replace("{photoSpecies}", t("pet.speciesDog").toLowerCase()).replace("{petName}", "Mo").replace("{petSpecies}", t("pet.speciesCat").toLowerCase()), "species names reuse the profile labels");

  const { isPermissionError } = require("./AvatarPhotoGeneration");
  assert(isPermissionError({ code: "ERR_NO_PERMISSIONS" }) && isPermissionError(new Error("User rejected permissions")) && !isPermissionError(new Error("decode failed")) && !isPermissionError(null), "only permission failures map to the permission notice");
  assert(/2/.test(translations.ko["character.ai.consentDelete"]) && /2 hours/.test(translations.en["character.ai.consentDelete"]), "consent states the 2-hour deletion bound for interrupted creations");

  // Photo typing: header, blob type, extension; unknown types are a recoverable photo error.
  const read = async () => ({ size: 9, type: "image/png" }) as Blob;
  assert((await toAvatarPhoto({ uri: "a", mimeType: "image/jpg" }, read)).contentType === "image/jpeg", "image/jpg normalizes");
  assert((await toAvatarPhoto({ uri: "a" }, read)).contentType === "image/png", "blob type fallback");
  assert((await toAvatarPhoto({ uri: "a", fileName: "x.WEBP" }, async () => ({ size: 9, type: "" }) as Blob)).contentType === "image/webp", "extension fallback");
  let invalid = ""; try { await toAvatarPhoto({ uri: "a", mimeType: "image/heic" }, async () => ({ size: 9, type: "" }) as Blob); } catch (error: any) { invalid = error.code; }
  assert(invalid === "avatar_image_invalid", "unsupported type becomes avatar_image_invalid");
  harness.unmount();
  console.log("Avatar photo UI: preview/owner gates, consent→picker→start, progress lock, result, 12 errors, pending.");
} finally { modules._load = original; }
function assert(value: unknown, message: string): void { if (!value) throw new Error(message); }
