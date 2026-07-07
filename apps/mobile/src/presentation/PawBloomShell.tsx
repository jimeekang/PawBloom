import { useCallback, useMemo, useState } from "react";
import { SafeAreaView, ScrollView, View } from "react-native";
import type { DiaryEntry } from "../contexts/diary/domain/diaryEntry";
import { DiaryEntryScreen } from "../contexts/diary/ui/DiaryEntryScreen";
import { getTodayEntriesForPet, useDiaryEntriesController } from "../contexts/diary/ui/useDiaryEntriesController";
import { useAuth } from "../contexts/identity/application/authContext";
import { SettingsScreen } from "../contexts/identity/ui/SettingsScreen";
import { rescheduleMedicationReminders } from "../contexts/medication/application/medicationReminderNotifications";
import { hasRecordedMedication } from "../contexts/medication/ui/medicationDoseActions";
import { shouldMarkMedicationChecklist } from "../contexts/medication/ui/localMedicationState";
import { useMedicationDosesController } from "../contexts/medication/ui/useMedicationDosesController";
import { buildQuickDoseFromSchedule } from "../contexts/care/application/carePlanRecords";
import type { CareMedicationSchedule, CareSetupInput } from "../contexts/care/domain/carePlan";
import { useCareSetupState } from "../contexts/care/ui/useCareSetupState";
import { useRoutineDefaults } from "../contexts/routine/ui/useRoutineDefaults";
import { type PetProfile } from "../contexts/pet/domain/pet";
import { mockPets } from "../contexts/pet/ui/samplePets";
import { useReportDraftSummary } from "../contexts/report/application/reportDraftRecords";
import type { ReportStage } from "../contexts/report/ui/reportStage";
import { ReportsScreen } from "../contexts/report/ui/ReportsScreen";
import { t } from "../i18n/translations";
import { getLocalDateKey } from "../shared-kernel/date";
import { CareModeScreen } from "./screens/CareModeScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { PetOnboardingScreen } from "./screens/PetOnboardingScreen";
import { BottomNav, type MainTab } from "./ui/BottomNav";
import { CareHeader, DiaryHeader, HomeHeader, PetSettingsHeader, ReportsHeader, SettingsHeader } from "./shell/ShellHeaders";
import { SaveFeedbackBar } from "./shell/SaveFeedbackBar";
import { createSaveFeedback, type SaveFeedback, type SaveFeedbackKind } from "./shell/saveFeedback";
import { createChecklistFromRecords, initialChecklist } from "./shell/todayChecklist";
import { useTodayChecklistController } from "./shell/useTodayChecklistController";
import { getTimelineEntryRoute } from "./shell/timelineRouting";
import { styles } from "./PawBloomShell.styles";

type PawBloomShellProps = { activePet?: PetProfile | null; pets?: PetProfile[]; onPetNext?: () => void };

