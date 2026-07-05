# Care Profile Defaults Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move long-running care setup into the pet profile and make the Care tab a simple daily medication check surface with period-aware, recurrence-aware, reminder-backed, duplicate-safe scheduled dose recording.

**Architecture:** Keep clinical data ownership in the existing `care` and `medication` contexts while letting the profile screen compose their use cases. Build today's Care UI from a merged agenda of saved medication schedules that apply to the selected date and today's medication doses, then create or update a single dose only when the caregiver records an outcome. Expo local notifications are scheduled from the same recurrence rules so reminders and Care rows stay consistent. Diary remains the source of condition score.

**Tech Stack:** Expo React Native, TypeScript strict mode, TanStack Query, Supabase Postgres/RLS, existing design-system components, existing i18n verification scripts.

---

## File Structure

- `docs/product/PRODUCT_SPEC.md`
  - Product direction: profile stores care defaults, Care executes today's medication check.
- `docs/engineering/FRONTEND.md`
  - UI rule: Care is execution-first; profile owns setup placement; Diary owns condition input.
- `ARCHITECTURE.md`
  - Context ownership: profile screen composes care/medication use cases without moving care data into `pet`.
- `docs/engineering/DATABASE.md`
  - Duplicate prevention rule for schedule-based daily doses.
- `apps/mobile/src/contexts/care/domain/carePlan.ts`
  - Add multi-condition and multi-schedule model fields.
- `apps/mobile/src/contexts/care/application/carePlanRecords.ts`
  - Map active conditions, plans, medications, and schedules into profile-friendly defaults.
- `apps/mobile/src/contexts/care/application/carePlanRecords.test.ts`
  - Lock multi-condition, multi-medication, and schedule mapping behavior.
- `supabase/migrations/20260704000100_medication_dose_schedule_date_guard.sql`
  - Add `medication_schedules.recurrence_interval_days`, `medication_doses.dose_date`, and a unique guard for one scheduled dose per schedule/date.
- `apps/mobile/generated-supabase/database.types.ts`
  - Reflect the migration fields.
- `apps/mobile/src/contexts/medication/domain/medication.ts`
  - Add schedule/date fields to daily dose records.
- `apps/mobile/src/contexts/medication/application/medicationDoseRecords.ts`
  - Add duplicate-safe scheduled dose create/update helpers.
- `apps/mobile/src/contexts/medication/application/medicationDoseRecords.scheduleGuard.test.ts`
  - Lock payload and merge behavior.
- `apps/mobile/src/contexts/medication/application/medicationScheduleRules.ts`
  - Decide whether a schedule applies to a local date from start date, end date, and repeat interval.
- `apps/mobile/src/contexts/medication/application/medicationScheduleRules.test.ts`
  - Lock every-day, every-2-days, before-start, and after-end behavior.
- `apps/mobile/src/presentation/notifications/medicationReminderNotifications.ts`
  - Schedule and cancel Expo local medication reminders from active schedule rules.
- `apps/mobile/src/presentation/notifications/medicationReminderNotifications.test.ts`
  - Lock reminder request generation without invoking native APIs.
- `apps/mobile/src/presentation/screens/todayMedicationAgenda.ts`
  - Create virtual agenda rows from schedules that apply to the selected date plus saved doses.
- `apps/mobile/src/presentation/screens/todayMedicationAgenda.test.ts`
  - Test schedule-only rows, dose-backed rows, and duplicate merge priority.
- `apps/mobile/src/presentation/screens/ProfileCareDefaultsPanel.tsx`
  - Profile UI for illness/condition and medication defaults.
- `apps/mobile/src/presentation/screens/ProfileCareDefaultsPanel.test.tsx`
  - Type-level props and state-helper coverage for the panel.
- `apps/mobile/src/presentation/screens/PetOnboardingScreen.tsx`
  - Render care defaults in the profile screen.
- `apps/mobile/src/presentation/screens/CareModeScreen.tsx`
  - Simplify Care into today medication check, temporary medication, small condition reference, and report CTA.
- `apps/mobile/src/presentation/screens/CareMedicationPanel.tsx`
  - Replace cyclic status UI with direct "먹였어요" and "못 먹였어요" actions; collapse temporary add form.
- `apps/mobile/src/presentation/screens/careMedicationPanelState.ts`
  - Add simple temporary-medication and status-action state helpers.
- `apps/mobile/src/presentation/PawBloomShell.tsx`
  - Wire profile care defaults, today's agenda, and duplicate-safe status saves.
- `apps/mobile/src/presentation/shell/useShellCareDefaults.ts`
  - Split or clarify routine defaults vs care profile defaults.
- `apps/mobile/src/presentation/liveUiState.ts`
  - Count pending medication from agenda rows rather than persisted doses only.
- `apps/mobile/src/presentation/screens/HomeScreen.tsx`
  - Pass schedule-aware medication summary data if needed.
- `apps/mobile/src/presentation/screens/HomeDashboardPanel.logic.ts`
  - Keep home care summary compatible with scheduled agenda rows.
- `apps/mobile/src/i18n/translations.ts`
  - Add caregiver-facing Korean/English copy.
- `scripts/verify-presentation-state.mjs`
  - Add static guards that Care setup does not return to the primary Care flow.

## Implementation Tasks

### Task 1: Lock Care Defaults Domain Shape

**Files:**
- Modify: `apps/mobile/src/contexts/care/domain/carePlan.ts`
- Modify: `apps/mobile/src/contexts/care/application/carePlanRecords.ts`
- Modify: `apps/mobile/src/contexts/care/application/carePlanRecords.test.ts`

