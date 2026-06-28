import { ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";
import type { DiaryEntry } from "../../contexts/diary/domain/diaryEntry";
import type { DoseRecord } from "../../contexts/medication/domain/medication";
import { usePetProfilePhotoUrl } from "../../contexts/pet/application/profilePhotoUrl";
import type { PetProfile } from "../../contexts/pet/domain/pet";
import { categoryVisuals } from "../../design-system/categoryVisuals";
import { AppIcon } from "../../design-system/iconography";
import { IconBubble, NoticeBanner, SectionHeader, SurfaceCard } from "../../design-system/components";
import { colors, iconSize, layout, radius, spacing, type } from "../../design-system/tokens";
import { t } from "../../i18n/translations";
import { createDashboardSummary } from "../liveUiState";
import type { ChecklistKey } from "../mockUiState";
import { AttentionStrip, CareSummaryCard, QuickActionRow } from "./HomeDashboardPanel";

const mochiHero = require("../../../assets/mochi-hero.png");

const checklistOrder: ChecklistKey[] = ["food", "water", "walk", "stool", "medication", "night"];

type Props = {
  pet: PetProfile;
  checklist: Record<ChecklistKey, boolean>;
  entries: DiaryEntry[];
  doses: DoseRecord[];
  notice: string;
  onChecklistToggle: (key: ChecklistKey) => void;
  onAddDiary: () => void;
  onRecordMedication: () => void;
  onViewReport: () => void;
  onTimelineEntryPress?: (entry: DiaryEntry) => void;
};

export function HomeScreen({ pet, checklist, entries, doses, notice, onChecklistToggle, onAddDiary, onRecordMedication, onViewReport, onTimelineEntryPress }: Props) {
  const timeline = entries.slice(0, 4);
  const profilePhoto = usePetProfilePhotoUrl(pet.id);
  const heroSource = profilePhoto.data ? { uri: profilePhoto.data } : mochiHero;
  const dashboard = createDashboardSummary(checklist, entries, doses);

  return (
    <View>
      <ImageBackground source={heroSource} resizeMode="cover" imageStyle={styles.heroImage} style={styles.heroCard}>
        <View style={styles.heroOverlay}>
          <Text style={styles.heroName}>{pet.name}</Text>
          <Text style={styles.heroMeta}>{pet.breed} - {pet.ageLabel}</Text>
          {pet.careMode ? (
            <View style={styles.heroPill}>
              <AppIcon name="diary" size={iconSize.sm} color={colors.orangeDeep} />
              <Text style={styles.heroPillText}>{t("ko", "pet.diaryMode")}</Text>
            </View>
          ) : null}
          <View style={styles.heroSummary}>
            <Text style={styles.heroSummaryText}>{t("ko", "today.dashboardCompletion")} {dashboard.completedCount}/{dashboard.totalCount}</Text>
            <Text style={styles.heroSummaryText}>{t("ko", "today.dashboardMedicationPending")} {dashboard.pendingMedicationCount}</Text>
          </View>
        </View>
      </ImageBackground>

      <View style={styles.noticeWrap}>
        <NoticeBanner text={notice} />
      </View>

      <AttentionStrip signals={dashboard.attentionSignals} />

      <SectionHeader title={t("ko", "today.checklist.full")} action={t("ko", "today.seeAll")} />
      <View style={styles.checklist}>
        {checklistOrder.map((key) => {
          const item = categoryVisuals[key];
          const done = checklist[key];
          return (
            <Pressable key={key} style={styles.checkItem} onPress={() => onChecklistToggle(key)}>
              <IconBubble name={item.icon} color={item.color} background={item.background} size={50} />
              <View style={styles.checkMark}>
                <AppIcon name={done ? "check" : "circle"} size={iconSize.xs} color={done ? colors.mintDeep : colors.textSoft} />
              </View>
              <Text style={styles.checkLabel} numberOfLines={2}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <CareSummaryCard dashboard={dashboard} doses={doses} />

      <SurfaceCard>
        <SectionHeader title={t("ko", "today.timeline.full")} action={t("ko", "today.seeAll")} />
        <View style={styles.timeline}>
          {timeline.length === 0 ? <Text style={styles.emptyTimeline}>{t("ko", "today.noTimeline")}</Text> : null}
          {timeline.map((entry) => {
            const item = categoryVisuals[entry.category];
            const row = (
              <>
                <View style={styles.timelineStem}>
                  <View style={styles.timelineDot} />
                </View>
                <Text style={styles.time}>{entry.occurredAt}</Text>
                <AppIcon name={item.icon} size={iconSize.sm} color={item.color} />
                <Text style={styles.timelineTitle}>{item.label}</Text>
                <Text style={styles.timelineValue} numberOfLines={1}>{entry.summary}</Text>
              </>
            );
            return onTimelineEntryPress ? (
              <Pressable key={entry.id} style={({ pressed }) => [styles.timelineRow, pressed && styles.timelineRowPressed]} onPress={() => onTimelineEntryPress(entry)}>
                {row}
              </Pressable>
            ) : (
              <View key={entry.id} style={styles.timelineRow}>
                {row}
              </View>
            );
          })}
        </View>
      </SurfaceCard>

      <QuickActionRow onAddDiary={onAddDiary} onRecordMedication={onRecordMedication} onViewReport={onViewReport} />
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    height: layout.heroHeight,
    borderRadius: radius.xl,
    overflow: "hidden",
    backgroundColor: colors.border,
  },
  heroImage: {
    borderRadius: radius.xl,
  },
  heroOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    padding: spacing.xxl,
    backgroundColor: colors.heroScrim,
  },
  heroName: {
    ...type.heroTitle,
  },
  heroMeta: {
    ...type.sectionTitle,
    color: colors.white,
    marginTop: spacing.xs,
  },
  heroPill: {
    alignSelf: "flex-start",
    minHeight: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surfacePeach,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  heroPillText: {
    ...type.caption,
    color: colors.orangeDeep,
    fontWeight: "600",
  },
  heroSummary: {
    alignSelf: "flex-start",
    borderRadius: radius.md,
    backgroundColor: "rgba(255, 255, 255, 0.82)",
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xxs,
  },
  heroSummaryText: {
    ...type.caption,
    color: colors.text,
    fontWeight: "700",
  },
  noticeWrap: {
    marginTop: spacing.md,
  },
  checklist: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  checkItem: {
    width: 56,
    alignItems: "center",
    position: "relative",
  },
  checkMark: {
    position: "absolute",
    top: 38,
    right: 5,
    width: 18,
    height: 18,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkLabel: {
    ...type.tiny,
    color: colors.text,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  timeline: {
    gap: spacing.md,
  },
  timelineRow: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  timelineRowPressed: {
    opacity: 0.72,
  },
  timelineStem: {
    width: 8,
    alignItems: "center",
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
    backgroundColor: colors.salmon,
  },
  time: {
    ...type.body,
    width: 54,
  },
  timelineTitle: {
    ...type.bodyStrong,
    flex: 1,
  },
  timelineValue: {
    ...type.caption,
    maxWidth: 116,
    textAlign: "right",
  },
  emptyTimeline: {
    ...type.caption,
    color: colors.textMuted,
  },
});
