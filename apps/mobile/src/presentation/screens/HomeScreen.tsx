import { ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";
import type { DiaryEntry } from "../../contexts/diary/domain/diaryEntry";
import type { DoseRecord } from "../../contexts/medication/domain/medication";
import type { TodayMedicationAgendaRow } from "../../contexts/medication/ui/todayMedicationAgenda";
import { usePetProfilePhotoUrl } from "../../contexts/pet/application/profilePhotoUrl";
import { formatPetMetaLine, type PetProfile } from "../../contexts/pet/domain/pet";
import { categoryVisuals } from "../../design-system/categoryVisuals";
import { AppIcon } from "../../design-system/iconography";
import { IconBubble, NoticeBanner, SectionHeader, SurfaceCard, type NoticeTone } from "../../design-system/components";
import { colors, font, iconSize, layout, radius, spacing, type } from "../../design-system/tokens";
import { t } from "../../i18n/translations";
import { useLanguage } from "../../i18n/languageContext";
import { getDiaryEntryDisplaySummary } from "../../contexts/diary/ui/diaryEntryDisplay";
import { createDashboardSummary, getTodayChecklistOrder } from "../shell/todayChecklist";
import type { ChecklistKey } from "../shell/todayChecklist";
import { AttentionStrip, CareSummaryCard } from "./HomeDashboardPanel";

const mochiHero = require("../../../assets/mochi-hero.png");

type Props = {
  pet: PetProfile;
  userId?: string | null;
  checklist: Record<ChecklistKey, boolean>;
  entries: DiaryEntry[];
  doses: DoseRecord[];
  medicationAgenda?: TodayMedicationAgendaRow[];
  walkEnabled: boolean;
  includeMedication?: boolean;
  showMedicationSummary?: boolean;
  notice: string;
  noticeTone?: NoticeTone;
  onChecklistToggle: (key: ChecklistKey) => void;
  onViewTimelineAll: () => void;
  onTimelineEntryPress?: (entry: DiaryEntry) => void;
};

export function HomeScreen({ pet, userId = null, checklist, entries, doses, medicationAgenda = [], walkEnabled, includeMedication = true, showMedicationSummary = includeMedication, notice, noticeTone = "success", onChecklistToggle, onViewTimelineAll, onTimelineEntryPress }: Props) {
  const { language } = useLanguage();
  const timeline = entries.slice(0, 4);
  const profilePhoto = usePetProfilePhotoUrl(pet.id, userId);
  const heroSource = profilePhoto.data ? { uri: profilePhoto.data } : mochiHero;
  const checklistOrder = getTodayChecklistOrder({ walkEnabled, includeMedication });
  const dashboard = createDashboardSummary(checklist, entries, doses, checklistOrder, medicationAgenda);
  const heroMeta = formatPetMetaLine(pet, language);

  return (
    <View>
      <ImageBackground source={heroSource} resizeMode="cover" imageStyle={styles.heroImage} style={styles.heroCard}>
        <View style={styles.heroOverlay}>
          <Text style={styles.heroName}>{pet.name}</Text>
          {heroMeta ? <Text style={styles.heroMeta}>{heroMeta}</Text> : null}
        </View>
      </ImageBackground>

      <View style={styles.heroInfo}>
        <View style={styles.heroSummary}>
          <View style={styles.heroSummaryItem}>
            <Text style={styles.heroSummaryLabel}>{t("ko", "today.dashboardCompletion")}</Text>
            <Text style={styles.heroSummaryValue}>{dashboard.completedCount}/{dashboard.totalCount}</Text>
          </View>
          {showMedicationSummary ? <View style={styles.heroSummaryItem}>
            <Text style={styles.heroSummaryLabel}>{t("ko", "today.dashboardMedicationPending")}</Text>
            <Text style={styles.heroSummaryValue}>{dashboard.pendingMedicationCount}</Text>
          </View> : null}
        </View>
      </View>

      {notice ? (
        <View style={styles.noticeWrap}>
          <NoticeBanner text={notice} tone={noticeTone} icon={noticeTone === "error" ? "close" : "check"} />
        </View>
      ) : null}

      <AttentionStrip signals={dashboard.attentionSignals} />

      <SectionHeader
        title={t("ko", "today.checklist.full")}
      />
      <View style={styles.checklist}>
        {checklistOrder.map((key) => {
          const item = categoryVisuals[key];
          const done = checklist[key];
          const label = t("ko", item.labelKey);
          return (
            <Pressable
              key={key}
              accessibilityRole="checkbox"
              accessibilityLabel={`${label}, ${t("ko", done ? "today.checklistStatusComplete" : "today.checklistStatusIncomplete")}`}
              accessibilityState={{ checked: done }}
              aria-checked={done}
              style={styles.checkItem}
              onPress={() => onChecklistToggle(key)}
            >
              <IconBubble name={item.icon} color={item.color} background={item.background} size={50} />
              <View style={styles.checkMark}>
                <AppIcon name={done ? "check" : "circle"} size={iconSize.xs} color={done ? colors.mintDeep : colors.textSoft} />
              </View>
              <Text style={styles.checkLabel} numberOfLines={2}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {showMedicationSummary ? <CareSummaryCard dashboard={dashboard} doses={doses} /> : null}

      <View style={styles.timelineCard}>
        <SurfaceCard>
          <SectionHeader title={t("ko", "today.timeline.full")} action={t("ko", "today.seeAll")} onActionPress={onViewTimelineAll} />
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
                  <Text style={styles.timelineTitle}>{t("ko", item.labelKey)}</Text>
                  <Text style={styles.timelineValue} numberOfLines={1}>{getDiaryEntryDisplaySummary(entry)}</Text>
                </>
              );
              return onTimelineEntryPress ? (
                <Pressable
                  key={entry.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${entry.occurredAt} ${t("ko", item.labelKey)} ${getDiaryEntryDisplaySummary(entry)}`.trim()}
                  style={({ pressed }) => [styles.timelineRow, pressed && styles.timelineRowPressed]}
                  onPress={() => onTimelineEntryPress(entry)}
                >
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
      </View>

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
  heroImage: { borderRadius: radius.xl },
  heroOverlay: { flex: 1, justifyContent: "flex-end", padding: spacing.xxl, backgroundColor: colors.heroScrim },
  heroName: { ...type.heroTitle, textShadowColor: colors.heroScrim, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  heroMeta: { ...type.sectionTitle, color: colors.white, marginTop: spacing.xs, textShadowColor: colors.heroScrim, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 5 },
  heroInfo: { marginTop: spacing.md, gap: spacing.md },
  heroSummary: { flexDirection: "row", gap: spacing.sm },
  heroSummaryItem: { flex: 1, minHeight: 58, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, justifyContent: "center" },
  heroSummaryLabel: { ...type.caption },
  heroSummaryValue: { ...type.sectionTitle, color: colors.text, fontWeight: font.weight.bold, marginTop: spacing.xxs },
  noticeWrap: { marginTop: spacing.md },
  checklist: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  checkItem: { width: 56, alignItems: "center", position: "relative" },
  checkMark: { position: "absolute", top: 38, right: 5, width: 18, height: 18, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  checkLabel: { ...type.tiny, color: colors.text, textAlign: "center", marginTop: spacing.xs },
  timelineCard: { marginTop: spacing.md },
  timeline: { gap: spacing.md },
  timelineRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.md },
  timelineRowPressed: { opacity: 0.72 },
  timelineStem: { width: 8, alignItems: "center" },
  timelineDot: { width: 10, height: 10, borderRadius: radius.full, backgroundColor: colors.salmon },
  time: { ...type.body, width: 54 },
  timelineTitle: { ...type.bodyStrong, flex: 1 },
  timelineValue: { ...type.caption, maxWidth: 116, textAlign: "right" },
  emptyTimeline: { ...type.caption, color: colors.textMuted },
});
