import { useCallback, useMemo, useRef, useState } from "react";
import { SafeAreaView, ScrollView, View } from "react-native";
import type { DiaryEntry } from "../contexts/diary/domain/diaryEntry";
import type { DoseRecord } from "../contexts/medication/domain/medication";
import { useAuth } from "../contexts/identity/application/authContext";
import { getLocalDateKey, getWeekDateRange, useCreateDiaryEntry, useDeleteDiaryEntry, useDiaryEntriesByDate, useDiaryEntriesByDateRange, useTodayDiaryEntries, useUpdateDiaryEntry } from "../contexts/diary/application/diaryRecords";
import { type QuickMedicationDoseInput, type UpdateMedicationDoseInput, useCreateMedicationDose, useDeleteMedicationDose, useTodayMedicationDoses, useUpdateMedicationDose, useUpdateMedicationDoseStatus } from "../contexts/medication/application/medicationDoseRecords";
import type { DoseStatus } from "../contexts/medication/domain/medication";
import { useReportDraftSummary } from "../contexts/report/application/reportDraftRecords";
import { t } from "../i18n/translations";
import { DiaryEntryScreen } from "./screens/DiaryEntryScreen";
import { CareModeScreen } from "./screens/CareModeScreen";
import { createTodayMedicationAgendaRows, findPendingMedicationAgendaRow, type TodayMedicationAgendaRow } from "./screens/todayMedicationAgenda";
import { HomeScreen } from "./screens/HomeScreen";
import { PetOnboardingScreen } from "./screens/PetOnboardingScreen";
import { ReportsScreen } from "./screens/ReportsScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { BottomNav, type MainTab } from "./ui/BottomNav";
import { createMockDiaryEntry, initialChecklist, initialDiaryEntries, initialDoses, mockPets, type ChecklistKey, type DraftDiaryEntry, type ReportStage } from "./mockUiState";
import { createChecklistFromRecords } from "./liveUiState";
import { type PetProfile } from "../contexts/pet/domain/pet";
import { CareHeader, DiaryHeader, HomeHeader, PetSettingsHeader, ReportsHeader, SettingsHeader } from "./shell/ShellHeaders";
import { useShellCareDefaults } from "./shell/useShellCareDefaults";
import { SaveFeedbackBar } from "./shell/SaveFeedbackBar";
import { createSaveFeedback, type SaveFeedback, type SaveFeedbackKind } from "./shell/saveFeedback";
import type { DiaryFilter } from "./screens/DiaryCalendar";
import { styles } from "./PawBloomShell.styles";
import { createLocalDoseRecord, shouldMarkMedicationChecklist } from "./localMedicationState";
import { getTodayEntriesForPet, updateLocalDiaryEntry } from "./localDiaryState";
import { confirmDestructiveAction } from "./shell/confirmAction";
import { createLocalChecklistRecord, isChecklistRecordBlocked, recordRemoteChecklistItem } from "./shell/checklistActions";
import { confirmAndDeleteMedicationDose, saveMedicationAgendaStatus as saveMedicationAgendaStatusAction, saveMedicationDoseEdit } from "./shell/medicationDoseActions";
import { getChecklistSuccessHomeNotice } from "./shell/checklistNotice";
import { getTimelineEntryRoute } from "./shell/timelineRouting";
import { rescheduleMedicationReminders } from "./notifications/medicationReminderNotifications";
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
  const [settingsLanguage, setSettingsLanguage] = useState<"ko" | "en">("ko");
  const [localChecklist, setLocalChecklist] = useState(initialChecklist);
  const [entries, setEntries] = useState<DiaryEntry[]>(initialDiaryEntries);
  const [doses, setDoses] = useState<DoseRecord[]>(initialDoses);
  const [reportStage, setReportStage] = useState<ReportStage>("draft");
  const [selectedDiaryDate, setSelectedDiaryDate] = useState(getLocalDateKey());
  const [diaryFilter, setDiaryFilter] = useState<DiaryFilter>("day");
  const [timelineEditEntry, setTimelineEditEntry] = useState<DiaryEntry | null>(null);
  const [notice, setNotice] = useState<string>(databaseMode ? t("ko", "today.databaseNotice") : t("ko", "today.previewNotice"));
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedback | null>(null);
  const pendingChecklistKeys = useRef<ChecklistKey[]>([]);
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
  const { activeRoutine, activeCareSetup, saveRoutine, saveCareSetup } = useShellCareDefaults({ activePet, databaseMode, livePetId, userId, addMedicationDose, setNotice, showSaveFeedback });
  const todayDoseDate = getLocalDateKey();
  const medicationAgenda = useMemo(() => createTodayMedicationAgendaRows({ schedules: activeCareSetup.schedules, doses: activeDoses, doseDate: todayDoseDate }), [activeCareSetup.schedules, activeDoses, todayDoseDate]);
  const hasCareRecords = activeDoses.length > 0 || activeCareSetup.schedules.length > 0 || Boolean(activeCareSetup.condition || activeCareSetup.plan || activeCareSetup.conditionName || activeCareSetup.planTitle);
  const handlePetPress = () => { if (canCyclePet) onPetNext ? onPetNext() : selectNextPet(); setNotice(t("ko", "today.petSwitched")); };
  function toggleChecklist(key: ChecklistKey) {
    const today = getLocalDateKey();
    if (isChecklistRecordBlocked({ key, checklist, entries: activeEntries, entryDate: today, pendingKeys: pendingChecklistKeys.current })) {
      setNotice(t("ko", "today.checklistAlreadyRecorded"));
      return;
    }
    pendingChecklistKeys.current = [...pendingChecklistKeys.current, key];
    const pendingMedicationAgendaRow = key === "medication" ? findPendingMedicationAgendaRow(medicationAgenda) : undefined;
    if (pendingMedicationAgendaRow) {
      const clearPendingKey = () => {
        pendingChecklistKeys.current = pendingChecklistKeys.current.filter((item) => item !== key);
      };
      const saveResult = saveMedicationAgendaStatus(pendingMedicationAgendaRow, "completed");
      if (saveResult) saveResult.finally(clearPendingKey);
      else setTimeout(clearPendingKey, 0);
      return;
    }
    if (!databaseMode) {
      recordLocalChecklistItem(key, today);
      setTimeout(() => { pendingChecklistKeys.current = pendingChecklistKeys.current.filter((item) => item !== key); }, 0);
      return;
    }
    void recordChecklistItem(key)
      .catch((error: Error) => setNotice(error.message))
      .finally(() => { pendingChecklistKeys.current = pendingChecklistKeys.current.filter((item) => item !== key); });
  }

  function saveDiaryEntry(draft: DraftDiaryEntry, feedbackKind: SaveFeedbackKind = "diary") {
    if (databaseMode) {
      return createDiaryEntry
        .mutateAsync({ category: draft.category, summary: draft.summary, detail: draft.detail, entryDate: draft.entryDate, occurredTime: draft.occurredAt, origin: draft.origin, conditionScore: draft.conditionScore, photos: draft.photos })
        .then(() => { setNotice(t("ko", "today.diarySavedRemote")); showSaveFeedback(feedbackKind); })
        .catch((error: Error) => { setNotice(error.message); throw error; });
    }
    const nextEntry = createMockDiaryEntry(activePet.id, draft);
    setEntries((current) => [nextEntry, ...current]);
    setLocalChecklist((current) => ({ ...current, ...(draft.category in current ? { [draft.category]: true } : {}) }));
    setNotice(t("ko", "today.diarySaved"));
    showSaveFeedback(feedbackKind);
  }
  async function updateDiaryRecord(draft: DraftDiaryEntry & { id: string; occurredTime: string }) {
    if (databaseMode) {
      try {
        await updateDiaryEntry.mutateAsync({ id: draft.id, category: draft.category, summary: draft.summary, detail: draft.detail, entryDate: draft.entryDate, occurredTime: draft.occurredTime, origin: draft.origin, conditionScore: draft.conditionScore });
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
    return confirmDestructiveAction({ title: t("ko", "diary.deleteTitle"), message: t("ko", "diary.deleteCopy"), cancelText: t("ko", "diary.deleteCancel"), confirmText: t("ko", "diary.deleteConfirm") }, async () => {
      if (databaseMode) {
        try {
          await deleteDiaryEntry.mutateAsync(entry.id);
          setNotice(t("ko", "today.diaryDeletedRemote")); showSaveFeedback("diary"); return true;
        } catch (error) {
          setNotice(error instanceof Error ? error.message : t("ko", "diary.deleteFailed")); return false;
        }
      }

      const nextEntries = entries.filter((item) => item.id !== entry.id);
      setEntries(nextEntries);
      setLocalChecklist(createChecklistFromRecords(getTodayEntriesForPet(nextEntries, activePet.id), activeDoses));
      setNotice(t("ko", "today.diaryDeleted")); showSaveFeedback("diary"); return true;
    });
  }

  function saveMedicationAgendaStatus(row: TodayMedicationAgendaRow, status: Extract<DoseStatus, "completed" | "skipped" | "partial">): Promise<void> | void {
    return saveMedicationAgendaStatusAction({ row, status, activePetId: activePet.id, databaseMode, doses, updateMedicationDoseStatus, addMedicationDose, setDoses, setLocalChecklist, setNotice, showSaveFeedback });
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

  function saveCareSetupAndRefreshReminders(input: Parameters<typeof saveCareSetup>[0]) {
    saveCareSetup(input);
    void rescheduleMedicationReminders({ petName: activePet.name, schedules: activeCareSetup.schedules, fromDate: getLocalDateKey() })
      .then((scheduled) => setNotice(scheduled ? t("ko", "care.reminderScheduled") : t("ko", "care.reminderPermissionDenied")))
      .catch(() => undefined);
  }

  function recordLocalChecklistItem(key: ChecklistKey, entryDate: string) {
    const result = createLocalChecklistRecord({ key, entryDate, activePetId: activePet.id, entries, doses, activeDoses, checklist, quickMedicationName: t("ko", "care.quickMedicationName") });
    if (!result) return;
    if (result.nextEntries) setEntries(result.nextEntries);
    if (result.nextDoses) setDoses(result.nextDoses);
    setLocalChecklist(result.nextChecklist);
    setNotice(getChecklistSuccessHomeNotice());
    showSaveFeedback(result.feedbackKind);
  }

  async function recordChecklistItem(key: ChecklistKey) {
    const feedbackKind = await recordRemoteChecklistItem({ key, activeDoses, quickMedicationName: t("ko", "care.quickMedicationName"), createDiaryEntry: (input) => createDiaryEntry.mutateAsync(input), createMedicationDose: (input) => createMedicationDose.mutateAsync(input), updateMedicationDoseStatus: (input) => updateMedicationDoseStatus.mutateAsync(input) });
    setNotice(getChecklistSuccessHomeNotice());
    showSaveFeedback(feedbackKind);
  }

  function openTimelineEntry(entry: DiaryEntry) {
    if (getTimelineEntryRoute(entry) === "checklistNotice") { setNotice(t("ko", "today.checklistTimelineReadOnly")); return; }
    setTimelineEditEntry(entry); setSelectedDiaryDate(entry.entryDate); setDiaryFilter("day"); setActiveTab("diary");
  }
  function handleSignOut() { void signOut(); }
  const homeNotice = notice === t("ko", "today.databaseNotice") ? "" : notice;

  if (showPetSettings) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.appFrame}>
          <PetSettingsHeader onBack={() => setShowPetSettings(false)} />
          <PetOnboardingScreen routine={activeRoutine} onSaveRoutine={saveRoutine} careSetup={activeCareSetup} onSaveCareSetup={saveCareSetupAndRefreshReminders} onProfileSaved={() => showSaveFeedback("petProfile")} />
          <SaveFeedbackBar feedback={saveFeedback} onDismiss={hideSaveFeedback} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.appFrame}>
        {activeTab === "today" ? <HomeHeader petName={activePet.name} onPetPress={handlePetPress} onManagePets={() => setActiveTab("settings")} canSwitchPet={canCyclePet} /> : null}
        {activeTab === "diary" ? <DiaryHeader onBack={() => setActiveTab("today")} /> : null}
        {activeTab === "care" ? <CareHeader /> : null}
        {activeTab === "reports" ? <ReportsHeader /> : null}
        {activeTab === "settings" ? <SettingsHeader /> : null}

        <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, activeTab === "today" && styles.homeScrollContent]} showsVerticalScrollIndicator={false}>
          {activeTab === "today" ? <HomeScreen pet={activePet} checklist={checklist} entries={activeEntries} doses={activeDoses} medicationAgenda={medicationAgenda} walkEnabled={activeRoutine.walk.enabled !== false} includeMedication showMedicationSummary={hasCareRecords} notice={homeNotice} onChecklistToggle={toggleChecklist} onViewTimelineAll={() => { setTimelineEditEntry(null); setSelectedDiaryDate(getLocalDateKey()); setDiaryFilter("day"); setActiveTab("diary"); }} onTimelineEntryPress={openTimelineEntry} /> : null}
          {activeTab === "diary" ? <DiaryEntryScreen entries={selectedDiaryEntries} selectedDateKey={selectedDiaryDate} filter={diaryFilter} onDateChange={setSelectedDiaryDate} onFilterChange={setDiaryFilter} onSave={saveDiaryEntry} onUpdate={updateDiaryRecord} onDelete={deleteDiaryRecord} routine={activeRoutine} petSpecies={activePet.species} initialEditingEntry={timelineEditEntry} onInitialEditingEntryConsumed={() => setTimelineEditEntry(null)} /> : null}
          {activeTab === "care" ? <CareModeScreen doses={activeDoses} medicationAgenda={medicationAgenda} onAgendaStatusChange={saveMedicationAgendaStatus} onAddDose={addMedicationDose} onUpdateDose={updateMedicationRecord} onDeleteDose={deleteMedicationRecord} onGenerateReport={() => setActiveTab("reports")} conditionScore={latestConditionScore} careSetup={activeCareSetup} /> : null}
          {activeTab === "reports" ? <ReportsScreen reportStage={reportStage} reportSummary={reportSummary} onReportStageChange={setReportStage} onNewDiary={() => setActiveTab("diary")} /> : null}
          {activeTab === "settings" ? <SettingsScreen email={user?.email} configured={configured} language={settingsLanguage} onLanguageChange={setSettingsLanguage} onOpenPetProfiles={() => setShowPetSettings(true)} onSignOut={handleSignOut} /> : null}
        </ScrollView>

        <BottomNav activeTab={activeTab} onChange={setActiveTab} />
        <SaveFeedbackBar feedback={saveFeedback} onDismiss={hideSaveFeedback} />
      </View>
    </SafeAreaView>
  );
}
