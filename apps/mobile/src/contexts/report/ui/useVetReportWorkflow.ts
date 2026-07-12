import { useEffect, useRef, useState } from "react";
import { Share } from "react-native";
import { useMutation } from "@tanstack/react-query";
import type { GeneratedVetReport } from "../application/vetReportContract";
import { confirmVetReport, generateVetReport, markVetReportShared, readSharedVetReport } from "../application/vetReportRecords";
import { t } from "../../../i18n/translations";
import type { ReportWorkflowAction, ReportWorkflowError } from "./reportWorkflow";

type Params = {
  petId: string | null;
  enabled: boolean;
  hasRecords: boolean;
};

export function useVetReportWorkflow({ petId, enabled, hasRecords }: Params) {
  const [report, setReport] = useState<GeneratedVetReport | null>(null);
  const [error, setError] = useState<ReportWorkflowError | null>(null);
  const [pendingAction, setPendingAction] = useState<ReportWorkflowAction | null>(null);
  const lockRef = useRef(false);
  const activePetIdRef = useRef(petId);
  const generateMutation = useMutation({ mutationFn: generateVetReport });
  const confirmMutation = useMutation({
    mutationFn: async (current: GeneratedVetReport) => {
      await confirmVetReport({ reportId: current.reportId, petId: current.petId });
      const sharedReport = await readSharedVetReport(current.shareToken);
      if (sharedReport.id !== current.reportId) throw new Error("Shared report did not match the confirmed report.");
      return sharedReport;
    },
  });
  const shareMutation = useMutation({
    mutationFn: async (current: GeneratedVetReport) => {
      const result = await Share.share(
        {
          title: t("ko", "reports.shareDialogTitle"),
          message: t("ko", "reports.shareMessage").replace("{url}", current.shareUrl),
          url: current.shareUrl,
        },
        { dialogTitle: t("ko", "reports.shareDialogTitle") },
      );
      if (result.action !== Share.sharedAction) return false;
      await markVetReportShared({ reportId: current.reportId, petId: current.petId });
      return true;
    },
  });

  useEffect(() => {
    activePetIdRef.current = petId;
    setReport(null);
    setError(null);
  }, [enabled, petId]);

  async function generate() {
    if (!enabled) return setError("accountRequired");
    if (!petId) return setError("petRequired");
    if (!hasRecords) return setError("empty");
    const requestPetId = petId;
    await runAction("generate", requestPetId, async () => {
      const generated = await generateMutation.mutateAsync({ petId: requestPetId, rangeDays: 7 });
      if (activePetIdRef.current === requestPetId) setReport(generated);
    });
  }

  async function confirm() {
    if (!report || report.status !== "draft" || report.petId !== petId) return;
    const current = report;
    await runAction("confirm", current.petId, async () => {
      const sharedReport = await confirmMutation.mutateAsync(current);
      if (activePetIdRef.current !== current.petId) return;
      setReport((value) => value?.reportId === current.reportId
        ? { ...value, status: sharedReport.status, confirmedByOwner: true, englishSummary: sharedReport.englishSummary, payload: sharedReport.payload }
        : value);
    });
  }

  async function share() {
    if (!report || report.status === "draft" || !report.confirmedByOwner || report.petId !== petId) return;
    const current = report;
    await runAction("share", current.petId, async () => {
      const shared = await shareMutation.mutateAsync(current);
      if (shared && activePetIdRef.current === current.petId) {
        setReport((value) => value?.reportId === current.reportId ? { ...value, status: "shared" } : value);
      }
    });
  }

  function reset() {
    if (lockRef.current) return;
    setReport(null);
    setError(null);
  }

  async function runAction(action: ReportWorkflowAction, actionPetId: string, task: () => Promise<void>) {
    if (lockRef.current) return;
    lockRef.current = true;
    setPendingAction(action);
    setError(null);
    try {
      await task();
    } catch {
      if (activePetIdRef.current === actionPetId) setError(action);
    } finally {
      lockRef.current = false;
      setPendingAction(null);
    }
  }

  return {
    report,
    error,
    pendingAction,
    isBusy: pendingAction !== null,
    canGenerate: enabled && Boolean(petId) && hasRecords,
    blockedReason: !enabled ? "accountRequired" as const : !petId ? "petRequired" as const : !hasRecords ? "empty" as const : null,
    generate,
    confirm,
    share,
    reset,
  };
}
