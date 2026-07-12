import { isRetriableOfflineError, offlineErrorMessage } from "./offlineErrorPolicy";

// Regression: ISSUE-OFFLINE-004 — authorization and validation errors were queued forever.
// Found by /qa on 2026-07-12.
// Report: .gstack/qa-reports/qa-report-localhost-2026-07-12.md
if (!isRetriableOfflineError(new TypeError("Network request failed"))) throw new Error("network failures must be eligible for offline replay");
if (!isRetriableOfflineError({ message: "Failed to fetch" })) throw new Error("browser fetch failures must be eligible for offline replay");
if (isRetriableOfflineError({ code: "42501", message: "permission denied for table medication_doses" })) throw new Error("RLS errors must not enter the outbox");
if (isRetriableOfflineError({ code: "23505", message: "duplicate key value violates unique constraint" })) throw new Error("constraint errors must not enter the outbox");
if (isRetriableOfflineError({ code: "PGRST116", message: "The result contains 0 rows" })) throw new Error("PostgREST contract errors must not enter the outbox");
if (offlineErrorMessage({ message: "kept" }) !== "kept") throw new Error("offline error messages must preserve the actionable backend message");
