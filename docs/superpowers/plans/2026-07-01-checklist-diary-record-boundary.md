# Checklist Diary Record Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate Today checklist completion records from detailed Diary category records so checklist timeline items do not open the wrong Diary edit flow or create duplicate category data.

**Architecture:** Add an explicit diary record origin while preserving the existing `diary_entries` table and timeline UI. Checklist records use `origin: "checklist"`, direct Diary records use `origin: "diary"`, and timeline tap behavior branches on that origin. Structured Diary categories use a daily upsert-style rule, while memo/photo remain appendable.

**Tech Stack:** Expo React Native, TypeScript strict mode, Supabase migrations/types, existing presentation verification script, React Query diary mutations.

**Implementation status on 2026-07-04:** Verified and implemented. The final behavior is stricter than the original duplicate helper sketch: saving a structured Diary category for a day updates any existing same-day category record, including a checklist-origin record, and promotes that saved record to `origin: "diary"`. Checklist-origin timeline taps still stay on Today and do not open Diary edit directly.

---

## File Structure

- Modify `docs/product/PRODUCT_SPEC.md`: keep the product rule that checklist is completion and Diary is detailed record.
- Modify `docs/engineering/FRONTEND.md`: keep the UI rule for timeline tap behavior and category duplicate policy.
- Modify `apps/mobile/src/contexts/diary/domain/diaryEntry.ts`: add `DiaryRecordOrigin` and `origin` to `DiaryEntry` and create/update input types.
- Modify `apps/mobile/src/contexts/diary/application/diaryRecords.ts`: map `record_origin`, set default origin, and support update/create payloads.
- Create `supabase/migrations/20260701000100_add_diary_record_origin.sql`: add `record_origin` to `diary_entries`.
- Modify `apps/mobile/generated-supabase/database.types.ts`: add the generated column type after applying the migration/type generation flow used by this repo.
- Modify `apps/mobile/src/presentation/mockUiState.ts`: default mock Diary records to `origin: "diary"` and checklist-created entries to `origin: "checklist"`.
- Modify `apps/mobile/src/presentation/shell/checklistActions.ts`: create checklist-origin records and block duplicate checklist completion using origin-aware rules.
- Modify `apps/mobile/src/presentation/PawBloomShell.tsx`: branch Home timeline taps by origin and avoid opening Diary edit for checklist-origin items.
- Modify `apps/mobile/src/presentation/screens/DiaryEntryScreen.tsx`: when saving structured categories, update or reopen the existing detailed record instead of silently creating another one.
- Modify `apps/mobile/src/presentation/screens/DiaryEntryScreen.test.ts`: add source-aware edit and structured duplicate tests.
- Modify `apps/mobile/src/presentation/shell/checklistActions.test.ts`: add origin-aware checklist tests.
- Modify `scripts/verify-presentation-state.mjs`: include any new pure presentation test files.

## Tasks

### Task 1: Lock the Domain Contract

**Files:**
- Modify: `apps/mobile/src/contexts/diary/domain/diaryEntry.ts`
- Modify: `apps/mobile/src/presentation/mockUiState.ts`
- Test: `apps/mobile/src/presentation/shell/checklistActions.test.ts`

- [ ] **Step 1: Write the failing origin contract test**

Add this check to `apps/mobile/src/presentation/shell/checklistActions.test.ts`:

```ts
import { createLocalChecklistRecord } from "./checklistActions";

const checklistResult = createLocalChecklistRecord({
  key: "food",
  entryDate: "2026-07-01",
  activePetId: "pet-1",
  entries: [],
  doses: [],
  activeDoses: [],
  checklist: emptyChecklist,
  quickMedicationName: "Medication",
});

if (checklistResult?.nextEntries?.[0]?.origin !== "checklist") {
  throw new Error("checklist-created diary timeline records must carry checklist origin");
}
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm run verify:presentation
```

Expected: FAIL because `DiaryEntry` does not expose `origin` and checklist records do not set it.

- [ ] **Step 3: Add the origin type**

In `apps/mobile/src/contexts/diary/domain/diaryEntry.ts`, add:

```ts
export type DiaryRecordOrigin = "diary" | "checklist";
```

Then add `origin: DiaryRecordOrigin` to `DiaryEntry` and optional `origin?: DiaryRecordOrigin` to `CreateDiaryEntryInput`.

