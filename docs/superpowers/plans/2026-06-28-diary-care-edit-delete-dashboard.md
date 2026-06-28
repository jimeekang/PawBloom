# Diary/Care Edit Delete Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users edit and delete saved Diary and Care medication records, then upgrade Today into a dashboard that summarizes completion, attention signals, care state, and quick actions.

**Architecture:** Keep data mutations inside their bounded contexts and keep screens presentation-focused. `PawBloomShell` remains the coordinator between record mutations, local preview mode, save feedback, navigation, and dashboard props. Supabase schema already permits update/delete through RLS, so this plan adds mobile mutations and UI only unless verification exposes a policy gap.

**Tech Stack:** React Native + Expo SDK 56, TypeScript strict mode, TanStack Query, Supabase, existing design-system components, existing i18n translation map.

---

## File Structure

- `apps/mobile/src/contexts/diary/application/diaryRecords.ts`
  - Add diary update/delete input types, mutation hooks, reusable occurred-at helpers, and cache update helpers.
- `apps/mobile/src/contexts/diary/application/diaryRecords.editDelete.test.ts`
  - Add focused tests for update payload encoding and cache-removal helpers.
- `apps/mobile/src/contexts/medication/application/medicationDoseRecords.ts`
  - Add full medication dose update/delete mutation hooks and reusable payload helpers.
- `apps/mobile/src/contexts/medication/application/medicationDoseRecords.editDelete.test.ts`
  - Add focused tests for dose update payload and cache-removal helpers.
- `apps/mobile/src/presentation/screens/DiaryEntryScreen.tsx`
  - Add edit mode state loading, time input, update/delete/cancel actions, and selected record handling.
- `apps/mobile/src/presentation/screens/DiaryEntryList.tsx`
  - Make rows tappable and expose `onEntryPress`.
- `apps/mobile/src/presentation/screens/DiaryEntryScreen.test.ts`
  - Expand pure-state tests for edit-mode reset behavior.
- `apps/mobile/src/presentation/screens/CareMedicationPanel.tsx`
  - Let `QuickMedicationForm` accept an editing dose, update/delete/cancel handlers, and optional initial time.
- `apps/mobile/src/presentation/screens/CareMedicationPanel.test.tsx`
  - Expand type-level and helper tests for create/edit props.
- `apps/mobile/src/presentation/screens/CareModeScreen.tsx`
  - Split row body edit from compact status action.
- `apps/mobile/src/presentation/PawBloomShell.tsx`
  - Wire database and local preview update/delete handlers, confirmation prompts, feedback, and dashboard navigation.
- `apps/mobile/src/presentation/localMedicationState.ts`
  - Add local medication update helper.
- `apps/mobile/src/presentation/liveUiState.ts`
  - Add dashboard summary/attention derivation helpers.
- `apps/mobile/src/presentation/screens/HomeScreen.tsx`
  - Render dashboard hero summary, attention strip, care summary, quick actions, and tappable timeline rows.
- `apps/mobile/src/i18n/translations.ts`
  - Add English/Korean strings for edit/delete/dashboard states.
- `docs/exec-plans/active/0003-weekly-execution-checklist.md`
  - Add and check the new edit/delete/dashboard work item as implementation completes.

## Task 1: Diary Data Mutations

**Files:**
- Modify: `apps/mobile/src/contexts/diary/application/diaryRecords.ts`
- Create: `apps/mobile/src/contexts/diary/application/diaryRecords.editDelete.test.ts`

- [x] **Step 1: Add failing pure tests for diary update and delete helpers**

Create `apps/mobile/src/contexts/diary/application/diaryRecords.editDelete.test.ts` with:

