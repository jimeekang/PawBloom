# Routine and Care Plan Defaults Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let caregivers configure each pet's baseline daily routine and active care medication plan once, then reuse those defaults when recording daily diary and care entries.

**Architecture:** Add a small `routine` context for pet-level daily baseline values, and use the existing `care`, `medications`, and `medication_schedules` tables for illness/condition and medication defaults. Daily diary and medication dose records remain the source of truth for what actually happened today; defaults only prefill those daily records.

**Tech Stack:** Expo SDK 56, React Native, TanStack Query, Supabase Postgres/RLS, TypeScript.

---

### Task 1: Document the Product and Data Direction

**Files:**
- Modify: `docs/product/PRODUCT_SPEC.md`
- Modify: `ARCHITECTURE.md`
- Modify: `docs/engineering/FRONTEND.md`
- Modify: `docs/engineering/DATABASE.md`
- Modify: `docs/exec-plans/active/0003-weekly-execution-checklist.md`

- [ ] Add product wording that defaults live in "basic routine" and "care plan", not in daily records.
- [ ] Add `routine` as a bounded context in the architecture map.
- [ ] Add UX rule: daily screens must load defaults but allow today-only edits.
- [ ] Add DB rule: baseline routines are pet-scoped and protected by pet membership RLS.
- [ ] Mark the Week 1/2 plan with this accelerated default-loading slice.

### Task 2: Add Pet Routine Storage and Types

**Files:**
- Create: `supabase/migrations/20260627000000_pet_routines.sql`
- Modify: `apps/mobile/generated-supabase/database.types.ts`
- Create: `apps/mobile/src/contexts/routine/domain/petRoutine.ts`
- Create: `apps/mobile/src/contexts/routine/application/petRoutineRecords.ts`
- Test: `apps/mobile/src/contexts/routine/application/petRoutineDefaults.test.ts`

- [ ] Write a failing type-level test for `createDefaultPetRoutine` and `buildRoutineDiaryDetail`.
- [ ] Add `pet_routines` with `pet_id`, `routine jsonb`, `created_by`, timestamps, unique `pet_id`, explicit GRANT, and RLS.
- [ ] Implement routine domain types for food, water, walk, stool, and condition baselines.
- [ ] Implement query and upsert hooks with TanStack Query.
- [ ] Keep default-to-diary conversion outside the `diary` context boundary.

### Task 3: Add Care Plan and Medication Schedule Setup

**Files:**
- Create: `apps/mobile/src/contexts/care/domain/carePlan.ts`
- Create: `apps/mobile/src/contexts/care/application/carePlanRecords.ts`
- Test: `apps/mobile/src/contexts/care/application/carePlanRecords.test.ts`

- [ ] Write a failing type-level test for converting a saved medication schedule into a today dose draft.
- [ ] Query active conditions, care plans, medications, and schedules for the selected pet.
- [ ] Insert a condition, care plan, medication, and medication schedule from one setup form.
- [ ] Return a simple active care setup model that the Care screen can render.

### Task 4: Connect Defaults to Mobile Screens

**Files:**
- Create: `apps/mobile/src/presentation/screens/RoutineSettingsPanel.tsx`
- Create: `apps/mobile/src/presentation/screens/CareSetupPanel.tsx`
- Modify: `apps/mobile/src/presentation/screens/DiaryEntryScreen.tsx`
- Modify: `apps/mobile/src/presentation/screens/CareModeScreen.tsx`
- Modify: `apps/mobile/src/presentation/PawBloomShell.tsx`
- Modify: `apps/mobile/src/presentation/mockUiState.ts`
- Modify: `apps/mobile/src/i18n/translations.ts`

- [ ] Show a compact routine settings panel in Diary so caregivers can save baseline values.
- [ ] Prefill category detail inputs from the saved routine when the category changes.
- [ ] Show a care setup panel in Care for condition, plan title, medication, dosage, and daily time.
- [ ] Show saved medication schedules as reusable rows that create today's dose from the saved values.
- [ ] Keep local preview mode useful with in-memory routine and care setup state.

### Task 5: Verify

**Files:**
- All changed files

- [ ] Run `npm --prefix apps/mobile run typecheck` after the red test and again after implementation.
- [ ] Run `npm run verify`.
- [ ] Visually check the simulator mirror at `http://localhost:3200` for the new routine and care setup panels.