- [ ] **Step 4: Default local mock records to diary origin**

In `apps/mobile/src/presentation/mockUiState.ts`, make `createMockDiaryEntry` set:

```ts
origin: draft.origin ?? "diary",
```

Add `origin?: DiaryRecordOrigin` to `DraftDiaryEntry`.

- [ ] **Step 5: Set checklist origin when creating local checklist records**

In `apps/mobile/src/presentation/shell/checklistActions.ts`, update the `createMockDiaryEntry` call:

```ts
const nextEntry = createMockDiaryEntry(activePetId, {
  category,
  summary: checklistSummary(key),
  entryDate,
  occurredAt: formatChecklistTime(),
  conditionScore: category === "condition" ? 3 : undefined,
  origin: "checklist",
});
```

- [ ] **Step 6: Verify the contract passes**

Run:

```bash
npm run verify:presentation
```

Expected: PASS for the new origin contract.

### Task 2: Persist Origin in Supabase

**Files:**
- Create: `supabase/migrations/20260701000100_add_diary_record_origin.sql`
- Modify: `apps/mobile/src/contexts/diary/application/diaryRecords.ts`
- Modify: `apps/mobile/generated-supabase/database.types.ts`
- Test: `apps/mobile/src/contexts/diary/application/diaryStructuredSummary.test.ts`

- [ ] **Step 1: Write the failing mapping test**

Add a row mapping check in `apps/mobile/src/contexts/diary/application/diaryStructuredSummary.test.ts`:

```ts
const checklistMapped = mapDiaryRow({
  id: "entry-checklist",
  pet_id: "pet-1",
  category: "food",
  occurred_at: "2026-07-01T08:00:00.000Z",
  summary: "식사 체크리스트가 기록되었습니다.",
  condition_score: null,
  entry_date: "2026-07-01",
  created_by: "user-1",
  client_mutation_id: null,
  created_at: "2026-07-01T08:00:00.000Z",
  updated_at: "2026-07-01T08:00:00.000Z",
  record_origin: "checklist",
  media_assets: [],
});

if (checklistMapped.origin !== "checklist") {
  throw new Error("diary row mapping must preserve checklist origin");
}
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm run verify:presentation
```

Expected: FAIL until the row mapper and types include `record_origin`.

- [ ] **Step 3: Add the migration**

Create `supabase/migrations/20260701000100_add_diary_record_origin.sql`:

```sql
alter table public.diary_entries
  add column if not exists record_origin text not null default 'diary';

alter table public.diary_entries
  add constraint diary_entries_record_origin_check
  check (record_origin in ('diary', 'checklist'));
```

- [ ] **Step 4: Update the Supabase type**

Update `apps/mobile/generated-supabase/database.types.ts` so `diary_entries.Row`, `Insert`, and `Update` include:

```ts
record_origin: "diary" | "checklist";
```

For `Insert` and `Update`, make it optional if the surrounding generated type pattern uses optional insert/update fields.

- [ ] **Step 5: Map and write origin**

In `apps/mobile/src/contexts/diary/application/diaryRecords.ts`:

```ts
const diaryEntrySelect = "id,pet_id,category,occurred_at,summary,condition_score,entry_date,created_by,client_mutation_id,created_at,updated_at,record_origin,media_assets(id)";
```

Set mapped entry origin:

```ts
origin: row.record_origin ?? "diary",
```

Set create payload origin:

```ts
record_origin: input.origin ?? "diary",
```

- [ ] **Step 6: Verify persistence changes**

Run:

```bash
npm run typecheck
npm run verify:supabase
npm run verify:presentation
```

Expected: all three commands pass.

### Task 3: Make Checklist Duplicate Rules Origin-Aware

**Files:**
- Modify: `apps/mobile/src/presentation/shell/checklistActions.ts`
- Modify: `apps/mobile/src/presentation/shell/checklistActions.test.ts`
- Modify: `apps/mobile/src/presentation/liveUiState.ts`
- Modify: `apps/mobile/src/presentation/liveUiState.dashboard.test.ts`

- [ ] **Step 1: Add failing duplicate policy tests**

Add tests that prove:

```ts
const todayDetailedFood = {
  id: "entry-food-detail",
  petId: "pet-1",
  category: "food",
  origin: "diary" as const,
  entryDate: "2026-07-01",
  occurredAt: "08:00",
  summary: "아침 80g/100g",
};

if (!isChecklistRecordBlocked({ key: "food", checklist: emptyChecklist, entries: [todayDetailedFood], entryDate: "2026-07-01", pendingKeys: [] })) {
  throw new Error("checklist must not create a quick completion when a detailed diary record already completes that category");
}
```

Also add a checklist-origin entry test:

```ts
const todayChecklistFood = { ...todayDetailedFood, id: "entry-food-checklist", origin: "checklist" as const };

if (!isChecklistRecordBlocked({ key: "food", checklist: emptyChecklist, entries: [todayChecklistFood], entryDate: "2026-07-01", pendingKeys: [] })) {
  throw new Error("checklist must block duplicate checklist completion for the same category and day");
}
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm run verify:presentation
```

Expected: FAIL until all test fixtures include origin and completion logic is consistent.

- [ ] **Step 3: Keep completion calculation category-based**

In `apps/mobile/src/presentation/liveUiState.ts`, keep checklist completion true when today has any matching structured category record, regardless of `origin`.

This keeps the UX simple: a detailed Diary food record also satisfies the Today food checklist.

- [ ] **Step 4: Keep creation blocking category-based**

In `apps/mobile/src/presentation/shell/checklistActions.ts`, keep `isChecklistRecordBlocked` blocking when any same-day matching category entry exists. The difference is not in completion calculation; the difference is in edit routing.

- [ ] **Step 5: Verify duplicate policy**

Run:

```bash
npm run verify:presentation
```

Expected: PASS.

### Task 4: Route Timeline Taps by Origin

**Files:**
- Modify: `apps/mobile/src/presentation/PawBloomShell.tsx`
- Modify: `apps/mobile/src/presentation/screens/DiaryEntryScreen.test.ts`
- Create: `apps/mobile/src/presentation/shell/timelineRouting.ts`
- Create: `apps/mobile/src/presentation/shell/timelineRouting.test.ts`
- Modify: `scripts/verify-presentation-state.mjs`

- [ ] **Step 1: Add a failing pure routing test**

Create `apps/mobile/src/presentation/shell/timelineRouting.test.ts`:

```ts
import { getTimelineEntryRoute } from "./timelineRouting";

const baseEntry = {
  id: "entry-1",
  petId: "pet-1",
  category: "food" as const,
  entryDate: "2026-07-01",
  occurredAt: "08:00",
  summary: "record",
};

if (getTimelineEntryRoute({ ...baseEntry, origin: "diary" }) !== "diaryEdit") {
  throw new Error("diary-origin timeline entries must open diary edit");
}

if (getTimelineEntryRoute({ ...baseEntry, origin: "checklist" }) !== "checklistNotice") {
  throw new Error("checklist-origin timeline entries must not open diary edit");
}
```

Add this test file to `scripts/verify-presentation-state.mjs`.

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm run verify:presentation
```

Expected: FAIL because `timelineRouting.ts` does not exist.

- [ ] **Step 3: Implement routing helper**

Create `apps/mobile/src/presentation/shell/timelineRouting.ts`:

```ts
import type { DiaryEntry } from "../../contexts/diary/domain/diaryEntry";

export type TimelineEntryRoute = "diaryEdit" | "checklistNotice";

export function getTimelineEntryRoute(entry: DiaryEntry): TimelineEntryRoute {
  return entry.origin === "checklist" ? "checklistNotice" : "diaryEdit";
}
```

- [ ] **Step 4: Use routing in the shell**

In `apps/mobile/src/presentation/PawBloomShell.tsx`, replace the Home timeline press handler with:

```ts
onTimelineEntryPress={(entry) => {
  if (getTimelineEntryRoute(entry) === "checklistNotice") {
    setNotice(t("ko", "today.checklistTimelineReadOnly"));
    return;
  }

  setTimelineEditEntry(entry);
  setSelectedDiaryDate(entry.entryDate);
  setDiaryFilter("day");
  setActiveTab("diary");
}}
```

Add `today.checklistTimelineReadOnly` to `apps/mobile/src/i18n/translations.ts`:

```ts
"today.checklistTimelineReadOnly": "체크리스트 완료 기록은 메인에서 관리돼요. 자세한 내용은 다이어리에서 새로 기록하세요.",
```

- [ ] **Step 5: Verify routing**

Run:

```bash
npm run verify:presentation
npm run verify:i18n
```

Expected: both pass.

### Task 5: Prevent Structured Diary Duplicate Creates

**Files:**
- Modify: `apps/mobile/src/presentation/screens/DiaryEntryScreen.tsx`
- Modify: `apps/mobile/src/presentation/screens/DiaryEntryScreen.logic.ts`
- Modify: `apps/mobile/src/presentation/screens/DiaryEntryScreen.test.ts`
- Modify: `apps/mobile/src/presentation/PawBloomShell.tsx`
- Modify: `apps/mobile/src/contexts/diary/application/diaryRecords.ts`

- [ ] **Step 1: Add failing helper tests**

Add to `apps/mobile/src/presentation/screens/DiaryEntryScreen.test.ts`:

```ts
import { findEditableDailyStructuredEntry, isStructuredDailyDiaryCategory } from "./DiaryEntryScreen.logic";

