import { useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import type { PetProfile } from "../../contexts/pet/domain/pet";
import { categoryVisuals, type CategoryKey } from "../../design-system/categoryVisuals";
import { AppIcon, type AppIconName } from "../../design-system/iconography";
import { colors, iconSize } from "../../design-system/tokens";
import { useLanguage } from "../../i18n/languageContext";
import { t, type TranslationKey } from "../../i18n/translations";
import type { CareDestination } from "../navigation/appRoute";
import { PetNameChip, StatusChip, type StatusTone } from "../house/PetNameChip";
import { styles } from "./TodayCareScreen.styles";
export type TodayCareItem = { id: string; label: string; source: "routine" | "schedule" | "dose"; dateKey: string; scheduledTime?: string; status: "pending" | "completed" | "partial" | "skipped"; scheduleId?: string; doseId?: string; destination?: CareDestination };
export type TodayCarePetState = { petId: string; status: "loading" | "ready" | "error"; items: readonly TodayCareItem[] };
export type TodayCareScreenProps = {
  /** Local date shared by the future aggregate hook and each item destination. */
  dateKey: string;
  /** Current accessible pets; stale hook results for removed IDs are ignored. */
  pets: readonly PetProfile[];
  /** Aggregate state; petStates preserve each independent failure. */
  status: "loading" | "ready" | "error";
  /** Independent pet results preserve partial loading and failure. */
  petStates: readonly TodayCarePetState[];
  /** Opens the named pet and optional schedule/date; never records completion. */
  onOpenPet: (petId: string, destination?: CareDestination) => void;
  /** Retries only the named pet. */
  onRetryPet: (petId: string) => void;
};

const medicationStatus: Record<TodayCareItem["status"], { tone: StatusTone; icon: AppIconName; short: TranslationKey; long: TranslationKey }> = {
  pending: { tone: "pending", icon: "time", short: "todayCare.scheduled", long: "care.status.pending" },
  completed: { tone: "success", icon: "check", short: "care.status.completedShort", long: "care.status.completed" },
  partial: { tone: "warning", icon: "partial", short: "care.status.partialShort", long: "care.status.partial" },
  skipped: { tone: "neutral", icon: "skipped", short: "care.status.skippedShort", long: "care.status.skipped" },
};

/** Status shown as icon + words; partial and skipped stay distinct from done. */
export function todayCareStatus(item: TodayCareItem) {
  if (item.source === "routine") {
    const done = item.status !== "pending";
    const label = t(done ? "todayCare.routineDone" : "todayCare.routinePending");
    return { tone: (done ? "success" : "pending") as StatusTone, icon: (done ? "check" : "circle") as AppIconName, short: label, long: label };
  }
  const status = medicationStatus[item.status];
  return { tone: status.tone, icon: status.icon, short: t(status.short), long: t(status.long) };
}

/**
 * Medication rows arrive as "HH:mm Name · Status"; the screen shows time and
 * status separately, so it shows only the name. Unknown formats fall back to
 * the full label rather than hiding text.
 */
export function todayCareItemTitle(item: TodayCareItem) {
  if (item.source === "routine") return item.label;
  let title = item.label;
  if (item.scheduledTime && title.startsWith(`${item.scheduledTime} `)) title = title.slice(item.scheduledTime.length + 1);
  const suffix = ` · ${t(medicationStatus[item.status].long)}`;
  if (title.endsWith(suffix)) title = title.slice(0, -suffix.length);
  return title.trim() || item.label;
}

export function todayCareVisual(item: TodayCareItem) {
  const category = item.source === "routine" ? item.id.replace(/^routine-/, "") : "medication";
  return categoryVisuals[(category in categoryVisuals ? category : "medication") as CategoryKey];
}

/** Earliest pending timed item at/after now, else the earliest pending item. */
export function nextTodayCareItem(items: readonly TodayCareItem[], nowTime: string) {
  const pending = items.filter((item) => item.status === "pending").sort((a, b) => (a.scheduledTime ?? "99:99").localeCompare(b.scheduledTime ?? "99:99"));
  return pending.find((item) => item.scheduledTime && item.scheduledTime >= nowTime) ?? pending.find((item) => !item.scheduledTime) ?? pending[0];
}

export function formatCareDate(dateKey: string, language: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
  if (Number.isNaN(date.getTime())) return dateKey;
  return new Intl.DateTimeFormat(language === "ko" ? "ko-KR" : "en-AU", { month: "long", day: "numeric", weekday: "long" }).format(date);
}

export function TodayCareScreen({ dateKey, pets, status, petStates, onOpenPet, onRetryPet }: TodayCareScreenProps) {
  const { language } = useLanguage();
  const [filter, setFilter] = useState("all");
  const activeFilter = pets.some((pet) => pet.id === filter) ? filter : "all";
  const visiblePets = pets.filter((pet) => activeFilter === "all" || pet.id === activeFilter);
  const stateFor = (petId: string) => petStates.find((state) => state.petId === petId);
  const failed = visiblePets.filter((pet) => stateFor(pet.id)?.status === "error");
  const loading = visiblePets.filter((pet) => { const state = stateFor(pet.id); return !state || state.status === "loading"; });
  const rows = visiblePets.flatMap((pet) => {
    const state = stateFor(pet.id);
    return state?.status === "ready" ? state.items.filter((item) => item.dateKey === dateKey).map((item) => ({ pet, item })) : [];
  }).sort((a, b) => (a.item.scheduledTime ?? "").localeCompare(b.item.scheduledTime ?? "") || a.pet.name.localeCompare(b.pet.name) || a.item.id.localeCompare(b.item.id));
  const timed = rows.filter((row) => row.item.scheduledTime), anytime = rows.filter((row) => !row.item.scheduledTime);
  const settled = !failed.length && !loading.length;

  return (
    <View style={styles.screen}>
      <Text style={styles.eyebrow}>{t("care.eyebrow")}</Text>
      <View style={styles.dateRow}>
        <AppIcon name="calendar" size={iconSize.sm} color={colors.orangeDeep} />
        <Text style={styles.dateText} accessibilityRole="header">{formatCareDate(dateKey, language)}</Text>
        <Text style={styles.todayBadge}>{t("todayCare.today")}</Text>
      </View>
      {pets.length > 1 ? (
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
            <Text style={styles.errorText}>{t("todayCare.petLoadFailed").replace("{petName}", pet.name)}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t("todayCare.retryPet").replace("{petName}", pet.name)} onPress={() => onRetryPet(pet.id)} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
              <AppIcon name="retry" size={iconSize.sm} color={colors.orangeDeep} />
              <Text style={styles.retryText}>{t("diary.listRetry")}</Text>
            </Pressable>
          </View>
        ))}
        {loading.map((pet) => (
          <View key={`loading-${pet.id}`} style={styles.loadingRow}>
            <ActivityIndicator size="small" color={colors.orangeDeep} />
            <Text style={styles.loadingText}>{t("todayCare.petLoading").replace("{petName}", pet.name)}</Text>
          </View>
        ))}
      </View>
      {!pets.length ? <EmptyCard title={t("pet.empty")} /> : null}
      {pets.length && settled && status !== "loading" && !rows.length ? <EmptyCard title={t("todayCare.emptyTitle")} copy={t("todayCare.emptyCopy")} /> : null}
      {timed.length ? <Section title={t("todayCare.timedTitle")}>{timed.map(({ pet, item }) => <CareRow key={`${pet.id}:${item.id}`} pet={pet} item={item} onPress={() => onOpenPet(pet.id, item.destination)} />)}</Section> : null}
      {anytime.length ? <Section title={t("todayCare.anytimeTitle")}>{anytime.map(({ pet, item }) => <CareRow key={`${pet.id}:${item.id}`} pet={pet} item={item} onPress={() => onOpenPet(pet.id, item.destination)} />)}</Section> : null}
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <View style={styles.section}><Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text><View style={styles.list}>{children}</View></View>;
}

function EmptyCard({ title, copy }: { title: string; copy?: string }) {
  return (
    <View style={styles.emptyCard}>
      <AppIcon name="today" size={iconSize.lg} color={colors.textSoft} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {copy ? <Text style={styles.emptyCopy}>{copy}</Text> : null}
    </View>
  );
}

function CareRow({ pet, item, onPress }: { pet: PetProfile; item: TodayCareItem; onPress: () => void }) {
  const visual = todayCareVisual(item), state = todayCareStatus(item), title = todayCareItemTitle(item);
  const time = item.scheduledTime ?? t("todayCare.anytime");
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${pet.name}, ${title}, ${time}, ${state.long}`} accessibilityHint={t("todayCare.openHint")} onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      {item.scheduledTime ? <Text style={styles.rowTime}>{item.scheduledTime}</Text> : null}
      <View style={[styles.rowIcon, { backgroundColor: visual.background }]}><AppIcon name={visual.icon} size={iconSize.sm} color={visual.color} /></View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={2}>{title}</Text>
        <PetNameChip pet={pet} />
      </View>
      <StatusChip tone={state.tone} icon={state.icon} label={state.short} />
    </Pressable>
  );
}