```ts
import { buildDiaryUpdatePayload, removeDiaryEntryFromList } from "./diaryRecords";

const payload = buildDiaryUpdatePayload({
  category: "food",
  summary: "ate well",
  detail: { category: "food", meals: { breakfast: { offeredGrams: "80", eatenGrams: "70" } }, appetite: "good" },
  entryDate: "2026-06-28",
  occurredTime: "08:15",
});

if (payload.entry_date !== "2026-06-28") throw new Error("update payload must keep selected date");
if (!payload.occurred_at.includes("T08:15")) throw new Error("update payload must include edited time");
if (!String(payload.summary).includes("\"version\":1")) throw new Error("update payload must encode structured detail");

const remaining = removeDiaryEntryFromList([{ id: "keep" }, { id: "remove" }], "remove");
if (remaining.length !== 1 || remaining[0]?.id !== "keep") throw new Error("delete helper must remove only the matching diary entry");
```

Run: `npm --prefix apps/mobile run typecheck`
Expected: FAIL because `buildDiaryUpdatePayload` and `removeDiaryEntryFromList` are not exported.

- [x] **Step 2: Implement diary update/delete helpers and hooks**

In `diaryRecords.ts`, add:

```ts
export type UpdateDiaryEntryInput = CreateDiaryEntryInput & {
  id: string;
  occurredTime?: string;
};

export function buildDiaryUpdatePayload(input: UpdateDiaryEntryInput) {
  const entryDate = input.entryDate ?? getLocalDateKey();
  return {
    category: input.category,
    summary: encodeDiarySummary({ category: input.category, memo: input.summary, detail: input.detail }) || defaultSummary(input.category),
    condition_score: input.category === "condition" ? input.conditionScore ?? 3 : null,
    entry_date: entryDate,
    occurred_at: buildOccurredAtForTime(entryDate, input.occurredTime),
    updated_at: new Date().toISOString(),
  };
}

export function removeDiaryEntryFromList<T extends { id: string }>(entries: T[] | undefined, id: string) {
  return (entries ?? []).filter((entry) => entry.id !== id);
}
```

Add `useUpdateDiaryEntry(petId)` and `useDeleteDiaryEntry(petId)` mutations. Both must update `diaryKeys.date`, invalidate all `["diary"]` queries, and return mapped rows for updates.

- [x] **Step 3: Run diary-focused checks**

Run: `npm --prefix apps/mobile run typecheck`
Expected: PASS.

Run: `npm run verify`
Expected: PASS or fail only on files later tasks are expected to fix. If it fails for Task 1 changes, fix before moving on.

## Task 2: Medication Data Mutations

**Files:**
- Modify: `apps/mobile/src/contexts/medication/application/medicationDoseRecords.ts`
- Create: `apps/mobile/src/contexts/medication/application/medicationDoseRecords.editDelete.test.ts`

- [x] **Step 1: Add failing pure tests for medication update and delete helpers**

Create `apps/mobile/src/contexts/medication/application/medicationDoseRecords.editDelete.test.ts` with:

```ts
import { buildMedicationDoseUpdatePayload, removeMedicationDoseFromList } from "./medicationDoseRecords";

const payload = buildMedicationDoseUpdatePayload({
  id: "dose-1",
  medicationName: "Amoxi",
  conditionName: "Cough",
  dosageLabel: "1 tablet",
  administeredAmount: "0.5 tablet",
  status: "partial",
  scheduledTime: "21:10",
  reactionNote: "sleepy",
});

if (payload.medication_name !== "Amoxi") throw new Error("update payload must keep medication name");
if (payload.status !== "partial") throw new Error("update payload must keep edited status");
if (!payload.scheduled_at.includes("T21:10")) throw new Error("update payload must include edited time");
if (!String(payload.reaction_note).includes("sleepy")) throw new Error("update payload must encode care note");

const remaining = removeMedicationDoseFromList([{ id: "keep" }, { id: "remove" }], "remove");
if (remaining.length !== 1 || remaining[0]?.id !== "keep") throw new Error("delete helper must remove only the matching dose");
```

Run: `npm --prefix apps/mobile run typecheck`
Expected: FAIL because helpers are not exported.

