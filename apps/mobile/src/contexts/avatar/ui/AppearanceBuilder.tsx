import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { NoticeBanner, PrimaryButton } from "../../../design-system/components";
import { AppIcon } from "../../../design-system/iconography";
import { characterColors, colors, iconSize, layout, radius, sceneColors, spacing, type } from "../../../design-system/tokens";
import { t, type TranslationKey } from "../../../i18n/translations";
import { automaticAccent, changeAppearance, defaultAppearance, presetAppearances, randomAppearance, type Appearance, type AppearanceField, type CharacterSpecies } from "../domain/appearance";
import type { CharacterPose } from "../domain/pixelFrames";
import { CharacterSvg } from "./CharacterSvg";
import { CharacterHeadAvatar } from "./CharacterHeadAvatar";
import { ChipScrollRow, revealChipOnFocus } from "./ChipScrollRow";
import { appearanceLabels, appearanceOptions, presetLabels, type VisibleAppearanceField } from "./appearanceOptions";

/** Same circle framing as the nearby-care avatar, one step larger so the card reads at a glance. */
const PRESET_AVATAR = 52;
const tabs: { key: string; label: TranslationKey; fields: VisibleAppearanceField[] }[] = [
  { key: "preset", label: "character.preset", fields: [] }, { key: "color", label: "character.color", fields: ["coatColor", "accentColor"] },
  { key: "pattern", label: "character.pattern", fields: ["coatPattern"] }, { key: "eyes", label: "character.eyes", fields: ["eyeColor"] },
  { key: "ears", label: "character.earShape", fields: ["earShape"] }, { key: "body", label: "character.tail", fields: ["tail"] },
  { key: "face", label: "character.faceCollar", fields: ["faceMark", "collar"] },
];
export type AppearanceBuilderProps = {
  pet: { id: string; name: string; breed: string; species: CharacterSpecies };
  initialAppearance: Appearance; motionEnabled: boolean; reducedMotion: boolean; onboarding?: boolean;
  onSave: (appearance: Appearance) => Promise<void>; onClose: () => void;
  /** Optional photo-generation entry; `load` replaces the edited appearance (refine or apply), `disabled` while saving. */
  photoGeneration?: (controls: { load: (appearance: Appearance) => void; disabled: boolean }) => ReactNode;
};