- [ ] **Step 1: Write the failing multi-default mapping test**

Append this coverage to `apps/mobile/src/contexts/care/application/carePlanRecords.test.ts`:

```ts
const secondCondition = {
  ...condition,
  id: "condition-2",
  name: "피부염",
  created_at: "2026-07-01T00:00:00.000Z",
  updated_at: "2026-07-01T00:00:00.000Z",
};

const secondMedication = {
  ...medication,
  id: "medication-2",
  condition_id: "condition-2",
  name: "연고",
  dosage_label: "얇게 1회",
};

const secondSchedule = {
  ...medicationSchedule,
  id: "schedule-2",
  medication_id: "medication-2",
  local_time: "20:30:00",
  starts_on: "2026-07-04",
  ends_on: "2026-07-12",
  recurrence_interval_days: 2,
};

const multiSetup = mapCareSetupForTest(
  [secondCondition, condition],
  [plan],
  [medication, secondMedication],
  [medicationSchedule, secondSchedule],
);

if (multiSetup.conditions.length !== 2) throw new Error("care setup must expose all active conditions");
if (multiSetup.conditions[0]?.name !== "피부염") throw new Error("care setup must keep newest condition first");
if (multiSetup.schedules.length !== 2) throw new Error("care setup must expose all medication schedules");
if (multiSetup.schedules[1]?.conditionId !== "condition-2") throw new Error("schedule must expose linked condition id");
if (multiSetup.schedules[1]?.conditionName !== "피부염") throw new Error("schedule must expose linked condition name");
if (multiSetup.schedules[1]?.startsOn !== "2026-07-04") throw new Error("schedule must expose treatment start date");
if (multiSetup.schedules[1]?.endsOn !== "2026-07-12") throw new Error("schedule must expose treatment end date");
if (multiSetup.schedules[1]?.recurrenceIntervalDays !== 2) throw new Error("schedule must expose recurrence interval");
```

- [ ] **Step 2: Run the focused typecheck and confirm it fails**

Run:

```bash
npm run typecheck
```

Expected: FAIL because `ActiveCareSetup.conditions`, `CareMedicationSchedule.conditionId`, and recurrence fields do not exist.

- [ ] **Step 3: Add the domain fields**

Update `apps/mobile/src/contexts/care/domain/carePlan.ts`:

```ts
export type ActiveCareSetup = {
  conditions: ActiveCareCondition[];
  condition?: ActiveCareCondition;
  plan?: ActiveCarePlanSummary;
  conditionName?: string;
  planTitle?: string;
  instructions?: string;
  schedules: CareMedicationSchedule[];
};

export type CareMedicationSchedule = {
  id: UUID;
  medicationId: UUID;
  medicationName: string;
  dosageLabel: string;
  conditionId?: UUID;
  conditionName?: string;
  localTime: string;
  startsOn: string;
  endsOn?: string;
  recurrenceIntervalDays: number;
};
```

- [ ] **Step 4: Map all active conditions and condition ids**

In `mapCareSetup`, return all conditions:

```ts
const activeConditions = conditions.map((item) => ({
  id: item.id,
  name: item.name,
  status: normalizeCareConditionStatus(item.status),
  startsOn: item.starts_on,
}));

return {
  conditions: activeConditions,
  condition: activeConditions[0],
  plan: plan ? { id: plan.id, title: plan.title, instructions: plan.instructions ?? undefined, startsOn: plan.starts_on } : undefined,
  conditionName: activeConditions[0]?.name,
  planTitle: plan?.title,
  instructions: plan?.instructions ?? undefined,
  schedules: schedules.flatMap((schedule) => {
    const medication = medicationById.get(schedule.medication_id);
    if (!medication) return [];
    const linkedCondition = medication.condition_id ? conditionById.get(medication.condition_id) : undefined;
    return [{
      id: schedule.id,
      medicationId: medication.id,
      medicationName: medication.name,
      dosageLabel: medication.dosage_label,
      conditionId: medication.condition_id ?? undefined,
      conditionName: linkedCondition?.name,
      localTime: schedule.local_time,
      startsOn: schedule.starts_on,
      endsOn: schedule.ends_on ?? undefined,
      recurrenceIntervalDays: schedule.recurrence_interval_days ?? 1,
    }];
  }),
};
```

- [ ] **Step 5: Run the test gate**

Run:

```bash
npm run typecheck
```

Expected: PASS.

### Task 2: Add Schedule Period And Recurrence Rules

**Files:**
- Create: `apps/mobile/src/contexts/medication/application/medicationScheduleRules.ts`
- Create: `apps/mobile/src/contexts/medication/application/medicationScheduleRules.test.ts`
- Modify: `apps/mobile/src/contexts/care/domain/carePlan.ts`
- Modify: `apps/mobile/src/contexts/care/application/carePlanRecords.ts`
- Modify: `scripts/verify-presentation-state.mjs`

- [ ] **Step 1: Write the failing recurrence test**

Create `apps/mobile/src/contexts/medication/application/medicationScheduleRules.test.ts`:

```ts
import { daysBetweenLocalDates, scheduleAppliesOnDate } from "./medicationScheduleRules";

if (daysBetweenLocalDates("2026-07-04", "2026-07-06") !== 2) {
  throw new Error("local date day difference must count calendar days");
}

const everyTwoDays = {
  startsOn: "2026-07-04",
  endsOn: "2026-07-10",
  recurrenceIntervalDays: 2,
};

if (!scheduleAppliesOnDate(everyTwoDays, "2026-07-04")) throw new Error("schedule must apply on the start date");
if (scheduleAppliesOnDate(everyTwoDays, "2026-07-05")) throw new Error("every-2-days schedule must skip the next day");
if (!scheduleAppliesOnDate(everyTwoDays, "2026-07-06")) throw new Error("every-2-days schedule must apply two days after start");
if (scheduleAppliesOnDate(everyTwoDays, "2026-07-11")) throw new Error("schedule must not apply after the end date");
if (scheduleAppliesOnDate(everyTwoDays, "2026-07-03")) throw new Error("schedule must not apply before the start date");
if (!scheduleAppliesOnDate({ startsOn: "2026-07-04", recurrenceIntervalDays: 1 }, "2026-07-05")) {
  throw new Error("daily schedule must apply every day after start");
}
```

- [ ] **Step 2: Run the failing check**

Run:

```bash
npm run typecheck
```

Expected: FAIL because `medicationScheduleRules.ts` does not exist.

- [ ] **Step 3: Implement the recurrence rules**

Create `apps/mobile/src/contexts/medication/application/medicationScheduleRules.ts`:

```ts
type ScheduleWindow = {
  startsOn: string;
  endsOn?: string;
  recurrenceIntervalDays: number;
};

export function scheduleAppliesOnDate(schedule: ScheduleWindow, dateKey: string) {
  if (dateKey < schedule.startsOn) return false;
  if (schedule.endsOn && dateKey > schedule.endsOn) return false;
  const interval = Math.max(1, Math.floor(schedule.recurrenceIntervalDays || 1));
  return daysBetweenLocalDates(schedule.startsOn, dateKey) % interval === 0;
}

export function daysBetweenLocalDates(fromDateKey: string, toDateKey: string) {
  const from = parseLocalDateKey(fromDateKey);
  const to = parseLocalDateKey(toDateKey);
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.round((to.getTime() - from.getTime()) / millisecondsPerDay);
}

function parseLocalDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}
```

- [ ] **Step 4: Add the pure test to verification**

Append `apps/mobile/src/contexts/medication/application/medicationScheduleRules.test.ts` to the existing pure TypeScript test list in `scripts/verify-presentation-state.mjs`.

- [ ] **Step 5: Run gates**

Run:

```bash
npm run verify:presentation
npm run typecheck
```

Expected: PASS.

### Task 3: Add Duplicate-Safe Scheduled Dose Storage

**Files:**
- Create: `supabase/migrations/20260704000100_medication_dose_schedule_date_guard.sql`
- Modify: `apps/mobile/generated-supabase/database.types.ts`
- Modify: `apps/mobile/src/contexts/medication/domain/medication.ts`
- Modify: `apps/mobile/src/contexts/medication/application/medicationDoseRecords.ts`
- Create: `apps/mobile/src/contexts/medication/application/medicationDoseRecords.scheduleGuard.test.ts`
- Modify: `scripts/verify-presentation-state.mjs`

- [ ] **Step 1: Add the failing payload/merge test**

Create `apps/mobile/src/contexts/medication/application/medicationDoseRecords.scheduleGuard.test.ts`:

```ts
import { buildMedicationDoseInsertPayload, findDoseForScheduleDate, mergeSavedDoseIntoList } from "./medicationDoseRecords";

const payload = buildMedicationDoseInsertPayload({
  scheduleId: "schedule-1",
  doseDate: "2026-07-04",
  scheduledTime: "08:30",
  medicationName: "항생제",
  conditionName: "피부염",
  dosageLabel: "1정",
  status: "completed",
});

if (payload.schedule_id !== "schedule-1") throw new Error("scheduled dose payload must keep schedule id");
if (payload.dose_date !== "2026-07-04") throw new Error("scheduled dose payload must keep local dose date");
if (!payload.scheduled_at.includes("T")) throw new Error("scheduled dose payload must build a scheduled timestamp");

const existing = {
  id: "dose-1",
  petId: "pet-1",
  scheduleId: "schedule-1",
  doseDate: "2026-07-04",
  medicationName: "항생제",
  scheduledAt: "08:30",
  status: "pending" as const,
};

if (findDoseForScheduleDate([existing], "schedule-1", "2026-07-04")?.id !== "dose-1") {
  throw new Error("schedule/date lookup must find the existing dose");
}

const merged = mergeSavedDoseIntoList([existing], { ...existing, status: "completed" });
if (merged.length !== 1 || merged[0]?.status !== "completed") {
  throw new Error("saving a schedule-backed dose must replace the existing schedule/date dose");
}
```

- [ ] **Step 2: Run the failing check**

Run:

```bash
npm run typecheck
```

Expected: FAIL because the schedule/date helpers and dose fields do not exist.

- [ ] **Step 3: Add the database guard migration**

Create `supabase/migrations/20260704000100_medication_dose_schedule_date_guard.sql`:

```sql
alter table public.medication_schedules add column if not exists recurrence_interval_days integer not null default 1;
alter table public.medication_schedules add constraint medication_schedules_recurrence_interval_positive check (recurrence_interval_days >= 1);

alter table public.medication_doses add column if not exists dose_date date;

update public.medication_doses
set dose_date = (scheduled_at at time zone 'Australia/Sydney')::date
where dose_date is null;

alter table public.medication_doses alter column dose_date set not null;

create unique index if not exists medication_doses_schedule_date_unique
  on public.medication_doses(pet_id, schedule_id, dose_date)
  where schedule_id is not null;
```

- [ ] **Step 4: Update generated Supabase types**