- [x] **Step 2: Implement medication update/delete helpers and hooks**

In `medicationDoseRecords.ts`, add:

```ts
export type UpdateMedicationDoseInput = QuickMedicationDoseInput & {
  id: string;
  scheduledTime?: string;
};

export function buildMedicationDoseUpdatePayload(input: UpdateMedicationDoseInput) {
  const status = input.status ?? "pending";
  const scheduledAt = buildScheduledAtForTime(input.scheduledTime);
  return {
    medication_name: input.medicationName.trim() || "투약",
    scheduled_at: scheduledAt,
    status,
    recorded_at: buildDoseRecordedAt(status),
    reaction_note: encodeMedicationDoseCareNote(input),
    updated_at: new Date().toISOString(),
  };
}

export function removeMedicationDoseFromList<T extends { id: string }>(doses: T[] | undefined, id: string) {
  return (doses ?? []).filter((dose) => dose.id !== id);
}
```

Add `useUpdateMedicationDose(petId)` for full content updates and `useDeleteMedicationDose(petId)`. Keep existing `useUpdateMedicationDoseStatus` for quick status changes.

- [x] **Step 3: Run medication-focused checks**

Run: `npm --prefix apps/mobile run typecheck`
Expected: PASS.

Run: `npm run verify`
Expected: PASS or fail only on later UI wiring. If it fails for Task 2 changes, fix before moving on.

## Task 3: Diary Edit/Delete UI

**Files:**
- Modify: `apps/mobile/src/presentation/screens/DiaryEntryList.tsx`
- Modify: `apps/mobile/src/presentation/screens/DiaryEntryScreen.tsx`
- Modify: `apps/mobile/src/presentation/screens/DiaryEntryScreen.test.ts`
- Modify: `apps/mobile/src/presentation/PawBloomShell.tsx`
- Modify: `apps/mobile/src/i18n/translations.ts`

- [x] **Step 1: Make diary rows selectable**

In `DiaryEntryList.tsx`, add prop `onEntryPress?: (entry: DiaryEntry) => void`. Wrap each row in `Pressable` when the prop exists and keep the same visual layout.

Run: `npm --prefix apps/mobile run typecheck`
Expected: PASS.

- [x] **Step 2: Add diary edit mode props and state**

In `DiaryEntryScreen.tsx`, add props:

```ts
onUpdate: (entry: DraftDiaryEntry & { id: string }) => void;
onDelete: (entry: DiaryEntry) => void;
```

Add `editingEntry` state. When a row is pressed, load:

- `selected` from `entry.category`
- `detail` from `entry.detail` or category default
- `memo` from the decoded editable memo when available; if not available use `entry.summary`
- `conditionScore` from `entry.conditionScore` or `3`
- `selectedDateKey` remains managed by the shell
- `occurredTime` from `entry.occurredAt`

Add cancel edit behavior that clears `editingEntry`, clears memo/photos, restores routine default detail, and closes edit mode.

- [x] **Step 3: Add update/delete/cancel controls**

When `editingEntry` exists:

- Primary button label becomes `diary.update`.
- Add secondary `diary.cancelEdit`.
- Add destructive `diary.delete`.
- Save calls `onUpdate({ id: editingEntry.id, ...draft })`.
- Delete calls `onDelete(editingEntry)`.

Keep existing create behavior unchanged when no edit record is selected.

- [x] **Step 4: Wire shell database and local preview diary update/delete**

In `PawBloomShell.tsx`:

- Import `useUpdateDiaryEntry` and `useDeleteDiaryEntry`.
- In database mode, call mutations and show `feedback.diaryUpdated...` or `feedback.diaryDeleted...`.
- In local mode, replace or remove the matching local entry.
- Use `Alert.alert` for delete confirmation.
- Recompute checklist from records through existing derived logic after local delete.

- [x] **Step 5: Run checks**

