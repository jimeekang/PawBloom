import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Platform, Pressable, Text, View, findNodeHandle } from "react-native";
import type { DiaryMemoryPetState } from "../../contexts/diary/application/diaryMemories";
import type { PetProfile } from "../../contexts/pet/domain/pet";
import { NoticeBanner, PrimaryButton, SecondaryButton } from "../../design-system/components";
import { AppIcon } from "../../design-system/iconography";
import { colors, iconSize } from "../../design-system/tokens";
import { t } from "../../i18n/translations";
import type { PetSection } from "../navigation/appRoute";
import { NearbyCare } from "../house/NearbyCare";
import { HousePetList } from "../house/HousePetList";
import { HouseScene } from "../house/HouseScene";
import { PetSummarySheet } from "../house/PetSummarySheet";
import { useHouseLayout } from "../house/useHouseLayout";
import { useHouseMotionState } from "../house/useHouseMotionEnabled";
import { DefaultPetCharacter } from "../house/DefaultPetCharacter";
import type { TodayCarePetState } from "./TodayCareScreen";
import { styles } from "./HouseScreen.styles";

export type HouseScreenProps = {
  /** Only pets accessible to the current account. */
  pets: readonly PetProfile[];
  /** Null uses the preview placeholder without requesting private photos. */
  userId: string | null;
  /** Record selection requires a second, named confirmation button. */
  recordTargetSelection?: boolean;
  /** Today facts per pet for the summary and list (read-only). */
  careStates?: readonly TodayCarePetState[];
  /** Existing diary photo/memo per pet for the summary (read-only). */
  memoryStates?: readonly DiaryMemoryPetState[];
  /** Opens the exact pet ID (optionally a detail section); never cycles selection. */
  onOpenPet: (petId: string, section?: PetSection) => void;
  /** Receives the pet ID explicitly confirmed by the user. */
  onRecordPet: (petId: string) => void;
  /** Preserves existing account and first-owned-pet creation gates. */
  onAddPet: () => void;
  onEditAppearance?: (petId: string) => void;
  /** Leaves record-target selection without saving; the cancel button shows only when provided. */
  onCancelRecordTarget?: () => void;
};

