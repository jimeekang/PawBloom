import { useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from "react-native";
import type { DiaryEntry } from "../../contexts/diary/domain/diaryEntry";
import type { PetProfile } from "../../contexts/pet/domain/pet";
import type { DiaryMemoryPetState } from "../../contexts/diary/application/diaryMemories";
import { getDiaryEntryDisplaySummary } from "../../contexts/diary/ui/diaryEntryDisplay";
import { AppIcon } from "../../design-system/iconography";
import { colors, iconSize } from "../../design-system/tokens";
import { useLanguage } from "../../i18n/languageContext";
import { can } from "../../shared-kernel/permissions";
import { t } from "../../i18n/translations";
import { PetNameChip } from "../house/PetNameChip";
import { formatCareDate } from "./TodayCareScreen";
import { styles } from "./MemoriesScreen.styles";
export type MemoriesScreenProps = {
  /** Current accessible pets; records outside this list never render. */
  pets: readonly PetProfile[];
  /** Photo/memo diary sources with independent loading/error states. */
  petStates: readonly DiaryMemoryPetState[];
  /** Optional detail scope; absent displays all accessible pets. */
  petId?: string;
  /** Opens the original diary editor with the original entry's petId. */
  onOpenDiaryEntry: (entry: DiaryEntry) => void;
  /** Retries the exact pet, preserving other successful results. */
  onRetryPet: (petId: string) => void;
};

/** Text shown for an existing photo/memo record; placeholders never pose as a story. */
export function memoryText(entry: DiaryEntry) {
  if (entry.category === "memo") return entry.memo?.trim() || getDiaryEntryDisplaySummary(entry);
  return entry.memo?.trim() ?? "";
}

export function MemoriesScreen({ pets, petStates, petId, onOpenDiaryEntry, onRetryPet }: MemoriesScreenProps) {
  const { language } = useLanguage();
  const [filter, setFilter] = useState("all");
  const scoped = petId ? pets.filter((pet) => pet.id === petId) : pets;
  const activeFilter = !petId && scoped.some((pet) => pet.id === filter) ? filter : "all";
  const visiblePets = scoped.filter((pet) => activeFilter === "all" || pet.id === activeFilter);
  const stateFor = (id: string) => petStates.find((state) => state.petId === id);
  const failed = visiblePets.filter((pet) => stateFor(pet.id)?.status === "error");
  const loading = visiblePets.filter((pet) => { const state = stateFor(pet.id); return !state || state.status === "loading"; });
  const cards = visiblePets.flatMap((pet) => {
    const state = stateFor(pet.id);
    // The entry's own petId must match: a record never renders under another pet.
    return state?.status === "ready" ? state.items.filter((item) => item.entry.petId === pet.id).map(({ entry, source }) => ({ pet, entry, source })) : [];
  }).sort((a, b) => b.entry.entryDate.localeCompare(a.entry.entryDate) || b.entry.occurredAt.localeCompare(a.entry.occurredAt) || a.entry.id.localeCompare(b.entry.id));
  const groups = cards.reduce<{ dateKey: string; cards: typeof cards }[]>((result, card) => {
    const last = result[result.length - 1];
    if (last?.dateKey === card.entry.entryDate) last.cards.push(card); else result.push({ dateKey: card.entry.entryDate, cards: [card] });
    return result;
  }, []);
  const settled = !failed.length && !loading.length;

  return (
    <View style={styles.screen}>
      {!petId && pets.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} accessibilityRole="radiogroup" accessibilityLabel={t("todayCare.filterLabel")}>
          {[{ id: "all", name: t("todayCare.filterAll") }, ...pets].map((option) => {
            const checked = activeFilter === option.id;
            return (
              <Pressable key={option.id} accessibilityRole="radio" accessibilityLabel={option.name} accessibilityState={{ checked }} aria-checked={checked} onPress={() => setFilter(option.id)} style={({ pressed }) => [styles.filterChip, checked && styles.filterChipActive, pressed && styles.pressed]}>
                <Text style={[styles.filterText, checked && styles.filterTextActive]} numberOfLines={1}>{option.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      <View accessibilityLiveRegion="polite" style={styles.stateStack}>
        {failed.map((pet) => (
          <View key={`error-${pet.id}`} accessibilityRole="alert" style={styles.errorCard}>
            <AppIcon name="alert" size={iconSize.md} color={colors.danger} />
            <Text style={styles.errorText}>{t("memories.petLoadFailed").replace("{petName}", pet.name)}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t("todayCare.retryPet").replace("{petName}", pet.name)} onPress={() => onRetryPet(pet.id)} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
              <AppIcon name="retry" size={iconSize.sm} color={colors.orangeDeep} />
              <Text style={styles.retryText}>{t("diary.listRetry")}</Text>
            </Pressable>
          </View>
        ))}
        {loading.map((pet) => (
          <View key={`loading-${pet.id}`} style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.orangeDeep} />
            <Text style={styles.loadingText}>{t("memories.petLoading").replace("{petName}", pet.name)}</Text>
          </View>
        ))}
      </View>
      {settled && !cards.length ? (
        <View style={styles.emptyCard}>
          <AppIcon name="memories" size={iconSize.lg} color={colors.textSoft} />
          <Text style={styles.emptyTitle}>{t("memories.emptyDiary")}</Text>
          <Text style={styles.emptyCopy}>{t("memories.emptyCopy")}</Text>
        </View>
      ) : null}
      {groups.map((group) => (
        <View key={group.dateKey} style={styles.group}>
          <Text style={styles.groupTitle} accessibilityRole="header">{formatCareDate(group.dateKey, language)}</Text>
          {group.cards.map(({ pet, entry, source }) => <MemoryCard key={`${source}:${entry.id}`} pet={pet} entry={entry} onOpen={can(pet.role, "diary.update") ? () => onOpenDiaryEntry(entry) : undefined} />)}
        </View>
      ))}
    </View>
  );
}

function MemoryCard({ pet, entry, onOpen }: { pet: PetProfile; entry: DiaryEntry; onOpen?: () => void }) {
  const text = memoryText(entry);
  const photos = entry.photoUrls ?? [];
  const photoCount = photos.length || entry.photoCount || 0;
  const description = [pet.name, entry.occurredAt, text, photoCount ? t("diary.photoCount").replace("{count}", String(photoCount)) : "", t("memories.diarySource")].filter(Boolean).join(", ");
  const body = (
    <>
      <View style={styles.cardTop}>
        <PetNameChip pet={pet} />
        <Text style={styles.cardTime}>{entry.occurredAt}</Text>
        <View style={styles.sourceBadge}><Text style={styles.sourceText}>{t("memories.diarySource")}</Text></View>
      </View>
      {photos.length ? (
        <View style={styles.photoGrid}>
          {photos.slice(0, 5).map((uri, index) => <Image key={uri} source={{ uri }} accessibilityIgnoresInvertColors style={[styles.photo, photos.length === 1 ? styles.photoSingle : null, index === 0 && photos.length > 2 ? styles.photoLead : null]} />)}
        </View>
      ) : photoCount ? <Text style={styles.photoCount}>{t("diary.photoCount").replace("{count}", String(photoCount))}</Text> : null}
      {text ? <Text style={styles.cardText} numberOfLines={5}>{text}</Text> : null}
      <View style={styles.cardFooter}>
        <AppIcon name={onOpen ? "edit" : "eye"} size={iconSize.xs} color={onOpen ? colors.orangeDeep : colors.textMuted} />
        <Text style={[styles.footerText, onOpen && styles.footerAction]}>{onOpen ? t("memories.openOriginal") : t("memories.viewOnly")}</Text>
      </View>
    </>
  );
  if (!onOpen) return <View accessible accessibilityLabel={description} style={styles.card}>{body}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${t("memories.editDiary").replace("{petName}", pet.name)}. ${description}`} onPress={onOpen} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      {body}
    </Pressable>
  );
}