In `apps/mobile/generated-supabase/database.types.ts`, add `recurrence_interval_days: number` to `medication_schedules.Row`, `recurrence_interval_days?: number` to `Insert` and `Update`, add `dose_date: string` to `medication_doses.Row`, and add `dose_date?: string` to `Insert` and `Update`.

- [ ] **Step 5: Extend dose domain and payload helpers**

Update `DoseRecord` in `apps/mobile/src/contexts/medication/domain/medication.ts`:

```ts
export type DoseRecord = {
  id: UUID;
  petId: UUID;
  scheduleId?: UUID;
  doseDate?: string;
  medicationName: string;
  conditionName?: string;
  dosageLabel?: string;
  administeredAmount?: string;
  scheduledAt: string;
  status: DoseStatus;
  recordedAt?: string;
  reactionNote?: string;
};
```

Update `QuickMedicationDoseInput` and add helpers in `medicationDoseRecords.ts`:

```ts
export type QuickMedicationDoseInput = {
  scheduleId?: string;
  doseDate?: string;
  scheduledTime?: string;
  conditionName?: string;
  medicationName: string;
  dosageLabel?: string;
  administeredAmount?: string;
  reactionNote?: string;
  status?: DoseStatus;
};

export function findDoseForScheduleDate(doses: DoseRecord[], scheduleId: string, doseDate: string) {
  return doses.find((dose) => dose.scheduleId === scheduleId && dose.doseDate === doseDate);
}

export function mergeSavedDoseIntoList(doses: DoseRecord[], saved: DoseRecord) {
  return [saved, ...doses.filter((dose) => {
    if (saved.scheduleId && dose.scheduleId === saved.scheduleId && dose.doseDate === saved.doseDate) return false;
    return dose.id !== saved.id;
  })];
}
```

- [ ] **Step 6: Include schedule/date in reads and writes**

Update `fetchMedicationDoses` select list to include `schedule_id,dose_date`. Update `mapDoseRow` to set `scheduleId: row.schedule_id ?? undefined` and `doseDate: row.dose_date ?? undefined`.

Add `buildMedicationDoseInsertPayload(input)` and use it in `useCreateMedicationDose` so scheduled rows can pass `schedule_id`, `dose_date`, and a time-derived `scheduled_at`.

- [ ] **Step 7: Add the new test file to presentation verification if that script owns pure TS checks**

Append the new schedule-guard test path to `scripts/verify-presentation-state.mjs` only if the script already lists similar pure test files. Preserve existing checks.

- [ ] **Step 8: Run gates**

Run:

```bash
npm run typecheck
npm run verify:supabase
```

Expected: PASS.

### Task 4: Build Today's Medication Agenda

**Files:**
- Create: `apps/mobile/src/presentation/screens/todayMedicationAgenda.ts`
- Create: `apps/mobile/src/presentation/screens/todayMedicationAgenda.test.ts`
- Modify: `scripts/verify-presentation-state.mjs`

- [ ] **Step 1: Write the failing agenda test**

Create `apps/mobile/src/presentation/screens/todayMedicationAgenda.test.ts`:

```ts
import type { CareMedicationSchedule } from "../../contexts/care/domain/carePlan";
import type { DoseRecord } from "../../contexts/medication/domain/medication";
import { createTodayMedicationAgendaRows } from "./todayMedicationAgenda";

const schedule: CareMedicationSchedule = {
  id: "schedule-1",
  medicationId: "medication-1",
  medicationName: "항생제",
  dosageLabel: "1정",
  conditionId: "condition-1",
  conditionName: "피부염",
  localTime: "08:30:00",
  startsOn: "2026-07-04",
  recurrenceIntervalDays: 2,
};

const rows = createTodayMedicationAgendaRows({ schedules: [schedule], doses: [], doseDate: "2026-07-04" });
if (rows[0]?.source !== "schedule" || rows[0]?.status !== "pending") {
  throw new Error("schedule-only agenda row must appear as pending without a saved dose");
}

const dose: DoseRecord = {
  id: "dose-1",
  petId: "pet-1",
  scheduleId: "schedule-1",
  doseDate: "2026-07-04",
  medicationName: "항생제",
  dosageLabel: "1정",
  conditionName: "피부염",
  scheduledAt: "08:30",
  status: "completed",
};

const mergedRows = createTodayMedicationAgendaRows({ schedules: [schedule], doses: [dose], doseDate: "2026-07-04" });
if (mergedRows.length !== 1 || mergedRows[0]?.source !== "dose" || mergedRows[0]?.status !== "completed") {
  throw new Error("saved dose must replace the virtual schedule row for the same date");
}

const skippedRows = createTodayMedicationAgendaRows({ schedules: [schedule], doses: [], doseDate: "2026-07-05" });
if (skippedRows.length !== 0) {
  throw new Error("agenda must not show schedules that do not apply to the selected date");
}
```

- [ ] **Step 2: Run the failing check**

Run:

```bash
npm run typecheck
```

Expected: FAIL because `createTodayMedicationAgendaRows` does not exist.

- [ ] **Step 3: Implement the agenda helper**

Create `todayMedicationAgenda.ts`:

