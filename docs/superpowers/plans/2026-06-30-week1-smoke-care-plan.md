# Week 1 Smoke And Care Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 2026-06-30 기준으로 Week 1 구현분을 iOS/웹에서 검증하고, Care Mode를 실제 care plan과 medication schedule 중심으로 안정화한다.

**Architecture:** 기존 DDD bounded context 구조를 유지한다. 반려동물 기본 루틴은 `contexts/routine`, 질병/케어 플랜/약 일정은 `contexts/care`, 오늘 실제 기록은 `contexts/diary`와 `contexts/medication`에 남긴다. UI는 `presentation/screens`에서 기존 panel 단위로 작게 확장하고, 사용자 문구는 반드시 `apps/mobile/src/i18n/translations.ts`에 둔다.

**Tech Stack:** Expo SDK 56, React Native, TypeScript strict mode, TanStack Query, Supabase Auth/Postgres/RLS, Expo SecureStore, Expo SQLite.

---

## File Map

- Modify: `docs/exec-plans/active/0003-weekly-execution-checklist.md`
  - 현재 브랜치와 오늘 완료/미완료 상태를 실제 상태로 맞춘다.
- Modify: `apps/mobile/src/contexts/care/domain/carePlan.ts`
  - active condition, care plan, schedule이 UI에서 구분되도록 domain type을 보강한다.
- Modify: `apps/mobile/src/contexts/care/application/carePlanRecords.ts`
  - Supabase row를 명확한 active care setup으로 매핑하고, create mutation invalidation을 유지한다.
- Modify: `apps/mobile/src/contexts/care/application/carePlanRecords.test.ts`
  - schedule에서 quick dose를 만드는 타입 테스트를 실제 mapper/normalizer 테스트로 확장한다.
- Modify: `apps/mobile/src/presentation/screens/CareSetupPanel.tsx`
  - 상태명, 플랜명, 복약명, 용량, 시간 입력의 오류/저장 UX를 보강한다.
- Modify: `apps/mobile/src/presentation/screens/CareModeScreen.tsx`
  - active care plan이 있을 때 Care Mode 상단에서 기준값을 보여준다.
- Modify: `apps/mobile/src/presentation/shell/SaveFeedbackBar.tsx`
  - 모든 저장 완료 안내가 눈에 띄는지 확인하고 필요한 경우 높이/위치/문구를 보강한다.
- Modify: `apps/mobile/src/i18n/translations.ts`
  - 새 UI 문구를 영어/한국어 모두 추가한다.
- Modify only if failing: `scripts/verify-supabase.mjs`, `scripts/verify-secrets.mjs`, `scripts/verify-offline-sync.mjs`
  - 검증 실패가 실제 코드 문제인지 스크립트 기준 문제인지 확인 후 최소 수정한다.

## Task 1: Baseline And Checklist Sync

**Files:**
- Modify: `docs/exec-plans/active/0003-weekly-execution-checklist.md`

- [ ] **Step 1: Confirm branch and clean state**

Run:

```bash
git status --short --branch
git log --oneline -5
```

Expected:

```text
## codex/routine-diary-care-defaults...origin/codex/routine-diary-care-defaults
```

- [ ] **Step 2: Update checklist state**

In `docs/exec-plans/active/0003-weekly-execution-checklist.md`, update the current status block to:

