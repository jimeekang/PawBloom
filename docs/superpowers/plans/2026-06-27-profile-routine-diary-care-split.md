# Profile Routine and Diary Care Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move basic routine settings into the selected pet profile, make walk defaults optional by species, and keep Diary focused on diary records while Care Mode owns illness and medication workflows.

**Architecture:** Keep `routine` data pet-scoped and reusable through `useShellCareDefaults`, but render routine settings from the pet profile management screen instead of Diary. Diary consumes routine defaults for today's editable values only. Care Mode remains the single place for care plans, medication, symptoms, and report generation inputs.

**Tech Stack:** React Native + Expo, TypeScript strict mode, TanStack Query hooks, Supabase-backed routine records, existing design system and i18n keys.

---

### Task 1: Lock Behavior With Tests

**Files:**
- Create: `apps/mobile/src/contexts/routine/application/petRoutineSpecies.test.ts`
- Modify: `apps/mobile/src/contexts/routine/application/petRoutineRecords.ts`

- [ ] **Step 1: Write failing type/runtime tests**

```ts
import { buildRoutineDiaryDetail, getDiaryCategoriesForSpecies } from "./petRoutineRecords";
import { createDefaultPetRoutine } from "./petRoutineRecords";

const routine = createDefaultPetRoutine("pet-1");

if (getDiaryCategoriesForSpecies("dog").join(",") !== "food,water,walk,stool,condition,memo") {
  throw new Error("dog diary categories must include walk");
}

if (getDiaryCategoriesForSpecies("cat").includes("walk")) {
  throw new Error("cat diary categories must not include walk by default");
}

if (getDiaryCategoriesForSpecies("other").includes("walk")) {
  throw new Error("other animal diary categories must not include walk by default");
}

const catRoutine = { ...routine, walk: { ...routine.walk, enabled: false } };
const walkDetail = buildRoutineDiaryDetail("walk", catRoutine);
if (walkDetail.category !== "walk" || walkDetail.durationMinutes !== undefined) {
  throw new Error("disabled walk routine should not prefill minutes");
}
```

- [ ] **Step 2: Run typecheck to verify RED**

Run: `npm --prefix apps/mobile run typecheck`

Expected: FAIL because `getDiaryCategoriesForSpecies` and `walk.enabled` do not exist.

- [ ] **Step 3: Implement minimal routine species helpers**

Add an optional `enabled` flag to `PetRoutine.walk`, include `getDiaryCategoriesForSpecies`, and make `buildRoutineDiaryDetail("walk")` return an empty walk detail when walking is disabled.

- [ ] **Step 4: Run typecheck to verify GREEN**

Run: `npm --prefix apps/mobile run typecheck`

Expected: PASS.

### Task 2: Move Routine Settings To Pet Profile

**Files:**
- Modify: `apps/mobile/src/presentation/screens/PetOnboardingScreen.tsx`
- Modify: `apps/mobile/src/presentation/PawBloomShell.tsx`
- Modify: `apps/mobile/src/presentation/screens/DiaryEntryScreen.tsx`
- Modify: `apps/mobile/src/presentation/screens/RoutineSettingsPanel.tsx`

- [ ] **Step 1: Add routine props to pet profile screen**

Pass `activeRoutine` and `saveRoutine` from `PawBloomShell` into `PetOnboardingScreen` when the profile settings screen is open.

- [ ] **Step 2: Render routine settings under selected pet profile**

Show `RoutineSettingsPanel` inside the active pet edit card, under the profile save/delete controls, so the user edits routine where they edit the pet.

- [ ] **Step 3: Remove routine editor from Diary**

Keep `DiaryEntryScreen` accepting `routine` for defaults, but remove `onSaveRoutine` and stop rendering the routine settings panel there.

### Task 3: Keep Diary Daily-Only And Care Mode Care-Only

**Files:**
- Modify: `apps/mobile/src/presentation/screens/DiaryEntryScreen.tsx`
- Modify: `apps/mobile/src/presentation/screens/CareModeScreen.tsx`
- Modify: `apps/mobile/src/i18n/translations.ts`
- Modify: `docs/product/PRODUCT_SPEC.md`
- Modify: `docs/engineering/FRONTEND.md`

- [ ] **Step 1: Remove Diary care segment**

Remove the daily/care segmented control and always show diary categories returned by `getDiaryCategoriesForSpecies`.

- [ ] **Step 2: Keep care records in Care Mode**

Leave care plan, medication, symptoms, reactions, and care review notes in `CareModeScreen` only.

- [ ] **Step 3: Update product and frontend docs**

State that routine settings live in pet profile, walk is optional for non-dog species, Diary is daily-only, and Care Mode owns care workflows.

### Task 4: Verify

**Files:**
- Existing verification scripts and browser mirror.

- [ ] **Step 1: Run full verification**

Run: `npm run verify`

Expected: PASS.

- [ ] **Step 2: Browser check**

Open `http://localhost:3200/`, verify the profile screen shows basic routine settings and Diary no longer shows a care segment or routine editor.