```ts
import type { CareMedicationSchedule } from "../../contexts/care/domain/carePlan";
import { scheduleAppliesOnDate } from "../../contexts/medication/application/medicationScheduleRules";
import type { DoseRecord, DoseStatus } from "../../contexts/medication/domain/medication";

export type TodayMedicationAgendaRow = {
  source: "schedule" | "dose";
  scheduleId?: string;
  doseId?: string;
  doseDate: string;
  medicationName: string;
  conditionName?: string;
  dosageLabel?: string;
  scheduledTime: string;
  status: DoseStatus;
};

export function createTodayMedicationAgendaRows({ schedules, doses, doseDate }: { schedules: CareMedicationSchedule[]; doses: DoseRecord[]; doseDate: string }): TodayMedicationAgendaRow[] {
  const rowsBySchedule = new Map<string, TodayMedicationAgendaRow>();
  for (const schedule of schedules) {
    if (!scheduleAppliesOnDate(schedule, doseDate)) continue;
    rowsBySchedule.set(schedule.id, {
      source: "schedule",
      scheduleId: schedule.id,
      doseDate,
      medicationName: schedule.medicationName,
      conditionName: schedule.conditionName,
      dosageLabel: schedule.dosageLabel,
      scheduledTime: schedule.localTime.slice(0, 5),
      status: "pending",
    });
  }
  const oneTimeRows: TodayMedicationAgendaRow[] = [];
  for (const dose of doses) {
    const row: TodayMedicationAgendaRow = {
      source: "dose",
      scheduleId: dose.scheduleId,
      doseId: dose.id,
      doseDate: dose.doseDate ?? doseDate,
      medicationName: dose.medicationName,
      conditionName: dose.conditionName,
      dosageLabel: dose.dosageLabel,
      scheduledTime: dose.scheduledAt,
      status: dose.status,
    };
    if (dose.scheduleId) rowsBySchedule.set(dose.scheduleId, row);
    else oneTimeRows.push(row);
  }
  return [...rowsBySchedule.values(), ...oneTimeRows].sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
}
```

- [ ] **Step 4: Add the test file to verification**

Append `apps/mobile/src/presentation/screens/todayMedicationAgenda.test.ts` to the existing presentation-state test file list.

- [ ] **Step 5: Run gates**

Run:

```bash
npm run verify:presentation
npm run typecheck
```

Expected: PASS.

### Task 5: Move Care Defaults Into Pet Profile

**Files:**
- Create: `apps/mobile/src/presentation/screens/ProfileCareDefaultsPanel.tsx`
- Create: `apps/mobile/src/presentation/screens/ProfileCareDefaultsPanel.test.tsx`
- Modify: `apps/mobile/src/presentation/screens/PetOnboardingScreen.tsx`
- Modify: `apps/mobile/src/presentation/PawBloomShell.tsx`
- Modify: `apps/mobile/src/presentation/shell/useShellCareDefaults.ts`
- Modify: `apps/mobile/src/i18n/translations.ts`

- [ ] **Step 1: Write the panel props test**

Create `apps/mobile/src/presentation/screens/ProfileCareDefaultsPanel.test.tsx`:

```ts
import type { ComponentProps } from "react";
import type { ActiveCareSetup } from "../../contexts/care/domain/carePlan";
import { ProfileCareDefaultsPanel } from "./ProfileCareDefaultsPanel";

const setup: ActiveCareSetup = {
  conditions: [{ id: "condition-1", name: "피부염", status: "active" }],
  conditionName: "피부염",
  schedules: [{
    id: "schedule-1",
    medicationId: "medication-1",
    medicationName: "항생제",
    dosageLabel: "1정",
    conditionId: "condition-1",
    conditionName: "피부염",
    localTime: "08:30:00",
    startsOn: "2026-07-04",
    recurrenceIntervalDays: 1,
  }],
};

const props: ComponentProps<typeof ProfileCareDefaultsPanel> = {
  setup,
  onSave: () => undefined,
};

void props;
```

- [ ] **Step 2: Run the failing check**

Run:

```bash
npm run typecheck
```

Expected: FAIL because `ProfileCareDefaultsPanel` does not exist.

- [ ] **Step 3: Create the profile care defaults panel**

Implement a panel that accepts:

```ts
export function ProfileCareDefaultsPanel({ setup, onSave }: { setup: ActiveCareSetup; onSave: (input: CareSetupInput) => void }) {
  // state: conditionName, planTitle, medicationName, dosageLabel, startsOn, endsOn, recurrenceIntervalDays, localTimes
  // render existing setup.conditions and setup.schedules
  // primary button saves one condition/medication with one schedule row per local time
}
```

Use profile/setup wording:

- `pet.careDefaultsTitle`: "케어 기본값"
- `pet.careDefaultsCopy`: "매일 보여줄 병명과 약 일정을 저장해요."
- `pet.careDefaultsConditionAdd`: "병명/상태 추가"
- `pet.careDefaultsMedicationAdd`: "약 추가"
- `pet.careDefaultsSavedHint`: "오늘 실제 투약 여부는 Care에서 체크해요."
- `pet.careDefaultsPeriod`: "투약 기간"
- `pet.careDefaultsRepeat`: "반복 간격"
- `pet.careDefaultsEveryDay`: "매일"
- `pet.careDefaultsEveryTwoDays`: "2일에 한 번"
- `pet.careDefaultsTimeAdd`: "복용 시간 추가"

- [ ] **Step 4: Render care defaults in profile**

Update `PetOnboardingScreen` props:

```ts
export function PetOnboardingScreen({
  routine,
  onSaveRoutine,
  careSetup,
  onSaveCareSetup,
  onProfileSaved,
}: {
  routine?: PetRoutine;
  onSaveRoutine?: (routine: PetRoutineInput) => void;
  careSetup?: ActiveCareSetup;
  onSaveCareSetup?: (input: CareSetupInput) => void;
  onProfileSaved?: () => void;
} = {}) {
```

Render below `RoutineSettingsPanel`:

```tsx
{activePet && !showCreateForm && careSetup && onSaveCareSetup ? (
  <ProfileCareDefaultsPanel setup={careSetup} onSave={onSaveCareSetup} />
) : null}
```

