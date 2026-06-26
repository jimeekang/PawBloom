import { useMemo, useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import type { DiaryEntry } from "../contexts/diary/domain/diaryEntry";
import type { DoseRecord } from "../contexts/medication/domain/medication";
import { useAuth } from "../contexts/identity/application/authContext";
import { useCreateDiaryEntry, useTodayDiaryEntries } from "../contexts/diary/application/diaryRecords";
import {
  nextDoseStatus,
  useCreateMedicationDose,
  useTodayMedicationDoses,
  useUpdateMedicationDoseStatus,
} from "../contexts/medication/application/medicationDoseRecords";
import { colors, layout } from "../design-system/tokens";
import { t } from "../i18n/translations";
import { DiaryEntryScreen } from "./screens/DiaryEntryScreen";
import { CareModeScreen } from "./screens/CareModeScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { PetOnboardingScreen } from "./screens/PetOnboardingScreen";
import { ReportsScreen } from "./screens/ReportsScreen";
import { BottomNav, type MainTab } from "./ui/BottomNav";
import {
  createMockDiaryEntry,
  initialChecklist,
  initialDiaryEntries,
  initialDoses,
  mockPets,
  type ChecklistKey,
  type DraftDiaryEntry,
  type ReportStage,
} from "./mockUiState";
import { checklistSummary, createChecklistFromRecords } from "./liveUiState";
import { type PetProfile } from "../contexts/pet/domain/pet";
import { CareHeader, DiaryHeader, HomeHeader, PetSettingsHeader, ReportsHeader } from "./shell/ShellHeaders";

type PawBloomShellProps = {
  activePet?: PetProfile | null;
  pets?: PetProfile[];
  onPetNext?: () => void;
};

export function PawBloomShell({ activePet: externalActivePet, pets: externalPets, onPetNext }: PawBloomShellProps = {}) {
  const { configured, user, activePet: authActivePet, pets: authPets, selectNextPet, signOut } = useAuth();

  const shellPets = externalPets ?? authPets;
  const activePet = useMemo(() => externalActivePet ?? authActivePet ?? mockPets[0], [authActivePet, externalActivePet]);
  const canCyclePet = shellPets.length > 1;
  const databaseMode = configured && Boolean(user) && Boolean(authActivePet ?? externalActivePet);
  const livePetId = databaseMode ? activePet.id : null;
  const userId = databaseMode ? user?.id ?? null : null;

  const diaryQuery = useTodayDiaryEntries(livePetId);
  const dosesQuery = useTodayMedicationDoses(livePetId);
  const createDiaryEntry = useCreateDiaryEntry(livePetId, userId);
  const createMedicationDose = useCreateMedicationDose(livePetId, userId);
  const updateMedicationDose = useUpdateMedicationDoseStatus(livePetId);

  const [activeTab, setActiveTab] = useState<MainTab>("today");
  const [showPetSettings, setShowPetSettings] = useState(false);
  const [localChecklist, setLocalChecklist] = useState(initialChecklist);
  const [entries, setEntries] = useState<DiaryEntry[]>(initialDiaryEntries);
  const [doses, setDoses] = useState<DoseRecord[]>(initialDoses);
  const [reportStage, setReportStage] = useState<ReportStage>("draft");
  const [notice, setNotice] = useState<string>(databaseMode ? t("en", "today.databaseNotice") : t("en", "today.previewNotice"));

  const activeEntries = useMemo(
    () => (databaseMode ? diaryQuery.data ?? [] : entries.filter((entry) => entry.petId === activePet.id)),
    [activePet.id, databaseMode, diaryQuery.data, entries],
  );
  const activeDoses = useMemo(
    () => (databaseMode ? dosesQuery.data ?? [] : doses.filter((dose) => dose.petId === activePet.id)),
    [activePet.id, databaseMode, doses, dosesQuery.data],
  );
  const checklist = useMemo(
    () => (databaseMode ? createChecklistFromRecords(activeEntries, activeDoses) : localChecklist),
    [activeDoses, activeEntries, databaseMode, localChecklist],
  );
  const latestConditionScore = activeEntries.find((entry) => entry.category === "condition" && entry.conditionScore)?.conditionScore;

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
    if (!databaseMode) {
      setLocalChecklist((current) => ({ ...current, [key]: !current[key] }));
      setNotice(t("en", "today.checklistUpdated"));
      return;
    }

    if (checklist[key]) {
      setNotice(t("en", "today.checklistAlreadyRecorded"));
      return;
    }

    void recordChecklistItem(key).catch((error: Error) => setNotice(error.message));
  }

  function saveDiaryEntry(draft: DraftDiaryEntry) {
    if (databaseMode) {
      void createDiaryEntry
        .mutateAsync({
          category: draft.category,
          summary: draft.summary,
          conditionScore: draft.conditionScore,
        })
        .then(() => {
          setNotice(t("en", "today.diarySavedRemote"));
          setActiveTab("today");
        })
        .catch((error: Error) => setNotice(error.message));
      return;
    }

    const nextEntry = createMockDiaryEntry(activePet.id, draft);
    setEntries((current) => [nextEntry, ...current]);
    setLocalChecklist((current) => ({ ...current, [draft.category]: true }));
    setNotice(t("en", "today.diarySaved"));
    setActiveTab("today");
  }

  function cycleDoseStatus(id: string) {
    if (databaseMode) {
      const dose = activeDoses.find((item) => item.id === id);
      if (!dose) {
        return;
      }
      void updateMedicationDose
        .mutateAsync({ id, status: nextDoseStatus(dose.status) })
        .then(() => setNotice(t("en", "today.medicationUpdatedRemote")))
        .catch((error: Error) => setNotice(error.message));
      return;
    }

    setDoses((current) => current.map((dose) => (dose.id === id ? { ...dose, status: nextDoseStatus(dose.status) } : dose)));
    setLocalChecklist((current) => ({ ...current, medication: true }));
    setNotice(t("en", "today.medicationUpdated"));
  }

  function addMedicationDose() {
    if (!databaseMode) {
      return;
    }

    void createMedicationDose
      .mutateAsync({ medicationName: t("en", "care.quickMedicationName") })
      .then(() => setNotice(t("en", "care.medicationAdded")))
      .catch((error: Error) => setNotice(error.message));
  }

  async function recordChecklistItem(key: ChecklistKey) {
    if (key === "medication") {
      const pendingDose = activeDoses.find((dose) => dose.status === "pending");
      if (pendingDose) {
        await updateMedicationDose.mutateAsync({ id: pendingDose.id, status: "completed" });
      } else {
        await createMedicationDose.mutateAsync({ medicationName: t("en", "care.quickMedicationName"), status: "completed" });
      }
      setNotice(t("en", "today.medicationUpdatedRemote"));
      return;
    }

    const category = key === "night" ? "memo" : key;
    await createDiaryEntry.mutateAsync({
      category,
      summary: checklistSummary(key),
      conditionScore: category === "condition" ? 3 : undefined,
    });
    setNotice(t("en", "today.checklistRecordedRemote"));
  }

  function handleSignOut() {
    void signOut();
  }

  if (showPetSettings) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.appFrame}>
          <PetSettingsHeader onBack={() => setShowPetSettings(false)} />
          <PetOnboardingScreen />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.appFrame}>
        {activeTab === "today" ? (
          <HomeHeader petName={activePet.name} onPetPress={handlePetPress} onManagePets={() => setShowPetSettings(true)} canSwitchPet={canCyclePet} />
        ) : null}
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
          {activeTab === "care" ? (
            <CareModeScreen
              doses={activeDoses}
              onDosePress={cycleDoseStatus}
              onAddDose={addMedicationDose}
              onGenerateReport={() => setActiveTab("reports")}
              conditionScore={latestConditionScore}
            />
          ) : null}
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
