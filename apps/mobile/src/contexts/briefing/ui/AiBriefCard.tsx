import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { NoticeBanner, PrimaryButton, SegmentedControl, SurfaceCard } from "../../../design-system/components";
import { AppIcon } from "../../../design-system/iconography";
import { colors, iconSize, radius, spacing, type } from "../../../design-system/tokens";
import { t } from "../../../i18n/translations";
import { useLanguage } from "../../../i18n/languageContext";
import type { AiBriefRangeDays } from "../domain/aiBrief";
import { useAiBrief } from "../application/useAiBrief";
import { buildSampleBrief } from "./sampleBrief";

type RangeValue = "3" | "7" | "14";

// Home AI brief card (PRODUCT_SPEC §6/§7): summarizes recent records via the
// generate-ai-brief edge function. Preview mode shows the sample brief; the
// localized not-a-diagnosis disclaimer is always rendered with the content.
export function AiBriefCard({
  petId,
  databaseMode,
  hasRecords,
}: {
  petId: string;
  databaseMode: boolean;
  hasRecords: boolean;
}) {
  const { language } = useLanguage();
  const [range, setRange] = useState<RangeValue>("7");
  const { brief, generating, failed, generate, reset } = useAiBrief(databaseMode ? petId : null, language);
  // The sample brief describes records, so showing it for a pet with none
  // contradicts the empty timeline directly below it on the same screen.
  const shownBrief = databaseMode ? brief : hasRecords ? buildSampleBrief(petId, language) : null;
  const emptyState = !hasRecords && !shownBrief;

  return (
    <SurfaceCard>
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <AppIcon name="spark" size={iconSize.md} color={colors.orangeDeep} />
          <Text style={styles.title}>{t("briefing.title")}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{t("briefing.notDiagnosis")}</Text>
          </View>
        </View>

        {emptyState ? <Text style={styles.copy}>{t("briefing.empty")}</Text> : null}
        {!emptyState && !shownBrief ? <Text style={styles.copy}>{t("briefing.summaryCopy")}</Text> : null}

        {databaseMode ? (
          <>
            <SegmentedControl<RangeValue>
              items={[
                { label: t("briefing.range3"), value: "3" },
                { label: t("briefing.range7"), value: "7" },
                { label: t("briefing.range14"), value: "14" },
              ]}
              value={range}
              onChange={(next) => { setRange(next); reset(); }}
            />
            <PrimaryButton
              label={t(generating ? "briefing.generating" : "briefing.generate")}
              onPress={() => generate(Number(range) as AiBriefRangeDays)}
              disabled={generating || !hasRecords}
            />
            {failed && !generating ? <NoticeBanner text={t("briefing.failed")} icon="close" tone="error" /> : null}
          </>
        ) : null}

        {shownBrief ? (
          <View style={styles.briefBody}>
            {shownBrief.highlights.map((highlight) => (
              <View key={highlight} style={styles.bulletRow}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>{highlight}</Text>
              </View>
            ))}
            <Text style={styles.sectionLabel}>{t("briefing.questionsTitle")}</Text>
            {shownBrief.questionsForVet.map((question) => (
              <View key={question} style={styles.bulletRow}>
                <View style={[styles.bulletDot, styles.questionDot]} />
                <Text style={styles.bulletText}>{question}</Text>
              </View>
            ))}
            {!databaseMode ? <Text style={styles.previewNote}>{t("briefing.previewNotice")}</Text> : null}
          </View>
        ) : null}

        <Text style={styles.disclaimer}>{t("briefing.disclaimer")}</Text>
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  title: {
    ...type.sectionTitle,
    flex: 1,
  },
  badge: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfacePeach,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  badgeText: {
    ...type.tiny,
    color: colors.orangeDeep,
  },
  copy: {
    ...type.body,
    color: colors.textMuted,
  },
  briefBody: {
    gap: spacing.sm,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.orangeDeep,
    marginTop: 7,
  },
  questionDot: {
    backgroundColor: colors.mintDeep,
  },
  bulletText: {
    ...type.body,
    color: colors.text,
    flex: 1,
  },
  sectionLabel: {
    ...type.bodyStrong,
    color: colors.text,
    marginTop: spacing.xs,
  },
  previewNote: {
    ...type.caption,
    color: colors.textMuted,
  },
  disclaimer: {
    ...type.caption,
    color: colors.textMuted,
  },
});