- [ ] **Step 5: Pass setup props from Shell**

In `PawBloomShell.tsx`, pass `activeCareSetup` and `saveCareSetup` into the pet settings screen alongside routine props.

- [ ] **Step 6: Clarify shell hook naming**

Either split `useShellCareDefaults` into routine/care hooks or rename local variables so the hook clearly returns both routine defaults and care profile defaults. Do not change behavior beyond naming/ownership clarity in this task.

- [ ] **Step 7: Run gates**

Run:

```bash
npm run verify:i18n
npm run typecheck
```

Expected: PASS.

### Task 6: Simplify Care To Today's Medication Check

**Files:**
- Modify: `apps/mobile/src/presentation/screens/CareModeScreen.tsx`
- Modify: `apps/mobile/src/presentation/screens/CareMedicationPanel.tsx`
- Modify: `apps/mobile/src/presentation/screens/careMedicationPanelState.ts`
- Modify: `apps/mobile/src/presentation/PawBloomShell.tsx`
- Modify: `apps/mobile/src/i18n/translations.ts`
- Modify: `scripts/verify-presentation-state.mjs`

- [ ] **Step 1: Add state-helper tests for direct actions**

Append to `apps/mobile/src/presentation/screens/CareMedicationPanel.test.tsx`:

```ts
import { careStatusActionLabel, shouldShowTemporaryMedicationForm } from "./careMedicationPanelState";

if (careStatusActionLabel("completed") !== "먹였어요") throw new Error("completed action must use caregiver wording");
if (careStatusActionLabel("skipped") !== "못 먹였어요") throw new Error("skipped action must use caregiver wording");
if (shouldShowTemporaryMedicationForm(false) !== false || shouldShowTemporaryMedicationForm(true) !== true) {
  throw new Error("temporary medication form visibility must be explicit");
}
```

- [ ] **Step 2: Run the failing check**

Run:

```bash
npm run typecheck
```

Expected: FAIL because the helper functions do not exist.

- [ ] **Step 3: Add direct action helpers**

Update `careMedicationPanelState.ts`:

```ts
export function careStatusActionLabel(status: "completed" | "skipped") {
  return status === "completed" ? "먹였어요" : "못 먹였어요";
}

export function shouldShowTemporaryMedicationForm(expanded: boolean) {
  return expanded;
}
```

- [ ] **Step 4: Replace cyclic row behavior**

Update `MedicationRow` props from `onStatusPress` to direct status actions:

```ts
export function MedicationRow({
  dose,
  onEdit,
  onStatusChange,
}: {
  dose: DoseRecord;
  onEdit: () => void;
  onStatusChange: (status: "completed" | "skipped") => void;
}) {
  // render two buttons: 먹였어요 and 못 먹였어요
}
```

Do not rely on `nextDoseStatus` for the primary Care row.

- [ ] **Step 5: Collapse temporary medication by default**

In `CareModeScreen`, replace always-visible `QuickMedicationForm` with:

```tsx
<SecondaryButton label={t("ko", "care.temporaryAdd")} icon="add" onPress={() => setTemporaryFormOpen((current) => !current)} />
{temporaryFormOpen ? (
  <QuickMedicationForm onSave={onAddDose} editingDose={editingDose} onUpdate={onUpdateDose} onDelete={onDeleteDose} onCancelEdit={() => setEditingDoseId(null)} />
) : null}
```

- [ ] **Step 6: Remove primary Care setup form from Care**

Remove `CareSetupPanel` rendering from `CareModeScreen`. Replace it with a compact schedule summary:

```tsx
<SurfaceCard>
  <Text style={styles.sectionTitle}>{t("ko", "care.scheduleSummaryTitle")}</Text>
  <Text style={styles.emptyText}>{t("ko", "care.scheduleSummaryCopy")}</Text>
</SurfaceCard>
```

The copy must tell users to edit long-running schedules in profile.

- [ ] **Step 7: Keep condition as a Diary reference**

Replace the large condition section with compact text:

```tsx
<SurfaceCard>
  <Text style={styles.sectionTitle}>{t("ko", "care.conditionFromDiaryTitle")}</Text>
  <Text style={styles.emptyText}>
    {conditionScore ? `${t("ko", "care.latestCondition")} ${conditionScore}/5` : t("ko", "care.conditionFromDiaryCopy")}
  </Text>
</SurfaceCard>
```

- [ ] **Step 8: Add presentation guard**

In `scripts/verify-presentation-state.mjs`, fail if `CareModeScreen.tsx` imports `CareSetupPanel` or renders `SummaryCard` in the main Care panel.

- [ ] **Step 9: Run gates**

Run:

```bash
npm run verify:presentation
npm run verify:i18n
npm run typecheck
```

Expected: PASS.

### Task 7: Wire Scheduled Agenda Saves

**Files:**
- Modify: `apps/mobile/src/presentation/PawBloomShell.tsx`
- Modify: `apps/mobile/src/presentation/shell/checklistActions.ts`
- Modify: `apps/mobile/src/presentation/shell/checklistActions.test.ts`
- Modify: `apps/mobile/src/presentation/liveUiState.ts`
- Modify: `apps/mobile/src/presentation/liveUiState.dashboard.test.ts`
- Modify: `apps/mobile/src/presentation/screens/HomeScreen.tsx`
- Modify: `apps/mobile/src/presentation/screens/HomeDashboardPanel.logic.ts`
- Modify: `apps/mobile/src/presentation/screens/HomeDashboardPanel.logic.test.ts`

