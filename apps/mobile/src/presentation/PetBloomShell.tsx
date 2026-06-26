import { useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import type { DiaryEntry } from "../contexts/diary/domain/diaryEntry";
import type { DoseRecord } from "../contexts/medication/domain/medication";
import { AppIcon } from "../design-system/iconography";
import { colors, iconSize, layout, radius, spacing, type } from "../design-system/tokens";
import { t } from "../i18n/translations";
import { DiaryEntryScreen } from "./screens/DiaryEntryScreen";
import { CareModeScreen } from "./screens/CareModeScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { ReportsScreen } from "./screens/ReportsScreen";
import { BottomNav, type MainTab } from "./ui/BottomNav";
import {
  createMockDiaryEntry,
  initialChecklist,
  initialDiaryEntries,
  initialDoses,
  mockPets,
  nextDoseStatus,
  type ChecklistKey,
  type DraftDiaryEntry,
  type ReportStage,
} from "./mockUiState";

export function PetBloomShell() {
  const [activeTab, setActiveTab] = useState<MainTab>("today");
  const [activePetIndex, setActivePetIndex] = useState(0);
  const [checklist, setChecklist] = useState(initialChecklist);
  const [entries, setEntries] = useState<DiaryEntry[]>(initialDiaryEntries);
  const [doses, setDoses] = useState<DoseRecord[]>(initialDoses);
  const [reportStage, setReportStage] = useState<ReportStage>("draft");
  const [notice, setNotice] = useState(t("en", "today.previewNotice"));
  const activePet = mockPets[activePetIndex];

  function togglePet() {
    setActivePetIndex((index) => (index + 1) % mockPets.length);
    setNotice(t("en", "today.petSwitched"));
  }

  function toggleChecklist(key: ChecklistKey) {
    setChecklist((current) => ({ ...current, [key]: !current[key] }));
    setNotice(t("en", "today.checklistUpdated"));
  }

  function saveDiaryEntry(draft: DraftDiaryEntry) {
    const nextEntry = createMockDiaryEntry(activePet.id, draft);
    setEntries((current) => [nextEntry, ...current]);
    setChecklist((current) => ({ ...current, [draft.category]: true }));
    setNotice(t("en", "today.diarySaved"));
    setActiveTab("today");
  }

  function cycleDoseStatus(id: string) {
    setDoses((current) => current.map((dose) => (dose.id === id ? { ...dose, status: nextDoseStatus(dose.status) } : dose)));
    setChecklist((current) => ({ ...current, medication: true }));
    setNotice(t("en", "today.medicationUpdated"));
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.appFrame}>
        {activeTab === "today" ? <HomeHeader petName={activePet.name} onPetPress={togglePet} /> : null}
        {activeTab === "diary" ? <DiaryHeader onBack={() => setActiveTab("today")} /> : null}
        {activeTab === "care" ? <CareHeader /> : null}
        {activeTab === "reports" ? <ReportsHeader /> : null}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, activeTab === "today" && styles.homeScrollContent]}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === "today" ? (
            <HomeScreen pet={activePet} checklist={checklist} entries={entries} notice={notice} onChecklistToggle={toggleChecklist} />
          ) : null}
          {activeTab === "diary" ? <DiaryEntryScreen onSave={saveDiaryEntry} /> : null}
          {activeTab === "care" ? <CareModeScreen doses={doses} onDosePress={cycleDoseStatus} onGenerateReport={() => setActiveTab("reports")} /> : null}
          {activeTab === "reports" ? (
            <ReportsScreen reportStage={reportStage} onReportStageChange={setReportStage} onNewDiary={() => setActiveTab("diary")} />
          ) : null}
        </ScrollView>

        <BottomNav activeTab={activeTab} onChange={setActiveTab} />
      </View>
    </SafeAreaView>
  );
}

function HomeHeader({ petName, onPetPress }: { petName: string; onPetPress: () => void }) {
  return (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <AppIcon name="logo" size={34} color={colors.orange} />
        <Text style={styles.brandText}>PetBloom</Text>
      </View>
      <View style={styles.headerActions}>
        <Pressable style={styles.petSwitch} onPress={onPetPress}>
          <AppIcon name="pet" size={iconSize.sm} color={colors.orangeDeep} />
          <Text style={styles.petSwitchText}>{petName}</Text>
        </Pressable>
        <View style={styles.bellWrap}>
          <AppIcon name="bell" size={iconSize.lg} color={colors.text} />
          <View style={styles.notificationDot} />
        </View>
        <AppIcon name="menu" size={iconSize.lg} color={colors.text} />
      </View>
    </View>
  );
}

function DiaryHeader({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <AppIconButton iconName="back" onPress={onBack} />
      <Text style={styles.screenTitle}>{t("en", "diary.title")}</Text>
      <AppIcon name="calendar" size={iconSize.lg} color={colors.text} />
    </View>
  );
}

function CareHeader() {
  return (
    <View style={styles.header}>
      <View style={styles.careTitleRow}>
        <View style={styles.careBadge}>
          <AppIcon name="care" size={iconSize.lg} color={colors.white} />
        </View>
        <Text style={styles.screenTitle}>{t("en", "care.eyebrow")}</Text>
      </View>
      <AppIcon name="settings" size={iconSize.lg} color={colors.text} />
    </View>
  );
}

function ReportsHeader() {
  return (
    <View style={styles.header}>
      <View style={styles.careTitleRow}>
        <AppIcon name="reports" size={iconSize.lg} color={colors.orangeDeep} />
        <Text style={styles.screenTitle}>{t("en", "tabs.reports")}</Text>
      </View>
      <AppIcon name="settings" size={iconSize.lg} color={colors.text} />
    </View>
  );
}

function AppIconButton({ iconName, onPress }: { iconName: "back"; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.headerIconTouch}>
      <AppIcon name={iconName} size={iconSize.lg} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.appBackground,
  },
  appFrame: {
    flex: 1,
    width: "100%",
    maxWidth: 430,
    alignSelf: "center",
    backgroundColor: colors.appBackground,
  },
  header: {
    minHeight: 70,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  brandText: {
    ...type.brand,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  petSwitch: {
    minHeight: 34,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  petSwitchText: {
    ...type.caption,
    color: colors.text,
    fontWeight: "600",
  },
  bellWrap: {
    position: "relative",
  },
  notificationDot: {
    position: "absolute",
    top: 2,
    right: 1,
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.coral,
    borderWidth: 1,
    borderColor: colors.appBackground,
  },
  screenTitle: {
    ...type.screenTitle,
  },
  careTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  careBadge: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.salmon,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconTouch: {
    width: 44,
    height: 44,
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: layout.bottomNavHeight + spacing.xl,
  },
  homeScrollContent: {
    paddingTop: 0,
  },
});
