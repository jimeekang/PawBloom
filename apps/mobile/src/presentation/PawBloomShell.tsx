import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { DiaryEntry } from "../contexts/diary/domain/diaryEntry";
import { DiaryEntryScreen } from "../contexts/diary/ui/DiaryEntryScreen";
import { getTodayEntriesForPet, useDiaryEntriesController } from "../contexts/diary/ui/useDiaryEntriesController";
import { useAuth } from "../contexts/identity/application/authContext";
import { SettingsScreen } from "../contexts/identity/ui/SettingsScreen";
import { confirmAndSignOut } from "../contexts/identity/ui/signOutConfirm";
import { hasRecordedMedication } from "../contexts/medication/ui/medicationDoseActions";
import { shouldMarkMedicationChecklist } from "../contexts/medication/ui/localMedicationState";
import { useMedicationDosesController } from "../contexts/medication/ui/useMedicationDosesController";
import { buildQuickDoseFromSchedule } from "../contexts/care/application/carePlanRecords";
import { findDoseForScheduleDate } from "../contexts/medication/application/medicationDosePayload";
import type { CareMedicationSchedule, CareSetupInput } from "../contexts/care/domain/carePlan";
import { useCareSetupState } from "../contexts/care/ui/useCareSetupState";
import { useRoutineDefaults } from "../contexts/routine/ui/useRoutineDefaults";
import type { PetRoutineInput } from "../contexts/routine/domain/petRoutine";
import { type PetProfile } from "../contexts/pet/domain/pet";
import { mockPets } from "../contexts/pet/ui/samplePets";
import { useReportDraftSummary } from "../contexts/report/application/reportDraftRecords";
import { ReportsScreen } from "../contexts/report/ui/ReportsScreen";
import { useVetReportWorkflow } from "../contexts/report/ui/useVetReportWorkflow";
import { OfflineConflictNotice } from "../contexts/sync/ui/OfflineConflictNotice";
import { t } from "../i18n/translations";
import { useLanguage } from "../i18n/languageContext";
import { getLocalDateKey } from "../shared-kernel/date";
import { CareModeScreen } from "./screens/CareModeScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { PetOnboardingScreen } from "./screens/PetOnboardingScreen";
import { BottomNav, type MainTab } from "./ui/BottomNav";
import { CareHeader, DiaryHeader, HomeHeader, PetSettingsHeader, ReportsHeader, SettingsHeader } from "./shell/ShellHeaders";
import { SaveFeedbackBar } from "./shell/SaveFeedbackBar";
import { createSaveFeedback, type SaveFeedback, type SaveFeedbackKind } from "./shell/saveFeedback";
import { createChecklistFromRecords } from "./shell/todayChecklist";
import { refreshMealReminders, refreshMedicationReminders, useReminderAutoRefresh } from "./shell/reminderScheduling";
import { buildSampleDiaryEntries } from "../contexts/diary/ui/sampleDiaryEntries";
import { buildSampleDoses } from "../contexts/medication/ui/sampleDoses";
import { useTodayChecklistController } from "./shell/useTodayChecklistController";
import { getTimelineEntryRoute } from "./shell/timelineRouting";
import { styles } from "./PawBloomShell.styles";
import { NoticeBanner, type NoticeTone } from "../design-system/components";
import { can } from "../shared-kernel/permissions";

type PawBloomShellProps = { activePet?: PetProfile | null; pets?: PetProfile[]; onPetNext?: () => void };