```markdown
## 현재 기준 상태

- Branch: `codex/routine-diary-care-defaults`
- Remote branch: `origin/codex/routine-diary-care-defaults`
- Latest completed commits:
  - `4d1ce4a feat: edit diary care records and dashboard`
  - `9edcf3d chore: add codex run environment checks`
- Required verification: `npm run verify`
- Expo dev URL: `http://localhost:8081/` or `http://localhost:3200/` depending on the active run command.
```

- [ ] **Step 3: Mark already shipped Day 5A status**

Keep these items checked because they are already committed:

```markdown
- [x] Diary records can be opened from the list and edited.
- [x] Diary records can be deleted with confirmation.
- [x] Care medication records can be opened and edited.
- [x] Care medication records can be deleted with confirmation.
- [x] Today dashboard shows completion, attention signals, care summary, recent timeline, and quick actions.
```

- [ ] **Step 4: Run docs-only verification**

Run:

```bash
npm run verify:i18n
npm run verify:architecture
```

Expected: both commands exit successfully.

## Task 2: Week 1 Smoke Test And Fix Queue

**Files:**
- Modify only if needed: `apps/mobile/src/**`
- Modify only if needed: `docs/exec-plans/active/0003-weekly-execution-checklist.md`

- [ ] **Step 1: Start app for interactive QA**

Run one of the following depending on the available environment:

```bash
npm run mobile:ios
```

If iOS simulator is unavailable, run:

```bash
npm run mobile:web
```

Expected: the app loads to the Today workflow after login.

- [ ] **Step 2: Verify auth and pet profile**

Manual test path:

```text
1. Log in with the existing test account.
2. Open pet profile.
3. Edit name, species, weight, and one routine value.
4. Save.
5. Reload the app.
6. Confirm the active pet and edited profile values remain.
```

Checklist result:

```markdown
- [x] Expo dev 화면에서 로그인 상태를 확인한다.
- [x] 반려동물 생성, 선택, 수정이 정상 동작하는지 확인한다.
```

- [ ] **Step 3: Verify Today, Diary, Care, Reports paths**

Manual test path:

```text
1. Save food, water, stool, condition, and memo from Diary.
2. Open the selected date list and edit one entry time/value.
3. Delete one non-critical test entry.
4. Open Care.
5. Add quick medication dose with time, medication, dosage, administered amount, and reaction.
6. Edit the medication dose.
7. Delete the medication dose.
8. Open Today and confirm checklist/timeline changed.
9. Open Reports and confirm draft summary is based on the actual records.
```

Checklist result:

```markdown
- [x] Today checklist 기록이 DB에 저장되고 reload 후 유지되는지 확인한다.
- [x] Diary 저장 후 Today timeline과 Diary 목록에 반영되는지 확인한다.
- [x] Care quick dose 추가와 상태 변경이 DB에 저장되는지 확인한다.
- [x] Reports draft가 실제 기록 기반으로 표시되는지 확인한다.
```

- [ ] **Step 4: Fix failures immediately**

If a failure appears, create a small focused patch and add or update the nearest test. Examples:

```bash
npm --prefix apps/mobile run typecheck
npm run verify
```

Expected: no TypeScript, architecture, i18n, secret, Supabase, or offline verification failures.

## Task 3: Save Feedback Visibility Pass

**Files:**
- Modify: `apps/mobile/src/presentation/shell/SaveFeedbackBar.tsx`
- Modify: `apps/mobile/src/presentation/shell/saveFeedback.ts`
- Modify: `apps/mobile/src/presentation/shell/saveFeedback.test.ts`
- Modify: `apps/mobile/src/i18n/translations.ts`

- [ ] **Step 1: Inspect current feedback behavior**

Run:

```bash
sed -n '1,220p' apps/mobile/src/presentation/shell/SaveFeedbackBar.tsx
sed -n '1,220p' apps/mobile/src/presentation/shell/saveFeedback.ts
sed -n '1,220p' apps/mobile/src/presentation/shell/saveFeedback.test.ts
```

Expected: feedback has a clear title, message, and dismissal/auto-clear behavior.

- [ ] **Step 2: Add failing expectations if missing**

If `saveFeedback.test.ts` does not assert category-specific titles, add expectations for:

```ts
expect(createSaveFeedback("diary").title).toBe("다이어리 저장 완료");
expect(createSaveFeedback("medication").title).toBe("투약 기록 저장 완료");
expect(createSaveFeedback("routine").title).toBe("기본 루틴 저장 완료");
expect(createSaveFeedback("petProfile").title).toBe("프로필 저장 완료");
```

Run:

```bash
npm --prefix apps/mobile run typecheck
```

Expected: fail only if the current feedback API lacks these cases.

- [ ] **Step 3: Strengthen the visual component only if QA shows it is weak**

Keep the component as a single global confirmation surface. Use existing tokens:

```tsx
<View style={styles.container} accessibilityRole="status">
  <View style={styles.iconCircle}>
    <AppIcon name="check" size={iconSize.md} color={colors.surface} />
  </View>
  <View style={styles.copy}>
    <Text style={styles.title}>{feedback.title}</Text>
    <Text style={styles.message}>{feedback.message}</Text>
  </View>
</View>
```

Design constraints:

```text
- Minimum height: 68
- Position: near top of active app content, not hidden below bottom nav
- Color: high-contrast success treatment, not low-contrast caption text
- Text: title + one short message
- Accessibility: status role if supported by React Native target
```

- [ ] **Step 4: Re-run targeted verification**

Run:

```bash
npm --prefix apps/mobile run typecheck
npm run verify:i18n
```

Expected: both pass.

## Task 4: Care Plan Domain Hardening

**Files:**
- Modify: `apps/mobile/src/contexts/care/domain/carePlan.ts`
- Modify: `apps/mobile/src/contexts/care/application/carePlanRecords.ts`
- Modify: `apps/mobile/src/contexts/care/application/carePlanRecords.test.ts`

- [ ] **Step 1: Add domain fields for active plan context**

Update the domain to expose the condition and plan metadata that Care Mode needs:

```ts
export type CareConditionStatus = "active" | "resolved" | "archived";

export type ActiveCareCondition = {
  id: UUID;
  name: string;
  status: CareConditionStatus;
  startsOn?: string;
};

export type ActiveCarePlanSummary = {
  id: UUID;
  title: string;
  instructions?: string;
  startsOn?: string;
};

export type ActiveCareSetup = {
  condition?: ActiveCareCondition;
  plan?: ActiveCarePlanSummary;
  conditionName?: string;
  planTitle?: string;
  instructions?: string;
  schedules: CareMedicationSchedule[];
};
```

Keep `conditionName`, `planTitle`, and `instructions` temporarily for existing UI compatibility.

- [ ] **Step 2: Test mapper behavior**

Expose a pure mapper from `carePlanRecords.ts`:

```ts
export function mapCareSetupForTest(
  conditions: ConditionRow[],
  plans: CarePlanRow[],
  medications: MedicationRow[],
  schedules: ScheduleRow[],
): ActiveCareSetup {
  return mapCareSetup(conditions, plans, medications, schedules);
}
```

Add a test that checks:

```ts
const setup = mapCareSetupForTest([condition], [plan], [medication], [schedule]);
expect(setup.condition?.name).toBe("구토");
expect(setup.condition?.status).toBe("active");
expect(setup.plan?.title).toBe("위장 케어");
expect(setup.schedules[0]?.medicationName).toBe("Cerenia");
expect(setup.schedules[0]?.localTime).toBe("08:00:00");
```

- [ ] **Step 3: Keep local time normalization safe**

Export a pure helper:

```ts
export function normalizeCareLocalTime(value: string) {
  const [hour = "08", minute = "00"] = value.split(":");
  return `${hour.padStart(2, "0").slice(0, 2)}:${minute.padStart(2, "0").slice(0, 2)}:00`;
}
```

Add tests:

```ts
expect(normalizeCareLocalTime("8:5")).toBe("08:05:00");
expect(normalizeCareLocalTime("")).toBe("08:00:00");
```

- [ ] **Step 4: Run targeted checks**

Run:

```bash
npm --prefix apps/mobile run typecheck
```

Expected: pass.

## Task 5: Care Setup UI Product Pass

**Files:**
- Modify: `apps/mobile/src/presentation/screens/CareSetupPanel.tsx`
- Modify: `apps/mobile/src/presentation/screens/CareModeScreen.tsx`
- Modify: `apps/mobile/src/i18n/translations.ts`

- [ ] **Step 1: Show active care context before inputs**

In `CareSetupPanel`, show a compact active context block when `setup.condition` or `setup.plan` exists:

```tsx
{setup.condition || setup.plan ? (
  <View style={styles.activeBox}>
    <Text style={styles.activeTitle}>{setup.plan?.title ?? setup.condition?.name}</Text>
    <Text style={styles.activeMeta}>{setup.condition?.name ?? t("ko", "care.noConditionLinked")}</Text>
  </View>
) : null}
```

- [ ] **Step 2: Prevent empty care setup saves**

In `CareSetupPanel`, add local validation:

```ts
const canSave = conditionName.trim() || planTitle.trim() || medicationName.trim();
if (!canSave) {
  setLocalError(t("ko", "care.setupRequired"));
  return;
}
```

Add Korean and English strings:

```ts
"care.setupRequired": "병명, 케어 플랜명, 약 이름 중 하나는 입력해 주세요."
```

- [ ] **Step 3: Label schedule-derived quick dose clearly**

When a saved schedule is tapped, the quick dose form should be populated and the user should see that it is today's editable record, not a permanent prescription change. Use copy like:

```ts
"care.useToday": "오늘 기록으로 불러오기"
"care.setupCopy": "상태명, 약, 용량, 시간을 저장해 두고 오늘 기록에 불러옵니다. 오늘 투약량과 반응은 별도로 수정할 수 있어요."
```

- [ ] **Step 4: Run UI typecheck and i18n verification**

Run:

```bash
npm --prefix apps/mobile run typecheck
npm run verify:i18n
```

Expected: both pass.

## Task 6: Security, RLS, And Secret Checkpoint

**Files:**
- Modify only if needed: `scripts/verify-supabase.mjs`
- Modify only if needed: `scripts/verify-secrets.mjs`
- Modify only if needed: `docs/exec-plans/active/0003-weekly-execution-checklist.md`

- [ ] **Step 1: Run repository verification**

Run:

```bash
npm run verify
```

Expected:

```text
verify:supabase passes
verify:secrets passes
verify:offline passes
```

- [ ] **Step 2: If Supabase verification fails, inspect whether schema or script is stale**

Run:

```bash
sed -n '1,260p' scripts/verify-supabase.mjs
```

Only patch the script if the database is already correct and the script is checking an obsolete table/column. If RLS or grants are actually missing, add a migration instead of weakening the verifier.

- [ ] **Step 3: Mark Week 1 checkpoint**

When verification passes, update:

```markdown
### Day 7: Week 1 보안/RLS checkpoint

- [x] public table 전체에 RLS와 explicit GRANT가 유지되는지 확인한다.
- [x] pet membership 기준 조회/insert/update 권한이 의도대로 동작하는지 확인한다.
- [x] 앱 bundle에 service role, OpenAI key, Supabase access token이 들어가지 않는지 확인한다.
- [x] Supabase smoke test를 publishable key 기준으로 다시 실행한다.
- [x] `npm run verify`를 실행한다.
```

## Task 7: Commit And Push

**Files:**
- All modified files from Tasks 1-6

- [ ] **Step 1: Inspect diff**

Run:

```bash
git diff --stat
git diff -- docs/exec-plans/active/0003-weekly-execution-checklist.md
git diff -- apps/mobile/src/contexts/care apps/mobile/src/presentation/screens/CareSetupPanel.tsx apps/mobile/src/presentation/screens/CareModeScreen.tsx apps/mobile/src/i18n/translations.ts
```

Expected: only today’s intended docs, care, feedback, i18n, and small verification fixes appear.

- [ ] **Step 2: Final verification**

Run:

```bash
npm run verify
```

Expected: pass.

- [ ] **Step 3: Commit**

Run:

```bash
git add docs/exec-plans/active/0003-weekly-execution-checklist.md docs/superpowers/plans/2026-06-30-week1-smoke-care-plan.md apps/mobile/src/contexts/care apps/mobile/src/presentation/screens/CareSetupPanel.tsx apps/mobile/src/presentation/screens/CareModeScreen.tsx apps/mobile/src/presentation/shell apps/mobile/src/i18n/translations.ts scripts
git commit -m "feat: stabilize care plan setup flow"
```

- [ ] **Step 4: Push**

Run:

```bash
git push
```

Expected: `codex/routine-diary-care-defaults` updates on origin.

## Stretch Task: Medication Schedule Split

Only do this today if Tasks 1-7 pass quickly and the Care setup UI still feels too tightly coupled.

**Files:**
- Create: `apps/mobile/src/contexts/medication/domain/medicationSchedule.ts`
- Create: `apps/mobile/src/contexts/medication/application/medicationScheduleRecords.ts`
- Modify: `apps/mobile/src/contexts/care/application/carePlanRecords.ts`
- Modify: `apps/mobile/src/presentation/screens/CareSetupPanel.tsx`

- [ ] Move medication schedule types and schedule query/mutation out of `contexts/care` only if it reduces coupling without changing behavior.
- [ ] Keep the existing UI behavior identical.
- [ ] Add typecheck coverage.
- [ ] Run `npm run verify`.

## Self-Review

- Spec coverage: Week 1 smoke test, save feedback visibility, RLS/secret verification, and Week 2 Day 8 care plan setup are covered. Offline replay, caregiver invite, and full medication schedule separation are intentionally not primary work today.
- Placeholder scan: no task depends on undefined files. The stretch task is explicitly optional and gated after final verification.
- Type consistency: `ActiveCareSetup`, `CareMedicationSchedule`, and `CareSetupInput` remain compatible with existing UI while adding richer active condition/plan metadata.
