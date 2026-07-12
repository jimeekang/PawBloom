export const vetReportStateKey = (petId: string | null, userId: string | null) => ["vet-report-state", petId, userId] as const;
