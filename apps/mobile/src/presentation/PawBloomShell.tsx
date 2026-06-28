import { useCallback, useMemo, useState } from "react";
import { Alert, SafeAreaView, ScrollView, View } from "react-native";
import type { DiaryEntry } from "../contexts/diary/domain/diaryEntry";
import type { DoseRecord } from "../contexts/medication/domain/medication";
import { useAuth } from "../contexts/identity/application/authContext";
import { getLocalDateKey, getWeekDateRange, useCreateDiaryEntry, useDeleteDiaryEntry, useDiaryEntriesByDate, useDiaryEntriesByDateRange, useTodayDiaryEntries, useUpdateDiaryEntry } from "../contexts/diary/application/diaryRecords";
import { buildDoseRecordedAt, nextDoseStatus, type QuickMedicationDoseInput, shouldCountDoseAsMedicationRecorded, type UpdateMedicationDoseInput, useCreateMedicationDose, useDeleteMedicationDose, useTodayMedicationDoses, useUpdateMedicationDose, useUpdateMedicationDoseStatus } from "../contexts/medication/application/medicationDoseRecords";
import { useReportDraftSummary } from "../contexts/report/application/reportDraftRecords";
import { t } from "../i18n/translations";
import { DiaryEntryScreen } from "./screens/DiaryEntryScreen";
import { CareModeScreen } from "./screens/CareModeScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { PetOnboardingScreen } from "./screens/PetOnboardingScreen";
import { ReportsScreen } from "./screens/ReportsScreen";
import { BottomNav, type MainTab } from "./ui/BottomNav";
import { createMockDiaryEntry, initialChecklist, initialDiaryEntries, initialDoses, mockPets, type ChecklistKey, type DraftDiaryEntry, type ReportStage } from "./mockUiState";
import { checklistSummary, createChecklistFromRecords } from "./liveUiState";
import { type PetProfile } from "../contexts/pet/domain/pet";
import { CareHeader, DiaryHeader, HomeHeader, PetSettingsHeader, ReportsHeader } from "./shell/ShellHeaders";
import { useShellCareDefaults } from "./shell/useShellCareDefaults";
import { SaveFeedbackBar } from "./shell/SaveFeedbackBar";
import { createSaveFeedback, type SaveFeedback, type SaveFeedbackKind } from "./shell/saveFeedback";
import type { DiaryFilter } from "./screens/DiaryCalendar";
import { styles } from "./PawBloomShell.styles";
import { createLocalDoseRecord, shouldMarkMedicationChecklist } from "./localMedicationState";
import { getTodayEntriesForPet, updateLocalDiaryEntry } from "./localDiaryState";
import { confirmAndDeleteMedicationDose, saveMedicationDoseEdit } from "./shell/medicationDoseActions";

