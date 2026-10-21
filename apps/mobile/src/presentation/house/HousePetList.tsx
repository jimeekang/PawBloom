import { Pressable, StyleSheet, Text, View } from "react-native";
import type { PetProfile } from "../../contexts/pet/domain/pet";
import { AppIcon } from "../../design-system/iconography";
import { colors, iconSize, radius, spacing, type } from "../../design-system/tokens";
import { t } from "../../i18n/translations";
import { nextTodayCareItem, todayCareItemTitle, type TodayCarePetState } from "../screens/TodayCareScreen";
import { PetAvatar } from "./PetAvatar";

export type HousePetRow = {
  pet: PetProfile;
  /** Accessible name for opening the summary (names the exact pet). */
  openLabel: string;
};

/** One line of today's facts for a pet; failures never read as "0 records". */
export function petCareLine(state: TodayCarePetState | undefined, now = new Date()) {
  if (!state || state.status === "loading") return t("house.careLoading");
  if (state.status === "error") return t("house.careFailed");
  const recorded = t("house.careRecorded").replace("{count}", String(state.items.filter((item) => item.status !== "pending").length));
  const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const next = nextTodayCareItem(state.items, nowTime);
  const nextText = !next ? t("house.careNone") : next.scheduledTime
    ? t("house.careNext").replace("{time}", next.scheduledTime).replace("{title}", todayCareItemTitle(next))
    : t("house.careNextUntimed").replace("{title}", todayCareItemTitle(next));
  return `${recorded} · ${nextText}`;
}

export type HousePetListProps = {
  rows: readonly HousePetRow[];
  userId: string | null;
  careStates: readonly TodayCarePetState[];
  /** browse opens the summary; record selects a single target (radio). */
  mode: "browse" | "record";
  selectedPetId: string | null;
  onPress: (petId: string) => void;
  registerNode: (petId: string, node: unknown) => void;
};

/** Always-present name list: picks overlapping pets and works without dragging. */
export function HousePetList({ rows, userId, careStates, mode, selectedPetId, onPress, registerNode }: HousePetListProps) {
  return (
    <View style={styles.list} accessibilityRole={mode === "record" ? "radiogroup" : undefined}>
      {rows.map(({ pet, openLabel }) => {
        const checked = mode === "record" && selectedPetId === pet.id;
        const line = petCareLine(careStates.find((state) => state.petId === pet.id));
        return (
          <Pressable
            key={pet.id}
            ref={(node: unknown) => registerNode(pet.id, node)}
            accessibilityRole={mode === "record" ? "radio" : "button"}
            accessibilityLabel={mode === "record" ? pet.name : openLabel}
            accessibilityHint={mode === "record" ? undefined : line}
            accessibilityState={mode === "record" ? { checked } : undefined}
            aria-checked={mode === "record" ? checked : undefined}
            onPress={() => onPress(pet.id)}
            style={({ pressed }) => [styles.row, checked && styles.rowChecked, pressed && styles.rowPressed]}
          >
            <PetAvatar pet={pet} userId={userId} size={44} />
            <View style={styles.body}>
              <Text style={styles.name} numberOfLines={2}>{pet.name}</Text>
              {mode === "browse" ? <Text style={styles.meta} numberOfLines={2}>{line}</Text> : null}
            </View>
            {mode === "record"
              ? <View style={[styles.radio, checked && styles.radioChecked]}>{checked ? <AppIcon name="check" size={iconSize.xs} color={colors.white} /> : null}</View>
              : <AppIcon name="forward" size={iconSize.sm} color={colors.textSoft} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  rowChecked: { borderColor: colors.orange, borderWidth: 2, backgroundColor: colors.surfacePeach },
  rowPressed: { backgroundColor: colors.surfaceWarm },
  body: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...type.bodyStrong },
  meta: { ...type.caption },
  radio: { width: 24, height: 24, borderRadius: radius.full, borderWidth: 2, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center", marginRight: spacing.xxs },
  radioChecked: { borderColor: colors.orange, backgroundColor: colors.orange },
});