export function PawBloomShell({ activePet: externalActivePet, pets: externalPets, onPetNext }: PawBloomShellProps = {}) {
  const { configured, user, activePet: authActivePet, pets: authPets, selectNextPet, signOut } = useAuth();
  const shellPets = externalPets ?? authPets;
  const activePet = useMemo(() => externalActivePet ?? authActivePet ?? mockPets[0], [authActivePet, externalActivePet]);
  const canCyclePet = shellPets.length > 1;
  const databaseMode = configured && Boolean(user) && Boolean(authActivePet ?? externalActivePet);
  const livePetId = databaseMode ? activePet.id : null;
  const userId = databaseMode ? user?.id ?? null : null;

  const [activeTab, setActiveTab] = useState<MainTab>("today");
  const [showPetSettings, setShowPetSettings] = useState(false);
  const [settingsLanguage, setSettingsLanguage] = useState<"ko" | "en">("ko");
  const [reportStage, setReportStage] = useState<ReportStage>("draft");
  const [notice, setNotice] = useState<string>(databaseMode ? t("ko", "today.databaseNotice") : t("ko", "today.previewNotice"));
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedback | null>(null);
  const [localChecklist, setLocalChecklist] = useState(initialChecklist);
  const showSaveFeedback = useCallback((kind: SaveFeedbackKind) => setSaveFeedback(createSaveFeedback(kind)), []);
  const hideSaveFeedback = useCallback(() => setSaveFeedback(null), []);

  const routine = useRoutineDefaults({ activePetId: activePet.id, activePetSpecies: activePet.species, databaseMode, livePetId, userId, fallbackPet: mockPets[0], onNotice: setNotice, onSaved: () => showSaveFeedback("routine") });
  const care = useCareSetupState({ databaseMode, livePetId, userId, onNotice: setNotice, onSaved: () => showSaveFeedback("careSetup") });
  const medication = useMedicationDosesController({
    activePetId: activePet.id,
    databaseMode,
    livePetId,
    userId,
    fallbackPetId: mockPets[0].id,
    schedules: care.activeCareSetup.schedules,
    onNotice: setNotice,
    onSaved: showSaveFeedback,
    onLocalDoseSaved: (input) => { if (shouldMarkMedicationChecklist(input)) setLocalChecklist((current) => ({ ...current, medication: true })); },
    onLocalDosesChanged: (nextDoses) => setLocalChecklist((current) => ({ ...current, medication: hasRecordedMedication(nextDoses, activePet.id) })),
  });
  const diary = useDiaryEntriesController({
    activePetId: activePet.id,
    databaseMode,
    livePetId,
    userId,
    fallbackPetId: mockPets[0].id,
    onNotice: setNotice,
    onSaved: () => showSaveFeedback("diary"),
    onLocalEntrySaved: (entry) => setLocalChecklist((current) => ({ ...current, ...(entry.category in current ? { [entry.category]: true } : {}) })),
    onLocalEntriesChanged: (nextEntries) => setLocalChecklist(createChecklistFromRecords(getTodayEntriesForPet(nextEntries, activePet.id), medication.activeDoses)),
  });
  const reportSummary = useReportDraftSummary({ activePetId: activePet.id, databaseMode, livePetId, entries: diary.entries, doses: medication.doses });
  const { checklist, toggleChecklist } = useTodayChecklistController({
    databaseMode,
    activePetId: activePet.id,
    localChecklist,
    setLocalChecklist,
    activeEntries: diary.activeEntries,
    activeDoses: medication.activeDoses,
    localEntries: diary.entries,
    localDoses: medication.doses,
    replaceLocalEntries: diary.replaceLocalEntries,
    replaceLocalDoses: medication.replaceLocalDoses,
    medicationAgenda: medication.medicationAgenda,
    saveMedicationAgendaStatus: medication.saveAgendaStatus,
    createDiaryEntryRemote: diary.createEntryRemote,
    createMedicationDoseRemote: medication.createDoseRemote,
    updateMedicationDoseStatusRemote: medication.updateDoseStatusRemote,
    setNotice,
    showSaveFeedback,
  });

  const hasCareRecords = medication.activeDoses.length > 0 || care.activeCareSetup.schedules.length > 0 || Boolean(care.activeCareSetup.condition || care.activeCareSetup.plan || care.activeCareSetup.conditionName || care.activeCareSetup.planTitle);
  const handlePetPress = () => { if (canCyclePet) onPetNext ? onPetNext() : selectNextPet(); setNotice(t("ko", "today.petSwitched")); };

  function useCareSchedule(schedule: CareMedicationSchedule) {
    void Promise.resolve(medication.addMedicationDose(buildQuickDoseFromSchedule(schedule, "pending"))).catch((error: Error) => setNotice(error.message));
  }

  function saveCareSetupAndRefreshReminders(input: CareSetupInput) {
    care.saveCareSetup(input);
    void rescheduleMedicationReminders({ petName: activePet.name, schedules: care.activeCareSetup.schedules, fromDate: getLocalDateKey() })
      .then((scheduled) => setNotice(scheduled ? t("ko", "care.reminderScheduled") : t("ko", "care.reminderPermissionDenied")))
      .catch(() => undefined);
  }

  function openTimelineEntry(entry: DiaryEntry) {
    if (getTimelineEntryRoute(entry) === "checklistNotice") { setNotice(t("ko", "today.checklistTimelineReadOnly")); return; }
    diary.setTimelineEditEntry(entry); diary.setSelectedDiaryDate(entry.entryDate); diary.setDiaryFilter("day"); setActiveTab("diary");
  }
  function handleSignOut() { void signOut(); }
  const homeNotice = notice === t("ko", "today.databaseNotice") ? "" : notice;

  if (showPetSettings) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.appFrame}>
          <PetSettingsHeader onBack={() => setShowPetSettings(false)} />
          <PetOnboardingScreen routine={routine.activeRoutine} onSaveRoutine={routine.saveRoutine} careSetup={care.activeCareSetup} onSaveCareSetup={saveCareSetupAndRefreshReminders} onProfileSaved={() => showSaveFeedback("petProfile")} />
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
          {activeTab === "today" ? <HomeScreen pet={activePet} checklist={checklist} entries={diary.activeEntries} doses={medication.activeDoses} medicationAgenda={medication.medicationAgenda} walkEnabled={routine.activeRoutine.walk.enabled !== false} includeMedication showMedicationSummary={hasCareRecords} notice={homeNotice} onChecklistToggle={toggleChecklist} onViewTimelineAll={() => { diary.setTimelineEditEntry(null); diary.setSelectedDiaryDate(getLocalDateKey()); diary.setDiaryFilter("day"); setActiveTab("diary"); }} onTimelineEntryPress={openTimelineEntry} /> : null}
          {activeTab === "diary" ? <DiaryEntryScreen entries={diary.selectedDiaryEntries} selectedDateKey={diary.selectedDiaryDate} filter={diary.diaryFilter} onDateChange={diary.setSelectedDiaryDate} onFilterChange={diary.setDiaryFilter} onSave={diary.saveDiaryEntry} onUpdate={diary.updateDiaryRecord} onDelete={diary.deleteDiaryRecord} routine={routine.activeRoutine} petSpecies={activePet.species} initialEditingEntry={diary.timelineEditEntry} onInitialEditingEntryConsumed={() => diary.setTimelineEditEntry(null)} /> : null}
          {activeTab === "care" ? <CareModeScreen doses={medication.activeDoses} medicationAgenda={medication.medicationAgenda} onAgendaStatusChange={medication.saveAgendaStatus} onAddDose={medication.addMedicationDose} onUpdateDose={medication.updateDoseRecord} onDeleteDose={medication.deleteDoseRecord} onSaveCareSetup={saveCareSetupAndRefreshReminders} onUseSchedule={useCareSchedule} onGenerateReport={() => setActiveTab("reports")} conditionScore={diary.latestConditionScore} careSetup={care.activeCareSetup} /> : null}
          {activeTab === "reports" ? <ReportsScreen reportStage={reportStage} reportSummary={reportSummary} onReportStageChange={setReportStage} onNewDiary={() => setActiveTab("diary")} /> : null}
          {activeTab === "settings" ? <SettingsScreen email={user?.email} configured={configured} language={settingsLanguage} onLanguageChange={setSettingsLanguage} onOpenPetProfiles={() => setShowPetSettings(true)} onSignOut={handleSignOut} /> : null}
        </ScrollView>

        <BottomNav activeTab={activeTab} onChange={setActiveTab} />
        <SaveFeedbackBar feedback={saveFeedback} onDismiss={hideSaveFeedback} />
      </View>
    </SafeAreaView>
  );
}
