import { vetReportDisclaimer, type VetReportPayload } from "../application/vetReportContract";
import { createReportArtifactSnapshot } from "./reportArtifactSnapshot";
import { formatReportTimelineItem } from "./reportDraftDisplay";

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
if (snapshot.petDetails.includes("null") || snapshot.petDetails.includes("weight_kg") || !snapshot.petDetails.includes("9.2kg")) {
  throw new Error("Pet details must render as human copy — no snake_case field names or null literals");
}
const emptyPetDetails = createReportArtifactSnapshot({ ...payload, pet: { name: "Mochi", species: "dog", breed: null, weightKg: null } }).petDetails;
if (emptyPetDetails.includes("null") || !emptyPetDetails.includes("미기록")) {
  throw new Error("Missing pet fields must read as a localized not-recorded label instead of null");
}

const doseItem = snapshot.timelineItems.find((item) => item.kind === "medication");
if (!doseItem || doseItem.administeredAmount !== "8 mg" || doseItem.reactionNote !== "Sleepy" || doseItem.dateKey !== "2026-07-12") {
  throw new Error("The generated artifact must preserve every timeline field shared with the clinic in the shared neutral shape");
}
const doseLine = formatReportTimelineItem(doseItem, "ko");
if (!doseLine.includes("8 mg") || !doseLine.includes("Sleepy") || !doseLine.includes("2026년 7월 12일")) {
  throw new Error("Generated timeline items must render through the shared draft formatter with locale dates");
}
if (snapshot.timelineItems.some((item) => JSON.stringify(item).includes('{\\"version\\"'))) throw new Error("artifact timeline items must never expose nested encoded JSON");

const reportsScreen = readFileSync(`${process.cwd()}/apps/mobile/src/contexts/report/ui/ReportsScreen.tsx`, "utf8");
if (!reportsScreen.includes("createReportArtifactSnapshot(report.payload)") || !reportsScreen.includes("artifactSnapshot?.timelineItems")) {
  throw new Error("After generation, the report screen must render the immutable artifact instead of a newer live summary");
}