- [ ] **Step 1: Add dashboard agenda tests**

Update `liveUiState.dashboard.test.ts` so pending medication can come from schedule-backed agenda rows even before a dose is saved:

```ts
const scheduledSummary = buildTodayDashboardSummary({
  checklist,
  entries,
  doses: [],
  medicationAgenda: [{ status: "pending", medicationName: "항생제", scheduledTime: "08:30" }],
});

if (scheduledSummary.pendingMedicationCount !== 1) {
  throw new Error("dashboard must count pending scheduled medication before a dose row is saved");
}
```

- [ ] **Step 2: Run the failing check**

Run:

```bash
npm run typecheck
```

Expected: FAIL because dashboard summary does not accept medication agenda rows.

- [ ] **Step 3: Create agenda rows in Shell**

In `PawBloomShell.tsx`, compute:

```ts
const todayDoseDate = getLocalDateKey();
const medicationAgenda = createTodayMedicationAgendaRows({
  schedules: activeCareSetup.schedules,
  doses: activeDoses,
  doseDate: todayDoseDate,
});
```

Pass `medicationAgenda` to Home and Care.

- [ ] **Step 4: Save scheduled status without duplicates**

Replace the old `cycleDoseStatus` primary path with:

```ts
function saveMedicationAgendaStatus(row: TodayMedicationAgendaRow, status: "completed" | "skipped" | "partial") {
  if (row.doseId) {
    void updateMedicationDoseStatus.mutateAsync({ id: row.doseId, status });
    return;
  }
  void addMedicationDose({
    scheduleId: row.scheduleId,
    doseDate: row.doseDate,
    scheduledTime: row.scheduledTime,
    medicationName: row.medicationName,
    conditionName: row.conditionName,
    dosageLabel: row.dosageLabel,
    status,
  });
}
```

Use this only for agenda rows. Keep manual temporary medication save as `addMedicationDose`.

- [ ] **Step 5: Update Today checklist medication behavior**

When the Today medication checklist is toggled, prefer the first pending agenda row and mark it completed. If there is no scheduled row, keep the existing one-time quick medication fallback.

- [ ] **Step 6: Update Home summary logic**

Allow `buildTodayDashboardSummary` and `CareSummaryCard` logic to read pending count and saved detail rows from `medicationAgenda`. Do not show a duplicate summary row when an agenda row is backed by a saved dose.

- [ ] **Step 7: Run gates**

Run:

```bash
npm run verify:presentation
npm run typecheck
```

Expected: PASS.

### Task 8: Schedule Local Medication Reminders

**Files:**
- Create: `apps/mobile/src/presentation/notifications/medicationReminderNotifications.ts`
- Create: `apps/mobile/src/presentation/notifications/medicationReminderNotifications.test.ts`
- Modify: `apps/mobile/src/presentation/PawBloomShell.tsx`
- Modify: `apps/mobile/src/i18n/translations.ts`
- Modify: `scripts/verify-presentation-state.mjs`

- [ ] **Step 1: Write the failing reminder request test**

Create `apps/mobile/src/presentation/notifications/medicationReminderNotifications.test.ts`:

```ts
import type { CareMedicationSchedule } from "../../contexts/care/domain/carePlan";
import { buildMedicationReminderRequests } from "./medicationReminderNotifications";

const schedule: CareMedicationSchedule = {
  id: "schedule-1",
  medicationId: "medication-1",
  medicationName: "항생제",
  dosageLabel: "1정",
  conditionName: "피부염",
  localTime: "08:30:00",
  startsOn: "2026-07-04",
  endsOn: "2026-07-08",
  recurrenceIntervalDays: 2,
};

const requests = buildMedicationReminderRequests({
  petName: "잉꼬",
  schedules: [schedule],
  fromDate: "2026-07-04",
  daysAhead: 5,
});

if (requests.length !== 3) throw new Error("every-2-days reminder must be scheduled only for matching dates in range");
if (requests[0]?.dateKey !== "2026-07-04" || requests[1]?.dateKey !== "2026-07-06" || requests[2]?.dateKey !== "2026-07-08") {
  throw new Error("reminder dates must follow the recurrence interval from start date");
}
if (!requests[0]?.title.includes("잉꼬") || !requests[0]?.body.includes("항생제")) {
  throw new Error("reminder copy must include pet and medicine names");
}
```

- [ ] **Step 2: Run the failing check**

Run:

```bash
npm run typecheck
```

Expected: FAIL because `medicationReminderNotifications.ts` does not exist.

- [ ] **Step 3: Implement reminder request generation**

Create `apps/mobile/src/presentation/notifications/medicationReminderNotifications.ts`:

