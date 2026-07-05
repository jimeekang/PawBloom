# Diary Category Specific Forms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make PawBloom's Diary screen show only the selected category's own form, move photos and memo into diary-only categories, and remove the duplicate care-record input from Care.

**Architecture:** Keep the existing diary and medication data model. Add small pure helpers for category UI rules so presentation tests can verify create/edit behavior without loading React Native. Remove the CareRecordPanel from the Care screen while keeping care setup, medication, and report aggregation intact.

**Tech Stack:** Expo React Native, TypeScript strict mode, existing presentation verification script, local simulator browser for final QA.

---

## File Structure

- Modify `docs/product/PRODUCT_SPEC.md`: clarify that diary category records and care medication data are aggregated for reports.
- Modify `docs/engineering/FRONTEND.md`: define category-specific diary forms and remove the separate care-record entry rule.
- Create `apps/mobile/src/presentation/screens/DiaryEntryScreen.formRules.ts`: pure helpers for photo/memo/detail visibility and draft shaping.
- Modify `apps/mobile/src/presentation/screens/DiaryEntryScreen.test.ts`: add presentation behavior checks for form visibility and draft shaping.
- Modify `apps/mobile/src/presentation/screens/DiaryEntryScreen.tsx`: render category-specific fields only and use the helpers for save/edit.
- Modify `apps/mobile/src/presentation/screens/CareModeScreen.tsx`: remove the care-record input section and unused save prop from the Care screen.
- Modify `apps/mobile/src/presentation/PawBloomShell.tsx`: stop passing `onSaveCareEntry` to the Care screen and remove the shell care-entry bridge if unused.
- Delete `apps/mobile/src/presentation/screens/CareRecordPanel.tsx`: remove the duplicate care-record input component.
- Modify `apps/mobile/src/i18n/translations.ts`: remove user-facing care-record input copy or leave unused keys only if deleting them would create translation churn.
- Create `apps/mobile/src/presentation/ui/TimePickerField.tsx`: shared native time selection field.
- Create `apps/mobile/src/presentation/ui/TimePickerField.logic.ts`: pure time parse/format helpers.
- Create `apps/mobile/src/presentation/ui/TimePickerField.test.ts`: presentation verification for time formatting.
- Modify `scripts/verify-presentation-state.mjs`: add a static guard that Care no longer imports `CareRecordPanel`.

## Tasks

### Task 1: Document the Product Rule

**Files:**
- Modify: `docs/product/PRODUCT_SPEC.md`
- Modify: `docs/engineering/FRONTEND.md`
- Create: `docs/superpowers/plans/2026-06-30-diary-category-specific-forms.md`

- [x] **Step 1: Update product wording**

Replace wording that says Care separately records symptoms/reactions with wording that says Diary category records plus Care medication/setup data are aggregated into reports.

- [x] **Step 2: Update frontend rule**

Add the UI rule that Diary categories only show their own fields, and that photo/memo are separate diary-only categories.

- [x] **Step 3: Save this plan**

Keep the plan in `docs/superpowers/plans/2026-06-30-diary-category-specific-forms.md`.

### Task 2: Add Diary Form Rules with Tests

**Files:**
- Create: `apps/mobile/src/presentation/screens/DiaryEntryScreen.formRules.ts`
- Modify: `apps/mobile/src/presentation/screens/DiaryEntryScreen.test.ts`

- [x] **Step 1: Write failing tests**

Add checks that:
- `photo` category shows photo input and no structured detail.
- `memo` category shows memo input and no photo/detail.
- Structured categories such as `water` show detail only, not photo/memo.
- Editing follows the same rule by deriving visibility from the entry category.
- Save drafts only include `photos` for the `photo` category and only include `summary` text for `memo` or `photo`.

- [x] **Step 2: Verify red**

Run `npm run verify:presentation`.
Expected: failure because the new helper file/functions do not exist yet.

- [x] **Step 3: Implement helpers**

Create helpers:
- `getDiaryCategoryFormState(category)` returning `{ showsDetail, showsMemo, showsPhotos }`.
- `getDiaryDetailForSave(category, detail)` returning detail only for structured categories.
- `getDiarySummaryForSave(category, memo)` returning trimmed text for `memo` and `photo`, otherwise an empty string.
- `getDiaryPhotosForSave(category, photos, isEditing)` returning photos only for new `photo` entries.