export function AppearanceBuilder({ pet, initialAppearance, motionEnabled, reducedMotion, onboarding = false, onSave, onClose, photoGeneration }: AppearanceBuilderProps) {
  const [previewPose, setPreviewPose] = useState<CharacterPose>("sit");
  const [appearance, setAppearance] = useState(initialAppearance);
  const [tab, setTab] = useState("preset"), [tap, setTap] = useState(0);
  const [saving, setSaving] = useState(false), [revealing, setRevealing] = useState(false), [failed, setFailed] = useState(false);
  const explicitAccent = useRef(initialAppearance.accentColor !== automaticAccent(initialAppearance.coatColor, initialAppearance.coatPattern));
  const mounted = useRef(true), timer = useRef<ReturnType<typeof setTimeout> | null>(null), inFlight = useRef(false);
  const dimensions = useWindowDimensions(); // short phones: the photo entry takes a row, so the preview steps down to exact 1.5x
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (timer.current) clearTimeout(timer.current); }; }, []);
  useEffect(() => { if (revealing && reducedMotion) { if (timer.current) clearTimeout(timer.current); onClose(); } }, [revealing, reducedMotion]);
  const presets = presetAppearances(pet.species);
  function replace(next: Appearance) { explicitAccent.current = false; setAppearance(next); }
  function choose(field: AppearanceField, value: string) {
    if (field === "accentColor") explicitAccent.current = true;
    setAppearance((current) => changeAppearance(current, field, value, pet.species, explicitAccent.current));
  }
  async function complete() {
    if (inFlight.current) return;
    inFlight.current = true; setSaving(true); setFailed(false);
    try {
      await onSave(appearance);
      if (!mounted.current) return;
      if (reducedMotion) { onClose(); return; }
      setRevealing(true); timer.current = setTimeout(onClose, 600);
    } catch { if (mounted.current) { setFailed(true); setSaving(false); inFlight.current = false; } }
  }
  const availableTabs = pet.species === "other" ? tabs.filter((item) => ["color", "face"].includes(item.key)) : tabs;
  const active = availableTabs.find((item) => item.key === tab) ?? availableTabs[0];
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("navigation.back")} onPress={onClose} style={styles.iconButton}><AppIcon name="back" size={iconSize.md} color={colors.text} /></Pressable>
        <Text style={styles.title} numberOfLines={2} accessibilityRole="header">{onboarding ? t("character.onboarding") : t("character.title").replace("{petName}", pet.name)}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t("character.random")} disabled={saving} onPress={() => replace(randomAppearance(pet.species, Date.now()))} style={styles.textButton}><Text style={styles.link}>{t("character.random")}</Text></Pressable>
      </View>
      {photoGeneration?.({ load: replace, disabled: saving })}
      <Pressable accessibilityRole="button" accessibilityLabel={`${pet.name}, ${t("character.preview")}`} onPress={() => setTap((value) => value + 1)} style={styles.preview}>
        <CharacterSvg species={pet.species} appearance={appearance} size={dimensions.height < 700 ? (photoGeneration ? 72 : 96) : 144} pose={previewPose} withBody motion={{ id: pet.id, enabled: motionEnabled && !saving, reduced: reducedMotion, paused: true, tap, reveal: revealing }} />
        <Text style={styles.petName} numberOfLines={2}>{pet.name}{pet.breed ? ` · ${pet.breed}` : ""}</Text>
        <Text style={styles.caption} accessibilityLiveRegion="polite">{t(revealing ? "character.creating" : "character.preview")}</Text>
      </Pressable>
      <ChipScrollRow>
        {([['sit','character.pose.sit'],['walkRight','character.pose.walk'],['sleep','character.pose.sleep'],['stretch','character.pose.stretch']] as const).map(([pose,label]) => <Choice key={pose} label={t(label)} group={t("character.pose")} selected={previewPose === pose} onPress={() => setPreviewPose(pose)} disabled={saving} />)}
      </ChipScrollRow>
      <ChipScrollRow>
        {availableTabs.map((item) => <Choice key={item.key} label={t(item.label)} group={t("character.title").replace("{petName}", pet.name)} selected={active.key === item.key} onPress={() => setTab(item.key)} disabled={saving} />)}
      </ChipScrollRow>
      <ScrollView style={styles.optionsScroll} contentContainerStyle={styles.options} keyboardShouldPersistTaps="handled">
        {active.key === "preset" ? <View style={styles.grid}>{presets.map((preset, index) => <Pressable key={index} accessibilityRole="button" accessibilityState={{ selected: JSON.stringify(preset) === JSON.stringify(appearance), disabled: saving }} accessibilityLabel={`${t("character.preset")}, ${t(presetLabels[pet.species === "cat" ? "cat" : "dog"][index])}`} disabled={saving} onPress={() => replace(preset)} style={[styles.preset, JSON.stringify(preset) === JSON.stringify(appearance) && styles.selected]}>
          <CharacterHeadAvatar species={pet.species} appearance={preset} size={PRESET_AVATAR} />
          <Text style={styles.presetText} numberOfLines={2}>{t(presetLabels[pet.species === "cat" ? "cat" : "dog"][index])}</Text>
          {JSON.stringify(preset) === JSON.stringify(appearance) ? <View style={styles.presetCheck}><AppIcon name="check" size={iconSize.xs} color={colors.orangeDeep} /></View> : null}
        </Pressable>)}</View> : active.fields.filter((field) => pet.species !== "other" || field === "coatColor" || field === "collar").filter((field) => field !== "accentColor" || (appearance.coatPattern !== "solid" && !(pet.species === "cat" && ["bicolor", "tabbyWhite"].includes(appearance.coatPattern)))).map((field) => <View key={field} style={styles.group}>
          <Text style={styles.groupTitle}>{t(appearanceLabels[field])}</Text>
          <View style={styles.grid}>{appearanceOptions[field].filter(({ value }) => field !== "earShape" || (pet.species === "cat" ? value !== "floppy" : ["floppy", "pointed"].includes(value))).filter(({ value }) => field !== "coatPattern" || pet.species === "cat" || ["solid", "bicolor"].includes(value)).map(({ value, label }) => <Choice key={value} label={t(label)} group={t(appearanceLabels[field])} selected={appearance[field] === value} onPress={() => choose(field, value)} disabled={saving} secondaryColor={field === "eyeColor" && value === "odd" ? characterColors.eye.amber : undefined} color={field === "coatColor" || field === "accentColor" ? characterColors.coat[value as Appearance["coatColor"]] : field === "eyeColor" ? characterColors.eye[value as Appearance["eyeColor"]] : undefined} />)}</View>
        </View>)}
        {failed ? <NoticeBanner text={t("character.saveFailed")} tone="error" icon="close" /> : null}
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryButton label={t(revealing ? "character.creating" : "character.done")} onPress={() => void complete()} disabled={saving} />
        <View style={styles.footerLinks}>
          <Pressable accessibilityRole="button" disabled={saving} onPress={() => replace(defaultAppearance(pet.species))} style={styles.textButton}><Text style={styles.caption}>{t("character.reset")}</Text></Pressable>
          {onboarding ? <Pressable accessibilityRole="button" onPress={onClose} style={styles.textButton}><Text style={styles.link}>{t("character.skip")}</Text></Pressable> : <Text style={styles.caption}>{t("character.localOnly")}</Text>}
        </View>
      </View>
    </View>
  );
}
function Choice({ label, group, selected, disabled, color, secondaryColor, onPress }: { label: string; group: string; selected: boolean; disabled?: boolean; color?: string; secondaryColor?: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${group}, ${label}${selected ? `, ${t("character.selected")}` : ""}`} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} onFocus={revealChipOnFocus} style={[styles.choice, selected && styles.selected]}>
    {color ? <View style={[styles.swatch, { backgroundColor: color }]}>{secondaryColor ? <View style={{ width: "50%", height: "100%", alignSelf: "flex-end", backgroundColor: secondaryColor }} /> : null}</View> : null}<Text style={styles.choiceText}>{label}</Text>{selected ? <AppIcon name="check" size={iconSize.xs} color={colors.orangeDeep} /> : null}
  </Pressable>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.appBackground, paddingHorizontal: spacing.lg, gap: spacing.sm, maxWidth: 430, width: "100%", alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingTop: spacing.xs },
  title: { ...type.screenTitle, flex: 1 }, iconButton: { width: layout.minTouch, height: layout.minTouch, alignItems: "center", justifyContent: "center" },
  textButton: { minHeight: layout.minTouch, justifyContent: "center", paddingHorizontal: spacing.xs }, link: { ...type.bodyStrong, color: colors.pendingText },
  preview: { alignItems: "center", backgroundColor: sceneColors.wall, borderRadius: radius.xl, padding: spacing.md, gap: spacing.xs },
  petName: { ...type.bodyStrong, textAlign: "center" }, caption: { ...type.caption },
  optionsScroll: { flex: 1 }, options: { gap: spacing.lg, paddingVertical: spacing.sm }, group: { gap: spacing.sm }, groupTitle: { ...type.bodyStrong },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }, choice: { minHeight: layout.minTouch, flexDirection: "row", gap: spacing.xs, alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.full, borderWidth: 2, borderColor: colors.border },
  selected: { borderColor: colors.orange, backgroundColor: colors.surfacePeach }, choiceText: { ...type.caption, color: colors.text, flexShrink: 1 },
  swatch: { overflow: "hidden", width: 24, height: 24, borderRadius: radius.full, borderWidth: 1, borderColor: colors.borderStrong },
  preset: { flexBasis: "30%", flexGrow: 1, alignItems: "center", gap: spacing.xs, borderRadius: radius.md, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.sm, paddingTop: spacing.md, paddingBottom: spacing.sm },
  presetText: { ...type.caption, color: colors.text, textAlign: "center" },
  // Corner badge keeps the selected card the same height as its neighbours.
  presetCheck: { position: "absolute", top: spacing.xs, right: spacing.xs },
  footer: { gap: spacing.xxs, paddingTop: spacing.xs }, footerLinks: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" },
});