export function PawBloomShell({ activePet: externalActivePet, pets: externalPets, onPetNext }: PawBloomShellProps = {}) {
  const { configured, user, activePet: authActivePet, pets: authPets, selectNextPet, signOut } = useAuth();
  const { language } = useLanguage();
  const shellPets = externalPets ?? authPets;
  const activePet = useMemo(() => externalActivePet ?? authActivePet ?? mockPets[0], [authActivePet, externalActivePet]);
  const canCyclePet = shellPets.length > 1;
  const databaseMode = configured && Boolean(user) && Boolean(authActivePet ?? externalActivePet);
  const livePetId = databaseMode ? activePet.id : null;
  const userId = databaseMode ? user?.id ?? null : null;
  const canCreateDiary = can(activePet.role, "diary.create");
  const canUpdateDiary = can(activePet.role, "diary.update");
  const canDeleteDiary = can(activePet.role, "diary.delete");
  const canManageCare = can(activePet.role, "care.update");
  const canDeleteDose = can(activePet.role, "medication.delete");
  const canGenerateReport = can(activePet.role, "report.generate");
  const canConfirmReport = can(activePet.role, "report.confirm");
  const canShareReport = can(activePet.role, "report.share");
  const canReadReport = can(activePet.role, "report.read");

  const [activeTab, setActiveTab] = useState<MainTab>("today");
  const [showPetSettings, setShowPetSettings] = useState(false);
  const [notice, setNoticeState] = useState<{ text: string; tone: NoticeTone }>({ text: databaseMode ? t("ko", "today.databaseNotice") : t("ko", "today.previewNotice"), tone: "success" });
  const setNotice = useCallback((text: string, tone: NoticeTone = "success") => setNoticeState({ text, tone }), []);
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedback | null>(null);
  const [localChecklist, setLocalChecklist] = useState(() => createChecklistFromRecords(buildSampleDiaryEntries(mockPets[0].id), buildSampleDoses(mockPets[0].id)));
  const showSaveFeedback = useCallback((kind: SaveFeedbackKind) => setSaveFeedback(createSaveFeedback(kind)), []);
  const hideSaveFeedback = useCallback(() => setSaveFeedback(null), []);

  useEffect(() => {
    setNotice(databaseMode ? t("ko", "today.databaseNotice") : t("ko", "today.previewNotice"));
  }, [databaseMode, language, setNotice]);

  const routine = useRoutineDefaults({ activePetId: activePet.id, activePetSpecies: activePet.species, databaseMode, livePetId, userId, fallbackPet: mockPets[0], onNotice: setNotice, onSaved: () => showSaveFeedback("routine") });
  const care = useCareSetupState({ databaseMode, livePetId, userId, onNotice: setNotice, onSaved: () => showSaveFeedback("careSetup") });
  useReminderAutoRefresh({ databaseMode, userId, petId: activePet.id, petName: activePet.name, language, schedules: care.activeCareSetup.schedules, activeRoutine: routine.activeRoutine });
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
  const reportSummary = useReportDraftSummary({ activePetId: activePet.id, databaseMode, livePetId, userId, entries: diary.entries, doses: medication.doses });
  const reportWorkflow = useVetReportWorkflow({
    petId: livePetId,
    userId,
    enabled: databaseMode,
    hasRecords: reportSummary.hasRecords,
    canGenerateReport,
    canConfirmReport,
    canShareReport,
    canReadReport,
  });
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
    if (findDoseForScheduleDate(medication.activeDoses, schedule.id, getLocalDateKey())) {
      setNotice(t("ko", "care.scheduleAlreadyLoaded"));
      return;
    }
    void Promise.resolve(medication.addMedicationDose(buildQuickDoseFromSchedule(schedule, "pending"))).catch(() => undefined);
  }

  async function saveCareSetupAndRefreshReminders(input: CareSetupInput) {
    if (!canManageCare) throw new Error(t("ko", "permission.careTeamOnly"));
    const previousScheduleIds = care.activeCareSetup.schedules.map((schedule) => schedule.id);
    const savedSetup = await care.saveCareSetup(input);
    try {
      const scheduled = await refreshMedicationReminders({ userId, petId: activePet.id, petName: activePet.name, schedules: savedSetup.schedules, requestPermission: true, previousScheduleIds });
      setNotice(scheduled ? t("ko", "care.reminderScheduled") : t("ko", "care.reminderPermissionDenied"));
    } catch {
      setNotice(t("ko", "care.reminderScheduleFailed"));
    }
    return savedSetup;
  }

  async function saveRoutineAndRefreshMealReminders(input: PetRoutineInput) {
    await routine.saveRoutine(input);
    if (!databaseMode || !userId) return;
    try {
      const scheduled = await refreshMealReminders({ userId, petId: activePet.id, petName: activePet.name, routine: { ...input, petId: activePet.id }, requestPermission: true });
      setNotice(scheduled ? t("ko", "routine.mealReminderScheduled") : t("ko", "routine.mealReminderPermissionDenied"));
    } catch {
      setNotice(t("ko", "routine.mealReminderScheduleFailed"));
    }
  }

  function openTimelineEntry(entry: DiaryEntry) {
    if (getTimelineEntryRoute(entry) === "checklistNotice") { setNotice(t("ko", "today.checklistTimelineReadOnly")); return; }
    if (!canUpdateDiary) { setNotice(t("ko", "permission.diaryUpdateCareTeamOnly")); return; }
    diary.setTimelineEditEntry(entry); diary.setSelectedDiaryDate(entry.entryDate); diary.setDiaryFilter("day"); setActiveTab("diary");
  }
  function handleSignOut() { void confirmAndSignOut(signOut); }
  const homeNotice = notice.text === t("ko", "today.databaseNotice") ? "" : notice.text;
  const nonHomeNotice = notice.text === t("ko", "today.databaseNotice") || notice.text === t("ko", "today.previewNotice") ? "" : notice.text;

  if (showPetSettings) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.appFrame}>
          <PetSettingsHeader onBack={() => setShowPetSettings(false)} />
          <PetOnboardingScreen routine={routine.activeRoutine} onSaveRoutine={saveRoutineAndRefreshMealReminders} careSetup={care.activeCareSetup} onSaveCareSetup={saveCareSetupAndRefreshReminders} onProfileSaved={() => showSaveFeedback("petProfile")} />
          <SaveFeedbackBar feedback={saveFeedback} onDismiss={hideSaveFeedback} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.appFrame}>
        {activeTab === "today" ? <HomeHeader petName={activePet.name} onPetPress={handlePetPress} canSwitchPet={canCyclePet} /> : null}
        {activeTab === "diary" ? <DiaryHeader /> : null}
        {activeTab === "care" ? <CareHeader /> : null}
        {activeTab === "reports" ? <ReportsHeader /> : null}
        {activeTab === "settings" ? <SettingsHeader /> : null}

        <ScrollView key={activeTab} style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <OfflineConflictNotice key={userId ?? "signed-out"} userId={userId} />
          {activeTab !== "today" && nonHomeNotice ? <NoticeBanner text={nonHomeNotice} icon={notice.tone === "error" ? "close" : "shield"} tone={notice.tone} /> : null}
          {activeTab === "today" ? <HomeScreen pet={activePet} userId={userId} checklist={checklist} entries={diary.activeEntries} doses={medication.activeDoses} medicationAgenda={medication.medicationAgenda} walkEnabled={routine.activeRoutine.walk.enabled !== false} includeMedication showMedicationSummary={hasCareRecords} notice={homeNotice} noticeTone={notice.tone} onChecklistToggle={toggleChecklist} onViewTimelineAll={() => { diary.setTimelineEditEntry(null); diary.setSelectedDiaryDate(getLocalDateKey()); diary.setDiaryFilter("day"); setActiveTab("diary"); }} onTimelineEntryPress={openTimelineEntry} /> : null}
          {activeTab === "diary" ? <DiaryEntryScreen entries={diary.selectedDiaryEntries} selectedDateKey={diary.selectedDiaryDate} filter={diary.diaryFilter} onDateChange={diary.setSelectedDiaryDate} onFilterChange={diary.setDiaryFilter} onSave={diary.saveDiaryEntry} onUpdate={diary.updateDiaryRecord} onDelete={diary.deleteDiaryRecord} routine={routine.activeRoutine} petSpecies={activePet.species} initialEditingEntry={diary.timelineEditEntry} onInitialEditingEntryConsumed={() => diary.setTimelineEditEntry(null)} canCreate={canCreateDiary} canUpdate={canUpdateDiary} canDelete={canDeleteDiary} listStatus={diary.selectedDiaryStatus} onRetryList={diary.refetchSelectedDiary} /> : null}
          {activeTab === "care" ? <CareModeScreen petId={activePet.id} doses={medication.activeDoses} medicationAgenda={medication.medicationAgenda} onAgendaStatusChange={medication.saveAgendaStatus} onAddDose={medication.addMedicationDose} onUpdateDose={medication.updateDoseRecord} onDeleteDose={medication.deleteDoseRecord} onSaveCareSetup={saveCareSetupAndRefreshReminders} onUseSchedule={useCareSchedule} onOpenProfileCare={() => setShowPetSettings(true)} onGenerateReport={() => setActiveTab("reports")} conditionScore={diary.latestConditionScore} careSetup={care.activeCareSetup} canManageCare={canManageCare} canDeleteDose={canDeleteDose} canManageReports={canGenerateReport || canShareReport} /> : null}
          {activeTab === "reports" ? <ReportsScreen report={reportWorkflow.report} reportSummary={reportSummary} canGenerate={reportWorkflow.canGenerate} canConfirm={reportWorkflow.canConfirm} canShare={reportWorkflow.canShare} blockedReason={reportWorkflow.blockedReason} error={reportWorkflow.error} pendingAction={reportWorkflow.pendingAction} isBusy={reportWorkflow.isBusy} onGenerate={() => void reportWorkflow.generate()} onConfirm={() => void reportWorkflow.confirm()} onShare={() => void reportWorkflow.share()} onRevoke={() => reportWorkflow.revoke()} onReset={reportWorkflow.reset} onNewDiary={() => setActiveTab("diary")} /> : null}
          {activeTab === "settings" ? <SettingsScreen email={user?.email} configured={configured} onOpenPetProfiles={() => setShowPetSettings(true)} onSignOut={handleSignOut} /> : null}
        </ScrollView>

        <BottomNav activeTab={activeTab} onChange={setActiveTab} />
        <SaveFeedbackBar feedback={saveFeedback} onDismiss={hideSaveFeedback} />
      </View>
    </SafeAreaView>
  );
}
