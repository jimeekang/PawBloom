# Week 1 Care And Reports Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish today's Week 1 MVP stabilization by making Care quick dose behavior clear, binding Reports to real recent records, verifying Supabase state, running the iOS app, and committing only the intentional changes.

**Architecture:** Mobile changes stay inside existing Expo/React Native presentation and bounded context application modules. Reports uses existing diary and medication read models for a record-based draft only; it does not call AI functions or require a new database schema. Care quick dose continues using `medication_doses` and structured `reaction_note` metadata.

**Tech Stack:** Expo SDK 56, React Native, TypeScript, TanStack Query, Supabase Auth/Postgres, existing PawBloom design system and i18n.

---

## Task 1: Freeze Today's Scope And Existing Dirty Work

**Files:**
- Modify: `docs/exec-plans/active/0003-weekly-execution-checklist.md`
- Keep intentional app changes already in progress:
  - `apps/mobile/src/presentation/shell/SaveFeedbackBar.tsx`
  - `apps/mobile/src/presentation/shell/saveFeedback.ts`
  - `apps/mobile/src/presentation/shell/saveFeedback.test.ts`
  - `apps/mobile/src/presentation/PawBloomShell.tsx`
  - `apps/mobile/src/presentation/screens/DiaryEntryScreen.tsx`
  - `apps/mobile/src/presentation/screens/DiaryEntryScreen.test.ts`
  - `apps/mobile/src/contexts/routine/application/petRoutineRecords.ts`
  - `apps/mobile/src/contexts/routine/application/petRoutineDefaults.test.ts`
  - `apps/mobile/src/presentation/screens/RoutineSettingsPanel.tsx`
  - `apps/mobile/src/i18n/translations.ts`

- [ ] **Step 1: Confirm working tree**

Run: `git status --short --branch`

Expected: branch is `codex/routine-diary-care-defaults`; unrelated local files such as `.codex/`, `.mcp.json`, `.env.example`, and `package.json` are not staged automatically.

- [ ] **Step 2: Confirm existing dirty feature behavior**

Run: `npm --prefix apps/mobile run typecheck`

Expected: TypeScript passes with save feedback, lunch defaults, and diary detail hide changes still intact.

- [ ] **Step 3: Update checklist status**

Mark Day 4A `npm run verify` complete only after the final full verify passes. Add a short known-issues note if iOS simulator smoke finds anything that is not fixed today.

## Task 2: Care Quick Dose Stabilization

**Files:**
- Modify: `apps/mobile/src/presentation/screens/CareMedicationPanel.tsx`
- Modify: `apps/mobile/src/presentation/screens/CareModeScreen.tsx`
- Modify: `apps/mobile/src/presentation/PawBloomShell.tsx`
- Modify: `apps/mobile/src/contexts/medication/application/medicationDoseRecords.ts`
- Modify: `apps/mobile/src/i18n/translations.ts`

- [ ] **Step 1: Preserve recorded time behavior**

Confirm `useCreateMedicationDose` stores `recorded_at: null` for `pending` and current time for `completed`, `partial`, and `skipped`. Confirm `useUpdateMedicationDoseStatus` clears `recorded_at` when changed back to `pending` and sets it otherwise.

- [ ] **Step 2: Improve quick dose UI copy**

Update status helper text and row labels so the user can understand the cycle order:
`대기 -> 정량 -> 일부 -> 건너뜀 -> 대기`.

- [ ] **Step 3: Reset quick dose form after save**

After successful quick dose save, clear condition, medication, dosage, administered amount, reaction note, and reset status to `completed`.

- [ ] **Step 4: Verify Today checklist behavior**

In local and Supabase modes, medication checklist should become complete when a quick dose is saved as `completed`, `partial`, or `skipped`, or when an existing pending dose is updated away from `pending`.

- [ ] **Step 5: Run focused checks**

Run:
`npm --prefix apps/mobile run typecheck`
`npm run verify:i18n`

Expected: both pass.