Run: `npm --prefix apps/mobile run typecheck`
Expected: PASS.

Run: `npm run verify`
Expected: PASS before moving to Care UI.

## Task 4: Care Medication Edit/Delete UI

**Files:**
- Modify: `apps/mobile/src/presentation/screens/CareMedicationPanel.tsx`
- Modify: `apps/mobile/src/presentation/screens/CareMedicationPanel.test.tsx`
- Modify: `apps/mobile/src/presentation/screens/CareModeScreen.tsx`
- Modify: `apps/mobile/src/presentation/PawBloomShell.tsx`
- Modify: `apps/mobile/src/presentation/localMedicationState.ts`
- Modify: `apps/mobile/src/i18n/translations.ts`

- [x] **Step 1: Extend medication form for edit mode**

In `CareMedicationPanel.tsx`, update `QuickMedicationForm` props:

```ts
type QuickMedicationFormProps = {
  onSave: QuickMedicationSaveHandler;
  editingDose?: DoseRecord | null;
  onUpdate?: (input: QuickMedicationDoseInput & { id: string; scheduledTime?: string }) => void | Promise<void>;
  onDelete?: (dose: DoseRecord) => void;
  onCancelEdit?: () => void;
};
```

When `editingDose` changes, load all editable fields from it and change the title/button labels to edit copy.

- [x] **Step 2: Split medication row actions**

In `MedicationRow`, add props:

```ts
onEdit: () => void;
onStatusPress: () => void;
```

The row body calls `onEdit`. The status circle calls `onStatusPress`.

- [x] **Step 3: Wire CareModeScreen edit state**

In `CareModeScreen.tsx`, keep `editingDoseId` state, pass the selected dose into `QuickMedicationForm`, and use `MedicationRow` row body for edit.

- [x] **Step 4: Wire shell database and local preview medication update/delete**

In `PawBloomShell.tsx`:

- Import `useUpdateMedicationDose` and `useDeleteMedicationDose`.
- In database mode, call full update/delete mutations.
- In local mode, update/remove the dose in local state.
- Use `Alert.alert` for delete confirmation.
- Keep quick status update behavior through `cycleDoseStatus`.

In `localMedicationState.ts`, add a helper:

```ts
export function updateLocalDoseRecord(current: DoseRecord, input: QuickMedicationDoseInput & { scheduledTime?: string }): DoseRecord {
  const status = input.status ?? current.status;
  return {
    ...current,
    medicationName: input.medicationName.trim() || current.medicationName,
    conditionName: input.conditionName?.trim() || undefined,
    dosageLabel: input.dosageLabel?.trim() || undefined,
    administeredAmount: input.administeredAmount?.trim() || undefined,
    scheduledAt: input.scheduledTime || current.scheduledAt,
    status,
    recordedAt: status === "pending" ? undefined : new Date().toISOString(),
    reactionNote: input.reactionNote?.trim() || undefined,
  };
}
```

- [x] **Step 5: Run checks**

Run: `npm --prefix apps/mobile run typecheck`
Expected: PASS.

Run: `npm run verify`
Expected: PASS before dashboard work.

## Task 5: Today Dashboard and Documentation

**Files:**
- Modify: `apps/mobile/src/presentation/liveUiState.ts`
- Modify: `apps/mobile/src/presentation/screens/HomeScreen.tsx`
- Modify: `apps/mobile/src/presentation/PawBloomShell.tsx`
- Modify: `apps/mobile/src/presentation/shell/saveFeedback.ts`
- Modify: `apps/mobile/src/presentation/shell/saveFeedback.test.ts`
- Modify: `apps/mobile/src/i18n/translations.ts`
- Modify: `docs/exec-plans/active/0003-weekly-execution-checklist.md`

- [x] **Step 1: Add dashboard derivation helpers**

In `liveUiState.ts`, add:

```ts
export type DashboardSummary = {
  completedCount: number;
  totalCount: number;
  pendingMedicationCount: number;
  attentionSignals: string[];
};
```