- [x] **Step 4: Verify green**

Run `npm run verify:presentation`.
Expected: presentation tests pass.

### Task 3: Apply Category-Specific Diary UI

**Files:**
- Modify: `apps/mobile/src/presentation/screens/DiaryEntryScreen.tsx`
- Modify: `apps/mobile/src/contexts/diary/domain/diaryEntry.ts`
- Modify: `apps/mobile/src/contexts/routine/application/petRoutineRecords.ts`
- Modify: `apps/mobile/src/design-system/categoryVisuals.ts` if a new photo category visual is required.
- Modify: `apps/mobile/src/i18n/translations.ts`

- [x] **Step 1: Add photo category**

Extend `DiaryCategory` and diary category lists with `"photo"` while keeping walk optional by pet routine.

- [x] **Step 2: Render fields by category**

Use `getDiaryCategoryFormState(selected)` in `DiaryEntryScreen.tsx`.
Only render:
- detail panel for food/water/walk/stool/condition
- photo picker or existing photo notice for photo
- memo text input for memo

- [x] **Step 3: Save using category rules**

Use the pure helpers when building the draft so structured categories no longer carry generic memo/photos.

- [x] **Step 4: Verify**

Run `npm run verify:presentation` and `npm run typecheck`.

### Task 4: Remove Care Record Input

**Files:**
- Modify: `apps/mobile/src/presentation/screens/CareModeScreen.tsx`
- Modify: `apps/mobile/src/presentation/PawBloomShell.tsx`
- Modify: `scripts/verify-presentation-state.mjs`
- Delete: `apps/mobile/src/presentation/screens/CareRecordPanel.tsx`

- [x] **Step 1: Remove CareRecordPanel usage**

Delete the `CareRecordPanel` import and JSX from `CareModeScreen.tsx`.

- [x] **Step 2: Remove unused save bridge**

Remove `onSaveCareEntry` from Care screen props and stop passing it from `PawBloomShell.tsx`.

- [x] **Step 3: Add guard**

Make `scripts/verify-presentation-state.mjs` fail if `CareModeScreen.tsx` imports `CareRecordPanel`.

- [x] **Step 4: Verify**

Run `npm run verify:presentation` and `npm run typecheck`.

### Task 5: Final Verification, Commit, Push

### Task 5: Native Time Picker Inputs

**Files:**
- Create: `apps/mobile/src/presentation/ui/TimePickerField.tsx`
- Create: `apps/mobile/src/presentation/ui/TimePickerField.logic.ts`
- Create: `apps/mobile/src/presentation/ui/TimePickerField.test.ts`
- Modify: `apps/mobile/src/presentation/screens/DiaryEntryScreen.tsx`
- Modify: `apps/mobile/src/presentation/screens/CareSetupPanel.tsx`
- Modify: `apps/mobile/src/presentation/screens/CareMedicationPanel.tsx`
- Modify: `apps/mobile/package.json`

- [x] **Step 1: Add native picker dependency**

Install `@react-native-community/datetimepicker` with Expo SDK-compatible version.

- [x] **Step 2: Add tested time helpers**

Add parse/format helpers that preserve the existing `HH:mm` storage value.

- [x] **Step 3: Replace direct time text inputs**

Use `TimePickerField` for Diary record time, Care plan medication time, and medication edit time.

- [x] **Step 4: Verify**

Run `npm run verify:presentation`, `npm run typecheck`, and `npm run verify:i18n`.

### Task 6: Final Verification, Commit, Push

**Files:**
- All modified files above.

- [ ] **Step 1: Run full verification**

Run `npm run verify`.
Expected: all quality gates pass.

- [ ] **Step 2: Run final simulator smoke test**

Use the existing simulator browser once to confirm:
- Diary structured categories show only structured fields.
- Memo category shows only memo.
- Photo category shows only photo controls.
- Editing an entry follows the selected entry category.
- Care screen no longer shows the duplicate care-record input.

- [ ] **Step 3: Commit and push**

Commit the full working tree on the current `codex/` branch and push it to its upstream or origin branch.
