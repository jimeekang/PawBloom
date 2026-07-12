import { vetReportDisclaimer, type VetReportPayload } from "../application/vetReportContract";
import { createReportArtifactSnapshot } from "./reportArtifactSnapshot";

declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const { readFileSync } = require("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
};

const payload: VetReportPayload = {
  pet: { name: "Mochi", species: "dog", breed: "Shiba", weight_kg: 9.2 },
  entries: [
    { category: "condition", summary: "Tired", occurred_at: "2026-07-11T08:00:00+10:00", condition_score: 2 },
    { category: "condition", summary: "Alert", occurred_at: "2026-07-12T08:00:00+10:00", condition_score: 4 },
  ],
  medicationDoses: [
    { medication_name: "Cerenia", status: "partial", scheduled_at: "2026-07-12T09:00:00+10:00", reaction_note: "Half dose" },
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
if (!snapshot.petDetails.includes("weight_kg: 9.2") || !snapshot.timelineItems.some((item) => item.includes("reaction_note: Half dose"))) {
  throw new Error("The generated artifact presentation must preserve every pet and timeline field shared with the clinic");
}

const reportsScreen = readFileSync(`${process.cwd()}/apps/mobile/src/contexts/report/ui/ReportsScreen.tsx`, "utf8");
if (!reportsScreen.includes("createReportArtifactSnapshot(report.payload)") || !reportsScreen.includes("artifactSnapshot?.timelineItems")) {
  throw new Error("After generation, the report screen must render the immutable artifact instead of a newer live summary");
}