Implement `createDashboardSummary(checklist, entries, doses)`:

- `completedCount` counts truthy checklist values.
- `totalCount` counts checklist keys.
- `pendingMedicationCount` counts pending doses.
- `attentionSignals` includes low condition score, skipped/partial doses, no water record, and stool blood/mucus detail.

- [x] **Step 2: Render dashboard sections**

In `HomeScreen.tsx`, add props:

```ts
dashboard: DashboardSummary;
onAddDiary: () => void;
onRecordMedication: () => void;
onViewReport: () => void;
onTimelineEntryPress?: (entry: DiaryEntry) => void;
```

Render:

- Hero completion summary.
- Attention strip before checklist.
- Care summary card after checklist.
- Quick action row.
- Tappable recent timeline rows when `onTimelineEntryPress` exists.

- [x] **Step 3: Wire dashboard navigation in shell**

In `PawBloomShell.tsx`, compute dashboard with `createDashboardSummary`. Wire:

- Add diary -> Diary tab.
- Record medication -> Care tab.
- View report -> Reports tab.
- Timeline entry press -> Diary tab and date selection.

- [x] **Step 4: Extend save feedback for update/delete**

In `saveFeedback.ts`, add kinds:

- `diaryUpdated`
- `diaryDeleted`
- `medicationUpdated`
- `medicationDeleted`

Add matching English/Korean translations and tests that confirm success tone and correct title keys.

- [x] **Step 5: Update execution checklist**

In `docs/exec-plans/active/0003-weekly-execution-checklist.md`, add a Day 6A or current-day section:

```md
### Day 6A: Diary/Care record correction and Today dashboard

- [x] Diary records can be opened from the list and edited.
- [x] Diary records can be deleted with confirmation.
- [x] Care medication records can be opened and edited.
- [x] Care medication records can be deleted with confirmation.
- [x] Today dashboard shows completion, attention signals, care summary, recent timeline, and quick actions.
- [x] `npm run verify` passes.
```

- [x] **Step 6: Run final verification**

Run: `npm --prefix apps/mobile run typecheck`
Expected: PASS.

Run: `npm run verify`
Expected: PASS.

Run: `git status --short --branch`
Expected: only intended feature files plus pre-existing unrelated local files remain.

Create commit:

```bash
git add apps/mobile/src/contexts/diary/application/diaryRecords.ts \
  apps/mobile/src/contexts/diary/application/diaryRecords.editDelete.test.ts \
  apps/mobile/src/contexts/medication/application/medicationDoseRecords.ts \
  apps/mobile/src/contexts/medication/application/medicationDoseRecords.editDelete.test.ts \
  apps/mobile/src/presentation/screens/DiaryEntryList.tsx \
  apps/mobile/src/presentation/screens/DiaryEntryScreen.tsx \
  apps/mobile/src/presentation/screens/DiaryEntryScreen.test.ts \
  apps/mobile/src/presentation/screens/CareMedicationPanel.tsx \
  apps/mobile/src/presentation/screens/CareMedicationPanel.test.tsx \
  apps/mobile/src/presentation/screens/CareModeScreen.tsx \
  apps/mobile/src/presentation/PawBloomShell.tsx \
  apps/mobile/src/presentation/localMedicationState.ts \
  apps/mobile/src/presentation/liveUiState.ts \
  apps/mobile/src/presentation/screens/HomeScreen.tsx \
  apps/mobile/src/presentation/shell/saveFeedback.ts \
  apps/mobile/src/presentation/shell/saveFeedback.test.ts \
  apps/mobile/src/i18n/translations.ts \
  docs/exec-plans/active/0003-weekly-execution-checklist.md \
  docs/superpowers/plans/2026-06-28-diary-care-edit-delete-dashboard.md
git commit -m "feat: edit diary care records and dashboard"
```

Expected: commit succeeds after verification.
