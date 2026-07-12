import { vetReportDisclaimer, type VetReportPayload } from "../application/vetReportContract";
import { createReportArtifactSnapshot } from "./reportArtifactSnapshot";

declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const { readFileSync } = require("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
};

const payload: VetReportPayload = {
  version: 1,
  pet: { name: "Mochi", species: "dog", breed: "Shiba", weightKg: 9.2 },
  entries: [
    { category: "condition", summary: "Energy: Low", memo: "Tired", details: [{ label: "Energy", value: "Low" }], occurredAt: "2026-07-11T08:00:00+10:00", conditionScore: 2 },
    { category: "condition", summary: "Energy: High", memo: "Alert", details: [{ label: "Energy", value: "High" }], occurredAt: "2026-07-12T08:00:00+10:00", conditionScore: 4 },
  ],
  medicationDoses: [
    { medicationName: "Cerenia", status: "partial", scheduledAt: "2026-07-12T09:00:00+10:00", conditionName: "Nausea", dosageLabel: "16 mg", administeredAmount: "8 mg", reactionNote: "Sleepy" },
  ],
  disclaimer: vetReportDisclaimer,
};

const snapshot = createReportArtifactSnapshot(payload);
if (snapshot.diaryCount !== 2 || snapshot.medicationCount !== 1 || snapshot.medicationAttentionCount !== 1) {
  throw new Error("Generated report metrics must be derived from the immutable artifact payload");
}
if (snapshot.conditionTrend.direction !== "improving" || snapshot.conditionTrend.latestScore !== 4) {
  throw new Error("Generated report condition trends must use only the artifact timestamps and scores");
}
if (!snapshot.petDetails.includes("weight_kg: 9.2") || !snapshot.timelineItems.some((item) => item.includes("given: 8 mg") && item.includes("reaction: Sleepy"))) {
  throw new Error("The generated artifact presentation must preserve every pet and timeline field shared with the clinic");
}
if (snapshot.timelineItems.some((item) => item.includes('{"version"'))) throw new Error("artifact timeline text must never expose nested encoded JSON");

const reportsScreen = readFileSync(`${process.cwd()}/apps/mobile/src/contexts/report/ui/ReportsScreen.tsx`, "utf8");
if (!reportsScreen.includes("createReportArtifactSnapshot(report.payload)") || !reportsScreen.includes("artifactSnapshot?.timelineItems")) {
  throw new Error("After generation, the report screen must render the immutable artifact instead of a newer live summary");
}