export function HouseScreen({ pets, userId, recordTargetSelection = false, careStates = [], memoryStates = [], onOpenPet, onRecordPet, onAddPet, onEditAppearance, onCancelRecordTarget }: HouseScreenProps) {
  const house = useHouseLayout(userId, pets.map((pet) => pet.id));
  const [motionPaused, setMotionPaused] = useState(false);
  const [positionsLocked, setPositionsLocked] = useState(false);
  const motion = useHouseMotionState(true, motionPaused);
  const [tap, setTap] = useState({ petId: "", sequence: 0 });
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (tapTimer.current) clearTimeout(tapTimer.current); }, []);
  const [summaryPetId, setSummaryPetId] = useState<string | null>(null);
  const [recordPetId, setRecordPetId] = useState<string | null>(null);
  const opener = useRef<{ petId: string; from: "scene" | "list" } | null>(null);
  const sceneNodes = useRef(new Map<string, unknown>()).current, listNodes = useRef(new Map<string, unknown>()).current;
  const rows = pets.map((pet) => ({ pet, openLabel: t("house.openPet").replace("{petName}", pet.name), recordLabel: t("house.confirmRecord").replace("{petName}", pet.name) }));
  const summaryPet = recordTargetSelection ? undefined : pets.find((pet) => pet.id === summaryPetId);
  // One pet is unambiguous; otherwise the user must pick before the named confirm appears.
  const recordTarget = rows.find((row) => row.pet.id === recordPetId) ?? (rows.length === 1 ? rows[0] : undefined);

  useEffect(() => { if (tapTimer.current) clearTimeout(tapTimer.current); setRecordPetId(null); setSummaryPetId(null); }, [recordTargetSelection]);

  function openSummary(petId: string, from: "scene" | "list") {
    if (recordTargetSelection) { setRecordPetId(petId); return; }
    opener.current = { petId, from };
    if (tapTimer.current) clearTimeout(tapTimer.current);
    setTap((current) => ({ petId, sequence: current.sequence + 1 }));
    tapTimer.current = setTimeout(() => setSummaryPetId(petId), motion.reduced ? 120 : 320);
  }
  function closeSummary() {
    const origin = opener.current;
    setSummaryPetId(null);
    if (!origin) return;
    // Web keyboard users reach pets through the list; native screen readers return to the touched character.
    const node = Platform.OS === "web" || origin.from === "list" ? listNodes.get(origin.petId) : sceneNodes.get(origin.petId);
    setTimeout(() => restoreFocus(node), Platform.OS === "web" ? 0 : 350);
  }
  function leaveSummary(action: () => void) { opener.current = null; setSummaryPetId(null); action(); }

  if (!pets.length) {
    return (
      <View style={styles.emptyCard}>
        <View style={styles.emptyArt}><DefaultPetCharacter species="dog" size={52} withBody /><DefaultPetCharacter species="cat" size={46} withBody /></View>
        <Text style={styles.emptyTitle} accessibilityRole="header">{t("house.emptyTitle")}</Text>
        <Text style={styles.emptyCopy}>{t("house.emptyCopy")}</Text>
        <View style={styles.emptyAction}><PrimaryButton label={t("house.emptyAction")} icon="add" onPress={onAddPet} /></View>
      </View>
    );
  }

  const controls = recordTargetSelection ? null : <>
    <Toggle icon={motionPaused ? "play" : "pause"} label={t("house.motionPause")} checked={motionPaused} onPress={() => setMotionPaused((value) => !value)} />
    <Toggle icon={positionsLocked ? "lock" : "lockOpen"} label={t("house.positionLock")} checked={positionsLocked} onPress={() => setPositionsLocked((value) => !value)} />
  </>;

  return (
    <View style={styles.screen}>
      {recordTargetSelection ? (
        <View style={styles.recordPanel}>
          <NoticeBanner text={t("house.recordTarget")} icon="add" tone="info" />
          <HousePetList rows={rows} userId={userId} careStates={careStates} mode="record" selectedPetId={recordTarget?.pet.id ?? null} onPress={(petId) => setRecordPetId(petId)} registerNode={(petId, node) => listNodes.set(petId, node)} />
          {recordTarget
            ? <PrimaryButton label={recordTarget.recordLabel} icon="add" onPress={() => onRecordPet(recordTarget.pet.id)} />
            : <PrimaryButton label={t("house.recordChooseFirst")} disabled />}
          {onCancelRecordTarget ? <SecondaryButton label={t("house.recordCancel")} icon="close" onPress={onCancelRecordTarget} /> : null}
        </View>
      ) : null}
      <HouseScene
        pets={pets}
        userId={userId}
        layout={house.layout}
        motionEnabled={motion.enabled}
        reducedMotion={motion.reduced}
        interactionPaused={recordTargetSelection || Boolean(summaryPetId)}
        tappedPetId={tap.petId}
        tapSequence={tap.sequence}
        positionsLocked={positionsLocked || recordTargetSelection}
        selectedPetId={recordTargetSelection ? recordTarget?.pet.id ?? null : summaryPetId}
        showSelection={recordTargetSelection}
        onPetTap={(petId) => openSummary(petId, "scene")}
        onMovePet={house.movePet}
        registerPetNode={(petId, node) => sceneNodes.set(petId, node)}
      />
      {recordTargetSelection ? null : <>
        <NearbyCare pets={pets} userId={userId} careStates={careStates} onOpenPet={onOpenPet} />
        <View style={styles.tools}>{controls}</View>
        <Text style={styles.hint}>{t(positionsLocked ? "house.gestureHintLocked" : "house.gestureHint")}</Text>
        <Text style={styles.sectionTitle} accessibilityRole="header">{t("house.listTitle")}</Text>
        <HousePetList rows={rows} userId={userId} careStates={careStates} mode="browse" selectedPetId={summaryPetId} onPress={(petId) => openSummary(petId, "list")} registerNode={(petId, node) => listNodes.set(petId, node)} />
      </>}
      {summaryPet ? (
        <PetSummarySheet
          pet={summaryPet}
          userId={userId}
          careState={careStates.find((state) => state.petId === summaryPet.id)}
          memoryState={memoryStates.find((state) => state.petId === summaryPet.id)}
          quickRecordLabel={t("house.confirmRecord").replace("{petName}", summaryPet.name)}
          reducedMotion={motion.reduced}
          onEditAppearance={summaryPet.role === "owner" && onEditAppearance ? () => leaveSummary(() => onEditAppearance(summaryPet.id)) : undefined}
          onClose={closeSummary}
          onOpenSection={(section) => leaveSummary(() => onOpenPet(summaryPet.id, section))}
          onQuickRecord={() => leaveSummary(() => onRecordPet(summaryPet.id))}
        />
      ) : null}
    </View>
  );
}

function Toggle({ icon, label, checked, onPress }: { icon: "play" | "pause" | "lock" | "lockOpen"; label: string; checked: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked }} aria-checked={checked} onPress={onPress} style={({ pressed }) => [styles.toggle, checked && styles.toggleOn, pressed && styles.togglePressed]}>
      <AppIcon name={icon} size={iconSize.sm} color={checked ? colors.pendingText : colors.textMuted} />
      <Text style={[styles.toggleText, checked && styles.toggleTextOn]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

function restoreFocus(node: unknown) {
  if (!node) return;
  if (Platform.OS === "web") { (node as { focus?: () => void }).focus?.(); return; }
  const tag = findNodeHandle(node as Parameters<typeof findNodeHandle>[0]);
  if (tag) AccessibilityInfo.setAccessibilityFocus(tag);
}
