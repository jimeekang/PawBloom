import type * as ImagePickerModule from "expo-image-picker";
import { useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, findNodeHandle } from "react-native";
import { NoticeBanner, PrimaryButton, SecondaryButton } from "../../../design-system/components";
import { AppIcon } from "../../../design-system/iconography";
import { colors, iconSize, layout, radius, sceneColors, spacing, type } from "../../../design-system/tokens";
import { t, type TranslationKey } from "../../../i18n/translations";
import type { PetProfile } from "../../pet/domain/pet";
import { useAvatarGeneration } from "../application/useAvatarGeneration";
import { normalizeAppearance, type Appearance } from "../domain/appearance";
import { AvatarGenerationError, isAvatarGenerationRetryable, validateAvatarPhoto, type AvatarGenerationErrorCode, type AvatarGenerationResult, type AvatarPhotoInput } from "../domain/avatarGeneration";
import { AvatarConsentSheet, AvatarSheetFrame, avatarSheetStyles } from "./AvatarConsentSheet";
import { CharacterHeadAvatar } from "./CharacterHeadAvatar";
import { CharacterSvg } from "./CharacterSvg";

/** Literal keys keep verify:i18n able to see every error message; never show provider text. */
export const avatarErrorKeys: Record<AvatarGenerationErrorCode, TranslationKey> = {
  avatar_owner_required: "character.aiError.avatar_owner_required", avatar_invalid_input: "character.aiError.avatar_invalid_input",
  avatar_daily_limit: "character.aiError.avatar_daily_limit", avatar_image_too_large: "character.aiError.avatar_image_too_large",
  avatar_image_invalid: "character.aiError.avatar_image_invalid", avatar_provider_refused: "character.aiError.avatar_provider_refused",
  avatar_provider_failed: "character.aiError.avatar_provider_failed", avatar_no_pet_found: "character.aiError.avatar_no_pet_found",
  avatar_in_progress: "character.aiError.avatar_in_progress", avatar_not_found: "character.aiError.avatar_not_found",
  avatar_network: "character.aiError.avatar_network", avatar_unknown: "character.aiError.avatar_unknown",
};
/** Recovery offered per code: the same request again, a new photo, or nothing until the 24-hour window frees up (close only). */
export function avatarErrorRecovery(code: AvatarGenerationErrorCode): "retry" | "photo" | "none" {
  if (isAvatarGenerationRetryable(code)) return "retry";
  return code === "avatar_daily_limit" || code === "avatar_owner_required" ? "none" : "photo";
}
const PICK_OPTIONS = { mediaTypes: ["images"], quality: 0.7, allowsEditing: true } satisfies ImagePickerModule.ImagePickerOptions;
const types: Record<string, AvatarPhotoInput["contentType"]> = { "image/jpeg": "image/jpeg", "image/jpg": "image/jpeg", "image/png": "image/png", "image/webp": "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
/** Upload compares the read body with byteSize, so measure the same URI the upload will read. */
export async function toAvatarPhoto(asset: { uri: string; mimeType?: string | null; fileName?: string | null }, read: (uri: string) => Promise<Blob> = async (uri) => (await fetch(uri)).blob()): Promise<AvatarPhotoInput> {
  const blob = await read(asset.uri);
  const extension = /\.([a-z0-9]+)$/i.exec(asset.fileName ?? "")?.[1]?.toLowerCase() ?? "";
  const contentType = types[(asset.mimeType ?? "").toLowerCase()] ?? types[(blob.type ?? "").toLowerCase()] ?? types[extension];
  if (!contentType) throw new AvatarGenerationError("avatar_image_invalid");
  return { uri: asset.uri, contentType, byteSize: blob.size };
}
const speciesKeys = { cat: "pet.speciesCat", dog: "pet.speciesDog" } as const satisfies Record<"cat" | "dog", TranslationKey>;
/** Reuses the profile species labels mid-sentence; lowercasing only affects English ("Dog" → "dog"). */
const speciesName = (species: "cat" | "dog") => t(speciesKeys[species]).toLowerCase();
/** The preview always uses the profile's species; say so when the photo looked like the other one. `other` profiles never mismatch. */
export function speciesNotice(photo: AvatarGenerationResult["species"], pet: Pick<PetProfile, "name" | "species">): string | null {
  if (pet.species === "other" || photo === pet.species || (photo !== "cat" && photo !== "dog")) return null;
  return t("character.ai.speciesMismatch").replace("{photoSpecies}", speciesName(photo)).replace("{petName}", pet.name).replace("{petSpecies}", speciesName(pet.species));
}
/** Picker rejections carry a code or message naming permissions (e.g. ERR_NO_PERMISSIONS); anything else is a generic pick failure. */
export function isPermissionError(error: unknown) {
  const { code, message } = (error ?? {}) as { code?: unknown; message?: unknown };
  return /permission/i.test(`${typeof code === "string" ? code : ""} ${typeof message === "string" ? message : ""}`);
}
type Sheet = "consent" | "work" | "pending" | null;
type Props = { userId: string | null; pet: PetProfile; disabled: boolean; motionEnabled: boolean; reducedMotion: boolean; onLoad: (appearance: Appearance) => void };

export function AvatarPhotoGeneration({ userId, pet, disabled, motionEnabled, reducedMotion, onLoad }: Props) {
  const generation = useAvatarGeneration(userId, pet);
  const [sheet, setSheet] = useState<Sheet>(null), [notice, setNotice] = useState<TranslationKey | null>(null);
  const [localError, setLocalError] = useState<AvatarGenerationErrorCode | null>(null), [applying, setApplying] = useState(false), [applied, setApplied] = useState(false);
  const last = useRef<{ kind: "start"; photo: AvatarPhotoInput } | { kind: "apply"; result: AvatarGenerationResult } | null>(null);
  const entry = useRef<View>(null);
  const { state } = generation, busy = state.phase === "uploading" || state.phase === "generating" || applying;
  const blocked = !userId ? "character.ai.loginRequired" : pet.role !== "owner" ? "character.ai.ownerOnly" : null;
  const failure = localError ?? (state.phase === "failed" ? state.code : null);
  const shown = sheet === "pending" ? generation.pending : state.phase === "ready" ? state.result : null;
  // A recent unapplied result rides on the entry card instead of a second row, so short phones keep the options visible.
  const pending = generation.pending && !blocked && state.phase === "idle" ? generation.pending : null;
  const caption: TranslationKey = blocked ?? (applied ? "character.ai.applied" : pending ? "character.ai.pendingTitle" : "character.ai.entryHint");

  function closeAll() {
    setSheet(null); setNotice(null); setLocalError(null); generation.reset();
    focusEntry();
  }
  /** Return focus to the entry so keyboard and screen-reader users land where they started. */
  function focusEntry() {
    setTimeout(() => {
      if (Platform.OS === "web") { (entry.current as unknown as { focus?: () => void })?.focus?.(); return; }
      const tag = findNodeHandle(entry.current); if (tag) AccessibilityInfo.setAccessibilityFocus(tag);
    }, Platform.OS === "web" ? 0 : 350);
  }
  function openConsent() { generation.reset(); setLocalError(null); setNotice(null); setApplied(false); setSheet("consent"); }
  async function pick(source: "library" | "camera") {
    try {
      // Loaded on demand: the shell imports this screen, and the native picker is only needed once a photo is requested.
      const ImagePicker: typeof ImagePickerModule = await import("expo-image-picker");
      // The system photo picker needs no library permission (iOS PHPicker, Android photo picker); only the camera asks first.
      if (source === "camera" && !(await ImagePicker.requestCameraPermissionsAsync()).granted) { setNotice("character.ai.permissionCamera"); return; }
      // The system picker cannot present over a closing sheet on iOS; let the consent sheet leave first.
      setSheet(null);
      if (Platform.OS !== "web") await new Promise((resolve) => setTimeout(resolve, 400));
      const picked = source === "library" ? await ImagePicker.launchImageLibraryAsync(PICK_OPTIONS) : await ImagePicker.launchCameraAsync(PICK_OPTIONS);
      if (picked.canceled || !picked.assets[0]) { focusEntry(); return; }
      setSheet("work");
      const photo = await toAvatarPhoto(picked.assets[0]);
      validateAvatarPhoto(photo);
      await run({ kind: "start", photo });
    } catch (error) {
      if (error instanceof AvatarGenerationError) { setLocalError(error.code); setSheet("work"); return; }
      setNotice(isPermissionError(error) ? (source === "library" ? "character.ai.permissionLibrary" : "character.ai.permissionCamera") : "character.ai.pickFailed");
      setSheet("consent");
    }
  }
  async function run(action: NonNullable<typeof last.current>) {
    last.current = action; setLocalError(null);
    if (action.kind === "start") { await generation.start(action.photo); return; }
    setApplying(true);
    try { const saved = await generation.apply(action.result); onLoad(saved); setApplied(true); closeAll(); }
    catch { setSheet("work"); } // the hook reports the failure code; keep the sheet open on it
    finally { setApplying(false); }
  }
  function refine(result: AvatarGenerationResult) { onLoad(normalizeAppearance(result.appearance, pet.species)); closeAll(); }

  const showWork = sheet === "work" || sheet === "pending" || (sheet === null && state.phase !== "idle");
  return (
    <View style={styles.wrap}>
      <View style={[styles.entry, (blocked || disabled) && styles.entryDisabled]}>
        <Pressable ref={entry} accessibilityRole="button" accessibilityLabel={t("character.ai.entry")} accessibilityHint={t(caption)} accessibilityState={{ disabled: Boolean(blocked) || disabled || busy }} disabled={Boolean(blocked) || disabled || busy} onPress={openConsent} style={({ pressed }) => [styles.entryMain, pressed && styles.entryPressed]}>
          {pending ? <CharacterHeadAvatar species={pet.species} appearance={normalizeAppearance(pending.appearance, pet.species)} size={36} />
            : <View style={styles.entryIcon}><AppIcon name="spark" size={iconSize.sm} color={blocked ? colors.textSoft : colors.orangeDeep} /></View>}
          <View style={styles.entryText}>
            <Text style={[styles.entryTitle, blocked && styles.muted]} numberOfLines={1}>{t("character.ai.entry")}</Text>
            <Text style={styles.caption} numberOfLines={2} accessibilityLiveRegion="polite">{t(caption)}</Text>
          </View>
          {pending ? null : <AppIcon name={blocked ? "lock" : "forward"} size={iconSize.sm} color={colors.textSoft} />}
        </Pressable>
        {/* A sibling, not nested: one control per screen-reader stop. */}
        {pending ? <Pressable accessibilityRole="button" accessibilityLabel={`${t("character.ai.pendingTitle")}, ${t("character.ai.view")}`} disabled={disabled} onPress={() => setSheet("pending")} style={({ pressed }) => [styles.view, pressed && styles.entryPressed]}><Text style={avatarSheetStyles.link}>{t("character.ai.view")}</Text></Pressable> : null}
      </View>
      {sheet === "consent" ? <AvatarConsentSheet reducedMotion={reducedMotion} notice={notice} onLibrary={() => void pick("library")} onCamera={() => void pick("camera")} onClose={closeAll} /> : null}
      {showWork && failure ? <AvatarSheetFrame title={t("character.ai.errorTitle")} reducedMotion={reducedMotion} onClose={closeAll}>
        <NoticeBanner text={t(avatarErrorKeys[failure])} tone="error" icon="alert" />
        <View style={avatarSheetStyles.actions}>
          {avatarErrorRecovery(failure) === "retry" && last.current ? <PrimaryButton label={t("character.ai.retry")} icon="retry" onPress={() => void run(last.current!)} /> : null}
          {avatarErrorRecovery(failure) === "photo" ? <PrimaryButton label={t("character.ai.otherPhoto")} icon="addPhoto" onPress={openConsent} /> : null}
          <SecondaryButton label={t("character.ai.close")} onPress={closeAll} />
        </View>
      </AvatarSheetFrame>
      : showWork && busy ? <AvatarSheetFrame title={t(state.phase === "uploading" ? "character.ai.uploading" : applying ? "character.ai.applying" : "character.ai.generating")} reducedMotion={reducedMotion}>
        <View style={styles.progress} accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.orangeDeep} size="large" />
          <Text style={avatarSheetStyles.hint}>{t("character.ai.progressHint")}</Text>
        </View>
      </AvatarSheetFrame>
      : showWork && shown ? <AvatarSheetFrame title={t(sheet === "pending" ? "character.ai.pendingTitle" : "character.ai.resultTitle")} reducedMotion={reducedMotion} onClose={closeAll}>
        <View style={styles.result} accessible accessibilityLabel={`${pet.name}, ${t("character.ai.resultTitle")}`}>
          <CharacterSvg species={pet.species} appearance={normalizeAppearance(shown.appearance, pet.species)} size={144} withBody motion={{ id: `ai-${pet.id}`, enabled: motionEnabled, reduced: reducedMotion, paused: true, reveal: true }} />
          <Text style={styles.resultName} numberOfLines={2}>{pet.name}</Text>
        </View>
        {speciesNotice(shown.species, pet) ? <NoticeBanner text={speciesNotice(shown.species, pet)!} tone="info" icon="alert" /> : null}
        <Text style={avatarSheetStyles.hint}>{t(sheet === "pending" ? "character.ai.pendingHint" : "character.ai.resultHint")}</Text>
        <View style={avatarSheetStyles.actions}>
          <PrimaryButton label={t("character.ai.apply")} icon="check" disabled={applying} onPress={() => void run({ kind: "apply", result: shown })} />
          <SecondaryButton label={t("character.ai.refine")} icon="edit" disabled={applying} onPress={() => refine(shown)} />
          <Pressable accessibilityRole="button" disabled={applying} onPress={openConsent} style={avatarSheetStyles.textButton}><Text style={avatarSheetStyles.link}>{t("character.ai.again")}</Text></Pressable>
        </View>
      </AvatarSheetFrame> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  entry: { flexDirection: "row", alignItems: "stretch", borderRadius: radius.md, borderWidth: 1, borderColor: colors.segmentActiveBorder, backgroundColor: colors.surfaceWarm, overflow: "hidden" },
  entryMain: { flex: 1, minHeight: layout.minTouch + 8, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  entryPressed: { backgroundColor: colors.surfacePeach }, entryDisabled: { borderColor: colors.border, backgroundColor: colors.neutralBg },
  view: { minWidth: layout.minTouch + 12, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.md, borderLeftWidth: 1, borderLeftColor: colors.segmentActiveBorder },
  entryIcon: { width: 36, height: 36, borderRadius: radius.full, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  entryText: { flex: 1, minWidth: 0, gap: 2 }, entryTitle: { ...type.bodyStrong }, muted: { color: colors.textMuted }, caption: { ...type.caption },
  progress: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.lg },
  result: { alignItems: "center", gap: spacing.xs, padding: spacing.md, borderRadius: radius.xl, backgroundColor: sceneColors.wall },
  resultName: { ...type.bodyStrong, textAlign: "center" },
});
