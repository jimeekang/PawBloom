# Home Today Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the PawBloom Today home screen, keep the pet photo readable, remove duplicated quick actions, and show the visible checklist without presenting diary/care as separate modes.

**Architecture:** Keep the change in the mobile presentation layer. Home receives explicit display flags from `PawBloomShell`, and pure checklist/dashboard rules live in `liveUiState.ts` so they can be verified without rendering React Native.

**Tech Stack:** Expo SDK 56, React Native, TypeScript strict mode, repository verification through `npm run verify`.

---

## Tasks

### Task 1: Remove Duplicate Quick Actions

**Files:**
- `apps/mobile/src/presentation/screens/HomeDashboardPanel.tsx`
- `apps/mobile/src/presentation/screens/HomeScreen.tsx`
- `apps/mobile/src/presentation/PawBloomShell.tsx`

- [x] Remove home quick action buttons for `다이어리 추가`, `투약 기록`, and `리포트 보기`.
- [x] Keep navigation through the bottom tab bar.

### Task 2: Move Non-Photo Info Below Hero

**Files:**
- `apps/mobile/src/presentation/screens/HomeScreen.tsx`

- [x] Keep only pet name and pet detail on the profile image.
- [x] Keep dashboard summary below the image.
- [x] Remove Diary/Care mode buttons from Home.
- [x] Adjust margins and card spacing so the home screen remains scannable.

### Task 3: Wire Home Actions

**Files:**
- `apps/mobile/src/design-system/components.tsx`
- `apps/mobile/src/presentation/screens/HomeScreen.tsx`
- `apps/mobile/src/presentation/PawBloomShell.tsx`

- [x] Make `SectionHeader` actions pressable when `onActionPress` is provided.
- [x] Wire timeline `모두 보기` to open today's Diary list.
- [x] Keep timeline `모두 보기` wired to today's Diary list.
- [x] Keep Care reachable through the bottom navigation as a care-record section.

### Task 4: Match Checklist To Pet Configuration

**Files:**
- `apps/mobile/src/presentation/liveUiState.ts`
- `apps/mobile/src/presentation/liveUiState.dashboard.test.ts`
- `apps/mobile/src/presentation/PawBloomShell.tsx`
- `apps/mobile/src/presentation/screens/HomeScreen.tsx`

- [x] Show the full visible Today checklist on Home.
- [x] Hide `산책` when `activeRoutine.walk.enabled === false`.
- [x] Show `투약` in the Today checklist by default.
- [x] Keep the optional medication visibility flag available for future suppressed contexts.
- [x] Do not derive medication visibility from the DB pet mapping flag.

### Task 5: Verification

**Files:**
- `scripts/verify-presentation-state.mjs`
- `package.json`

- [x] Add presentation-state verification that actually executes `liveUiState.dashboard.test.ts`.
- [x] Include `verify:presentation` in `npm run verify`.
- [x] Run `npm run verify`.
- [x] Run focused simulator QA only at the end.

## Final Checks

- [x] `npm run verify` passes.
- [x] Subagent spec review approved.
- [x] Subagent code quality review approved.
- [x] Final simulator screenshot confirms the hero image is not overloaded.