type PawBloomShellProps = { activePet?: PetProfile | null; pets?: PetProfile[]; onPetNext?: () => void };

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
  const updateDiaryEntry = useUpdateDiaryEntry(livePetId);
  const deleteDiaryEntry = useDeleteDiaryEntry(livePetId);
  const createMedicationDose = useCreateMedicationDose(livePetId, userId);
  const updateMedicationDose = useUpdateMedicationDose(livePetId);
  const deleteMedicationDose = useDeleteMedicationDose(livePetId);
  const updateMedicationDoseStatus = useUpdateMedicationDoseStatus(livePetId);

  const [activeTab, setActiveTab] = useState<MainTab>("today");
  const [showPetSettings, setShowPetSettings] = useState(false);
  const [localChecklist, setLocalChecklist] = useState(initialChecklist);
  const [entries, setEntries] = useState<DiaryEntry[]>(initialDiaryEntries);
  const [doses, setDoses] = useState<DoseRecord[]>(initialDoses);
  const [reportStage, setReportStage] = useState<ReportStage>("draft");
  const [selectedDiaryDate, setSelectedDiaryDate] = useState(getLocalDateKey());
  const [diaryFilter, setDiaryFilter] = useState<DiaryFilter>("day");
  const [notice, setNotice] = useState<string>(databaseMode ? t("ko", "today.databaseNotice") : t("ko", "today.previewNotice"));
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedback | null>(null);
  const selectedWeekRange = useMemo(() => getWeekDateRange(selectedDiaryDate), [selectedDiaryDate]);
  const showSaveFeedback = useCallback((kind: SaveFeedbackKind) => setSaveFeedback(createSaveFeedback(kind)), []);
  const hideSaveFeedback = useCallback(() => setSaveFeedback(null), []);

  const activeEntries = useMemo(() => (databaseMode ? diaryQuery.data ?? [] : entries.filter((entry) => entry.petId === activePet.id && entry.entryDate === getLocalDateKey())), [activePet.id, databaseMode, diaryQuery.data, entries]);
  const diaryDateQuery = useDiaryEntriesByDate(livePetId, selectedDiaryDate);
  const diaryWeekQuery = useDiaryEntriesByDateRange(livePetId, selectedWeekRange.fromDateKey, selectedWeekRange.toDateKey);
  const selectedDiaryEntries = useMemo(() => {
    if (databaseMode) {
      return diaryFilter === "day" ? diaryDateQuery.data ?? [] : diaryWeekQuery.data ?? [];
    }
    return entries.filter((entry) => entry.petId === activePet.id && (diaryFilter === "day" ? entry.entryDate === selectedDiaryDate : entry.entryDate >= selectedWeekRange.fromDateKey && entry.entryDate <= selectedWeekRange.toDateKey));
  }, [activePet.id, databaseMode, diaryDateQuery.data, diaryFilter, diaryWeekQuery.data, entries, selectedDiaryDate, selectedWeekRange.fromDateKey, selectedWeekRange.toDateKey]);
  const activeDoses = useMemo(() => (databaseMode ? dosesQuery.data ?? [] : doses.filter((dose) => dose.petId === activePet.id)), [activePet.id, databaseMode, doses, dosesQuery.data]);
  const reportSummary = useReportDraftSummary({ activePetId: activePet.id, databaseMode, livePetId, entries, doses });
  const checklist = useMemo(() => (databaseMode ? createChecklistFromRecords(activeEntries, activeDoses) : localChecklist), [activeDoses, activeEntries, databaseMode, localChecklist]);
  const latestConditionScore = activeEntries.find((entry) => entry.category === "condition" && entry.conditionScore)?.conditionScore;
  const { activeRoutine, activeCareSetup, saveRoutine, saveCareSetup, useCareSchedule } = useShellCareDefaults({ activePet, databaseMode, livePetId, userId, addMedicationDose, setNotice, showSaveFeedback });

  const handlePetPress = () => {
    if (canCyclePet) onPetNext ? onPetNext() : selectNextPet();
    setNotice(t("ko", "today.petSwitched"));
  };

  function toggleChecklist(key: ChecklistKey) {
    if (!databaseMode) {
      setLocalChecklist((current) => ({ ...current, [key]: !current[key] }));
      setNotice(t("ko", "today.checklistUpdated"));
      showSaveFeedback("checklist");
      return;
    }

    if (checklist[key]) { setNotice(t("ko", "today.checklistAlreadyRecorded")); return; }

    void recordChecklistItem(key).catch((error: Error) => setNotice(error.message));
  }

  function saveDiaryEntry(draft: DraftDiaryEntry, feedbackKind: SaveFeedbackKind = "diary") {
    if (databaseMode) {
      return createDiaryEntry
        .mutateAsync({ category: draft.category, summary: draft.summary, detail: draft.detail, entryDate: draft.entryDate, occurredTime: draft.occurredAt, conditionScore: draft.conditionScore, photos: draft.photos })
        .then(() => { setNotice(t("ko", "today.diarySavedRemote")); showSaveFeedback(feedbackKind); })
        .catch((error: Error) => { setNotice(error.message); throw error; });
    }

    const nextEntry = createMockDiaryEntry(activePet.id, draft);
    setEntries((current) => [nextEntry, ...current]);
    setLocalChecklist((current) => ({ ...current, [draft.category]: true }));
    setNotice(t("ko", "today.diarySaved"));
    showSaveFeedback(feedbackKind);
  }

  function saveCareEntry(draft: DraftDiaryEntry) {
    saveDiaryEntry({ ...draft, entryDate: getLocalDateKey(), occurredAt: draft.occurredAt }, "careRecord");
  }

  async function updateDiaryRecord(draft: DraftDiaryEntry & { id: string; occurredTime: string }) {
    if (databaseMode) {
      try {
        await updateDiaryEntry.mutateAsync({ id: draft.id, category: draft.category, summary: draft.summary, detail: draft.detail, entryDate: draft.entryDate, conditionScore: draft.conditionScore, occurredTime: draft.occurredTime });
        setNotice(t("ko", "today.diaryUpdatedRemote")); showSaveFeedback("diary");
      } catch (error) {
        setNotice(error instanceof Error ? error.message : t("ko", "diary.updateFailed")); throw error;
      }
      return;
    }

    const nextEntries = entries.map((entry) => (entry.id === draft.id ? updateLocalDiaryEntry(entry, draft) : entry));
    setEntries(nextEntries);
    setLocalChecklist(createChecklistFromRecords(getTodayEntriesForPet(nextEntries, activePet.id), activeDoses));
    setNotice(t("ko", "today.diaryUpdated"));
    showSaveFeedback("diary");
  }

  function deleteDiaryRecord(entry: DiaryEntry) {
    return new Promise<boolean>((resolve) => Alert.alert(t("ko", "diary.deleteTitle"), t("ko", "diary.deleteCopy"), [
      { text: t("ko", "diary.deleteCancel"), style: "cancel", onPress: () => resolve(false) },
      {
        text: t("ko", "diary.deleteConfirm"), style: "destructive",
        onPress: async () => {
          if (databaseMode) {
            try {
              await deleteDiaryEntry.mutateAsync(entry.id);
              setNotice(t("ko", "today.diaryDeletedRemote")); showSaveFeedback("diary"); resolve(true);
            } catch (error) {
              setNotice(error instanceof Error ? error.message : t("ko", "diary.deleteFailed")); resolve(false);
            }
            return;
          }

          const nextEntries = entries.filter((item) => item.id !== entry.id);
          setEntries(nextEntries);
          setLocalChecklist(createChecklistFromRecords(getTodayEntriesForPet(nextEntries, activePet.id), activeDoses));
          setNotice(t("ko", "today.diaryDeleted")); showSaveFeedback("diary"); resolve(true);
        },
      },
    ], { cancelable: true, onDismiss: () => resolve(false) }));
  }

  function cycleDoseStatus(id: string) {
    if (databaseMode) {
      const dose = activeDoses.find((item) => item.id === id);
      if (!dose) return;
      void updateMedicationDoseStatus
        .mutateAsync({ id, status: nextDoseStatus(dose.status) })
        .then(() => { setNotice(t("ko", "today.medicationUpdatedRemote")); showSaveFeedback("medicationStatus"); })
        .catch((error: Error) => setNotice(error.message));
      return;
    }

    const nextDoses = doses.map((dose) => {
      if (dose.id !== id) return dose;
      const status = nextDoseStatus(dose.status);
      return { ...dose, status, recordedAt: buildDoseRecordedAt(status) ?? undefined };
    });
    setDoses(nextDoses);
    setLocalChecklist((currentChecklist) => ({ ...currentChecklist, medication: nextDoses.some((dose) => dose.petId === activePet.id && shouldCountDoseAsMedicationRecorded(dose.status)) }));
    setNotice(t("ko", "today.medicationUpdated"));
    showSaveFeedback("medicationStatus");
  }

  function updateMedicationRecord(input: UpdateMedicationDoseInput) {
    return saveMedicationDoseEdit({ input, updateMedicationDose, activePetId: activePet.id, databaseMode, setDoses, setLocalChecklist, setNotice, showSaveFeedback });
  }

  function deleteMedicationRecord(dose: DoseRecord) {
    return confirmAndDeleteMedicationDose({ dose, deleteMedicationDose, activePetId: activePet.id, databaseMode, setDoses, setLocalChecklist, setNotice, showSaveFeedback });
  }

  async function addMedicationDose(input: QuickMedicationDoseInput) {
    if (!databaseMode) {
      setDoses((current) => [createLocalDoseRecord(activePet.id, input, t("ko", "care.quickMedicationName")), ...current]);
      if (shouldMarkMedicationChecklist(input)) setLocalChecklist((current) => ({ ...current, medication: true }));
      setNotice(t("ko", "care.medicationAdded"));
      showSaveFeedback("medication");
      return;
    }

    try {
      await createMedicationDose.mutateAsync(input);
      setNotice(t("ko", "care.medicationAdded"));
      showSaveFeedback("medication");
    } catch (error) {
      const message = error instanceof Error ? error.message : t("ko", "care.quickDoseNotice");
      setNotice(message);
      throw new Error(message);
    }
  }

  async function recordChecklistItem(key: ChecklistKey) {
    if (key === "medication") {
      const pendingDose = activeDoses.find((dose) => dose.status === "pending");
      if (pendingDose) await updateMedicationDoseStatus.mutateAsync({ id: pendingDose.id, status: "completed" });
      else await createMedicationDose.mutateAsync({ medicationName: t("ko", "care.quickMedicationName"), status: "completed" });
      setNotice(t("ko", "today.medicationUpdatedRemote"));
      showSaveFeedback("medicationStatus");
      return;
    }

    const category = key === "night" ? "memo" : key;
    await createDiaryEntry.mutateAsync({ category, summary: checklistSummary(key), conditionScore: category === "condition" ? 3 : undefined });
    setNotice(t("ko", "today.checklistRecordedRemote"));
    showSaveFeedback("checklist");
  }

  function handleSignOut() { void signOut(); }
  if (showPetSettings) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.appFrame}>
          <PetSettingsHeader onBack={() => setShowPetSettings(false)} />
          <PetOnboardingScreen routine={activeRoutine} onSaveRoutine={saveRoutine} onProfileSaved={() => showSaveFeedback("petProfile")} />
          <SaveFeedbackBar feedback={saveFeedback} onDismiss={hideSaveFeedback} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.appFrame}>
        {activeTab === "today" ? <HomeHeader petName={activePet.name} onPetPress={handlePetPress} onManagePets={() => setShowPetSettings(true)} canSwitchPet={canCyclePet} /> : null}
        {activeTab === "diary" ? <DiaryHeader onBack={() => setActiveTab("today")} /> : null}
        {activeTab === "care" ? <CareHeader /> : null}
        {activeTab === "reports" ? <ReportsHeader onSignOut={handleSignOut} /> : null}

        <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, activeTab === "today" && styles.homeScrollContent]} showsVerticalScrollIndicator={false}>
          {activeTab === "today" ? <HomeScreen pet={activePet} checklist={checklist} entries={activeEntries} doses={activeDoses} notice={notice} onChecklistToggle={toggleChecklist} onAddDiary={() => setActiveTab("diary")} onRecordMedication={() => setActiveTab("care")} onViewReport={() => setActiveTab("reports")} onTimelineEntryPress={(entry) => { setSelectedDiaryDate(entry.entryDate); setDiaryFilter("day"); setActiveTab("diary"); }} /> : null}
          {activeTab === "diary" ? <DiaryEntryScreen entries={selectedDiaryEntries} selectedDateKey={selectedDiaryDate} filter={diaryFilter} onDateChange={setSelectedDiaryDate} onFilterChange={setDiaryFilter} onSave={saveDiaryEntry} onUpdate={updateDiaryRecord} onDelete={deleteDiaryRecord} routine={activeRoutine} petSpecies={activePet.species} /> : null}
          {activeTab === "care" ? <CareModeScreen doses={activeDoses} onDosePress={cycleDoseStatus} onAddDose={addMedicationDose} onUpdateDose={updateMedicationRecord} onDeleteDose={deleteMedicationRecord} onSaveCareEntry={saveCareEntry} onGenerateReport={() => setActiveTab("reports")} conditionScore={latestConditionScore} careSetup={activeCareSetup} onSaveCareSetup={saveCareSetup} onUseCareSchedule={useCareSchedule} /> : null}
          {activeTab === "reports" ? <ReportsScreen reportStage={reportStage} reportSummary={reportSummary} onReportStageChange={setReportStage} onNewDiary={() => setActiveTab("diary")} /> : null}
        </ScrollView>

        <BottomNav activeTab={activeTab} onChange={setActiveTab} />
        <SaveFeedbackBar feedback={saveFeedback} onDismiss={hideSaveFeedback} />
      </View>
    </SafeAreaView>
  );
}
