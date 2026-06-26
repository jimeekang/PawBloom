import { useMemo, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import type { DiaryEntry } from "../contexts/diary/domain/diaryEntry";
import type { DoseRecord } from "../contexts/medication/domain/medication";
import { useAuth } from "../contexts/identity/application/authContext";
import { colors, layout } from "../design-system/tokens";
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
import { type PetProfile } from "../contexts/pet/domain/pet";
import { CareHeader, DiaryHeader, HomeHeader, ReportsHeader } from "./shell/ShellHeaders";

type PawBloomShellProps = {
  activePet?: PetProfile | null;
  pets?: PetProfile[];
  onPetNext?: () => void;
};

export function PawBloomShell({ activePet: externalActivePet, pets: externalPets, onPetNext }: PawBloomShellProps = {}) {
  const { activePet: authActivePet, pets: authPets, selectNextPet, signOut } = useAuth();

  const shellPets = externalPets ?? authPets;
  const activePet = useMemo(() => externalActivePet ?? authActivePet ?? mockPets[0], [authActivePet, externalActivePet]);
  const canCyclePet = shellPets.length > 1;

  const [activeTab, setActiveTab] = useState<MainTab>("today");
  const [checklist, setChecklist] = useState(initialChecklist);
  const [entries, setEntries] = useState<DiaryEntry[]>(initialDiaryEntries);
  const [doses, setDoses] = useState<DoseRecord[]>(initialDoses);
  const [reportStage, setReportStage] = useState<ReportStage>("draft");
  const [notice, setNotice] = useState(t("en", "today.previewNotice"));

  const activeEntries = useMemo(() => entries.filter((entry) => entry.petId === activePet.id), [entries, activePet.id]);
  const activeDoses = useMemo(() => doses.filter((dose) => dose.petId === activePet.id), [doses, activePet.id]);

  const handlePetPress = () => {
    if (canCyclePet) {
      if (onPetNext) {
        onPetNext();
      } else {
        selectNextPet();
      }
    }
    setNotice(t("en", "today.petSwitched"));
  };

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

  function handleSignOut() {
    void signOut();
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.appFrame}>
        {activeTab === "today" ? <HomeHeader petName={activePet.name} onPetPress={handlePetPress} canSwitchPet={canCyclePet} /> : null}
        {activeTab === "diary" ? <DiaryHeader onBack={() => setActiveTab("today")} /> : null}
        {activeTab === "care" ? <CareHeader /> : null}
        {activeTab === "reports" ? <ReportsHeader onSignOut={handleSignOut} /> : null}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, activeTab === "today" && styles.homeScrollContent]}
          showsVerticalScrollIndicator={false}
        >
          {activeTab === "today" ? (
            <HomeScreen pet={activePet} checklist={checklist} entries={activeEntries} notice={notice} onChecklistToggle={toggleChecklist} />
          ) : null}
          {activeTab === "diary" ? <DiaryEntryScreen onSave={saveDiaryEntry} /> : null}
          {activeTab === "care" ? <CareModeScreen doses={activeDoses} onDosePress={cycleDoseStatus} onGenerateReport={() => setActiveTab("reports")} /> : null}
          {activeTab === "reports" ? (
            <ReportsScreen reportStage={reportStage} onReportStageChange={setReportStage} onNewDiary={() => setActiveTab("diary")} />
          ) : null}
        </ScrollView>

        <BottomNav activeTab={activeTab} onChange={setActiveTab} />
      </View>
    </SafeAreaView>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: layout.bottomNavHeight + 24,
  },
  homeScrollContent: {
    paddingTop: 0,
  },
});