const existingFood = {
  id: "entry-food",
  petId: "pet-1",
  category: "food" as const,
  origin: "diary" as const,
  entryDate: "2026-07-01",
  occurredAt: "08:00",
  summary: "아침 80g/100g",
};

if (!isStructuredDailyDiaryCategory("food")) {
  throw new Error("food must be treated as one detailed daily diary category");
}

if (isStructuredDailyDiaryCategory("memo")) {
  throw new Error("memo must remain appendable");
}

if (findEditableDailyStructuredEntry([existingFood], "food", "2026-07-01")?.id !== "entry-food") {
  throw new Error("saving the same structured diary category should find the existing daily record");
}
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npm run verify:presentation
```

Expected: FAIL because the helpers do not exist.

- [ ] **Step 3: Add helper implementation**

In `apps/mobile/src/presentation/screens/DiaryEntryScreen.logic.ts`:

```ts
import type { DiaryCategory, DiaryEntry } from "../../contexts/diary/domain/diaryEntry";

const structuredDailyCategories = new Set<DiaryCategory>(["food", "water", "walk", "stool", "condition"]);

export function isStructuredDailyDiaryCategory(category: DiaryCategory) {
  return structuredDailyCategories.has(category);
}

export function findEditableDailyStructuredEntry(entries: DiaryEntry[], category: DiaryCategory, dateKey: string) {
  if (!isStructuredDailyDiaryCategory(category)) return undefined;
  return entries.find((entry) => entry.origin !== "checklist" && entry.category === category && entry.entryDate === dateKey);
}
```

- [ ] **Step 4: Use helper before create**

In `apps/mobile/src/presentation/screens/DiaryEntryScreen.tsx`, before calling `onSave(draft)`, check whether a structured same-day `diary` origin entry already exists. If it exists, load it into edit mode or call `onUpdate` with that id instead of creating a new entry.

Use this behavior:

```ts
const existingDailyEntry = findEditableDailyStructuredEntry(entries, selected, selectedDateKey);
if (!editingEntry && existingDailyEntry) {
  await onUpdate({ id: existingDailyEntry.id, ...draft, occurredTime: saveTime });
  setEditingEntry(null);
  setNotice(t("ko", "diary.updatedForDate"));
  return;
}
```

- [ ] **Step 5: Verify local and remote update paths**

Run:

```bash
npm run verify:presentation
npm run typecheck
```

Expected: both pass.

### Task 6: Final Verification

**Files:**
- All files above.

- [ ] **Step 1: Run focused checks**

Run:

```bash
npm run verify:presentation
npm run verify:i18n
npm run verify:supabase
```

Expected: all pass.

- [ ] **Step 2: Run full verification**

Run:

```bash
npm run verify
```

Expected: all quality gates pass.

- [ ] **Step 3: Final simulator check**

Use one final simulator pass only. Confirm:

- Tapping a direct Diary timeline record opens the matching Diary edit form.
- Tapping a checklist-created timeline record does not open Diary edit.
- Saving a structured Diary category twice for the same day updates the existing detailed record instead of adding another.
- Memo/photo still allow multiple records.
- Medication checklist still updates Care medication state rather than Diary.

## Self-Review

- The plan covers the design requirements: source distinction, duplicate rules, timeline routing, persistence, and tests.
- There are no placeholders.
- Type names are consistent: database `record_origin`, app `DiaryRecordOrigin`, entry field `origin`.
- The scope intentionally avoids a new checklist table; that can be a later architecture change if checklist data grows.
