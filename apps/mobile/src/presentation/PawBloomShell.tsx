import { AppearanceRoute, CharacterSaveReaction, useAppearanceOnboarding } from "./shell/AppearanceRoute";
import { useAllPetsTodayCare } from "./care/useAllPetsTodayCare";
import { useShellMutationScope } from "./shell/useShellMutationScope";
import type { NotificationOpenTarget } from "./shell/notificationRouting";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { DiaryEntry } from "../contexts/diary/domain/diaryEntry";
import { DiaryEntryScreen } from "../contexts/diary/ui/DiaryEntryScreen";
import { getTodayEntriesForPet, useDiaryEntriesController } from "../contexts/diary/ui/useDiaryEntriesController";
import { useAuth } from "../contexts/identity/application/authContext";
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
import { useReportDraftSummary } from "../contexts/report/application/reportDraftRecords";
import { ReportsScreen } from "../contexts/report/ui/ReportsScreen";
import { useVetReportWorkflow } from "../contexts/report/ui/useVetReportWorkflow";
import { OfflineConflictNotice } from "../contexts/sync/ui/OfflineConflictNotice";
import { t } from "../i18n/translations";
import { useLanguage } from "../i18n/languageContext";
import { getLocalDateKey } from "../shared-kernel/date";
import { MedicationDestinationScreen } from "./screens/MedicationDestinationScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { PetOnboardingScreen } from "./screens/PetOnboardingScreen";
import { SettingsHubScreen } from "./screens/SettingsHubScreen";
import { BottomNav } from "./ui/BottomNav";
import { HouseHeader, ShellTitleHeader, PetDetailHeader, PetSettingsHeader, SettingsHeader } from "./shell/ShellHeaders";
import { SaveFeedbackBar } from "./shell/SaveFeedbackBar";
import { createSaveFeedback, shouldShowShellNotice, type SaveFeedback, type SaveFeedbackKind, type ShellNoticeSource } from "./shell/saveFeedback";
import { createChecklistFromRecords } from "./shell/todayChecklist";
import { refreshMealReminders, refreshMedicationReminders, useReminderAutoRefresh } from "./shell/reminderScheduling";
import { useMedicationReminderToggle } from "./shell/useMedicationReminderToggle";
import { useAndroidBackNavigation } from "./shell/useAndroidBackNavigation";
import { buildSampleDiaryEntries } from "../contexts/diary/ui/sampleDiaryEntries";
import { getDiaryEntryDisplaySummary } from "../contexts/diary/ui/diaryEntryDisplay";
import { buildSampleDoses } from "../contexts/medication/ui/sampleDoses";
import { useTodayChecklistController } from "./shell/useTodayChecklistController";
import { getTimelineEntryRoute } from "./shell/timelineRouting";
import { useShellPetSelection } from "./shell/useShellPetSelection";
import { styles } from "./PawBloomShell.styles";
import { getShellPermissions } from "./shell/shellPermissions";
import { NoticeBanner, type NoticeTone } from "../design-system/components";
import { can } from "../shared-kernel/permissions";
import { HouseScreen } from "./screens/HouseScreen";
import { TodayCareScreen } from "./screens/TodayCareScreen";
import { MemoriesScreen } from "./screens/MemoriesScreen";
import { PetDetailScreen } from "./screens/PetDetailScreen";
import { houseRoute, reduceAppRoute, resolveAccessibleRoute, type AppRoute, type AppRouteAction, type CareDestination, type PetSection } from "./navigation/appRoute";
import { useDiaryMemories } from "../contexts/diary/application/diaryMemories";
import { canOpenDiaryMemory } from "./shell/diaryMemoryNavigation";
type PawBloomShellProps = { notificationTarget?: NotificationOpenTarget | null; onNotificationConsumed?: () => void; activePet?: PetProfile | null; pets?: PetProfile[]; onPetNext?: () => void; onSelectPet?: (petId: string) => void };
export function PawBloomShell(props: PawBloomShellProps = {}) { const { user } = useAuth(); return <PawBloomSession key={user?.id ?? "preview"} {...props} />; }
function PawBloomSession({ notificationTarget, onNotificationConsumed, activePet: externalActivePet, pets: externalPets, onSelectPet }: PawBloomShellProps) {
  const { configured, user, activePet: authActivePet, pets: authPets, selectPet, signOut } = useAuth();
  const { language } = useLanguage();
  const { activePet, accessiblePets, ownedPetCount, selectPetId, previewPets } = useShellPetSelection({ language, externalActivePet, externalPets, authActivePet, authPets, authenticated: Boolean(user), onSelectPet, selectPet });
  const [routeState, setRouteState] = useState<AppRoute>(houseRoute);
  const accessibleIds = accessiblePets.map((pet) => pet.id);
  const route = resolveAccessibleRoute(routeState, accessibleIds, accessiblePets.filter((pet) => pet.role === "owner").map((pet) => pet.id));
  const dispatchRoute = (action: AppRouteAction) => setRouteState((current) => reduceAppRoute(current, action, accessibleIds));
  useEffect(() => { if (route !== routeState) setRouteState(route); }, [route, routeState]);
  const detailReady = route.kind === "pet" && activePet.id === route.petId;
  const careView = detailReady && route.kind === "pet" && route.section === "care" ? route.destination.view : null;
  const databaseMode = configured && Boolean(user);
  const livePetId = databaseMode && accessibleIds.includes(activePet.id) ? activePet.id : null;
  const userId = databaseMode ? user?.id ?? null : null;
  const { canCreateDiary, canDeleteDiary, canManageCare, canDeleteDose, canGenerateReport, canShareReport, canReadReport } = getShellPermissions(activePet.role);
  const canUpdateDiary = can(activePet.role, "diary.update");
  const canConfirmReport = can(activePet.role, "report.confirm");
  const mutationScope = useShellMutationScope(JSON.stringify([userId, activePet.id, accessiblePets.map((pet) => [pet.id, pet.role])]));
  const scrollRef = useRef<ScrollView>(null);
  const [pendingEntry, setPendingEntry] = useState<DiaryEntry | null>(null);
  const [notice, setNoticeState] = useState<{ text: string; tone: NoticeTone }>({ text: databaseMode ? t("today.databaseNotice") : t("today.previewNotice"), tone: "success" });
  const setNotice = useCallback((text: string, tone: NoticeTone = "success", source?: ShellNoticeSource) => { if (shouldShowShellNotice(tone, source)) setNoticeState({ text, tone }); }, []);
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedback | null>(null);
  const [localChecklist, setLocalChecklist] = useState(() => createChecklistFromRecords(buildSampleDiaryEntries(previewPets[0].id), buildSampleDoses(previewPets[0].id)));
  const showSaveFeedback = useCallback((kind: SaveFeedbackKind) => setSaveFeedback(createSaveFeedback(kind)), []);
  const hideSaveFeedback = useCallback(() => setSaveFeedback(null), []);
  useEffect(() => {
    setNotice(databaseMode ? t("today.databaseNotice") : t("today.previewNotice"));
  }, [databaseMode, language, setNotice]);
  function navigate(action: AppRouteAction) {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    setNotice(databaseMode ? t("today.databaseNotice") : t("today.previewNotice"));
    dispatchRoute(action);
  }
  useAppearanceOnboarding(userId, accessiblePets, (petId) => { selectPetId(petId); navigate({ type: "appearance", petId, onboarding: true }); });
  useAndroidBackNavigation({ route, onBack: () => navigate({ type: "back" }) });
  const routine = useRoutineDefaults({ activePetId: activePet.id, activePetSpecies: activePet.species, databaseMode, livePetId, userId, fallbackPet: previewPets[0], onNotice: mutationScope.guard(setNotice), onSaved: mutationScope.guard(() => showSaveFeedback("routine")) });
  const care = useCareSetupState({ activePetId: activePet.id, databaseMode, livePetId, userId, onNotice: mutationScope.guard(setNotice), onSaved: mutationScope.guard(() => showSaveFeedback("careSetup")) });
  const { medicationRemindersEnabled, toggleMedicationReminders } = useMedicationReminderToggle({ databaseMode, userId, activePet, pets: authPets, activePetSchedules: care.activeCareSetup.schedules, setNotice });
  useReminderAutoRefresh({ databaseMode, userId, petId: activePet.id, petName: activePet.name, language, schedules: care.activeCareSetup.schedules, activeRoutine: routine.activeRoutine, medicationRemindersEnabled, routineLoaded: routine.routineLoaded });
  const medication = useMedicationDosesController({
    activePetId: activePet.id,
    databaseMode,
    livePetId,
    userId,
    fallbackPetId: previewPets[0].id,
    language,
    schedules: care.activeCareSetup.schedules,
    onNotice: mutationScope.guard(setNotice),
    onSaved: mutationScope.guard(showSaveFeedback),
    onLocalDoseSaved: mutationScope.guard((input) => { if (shouldMarkMedicationChecklist(input)) setLocalChecklist((current) => ({ ...current, medication: true })); }),
    onLocalDosesChanged: mutationScope.guard((nextDoses) => setLocalChecklist((current) => ({ ...current, medication: hasRecordedMedication(nextDoses, activePet.id) }))),
  });
  const diary = useDiaryEntriesController({
    activePetId: activePet.id,
    databaseMode,
    livePetId,
    userId,
    fallbackPetId: previewPets[0].id,
    language,
    onNotice: mutationScope.guard(setNotice),
    onSaved: mutationScope.guard(() => showSaveFeedback("diary")),
    onLocalEntrySaved: mutationScope.guard((entry) => setLocalChecklist((current) => ({ ...current, ...(entry.category in current ? { [entry.category]: true } : {}) }))),
    onLocalEntriesChanged: mutationScope.guard((nextEntries) => setLocalChecklist(createChecklistFromRecords(getTodayEntriesForPet(nextEntries, activePet.id), medication.activeDoses, medication.medicationAgenda))),
  });
  useEffect(() => { if (!databaseMode) setLocalChecklist(createChecklistFromRecords(diary.activeEntries, medication.activeDoses, medication.medicationAgenda)); }, [databaseMode, diary.activeEntries, medication.activeDoses, medication.medicationAgenda]);
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
    databaseMode, scopeKey: JSON.stringify([userId, activePet.id, accessiblePets.map((pet) => [pet.id, pet.role])]),
    activePetId: activePet.id,
    canDeleteDiary,
    canManageCare,
    canDeleteDose,
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
    deleteDiaryEntryRemote: diary.deleteEntryRemote,
    deleteMedicationDoseRemote: medication.deleteDoseRemote,
    updateMedicationDoseStatusRemote: medication.updateDoseStatusRemote,
    setNotice,
    showSaveFeedback,
  });
  const hasCareRecords = medication.activeDoses.length > 0 || care.activeCareSetup.schedules.length > 0 || Boolean(care.activeCareSetup.condition || care.activeCareSetup.plan || care.activeCareSetup.conditionName || care.activeCareSetup.planTitle);
  function useCareSchedule(schedule: CareMedicationSchedule) {
    if (findDoseForScheduleDate(medication.activeDoses, schedule.id, getLocalDateKey())) {
      setNotice(t("care.scheduleAlreadyLoaded"));
      return;
    }
    void Promise.resolve(medication.addMedicationDose(buildQuickDoseFromSchedule(schedule, "pending"))).catch(() => undefined);
  }
  async function saveCareSetupAndRefreshReminders(input: CareSetupInput) {
    if (!canManageCare) throw new Error(t("permission.careTeamOnly"));
    const previousScheduleIds = care.activeCareSetup.schedules.map((schedule) => schedule.id);
    const savedSetup = await care.saveCareSetup(input);
    if (!mutationScope.isCurrent() || !databaseMode || !userId || Platform.OS === "web" || !medicationRemindersEnabled) return savedSetup;
    try {
      const scheduled = await refreshMedicationReminders({ userId, petId: activePet.id, petName: activePet.name, schedules: savedSetup.schedules, requestPermission: true, previousScheduleIds });
      mutationScope.guard(setNotice)(scheduled ? t("care.reminderScheduled") : t("care.reminderPermissionDenied"), scheduled ? "success" : "error");
    } catch {
      mutationScope.guard(setNotice)(t("care.reminderScheduleFailed"), "error");
    }
    return savedSetup;
  }
  async function saveRoutineAndRefreshMealReminders(input: PetRoutineInput) {
    await routine.saveRoutine(input);
    if (!mutationScope.isCurrent() || !databaseMode || !userId || Platform.OS === "web") return;
    try {
      const scheduled = await refreshMealReminders({ userId, petId: activePet.id, petName: activePet.name, routine: { ...input, petId: activePet.id }, requestPermission: true });
      mutationScope.guard(setNotice)(scheduled ? t("routine.mealReminderScheduled") : t("routine.mealReminderPermissionDenied"), scheduled ? "success" : "error");
    } catch {
      mutationScope.guard(setNotice)(t("routine.mealReminderScheduleFailed"), "error");
    }
  }
  const allPetsTodayCare = useAllPetsTodayCare(userId, accessiblePets, { entries: diary.entries, doses: medication.doses });
  useEffect(() => { if (notificationTarget?.userId === userId) { if ("kind" in notificationTarget) dispatchRoute({ type: "tab", tab: "house" }); else openPet(notificationTarget.petId, notificationTarget.destination); onNotificationConsumed?.(); } }, [notificationTarget]);
  const memories = useDiaryMemories(accessibleIds, userId, diary.entries);
  useEffect(() => {
    if (!pendingEntry) return;
    if (!canOpenDiaryMemory(pendingEntry, route, accessiblePets)) { setPendingEntry(null); return; }
    if (activePet.id !== pendingEntry.petId) return;
    diary.setSelectedDiaryDate(pendingEntry.entryDate); diary.setDiaryFilter("day"); diary.setTimelineEditEntry(pendingEntry);
    setPendingEntry(null);
  }, [pendingEntry, route, activePet.id, accessiblePets]);
  function openPet(petId: string, destination?: CareDestination, section?: PetSection) {
    if (section === "profile" && !databaseMode) { setNotice(t("pet.loginRequired"), "info"); return; }
    if (!selectPetId(petId)) { navigate({ type: "tab", tab: "house" }); return; }
    if (destination?.view === "diary" && destination.dateKey) { diary.setSelectedDiaryDate(destination.dateKey); diary.setDiaryFilter("day"); diary.setTimelineEditEntry(null); }
    navigate({ type: "openPet", petId, destination, section }); }
  function openTimelineEntry(entry: DiaryEntry) {
    if (getTimelineEntryRoute(entry) === "checklistNotice") { setNotice(t("today.checklistTimelineReadOnly")); return; }
    const pet = accessiblePets.find((item) => item.id === entry.petId);
    if (!pet || !can(pet.role, "diary.update")) { setNotice(t("permission.diaryUpdateCareTeamOnly")); return; }
    setPendingEntry(entry); openPet(entry.petId, { view: "diary", entryId: entry.id, dateKey: entry.entryDate });
  }
  function openNewDiary(petId: string) {
    if (!selectPetId(petId)) return;
    diary.setTimelineEditEntry(null); diary.setSelectedDiaryDate(getLocalDateKey()); diary.setDiaryFilter("day");
    openPet(petId, { view: "diary", dateKey: getLocalDateKey() });
  }
  function openPetSettings() {
    if (!databaseMode) { setNotice(t("pet.loginRequired"), "info"); return; }
    if (route.kind === "pet") navigate({ type: "section", section: "profile" });
    else navigate({ type: "tab", tab: "house" });
  }
  function openAddPet() {
    if (!databaseMode) { setNotice(t("pet.loginRequired"), "info"); return; }
    if (ownedPetCount > 0) { setNotice(t("pet.planLimitReached"), "info"); return; }
    navigate({ type: "petCreate" });
  }
  const homeNotice = notice.text === t("today.databaseNotice") ? "" : notice.text;
  const nonHomeNotice = notice.text === t("today.databaseNotice") ? "" : notice.text;
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.appFrame}>
        {route.kind === "pet" && detailReady ? <PetDetailHeader petName={activePet.name} onBack={() => navigate({ type: "back" })} /> : route.kind === "pet-create" ? <PetSettingsHeader onBack={() => navigate({ type: "back" })} /> : route.kind === "main" && route.tab === "more" ? <SettingsHeader /> : route.kind === "main" && (route.tab === "care" || route.tab === "memories") ? <ShellTitleHeader title={t(route.tab === "care" ? "tabs.care" : "tabs.memories")} /> : <HouseHeader onAddPet={openAddPet} onRequestRecord={() => navigate({ type: "recordTarget" })} />}
        <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <OfflineConflictNotice key={userId ?? "signed-out"} userId={userId} pets={authPets} />
          {careView !== "default" && nonHomeNotice ? <View style={styles.petSettingsNotice}><NoticeBanner text={nonHomeNotice} icon={notice.tone === "error" ? "close" : "check"} tone={notice.tone} /></View> : null}
          {route.kind === "main" && route.tab === "house" || route.kind === "record-target" ? <HouseScreen pets={accessiblePets} userId={userId} recordTargetSelection={route.kind === "record-target"} careStates={allPetsTodayCare.petStates} memoryStates={memories.petStates} onOpenPet={(petId, section) => openPet(petId, undefined, section)} onCancelRecordTarget={route.kind === "record-target" ? () => navigate({ type: "back" }) : undefined} onRecordPet={openNewDiary} onAddPet={openAddPet} onEditAppearance={(petId) => navigate({ type: "appearance", petId })} /> : null}
          {route.kind === "main" && route.tab === "care" ? <TodayCareScreen dateKey={allPetsTodayCare.dateKey} pets={accessiblePets} status={allPetsTodayCare.status} petStates={allPetsTodayCare.petStates} onOpenPet={openPet} onRetryPet={allPetsTodayCare.retryPet} /> : null}
          {route.kind === "main" && route.tab === "memories" ? <MemoriesScreen pets={accessiblePets} petStates={memories.petStates} onOpenDiaryEntry={openTimelineEntry} onRetryPet={memories.retryPet} /> : null}
          {detailReady && route.kind === "pet" ? <PetDetailScreen pet={activePet} route={route} userId={userId} onEditAppearance={() => navigate({ type: "appearance", petId: route.petId, returnTo: "profile" })} onSectionChange={(section) => section === "profile" ? openPetSettings() : navigate({ type: "section", section })} onCareViewChange={(destination) => navigate({ type: "careView", destination })} /> : null}
          {detailReady && route.kind === "pet" && route.section === "memories" ? <MemoriesScreen pets={accessiblePets} petId={route.petId} petStates={memories.petStates} onOpenDiaryEntry={openTimelineEntry} onRetryPet={memories.retryPet} /> : null}
          {route.kind === "pet-create" || detailReady && route.kind === "pet" && route.section === "profile" && databaseMode ? <PetOnboardingScreen mode="manage" petId={route.kind === "pet" ? route.petId : undefined} createOnly={route.kind === "pet-create"} onCreated={() => navigate({ type: "tab", tab: "house" })} onCancelCreate={() => navigate({ type: "tab", tab: "house" })} routine={routine.activeRoutine} onSaveRoutine={saveRoutineAndRefreshMealReminders} careSetup={care.activeCareSetup} onSaveCareSetup={saveCareSetupAndRefreshReminders} onProfileSaved={() => showSaveFeedback("petProfile")} medicationRemindersEnabled={medicationRemindersEnabled} onToggleMedicationReminders={(enabled) => void toggleMedicationReminders(enabled)} /> : null}
          {careView === "default" ? <HomeScreen pet={activePet} userId={userId} checklist={checklist} entries={diary.activeEntries} doses={medication.activeDoses} medicationAgenda={medication.medicationAgenda} walkEnabled={routine.activeRoutine.walk.enabled !== false} includeMedication showMedicationSummary={hasCareRecords} notice={homeNotice} noticeTone={notice.tone} todayStatus={diary.todayDiaryStatus === "error" || medication.todayDosesStatus === "error" ? "error" : diary.todayDiaryStatus === "loading" || medication.todayDosesStatus === "loading" ? "loading" : "ready"} onRetryToday={() => { diary.refetchTodayDiary(); medication.refetchTodayDoses(); }} onChecklistToggle={toggleChecklist} onViewTimelineAll={() => { diary.setTimelineEditEntry(null); diary.setSelectedDiaryDate(getLocalDateKey()); diary.setDiaryFilter("day"); dispatchRoute({ type: "careView", destination: { view: "diary" } }); }} onTimelineEntryPress={openTimelineEntry} /> : null}
          {/* Keep the diary draft mounted across tabs (B9). */}
          <View style={careView === "diary" ? null : styles.hiddenTab} accessibilityElementsHidden={careView !== "diary"} importantForAccessibility={careView === "diary" ? "auto" : "no-hide-descendants"}>
            <DiaryEntryScreen petId={activePet.id} entries={diary.selectedDiaryEntries} selectedDateKey={diary.selectedDiaryDate} filter={diary.diaryFilter} onDateChange={diary.setSelectedDiaryDate} onFilterChange={diary.setDiaryFilter} onSave={diary.saveDiaryEntry} onUpdate={diary.updateDiaryRecord} onDelete={diary.deleteDiaryRecord} routine={routine.activeRoutine} petSpecies={activePet.species} initialEditingEntry={diary.timelineEditEntry} onInitialEditingEntryConsumed={() => diary.setTimelineEditEntry(null)} canCreate={canCreateDiary} canUpdate={canUpdateDiary} canDelete={canDeleteDiary} listStatus={diary.selectedDiaryStatus} onRetryList={diary.refetchSelectedDiary} />
          </View>
          {careView === "medication" ? <MedicationDestinationScreen key={`${activePet.id}:${route.kind === "pet" && route.destination.view === "medication" ? route.destination.dateKey ?? getLocalDateKey() : getLocalDateKey()}`} dateKey={route.kind === "pet" && route.destination.view === "medication" ? route.destination.dateKey ?? getLocalDateKey() : getLocalDateKey()} scheduleId={route.kind === "pet" && route.destination.view === "medication" ? route.destination.scheduleId : undefined} userId={userId} petId={activePet.id} doses={medication.doses} onAgendaStatusChange={medication.saveAgendaStatus} onAddDose={medication.addMedicationDose} onUpdateDose={medication.updateDoseRecord} onDeleteDose={medication.deleteDoseRecord} onSaveCareSetup={saveCareSetupAndRefreshReminders} onUseSchedule={useCareSchedule} onOpenProfileCare={openPetSettings} onGenerateReport={() => dispatchRoute({ type: "careView", destination: { view: "reports" } })} conditionScore={diary.latestConditionScore} careSetup={care.activeCareSetup} careStatus={care.careSetupStatus} onRetryCare={care.refetchCareSetup} canManageCare={canManageCare} canDeleteDose={canDeleteDose} canManageReports={canGenerateReport || canShareReport} /> : null}
          {careView === "reports" ? <ReportsScreen report={reportWorkflow.report} reportSummary={reportSummary} canGenerate={reportWorkflow.canGenerate} canConfirm={reportWorkflow.canConfirm} canShare={reportWorkflow.canShare} blockedReason={reportWorkflow.blockedReason} error={reportWorkflow.error} pendingAction={reportWorkflow.pendingAction} isBusy={reportWorkflow.isBusy} onGenerate={() => void reportWorkflow.generate()} onConfirm={() => void reportWorkflow.confirm()} onShare={() => void reportWorkflow.share()} onRevoke={() => reportWorkflow.revoke()} onReset={reportWorkflow.reset} onNewDiary={() => dispatchRoute({ type: "careView", destination: { view: "diary" } })} onRetryLoad={reportWorkflow.retryLoad} formatDiarySummary={getDiaryEntryDisplaySummary} /> : null}
          {route.kind === "main" && route.tab === "more" ? <SettingsHubScreen email={user?.email} configured={configured} userId={userId} pets={accessiblePets} onOpenPetProfile={(petId) => { if (!databaseMode) { setNotice(t("pet.loginRequired"), "info"); return; } if (selectPetId(petId)) navigate({ type: "openPet", petId, section: "profile" }); }} onOpenPetProfiles={openPetSettings} onSignOut={() => void confirmAndSignOut(signOut)} /> : null}
        </ScrollView>
        <BottomNav activeTab={route.kind === "main" ? route.tab : "house"} onChange={(tab) => navigate({ type: "tab", tab })} />
        {route.kind === "appearance" ? <AppearanceRoute key={`${userId}:${route.petId}`} pet={accessiblePets.find((pet) => pet.id === route.petId && pet.role === "owner")} userId={userId} onboarding={route.onboarding} onClose={() => navigate({ type: "back" })} /> : null}
        {saveFeedback?.tone === "success" && ["diary", "checklist", "medication", "medicationStatus"].includes(saveFeedback.kind) ? <CharacterSaveReaction key={saveFeedback.id} eventId={saveFeedback.id} pet={activePet} userId={userId} /> : null}
        <SaveFeedbackBar feedback={saveFeedback} onDismiss={hideSaveFeedback} />
      </View>
    </SafeAreaView>
  );
}