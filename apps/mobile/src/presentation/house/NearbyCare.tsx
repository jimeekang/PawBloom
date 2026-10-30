import { Pressable, StyleSheet, Text, View } from "react-native";
import type { PetProfile } from "../../contexts/pet/domain/pet";
import { colors, radius, spacing, type } from "../../design-system/tokens";
import { t } from "../../i18n/translations";
import { todayCareItemTitle, type TodayCarePetState } from "../screens/TodayCareScreen";
import { PetAvatar } from "./PetAvatar";

export function NearbyCare({ pets, userId, careStates, onOpenPet }: { pets: readonly PetProfile[]; userId: string | null; careStates: readonly TodayCarePetState[]; onOpenPet: (id: string) => void }) {
  const now = new Date(), time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const rows = pets.flatMap((pet) => {
    const state = careStates.find((entry) => entry.petId === pet.id);
    return state?.status === "ready" ? state.items.filter((item) => item.status === "pending").map((item) => ({ pet, item })) : [];
  }).sort((a, b) => {
    // Upcoming schedules first, then still-pending past schedules, then daily records.
    // This selects display rows only; the shared care calculation and statuses stay unchanged.
    const priority = (scheduled?: string) => !scheduled ? 2 : scheduled >= time ? 0 : 1;
    return priority(a.item.scheduledTime) - priority(b.item.scheduledTime) || (a.item.scheduledTime ?? "99:99").localeCompare(b.item.scheduledTime ?? "99:99");
  }).slice(0, 2);
  const failed = pets.some((pet) => careStates.find((state) => state.petId === pet.id)?.status === "error");
  const loading = pets.some((pet) => !careStates.some((state) => state.petId === pet.id && state.status !== "loading"));
  return <View style={styles.card}>
    <Text style={styles.title} accessibilityRole="header">{t("character.nearCare")}</Text>
    {rows.map(({ pet, item }) => <Pressable key={`${pet.id}:${item.id}`} accessibilityRole="button" accessibilityLabel={`${pet.name}, ${item.scheduledTime ?? t("todayCare.anytime")}, ${todayCareItemTitle(item)}`} onPress={() => onOpenPet(pet.id)} style={styles.row}>
      <PetAvatar pet={pet} userId={userId} size={36} characterOnly />
      <View style={styles.body}><Text style={styles.name}>{pet.name}</Text><Text style={styles.caption} numberOfLines={2}>{todayCareItemTitle(item)}</Text></View>
      <Text style={styles.time}>{item.scheduledTime ?? t("todayCare.anytime")}</Text>
    </Pressable>)}
    {failed || loading || !rows.length ? <Text style={styles.caption}>{t(failed ? "house.careFailed" : loading ? "house.careLoading" : "house.careNone")}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  card: { padding: spacing.md, gap: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  title: { ...type.bodyStrong }, row: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.sm }, body: { flex: 1, minWidth: 0 },
  name: { ...type.bodyStrong }, caption: { ...type.caption }, time: { ...type.bodyStrong, color: colors.pendingText, maxWidth: 85 },
});