```ts
import * as Notifications from "expo-notifications";
import type { CareMedicationSchedule } from "../../contexts/care/domain/carePlan";
import { scheduleAppliesOnDate } from "../../contexts/medication/application/medicationScheduleRules";

export type MedicationReminderRequest = {
  identifier: string;
  dateKey: string;
  scheduleId: string;
  title: string;
  body: string;
  triggerDate: Date;
};

export function buildMedicationReminderRequests({
  petName,
  schedules,
  fromDate,
  daysAhead,
}: {
  petName: string;
  schedules: CareMedicationSchedule[];
  fromDate: string;
  daysAhead: number;
}) {
  const requests: MedicationReminderRequest[] = [];
  for (let offset = 0; offset < daysAhead; offset += 1) {
    const dateKey = addDaysToDateKey(fromDate, offset);
    for (const schedule of schedules) {
      if (!scheduleAppliesOnDate(schedule, dateKey)) continue;
      requests.push({
        identifier: `medication:${schedule.id}:${dateKey}`,
        dateKey,
        scheduleId: schedule.id,
        title: `${petName} 약 먹일 시간이에요`,
        body: schedule.medicationName,
        triggerDate: buildLocalTriggerDate(dateKey, schedule.localTime),
      });
    }
  }
  return requests;
}

export async function rescheduleMedicationReminders({ petName, schedules, fromDate }: { petName: string; schedules: CareMedicationSchedule[]; fromDate: string }) {
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return false;
  for (const notification of await Notifications.getAllScheduledNotificationsAsync()) {
    if (notification.identifier.startsWith("medication:")) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }
  for (const request of buildMedicationReminderRequests({ petName, schedules, fromDate, daysAhead: 30 })) {
    await Notifications.scheduleNotificationAsync({
      identifier: request.identifier,
      content: { title: request.title, body: request.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: request.triggerDate },
    });
  }
  return true;
}

function addDaysToDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function buildLocalTriggerDate(dateKey: string, localTime: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = localTime.split(":").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1, hour ?? 8, minute ?? 0, 0, 0);
}
```

- [ ] **Step 4: Wire reminder refresh after care default changes**

In `PawBloomShell.tsx`, after care setup save succeeds, call `rescheduleMedicationReminders` with the active pet name, active care setup schedules, and today's local date. If permission is denied, keep the app functional and show a non-blocking notice.

- [ ] **Step 5: Add the reminder test to verification**

Append `apps/mobile/src/presentation/notifications/medicationReminderNotifications.test.ts` to the pure TypeScript test list in `scripts/verify-presentation-state.mjs`.

- [ ] **Step 6: Run gates**

Run:

```bash
npm run verify:presentation
npm run typecheck
```

Expected: PASS.

### Task 9: Copy, Safety, And Revenue Positioning

**Files:**
- Modify: `apps/mobile/src/i18n/translations.ts`
- Modify: `docs/product/PRODUCT_SPEC.md`
- Modify: `docs/engineering/FRONTEND.md`
- Modify: `docs/superpowers/specs/2026-07-04-care-profile-defaults-simplification-design.md`

- [ ] **Step 1: Add user-facing copy keys**

Add English and Korean keys for:

```ts
"care.todayMedicationTitle"
"care.todayMedicationProgress"
"care.status.given"
"care.status.notGiven"
"care.temporaryAdd"
"care.temporaryCopy"
"care.scheduleSummaryTitle"
"care.scheduleSummaryCopy"
"care.conditionFromDiaryTitle"
"care.conditionFromDiaryCopy"
"care.reminderPermissionDenied"
"care.reminderScheduled"
"pet.careDefaultsTitle"
"pet.careDefaultsCopy"
"pet.careDefaultsSavedHint"
"pet.careDefaultsPeriod"
"pet.careDefaultsRepeat"
"pet.careDefaultsEveryDay"
"pet.careDefaultsEveryTwoDays"
"pet.careDefaultsTimeAdd"
```

- [ ] **Step 2: Remove confusing Care wording from primary UI**

Replace primary UI copy that says:

- "케어 플랜 기본값"
- "오늘 기록으로 불러오기"
- "투약 상태를 눌러 변경"

Use:

- "케어 기본값"
- "약 일정 관리"
- "먹였어요"
- "못 먹였어요"
- "임시 투약 추가"
- "투약 기간"
- "2일에 한 번"
- "복용 시간 추가"

- [ ] **Step 3: Keep safety wording neutral**

Confirm no new copy suggests diagnosis, dose advice, emergency judgment, or skipping vet care.

- [ ] **Step 4: Run gates**

Run:

```bash
npm run verify:i18n
npm run verify:ai-safety
```

Expected: PASS.

### Task 10: Full Verification And Browser Check

**Files:**
- All changed files

- [ ] **Step 1: Run full verification**

Run:

```bash
npm run verify
```

Expected: PASS.

- [ ] **Step 2: Export mobile web preview**

Run:

```bash
npm run mobile:export-web
```

Expected: PASS.

- [ ] **Step 3: Verify local preview**

Open or refresh:

```text
http://127.0.0.1:8082/
```

Expected visible behavior:

- Profile shows care defaults under routine/profile settings.
- Profile care defaults include treatment period, repeat interval, and multiple daily medication times.
- Care first viewport starts with today's medication check.
- Care shows every-2-days medicine only on dates calculated from the medication start date.
- Scheduled medicine rows show direct "먹였어요" and "못 먹였어요" actions.
- Long care setup form is not shown in the main Care flow.
- Temporary medication form is hidden until "임시 투약 추가" is tapped.
- Condition score is referenced from Diary and not entered in Care.
- Local medication reminders are scheduled from the same date and time rules that drive the Care screen.

## Acceptance Criteria

- Long-running care defaults are edited from pet profile, not the main Care tab.
- Multiple illnesses/conditions and multiple medication schedules can be represented.
- Each medication can store treatment start date, optional end date, repeat interval, and one or more daily times.
- Every-2-days schedules are calculated from the treatment start date and appear only on matching dates.
- Local medication reminders are scheduled only for matching schedule dates and times.
- Care displays scheduled medicines for today without pre-creating daily dose rows.
- A scheduled medicine action creates or updates one dose for the same schedule/date.
- Temporary medication remains a today-only record.
- Care no longer depends on cyclic status tapping for the primary medication action.
- Diary remains the only place for condition score input.
- Home and Today summaries remain consistent when scheduled medicines have no saved dose yet.
- Product, frontend, architecture, and database docs reflect the new direction.
- `npm run verify` passes.