## Task 3: Reports Real-Data Skeleton

**Files:**
- Create: `apps/mobile/src/contexts/report/application/reportDraftRecords.ts`
- Modify: `apps/mobile/src/contexts/diary/application/diaryRecords.ts`
- Modify: `apps/mobile/src/contexts/medication/application/medicationDoseRecords.ts`
- Modify: `apps/mobile/src/presentation/screens/ReportsScreen.tsx`
- Modify: `apps/mobile/src/presentation/PawBloomShell.tsx`
- Modify: `apps/mobile/src/i18n/translations.ts`

- [ ] **Step 1: Add range helper for last seven days**

Create a report draft application helper that returns the inclusive last-7-day date range ending today using existing local date keys.

- [ ] **Step 2: Query diary range**

Use existing `useDiaryEntriesByDateRange(petId, fromDateKey, toDateKey)` for Supabase mode. Use local mock entries filtered by `petId` and date range for preview mode.

- [ ] **Step 3: Query medication range**

Add a medication dose date-range hook that filters `scheduled_at` between the start and end of the report range. Reuse `mapDoseRow`.

- [ ] **Step 4: Build report draft summary**

Create a small pure helper that derives:
- total diary record count
- latest condition score and previous condition score
- condition trend label
- medication dose count
- missed count from `skipped` and `partial`
- empty state when both diary and medication counts are zero

- [ ] **Step 5: Render record-based draft**

Replace mock summary copy in Reports with metrics and a concise record-based summary. Keep the AI disclaimer and staged buttons, but do not invoke AI or backend functions.

- [ ] **Step 6: Run focused checks**

Run:
`npm --prefix apps/mobile run typecheck`
`npm run verify:architecture`
`npm run verify:i18n`

Expected: all pass.

## Task 4: Supabase And Full Verification

**Files:**
- Modify only if verification fails: `supabase/migrations/**`
- Modify only if verification fails: `scripts/verify-supabase.mjs`
- Modify only if verification fails: `scripts/verify-secrets.mjs`

- [ ] **Step 1: Confirm no migration is required**

Reports skeleton reads existing `diary_entries` and `medication_doses`. Care quick dose writes existing `medication_doses` columns. Do not add schema unless verification proves a missing column.

- [ ] **Step 2: Run full gate**

Run: `npm run verify`

Expected: typecheck, architecture, i18n, AI safety, secrets, Supabase, and offline checks all pass.

## Task 5: iOS Simulator Smoke

**Files:**
- Modify only if smoke finds a bug: `apps/mobile/src/**`

- [ ] **Step 1: Start iOS app**

Run: `npm run mobile:ios`

Expected: Expo starts and opens an iOS simulator.

- [ ] **Step 2: Mirror simulator**

Use `serve-sim` with the active simulator UDID and open the printed localhost URL in the in-app browser.

- [ ] **Step 3: Smoke the user flow**

Verify:
- login/session lands in the main app
- pet profile routine includes lunch
- routine save shows prominent feedback
- diary save hides the detail panel
- care quick dose can be saved and status-cycled
- Reports shows real record counts or a clear empty state

- [ ] **Step 4: Re-run full gate after any smoke fix**

Run: `npm run verify`

Expected: pass.

## Task 6: Commit Intentional Changes

**Files:**
- Stage only intentional app, docs, tests, and migration/script changes from today's scope.
- Do not stage `.codex/` or `.mcp.json`.
- Do not stage unrelated `.env.example` or `package.json` changes unless explicitly confirmed as part of this task.

- [ ] **Step 1: Review diff**

Run:
`git status --short`
`git diff --stat`

Expected: only intentional feature files are staged.

- [ ] **Step 2: Commit**

Run:
`git commit -m "feat: stabilize care records and reports draft"`

Expected: commit succeeds on `codex/routine-diary-care-defaults`.

- [ ] **Step 3: Report final state**

Run: `git status --short --branch`

Expected: committed files are clean; any remaining dirty files are explicitly named as unrelated/local.
