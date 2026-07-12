import { useEffect, useRef, useState } from "react";
import { Share } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { GeneratedVetReport } from "../application/vetReportContract";
import { confirmVetReport, generateVetReport, loadVetReportState, readSharedVetReport } from "../application/vetReportRecords";
import { t } from "../../../i18n/translations";
import { hasUsableReportLink, type ReportWorkflowAction, type ReportWorkflowError } from "./reportWorkflow";
import { vetReportStateKey } from "../application/reportQueryKeys";

type Params = {
  petId: string | null;
  userId: string | null;
  enabled: boolean;
  hasRecords: boolean;
  canGenerateReport: boolean;
  canConfirmReport: boolean;
  canShareReport: boolean;
  canReadReport: boolean;
};

export function useVetReportWorkflow({ petId, userId, enabled, hasRecords, canGenerateReport, canConfirmReport, canShareReport, canReadReport }: Params) {
  const [report, setReport] = useState<GeneratedVetReport | null>(null);
  const [error, setError] = useState<ReportWorkflowError | null>(null);
  const [pendingAction, setPendingAction] = useState<ReportWorkflowAction | null>(null);
  const lockRef = useRef(false);
  const dismissedReportIdRef = useRef<string | null>(null);
  const activePetIdRef = useRef(petId);
  const activeUserIdRef = useRef(userId);
  const queryClient = useQueryClient();
  const reportStateKey = vetReportStateKey(petId, userId);
  const canLoadReportState = enabled && Boolean(petId && userId) && canReadReport;
  const reportStateQuery = useQuery({
    queryKey: reportStateKey,
    queryFn: () => loadVetReportState({ petId: petId! }),
    enabled: canLoadReportState,
    staleTime: 5_000,
    refetchInterval: (query) => query.state.data?.status === "draft" ? 15_000 : false,
  });
  const generateMutation = useMutation({ mutationFn: generateVetReport });
  const confirmMutation = useMutation({
    mutationFn: async (current: GeneratedVetReport) => {
      await confirmVetReport({ reportId: current.reportId, petId: current.petId });
      const confirmedReport = await loadVetReportState({ petId: current.petId, reportId: current.reportId });
      if (!confirmedReport || confirmedReport.reportId !== current.reportId || !confirmedReport.confirmedByOwner) {
        throw new Error("Confirmed report state did not match the selected draft.");
      }
      return confirmedReport;
    },
  });
  const shareMutation = useMutation({
    mutationFn: async (current: GeneratedVetReport) => {
      const reusedExistingLink = hasUsableReportLink(current);
      let shareableReport = reusedExistingLink ? current : await issueReportLink(current);
      if (!shareableReport?.shareUrl || !shareableReport.shareToken || !shareableReport.expiresAt) {
        throw new Error("A protected report link could not be issued.");
      }
      let verifiedReport: Awaited<ReturnType<typeof readSharedVetReport>>;
      try {
        verifiedReport = await readSharedVetReport(shareableReport.shareToken);
      } catch (verificationError) {
        if (!reusedExistingLink) throw verificationError;
        shareableReport = await issueReportLink(current);
        if (!shareableReport?.shareUrl || !shareableReport.shareToken || !shareableReport.expiresAt) throw verificationError;
        verifiedReport = await readSharedVetReport(shareableReport.shareToken);
      }
      if (verifiedReport.status !== "shared") throw new Error("Shared report verification did not return a shared artifact.");
      if (activeUserIdRef.current !== userId) throw new Error("The active account changed before sharing.");
      const result = await Share.share(
        {
          title: t("ko", "reports.shareDialogTitle"),
          message: t("ko", "reports.shareMessage").replace("{url}", shareableReport.shareUrl),
          url: shareableReport.shareUrl,
        },
        { dialogTitle: t("ko", "reports.shareDialogTitle") },
      );
      if (result.action !== Share.sharedAction) return { report: shareableReport, shared: false };
      return { report: { ...shareableReport, status: "shared" as const }, shared: true };
    },
  });
  const revokeMutation = useMutation({
    mutationFn: async (current: GeneratedVetReport) => {
      const revoked = await loadVetReportState({ petId: current.petId, reportId: current.reportId, revokeShareToken: true });
      if (!revoked || revoked.status !== "confirmed" || !revoked.confirmedByOwner || revoked.shareToken || revoked.shareUrl) {
        throw new Error("The protected report link could not be revoked.");
      }
      return revoked;
    },
  });

  function issueReportLink(current: GeneratedVetReport) {
    return loadVetReportState({ petId: current.petId, reportId: current.reportId, issueShareToken: true });
  }

  useEffect(() => {
    activePetIdRef.current = petId;
    activeUserIdRef.current = userId;
    dismissedReportIdRef.current = null;
    setReport(null);
    setError(null);
    return () => {
      activePetIdRef.current = null;
      activeUserIdRef.current = null;
    };
  }, [enabled, petId, userId]);

  useEffect(() => {
    if (!canLoadReportState) {
      setReport(null);
      setError(null);
      return;
    }
    if (reportStateQuery.isError) setError("load");
    if (!reportStateQuery.isSuccess) return;
    setError((current) => current === "load" ? null : current);
    if (reportStateQuery.data?.reportId === dismissedReportIdRef.current) return;
    setReport((current) => mergeAuthorizedReportState(current, reportStateQuery.data));
  }, [canLoadReportState, reportStateQuery.data, reportStateQuery.isError, reportStateQuery.isSuccess]);

  async function generate() {
    if (!enabled || !userId) return setError("accountRequired");
    if (!petId) return setError("petRequired");
    if (!hasRecords) return setError("empty");
    if (!canGenerateReport) return setError("permission");
    const requestPetId = petId;
    const requestUserId = userId;
    await runAction("generate", requestPetId, requestUserId, async () => {
      const generated = await generateMutation.mutateAsync({ petId: requestPetId, rangeDays: 7 });
      if (activePetIdRef.current === requestPetId && activeUserIdRef.current === requestUserId) {
        dismissedReportIdRef.current = null;
        setReport(generated);
        queryClient.setQueryData(reportStateKey, generated);
      }
    });
  }

  async function confirm() {
    if (!canConfirmReport) return setError("permission");
    if (!userId || !report || report.status !== "draft" || report.petId !== petId) return;
    const current = report;
    const requestUserId = userId;
    await runAction("confirm", current.petId, requestUserId, async () => {
      const sharedReport = await confirmMutation.mutateAsync(current);
      if (activePetIdRef.current !== current.petId || activeUserIdRef.current !== requestUserId) return;
      setReport((value) => value?.reportId === current.reportId ? mergeAuthorizedReportState(value, sharedReport) : value);
      queryClient.setQueryData(reportStateKey, sharedReport);
    });
  }

  async function share() {
    if (!canShareReport) return setError("permission");
    if (!userId || !report || report.status === "draft" || !report.confirmedByOwner || report.petId !== petId) return;
    const current = report;
    const requestUserId = userId;
    await runAction("share", current.petId, requestUserId, async () => {
      const result = await shareMutation.mutateAsync(current);
      if (activePetIdRef.current === current.petId && activeUserIdRef.current === requestUserId) {
        setReport((value) => value?.reportId === current.reportId ? result.report : value);
        queryClient.setQueryData(reportStateKey, result.report);
      }
    });
  }

  async function revoke() {
    if (!canShareReport) return setError("permission");
    if (!userId || !report || report.status !== "shared" || report.petId !== petId) return;
    const current = report;
    const requestUserId = userId;
    await runAction("revoke", current.petId, requestUserId, async () => {
      const revoked = await revokeMutation.mutateAsync(current);
      if (activePetIdRef.current !== current.petId || activeUserIdRef.current !== requestUserId) return;
      setReport((value) => value?.reportId === current.reportId ? revoked : value);
      queryClient.setQueryData(reportStateKey, revoked);
    });
  }

  function reset() {
    if (lockRef.current) return;
    dismissedReportIdRef.current = report?.reportId ?? null;
    setReport(null);
    setError(null);
  }

  async function runAction(action: ReportWorkflowAction, actionPetId: string, actionUserId: string | null, task: () => Promise<void>) {
    if (lockRef.current) return;
    lockRef.current = true;
    setPendingAction(action);
    setError(null);
    try {
      await task();
    } catch {
      if (activePetIdRef.current === actionPetId && activeUserIdRef.current === actionUserId) setError(action);
    } finally {
      lockRef.current = false;
      setPendingAction(null);
    }
  }

  return {
    report,
    error,
    pendingAction,
    isBusy: pendingAction !== null || reportStateQuery.isLoading,
    canGenerate: enabled && Boolean(petId) && hasRecords && canGenerateReport,
    canConfirm: canConfirmReport,
    canShare: canShareReport,
    blockedReason: !enabled ? "accountRequired" as const : !petId ? "petRequired" as const : !hasRecords ? "empty" as const : !canGenerateReport && !report ? "permission" as const : null,
    generate,
    confirm,
    share,
    revoke,
    reset,
  };
}

export function mergeAuthorizedReportState(current: GeneratedVetReport | null, incoming: GeneratedVetReport | null) {
  if (!incoming) return null;
  if (incoming.status !== "shared") return incoming;
  if (current?.reportId !== incoming.reportId || incoming.shareToken) return incoming;
  return {
    ...incoming,
    shareToken: current.shareToken,
    expiresAt: current.expiresAt,
    shareUrl: current.shareUrl,
  };
}
