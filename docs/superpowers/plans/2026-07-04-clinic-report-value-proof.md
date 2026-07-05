# Clinic Report Value Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make PawBloom's first monetizable value clear before paid features exist: caregiver records become a clinic-ready, safe, record-based vet briefing.

**Architecture:** Keep this slice inside mobile presentation and deterministic report summary code. Do not add payment, PDF, share-token, AI prompt, or backend schema work. Report intelligence remains deterministic in `reportDraftRecords.ts`; screens render the value using existing records and translations.

**Tech Stack:** Expo React Native, TypeScript strict mode, existing design-system tokens/components, local presentation verification scripts, existing i18n parity checks.

---

## File Structure

- `apps/mobile/src/contexts/report/application/reportDraftRecords.ts`
  - Extend the draft summary with timeline highlights, missing records, vet questions, English preview, medication adherence, and score-movement trend language.
- `apps/mobile/src/contexts/report/application/reportDraftRecords.test.ts`
  - Add deterministic report proof tests.
- `apps/mobile/src/presentation/screens/ReportsScreen.tsx`
  - Make Reports artifact-first and compact, with full disclaimer and clearly labeled mock share state.
- `apps/mobile/src/presentation/screens/CareModeScreen.tsx`
  - Add report readiness above setup and move today's medication ahead of long forms.
- `apps/mobile/src/presentation/screens/CareMedicationPanel.tsx`
  - Stack quick medication dose fields on narrow mobile.
- `apps/mobile/src/presentation/screens/CareSetupPanel.tsx`
  - Stack medication name and time defaults on narrow mobile.
- `apps/mobile/src/presentation/screens/DiaryDetailPanel.tsx`
  - Stack food meal inputs to remove 390px clipping.
- `apps/mobile/src/presentation/screens/AuthScreen.tsx`
  - Add pre-signup value preview focused on vet report, family care log, and safe summary.
- `apps/mobile/src/presentation/screens/HomeScreen.tsx`
  - Strengthen Today hero readability while preserving the pet-first screen.
- `apps/mobile/src/presentation/components/SummaryCard.tsx`
  - Keep care summaries observational and show the full required disclaimer.
- `apps/mobile/src/i18n/translations.ts`
  - Add all user-facing copy in English and Korean.
- `apps/mobile/src/presentation/sampleData.ts`
  - Align sample disclaimer copy with the required AI safety disclaimer.
- `scripts/verify-presentation-state.mjs`
  - Add static guards for the known mobile overflow regressions while preserving existing checklist notice checks.

## Tasks

### Task 1: Deterministic Report Summary

**Files:**
- Modify: `apps/mobile/src/contexts/report/application/reportDraftRecords.ts`
- Modify: `apps/mobile/src/contexts/report/application/reportDraftRecords.test.ts`

- [x] Add summary fields for medication completed/pending counts, missing record prompts, timeline highlights, vet questions, English preview, and condition score movement.
- [x] Keep all generated wording observational and record-based.
- [x] Map condition movement to score wording, not medical improvement wording.
- [x] Add tests for highlights, missing records, questions, adherence counts, English preview, and empty-record behavior.

### Task 2: Reports as a Clinic Artifact

**Files:**
- Modify: `apps/mobile/src/presentation/screens/ReportsScreen.tsx`
- Modify: `apps/mobile/src/i18n/translations.ts`
- Modify: `apps/mobile/src/presentation/sampleData.ts`

- [x] Lead with a concrete draft artifact: title, date range, full disclaimer, English preview, highlights, missing records, and vet questions.
- [x] Keep metrics compact and make adherence counts readable.
- [x] Update confirmed/shared states so they feel concrete but are clearly labeled as mock or preview until real share tokens exist.
- [x] Replace trend labels like "Improving/Declining" with score movement copy.
- [x] Align sample data disclaimer with the exact required Korean disclaimer.

### Task 3: Care Screen Report Readiness

**Files:**
- Modify: `apps/mobile/src/presentation/screens/CareModeScreen.tsx`
- Modify: `apps/mobile/src/presentation/screens/CareMedicationPanel.tsx`
- Modify: `apps/mobile/src/presentation/screens/CareSetupPanel.tsx`
- Modify: `apps/mobile/src/presentation/components/SummaryCard.tsx`
- Modify: `apps/mobile/src/i18n/translations.ts`

- [x] Add a vet report readiness card above setup, based only on existing care plan, medication records, and condition score.
- [x] Reorder Care so today's medication and quick record come before the long care defaults form.
- [x] Stack dose/default/given fields so they do not clip at 390px.
- [x] Stack care setup medication name/time defaults so they do not clip at 390px.
- [x] Keep care summary copy observational and show the full required disclaimer.

### Task 4: Auth, Today, and Diary UX Fixes

**Files:**
- Modify: `apps/mobile/src/presentation/screens/AuthScreen.tsx`
- Modify: `apps/mobile/src/presentation/screens/HomeScreen.tsx`
- Modify: `apps/mobile/src/presentation/screens/DiaryDetailPanel.tsx`
- Modify: `apps/mobile/src/i18n/translations.ts`

- [x] Add value preview before signup/login form: 7-day vet report preview, family care log, safe record-based summary.
- [x] Move infrastructure trust copy below the primary value copy.
- [x] Strengthen the Today hero text contrast on the pet image.
- [x] Stack Diary food meal fields vertically on narrow mobile.

### Task 5: Verification Guards and Full Check

**Files:**
- Modify: `scripts/verify-presentation-state.mjs`

- [x] Add static guards that fail if Diary/Care form layouts return to row-based clipping patterns.
- [x] Preserve the existing checklist notice verification entry in the script.
- [x] Run:

```bash
npm run verify:presentation
npm run verify:i18n
npm run verify:ai-safety
npm run typecheck
npm run verify
```

## Acceptance Criteria

- Auth explains the paid-value direction before asking for credentials.
- Today hero text is readable on a 390px viewport.
- Diary food fields do not horizontally clip on 390px.
- Care quick medication and setup fields do not horizontally clip on 390px.
- Care first viewport prioritizes report readiness and today's medication over setup.
- Reports first viewport shows the clinic artifact, full disclaimer, English preview, and primary action.
- Reports include highlights, missing records, vet questions, adherence counts, and clear mock share copy.
- Report and care copy do not diagnose, prescribe, or imply a vet is unnecessary.
- Required verification commands pass before handoff.
