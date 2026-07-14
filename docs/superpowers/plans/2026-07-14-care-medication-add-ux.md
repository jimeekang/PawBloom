# 케어 탭 약 추가 UX (A안) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 케어 탭에서 중복 노출되던 케어 플랜 폼을 제거하고, 단일 "+ 약 추가" 진입점이 오늘만/며칠간/매일로 분기하는 UX로 재구성하며, 감사에서 나온 레이아웃 교정 10건을 반영한다.

**Architecture:** "오늘만"은 기존 `QuickMedicationForm`(medication/ui), "며칠간"은 신규 `ShortTermMedicationForm`(care/ui, 기존 케어 플랜 저장 파이프라인 재사용), 래퍼 `CareMedicationAddCard`는 presentation 레이어에서 두 컨텍스트를 조합한다. `CareSetupPanel`은 삭제하고 정적 가드를 새 구조에 맞게 갱신한다.

**Tech Stack:** React Native (Expo), TypeScript, 자체 디자인 시스템 토큰, throw-스타일 프레젠테이션 테스트 (`scripts/verify-presentation-state.mjs`가 수집·실행).

**Spec:** `docs/superpowers/specs/2026-07-14-care-medication-add-ux-design.md`

## Global Constraints

- `t()` 호출은 코드베이스 관례대로 항상 리터럴 `"ko"`를 첫 인자로 쓴다 (첫 인자는 사실상 무시되는 죽은 인자지만 관례를 따른다).
- 모든 i18n 키는 en/ko 두 블록에 모두 있어야 한다 — `npm run verify:i18n`이 패리티를 검사한다.
- **입력 필드는 세로 스택 유지** (390px 클리핑 가드). 짧은 고정 라벨 버튼(먹였어요/못 먹였어요)만 row 허용. 가드: `scripts/verify-presentation-state.mjs`.
- DDD import 규칙 (`npm run verify:architecture`): 컨텍스트 간 import 금지 (application→application, ui의 type-only domain import만 예외). 컨텍스트 조합은 presentation에서. presentation은 context infrastructure를 import할 수 없다.
- 테스트는 jest가 아니라 **throw-스타일 일반 TS 파일** (`*.test.ts`/`*.test.tsx`). 단일 실행: `node scripts/run-presentation-test.mjs <repo-relative-path>`. 전체: `npm run verify:presentation`.
- `docs/design/DESIGN_QA.md`는 `edit_policy: exclusive` (다른 모델 소유) — **절대 수정하지 않는다.**
- 타입체크: `npm run typecheck`. 커밋은 태스크마다.
- 모든 경로는 리포 루트(`/Users/jimee/Desktop/Project/PawBloom/.claude/worktrees/mobile-design-system-7b4895`) 기준.

---

### Task 1: i18n 키 추가 및 값 변경

**Files:**
- Modify: `apps/mobile/src/i18n/translations.ts`

**Interfaces:**
- Produces: `TranslationKey`에 아래 신규 키 14개가 추가됨. 이후 태스크들이 이 키를 사용한다.

- [x] **Step 1: en 블록에 신규 키 추가**

`"care.conditionLabel": ...`으로 시작하는 en 블록의 care 키 라인(약 31행) 끝에 이어서 추가:

```ts
    "care.addMedication": "Add medication", "care.addScope.today": "Today only", "care.addScope.short": "A few days", "care.addScope.daily": "Every day", "care.addDailyHint": "Medicines taken every day are managed in the profile's care defaults, so reminders and reports stay in one place.", "care.addDailyManage": "Manage in profile", "care.shortTermTitle": "Short-term medication", "care.shortTermEndDate": "End date", "care.shortTermPeriodInvalid": "Choose an end date on or after the start date.", "care.shortTermSave": "Save medication course", "care.scheduleUntil": "until {date}", "care.scheduleMore": "Show {count} more", "care.manageRoutineInProfile": "Daily routines are managed in the profile →", "care.editShort": "Edit", "care.removeTimeA11y": "Remove medication time",
```

- [x] **Step 2: ko 블록에 같은 키 추가**

ko 블록의 `"care.conditionLabel": ...` 라인(약 84행) 끝에 이어서 추가:

```ts
    "care.addMedication": "약 추가", "care.addScope.today": "오늘만", "care.addScope.short": "며칠간", "care.addScope.daily": "매일", "care.addDailyHint": "매일 먹는 약은 프로필의 케어 기본값에서 관리해요. 알림과 리포트가 한곳에서 이어집니다.", "care.addDailyManage": "프로필에서 관리하기", "care.shortTermTitle": "며칠간 복용약", "care.shortTermEndDate": "종료일", "care.shortTermPeriodInvalid": "종료일은 시작일과 같거나 이후로 선택해 주세요.", "care.shortTermSave": "복용 일정 저장", "care.scheduleUntil": "~{date}까지", "care.scheduleMore": "외 {count}개 더 보기", "care.manageRoutineInProfile": "매일 반복 루틴은 프로필에서 관리해요 →", "care.editShort": "수정", "care.removeTimeA11y": "복용 시간 삭제",
```

- [x] **Step 3: 기존 키 값 변경 (키 이름은 유지, en/ko 양쪽)**

| 키 | en 새 값 | ko 새 값 |
| --- | --- | --- |
| `care.quickDoseTitle` | `Today's medication record` | `오늘 투약 기록` |
| `care.temporaryMedicationLabel` | `Added today` | `오늘 추가한 약` |
| `care.scheduleSummaryCopy` | `Saved medicines appear here after you add one or save a profile routine.` | `약을 추가하거나 프로필 루틴을 저장하면 여기에 표시됩니다.` |

- [x] **Step 4: 검증**

Run: `npm run verify:i18n`
Expected: `i18n verification passed (N keys).` (en/ko 동수)

Run: `npm run typecheck`
Expected: 에러 없음

- [x] **Step 5: Commit**

```bash
git add apps/mobile/src/i18n/translations.ts
git commit -m "feat(i18n): add care medication-add scope keys, retire temporary wording"
```

---

### Task 2: 며칠간 복용약 폼 로직 (TDD)

> **실행 중 변경:** macOS 대소문자 무시 파일시스템에서 `shortTermMedicationForm.ts`가 Task 3의 `ShortTermMedicationForm.tsx`와 케이스 충돌(TS1149)을 일으켜, 로직 모듈은 `shortTermMedicationDraft.ts`(테스트 포함)로 리네임됨. 아래 본문의 원래 파일명은 이 이름으로 읽을 것.

**Files:**
- Create: `apps/mobile/src/contexts/care/ui/shortTermMedicationDraft.ts`
- Test: `apps/mobile/src/contexts/care/ui/shortTermMedicationDraft.test.ts`

**Interfaces:**
- Consumes: `CareSetupInput` (`../domain/carePlan`), `TranslationKey` (`../../../i18n/translations`), Task 1의 `care.shortTermPeriodInvalid` 키.
- Produces (Task 3, 6이 사용):
  - `type ShortTermMedicationDraft = { conditionName: string; medicationName: string; dosageLabel: string; times: string[]; startsOn: string; endsOn: string }`
  - `SHORT_TERM_DEFAULT_DURATION_DAYS: 7`
  - `addDaysToDateKey(dateKey: string, days: number): string`
  - `createShortTermMedicationDraft(todayKey: string): ShortTermMedicationDraft`
  - `shortTermDraftErrorKey(draft: ShortTermMedicationDraft): TranslationKey | null`
  - `buildShortTermCareSetupInput(draft: ShortTermMedicationDraft): CareSetupInput`

**배경 (구현자 주의):** `CareSetupInput`에 `medicationId`/`scheduleIds`를 **넣지 않으면** 영속 계층(`carePlanPersistence.ts`)이 새 medication + schedule 행을 만들고 기존 스케줄은 그대로 둔다 (프로필의 "+새 약" 흐름이 이미 이 경로를 사용). 며칠간 폼은 항상 이 additive 경로를 타야 하므로 id 필드를 절대 채우지 않는다.

- [x] **Step 1: 실패하는 테스트 작성**

`apps/mobile/src/contexts/care/ui/shortTermMedicationForm.test.ts`:

```ts
import { SHORT_TERM_DEFAULT_DURATION_DAYS, addDaysToDateKey, buildShortTermCareSetupInput, createShortTermMedicationDraft, shortTermDraftErrorKey } from "./shortTermMedicationForm";

if (addDaysToDateKey("2026-07-14", 7) !== "2026-07-21") throw new Error("addDaysToDateKey must add days within a month");
if (addDaysToDateKey("2026-07-28", 7) !== "2026-08-04") throw new Error("addDaysToDateKey must roll over month ends");
if (addDaysToDateKey("2026-12-30", 7) !== "2027-01-06") throw new Error("addDaysToDateKey must roll over year ends");

const draft = createShortTermMedicationDraft("2026-07-14");
if (draft.startsOn !== "2026-07-14") throw new Error("short-term draft must start on the provided day");
if (draft.endsOn !== addDaysToDateKey("2026-07-14", SHORT_TERM_DEFAULT_DURATION_DAYS)) throw new Error("short-term draft must default to a 7-day course");
if (draft.times.length !== 1 || draft.times[0] !== "08:00") throw new Error("short-term draft must start with one 08:00 dose time");

if (shortTermDraftErrorKey(draft) !== "care.quickDoseMedicationRequired") throw new Error("empty medication name must be rejected");
const named = { ...draft, medicationName: "Amoxicillin" };
if (shortTermDraftErrorKey(named) !== null) throw new Error("valid draft must pass validation");
if (shortTermDraftErrorKey({ ...named, endsOn: "2026-07-13" }) !== "care.shortTermPeriodInvalid") throw new Error("end date before start must be rejected");
if (shortTermDraftErrorKey({ ...named, endsOn: named.startsOn }) !== null) throw new Error("single-day course must be allowed");

const input = buildShortTermCareSetupInput({ ...named, conditionName: " 기침 ", dosageLabel: " 1정 ", times: ["08:00", "20:00"] });
if (input.medicationId !== undefined || input.scheduleIds !== undefined || input.conditionId !== undefined || input.planId !== undefined) {
  throw new Error("short-term input must create new records instead of editing existing ones");
}
if (input.endsOn !== named.endsOn || input.startsOn !== named.startsOn) throw new Error("short-term input must keep the course period");
if (input.localTime !== "08:00" || input.localTimes?.length !== 2) throw new Error("short-term input must carry all dose times");
if (input.conditionName !== "기침" || input.dosageLabel !== "1정" || input.planTitle !== "") throw new Error("short-term input must trim text fields and skip plan title");
if (input.recurrenceIntervalDays !== 1) throw new Error("short-term course must repeat daily");
```

- [x] **Step 2: 실패 확인**

Run: `node scripts/run-presentation-test.mjs apps/mobile/src/contexts/care/ui/shortTermMedicationForm.test.ts`
Expected: FAIL — `Cannot find module './shortTermMedicationForm'`

- [x] **Step 3: 구현**

`apps/mobile/src/contexts/care/ui/shortTermMedicationForm.ts`:

```ts
import type { TranslationKey } from "../../../i18n/translations";
import type { CareSetupInput } from "../domain/carePlan";

export type ShortTermMedicationDraft = {
  conditionName: string;
  medicationName: string;
  dosageLabel: string;
  times: string[];
  startsOn: string;
  endsOn: string;
};

export const SHORT_TERM_DEFAULT_DURATION_DAYS = 7;

export function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + days);
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
}

export function createShortTermMedicationDraft(todayKey: string): ShortTermMedicationDraft {
  return {
    conditionName: "",
    medicationName: "",
    dosageLabel: "",
    times: ["08:00"],
    startsOn: todayKey,
    endsOn: addDaysToDateKey(todayKey, SHORT_TERM_DEFAULT_DURATION_DAYS),
  };
}

export function shortTermDraftErrorKey(draft: ShortTermMedicationDraft): TranslationKey | null {
  if (!draft.medicationName.trim()) return "care.quickDoseMedicationRequired";
  if (!draft.endsOn || draft.endsOn < draft.startsOn) return "care.shortTermPeriodInvalid";
  return null;
}

export function buildShortTermCareSetupInput(draft: ShortTermMedicationDraft): CareSetupInput {
  return {
    conditionName: draft.conditionName.trim(),
    planTitle: "",
    medicationName: draft.medicationName.trim(),
    dosageLabel: draft.dosageLabel.trim(),
    localTime: draft.times[0] ?? "08:00",
    localTimes: draft.times,
    startsOn: draft.startsOn,
    endsOn: draft.endsOn,
    recurrenceIntervalDays: 1,
  };
}
```

- [x] **Step 4: 통과 확인**

Run: `node scripts/run-presentation-test.mjs apps/mobile/src/contexts/care/ui/shortTermMedicationForm.test.ts`
Expected: exit 0, 출력 없음

- [x] **Step 5: Commit**

```bash
git add apps/mobile/src/contexts/care/ui/shortTermMedicationForm.ts apps/mobile/src/contexts/care/ui/shortTermMedicationForm.test.ts
git commit -m "feat(care): add short-term medication draft logic"
```

---

### Task 3: ShortTermMedicationForm 컴포넌트

**Files:**
- Create: `apps/mobile/src/contexts/care/ui/ShortTermMedicationForm.tsx`
- Test: `apps/mobile/src/contexts/care/ui/ShortTermMedicationForm.test.tsx`

**Interfaces:**
- Consumes: Task 2의 로직 함수들, `DatePickerField`/`TimePickerField`/`PrimaryButton` (design-system), `getLocalDateKey` (shared-kernel).
- Produces (Task 4가 사용): `ShortTermMedicationForm({ onSave, onSaved }: { onSave: (input: CareSetupInput) => Promise<ActiveCareSetup>; onSaved?: () => void })` — SurfaceCard 래핑 없음(호출측이 카드 안에 배치).

**레이아웃 주의:** 입력 필드는 전부 세로 스택. `timeRow`(시간 피커 + 44px 삭제 버튼)만 row — `ProfileCareDefaultsPanel`에서 이미 승인된 패턴과 동일. `panel` 스타일에 `flexDirection: "row"`를 절대 넣지 않는다 (Task 6에서 이 파일에 정적 가드가 걸린다). 에러 텍스트는 `colors.danger` (교정 #6 — coral 금지).

- [x] **Step 1: 타입 레벨 테스트 작성**

`apps/mobile/src/contexts/care/ui/ShortTermMedicationForm.test.tsx`:

```tsx
import type { ComponentProps } from "react";
import { ShortTermMedicationForm } from "./ShortTermMedicationForm";
import type { ActiveCareSetup } from "../domain/carePlan";

const emptySetup: ActiveCareSetup = { conditions: [], plans: [], schedules: [] };
const props: ComponentProps<typeof ShortTermMedicationForm> = {
  onSave: async () => emptySetup,
  onSaved: () => undefined,
};
const withoutOnSaved: ComponentProps<typeof ShortTermMedicationForm> = {
  onSave: async () => emptySetup,
};
void props;
void withoutOnSaved;
```

- [x] **Step 2: 실패 확인**

Run: `node scripts/run-presentation-test.mjs apps/mobile/src/contexts/care/ui/ShortTermMedicationForm.test.tsx`
Expected: FAIL — `Cannot find module './ShortTermMedicationForm'`

- [x] **Step 3: 구현**

`apps/mobile/src/contexts/care/ui/ShortTermMedicationForm.tsx`:

```tsx
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { ActiveCareSetup, CareSetupInput } from "../domain/carePlan";
import { PrimaryButton } from "../../../design-system/components";
import { colors, layout, radius, spacing, type } from "../../../design-system/tokens";
import { t } from "../../../i18n/translations";
import { DatePickerField } from "../../../design-system/DatePickerField";
import { TimePickerField } from "../../../design-system/TimePickerField";
import { getLocalDateKey } from "../../../shared-kernel/date";
import { buildShortTermCareSetupInput, createShortTermMedicationDraft, shortTermDraftErrorKey } from "./shortTermMedicationForm";

export function ShortTermMedicationForm({ onSave, onSaved }: { onSave: (input: CareSetupInput) => Promise<ActiveCareSetup>; onSaved?: () => void }) {
  const [draft, setDraft] = useState(() => createShortTermMedicationDraft(getLocalDateKey()));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  async function save() {
    if (savingRef.current) return;
    const errorKey = shortTermDraftErrorKey(draft);
    if (errorKey) {
      setError(t("ko", errorKey));
      return;
    }
    savingRef.current = true;
    setIsSaving(true);
    setError(null);
    try {
      await onSave(buildShortTermCareSetupInput(draft));
      setDraft(createShortTermMedicationDraft(getLocalDateKey()));
      onSaved?.();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t("ko", "care.setupSaveFailed"));
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{t("ko", "care.shortTermTitle")}</Text>
      <TextInput style={styles.input} value={draft.conditionName} onChangeText={(value) => setDraft((current) => ({ ...current, conditionName: value.slice(0, 80) }))} placeholder={t("ko", "care.conditionPlaceholder")} placeholderTextColor={colors.textSoft} />
      <TextInput style={styles.input} value={draft.medicationName} onChangeText={(value) => setDraft((current) => ({ ...current, medicationName: value.slice(0, 80) }))} placeholder={t("ko", "care.medicationPlaceholder")} placeholderTextColor={colors.textSoft} />
      <TextInput style={styles.input} value={draft.dosageLabel} onChangeText={(value) => setDraft((current) => ({ ...current, dosageLabel: value.slice(0, 80) }))} placeholder={t("ko", "care.dosagePlaceholder")} placeholderTextColor={colors.textSoft} />
      {draft.times.map((time, index) => (
        <View key={index} style={styles.timeRow}>
          <View style={styles.timeField}>
            <TimePickerField value={time} onChange={(nextTime) => setDraft((current) => ({ ...current, times: current.times.map((item, itemIndex) => (itemIndex === index ? nextTime : item)) }))} />
          </View>
          {draft.times.length > 1 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("ko", "care.removeTimeA11y")}
              style={styles.removeTimeButton}
              onPress={isSaving ? undefined : () => setDraft((current) => ({ ...current, times: current.times.filter((_, itemIndex) => itemIndex !== index) }))}
            >
              <Text style={styles.removeTimeText}>×</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      <Pressable accessibilityRole="button" style={styles.addTimeButton} onPress={isSaving ? undefined : () => setDraft((current) => ({ ...current, times: [...current.times, "20:00"] }))}>
        <Text style={styles.addTimeText}>{t("ko", "pet.careDefaultsTimeAdd")}</Text>
      </Pressable>
      <Text style={styles.label}>{t("ko", "care.setupPeriod")}</Text>
      <DatePickerField value={draft.startsOn} onChange={(startsOn) => setDraft((current) => ({ ...current, startsOn }))} placeholder={t("ko", "care.setupStartDate")} />
      <DatePickerField value={draft.endsOn} onChange={(endsOn) => setDraft((current) => ({ ...current, endsOn }))} placeholder={t("ko", "care.shortTermEndDate")} />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <PrimaryButton label={t("ko", "care.shortTermSave")} icon="medication" onPress={isSaving ? undefined : () => void save()} disabled={isSaving} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing.md },
  title: { ...type.sectionTitle },
  label: { ...type.caption, color: colors.textMuted },
  input: { ...type.body, minHeight: layout.inputHeight, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  timeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  timeField: { flex: 1 },
  removeTimeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  removeTimeText: { ...type.sectionTitle, color: colors.textMuted },
  addTimeButton: { minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  addTimeText: { ...type.bodyStrong, color: colors.orangeDeep },
  errorText: { ...type.caption, color: colors.danger },
});
```

- [x] **Step 4: 통과 확인 + 타입체크**

Run: `node scripts/run-presentation-test.mjs apps/mobile/src/contexts/care/ui/ShortTermMedicationForm.test.tsx`
Expected: exit 0

Run: `npm run typecheck`
Expected: 에러 없음

- [x] **Step 5: Commit**

```bash
git add apps/mobile/src/contexts/care/ui/ShortTermMedicationForm.tsx apps/mobile/src/contexts/care/ui/ShortTermMedicationForm.test.tsx
git commit -m "feat(care): add short-term medication form component"
```

---

### Task 4: QuickMedicationForm 카드 언랩 + CareMedicationAddCard 생성

**Files:**
- Modify: `apps/mobile/src/contexts/medication/ui/CareMedicationPanel.tsx` (QuickMedicationForm의 SurfaceCard 래핑 제거)
- Modify: `apps/mobile/src/presentation/screens/CareModeScreen.tsx:145` (기존 호출부를 SurfaceCard로 감싸 시각 동일 유지)
- Create: `apps/mobile/src/presentation/screens/CareMedicationAddCard.tsx`
- Test: `apps/mobile/src/presentation/screens/CareMedicationAddCard.test.tsx`

**Interfaces:**
- Consumes: `QuickMedicationForm`, `QuickMedicationSaveHandler` (medication/ui), `ShortTermMedicationForm` (Task 3), `CareSetupInput`/`ActiveCareSetup` (care/domain).
- Produces (Task 6이 사용): `CareMedicationAddCard({ petId, onAddDose, onSaveCareSetup, onOpenProfileCare, onSaved })` — `petId: string`, `onAddDose: QuickMedicationSaveHandler`, `onSaveCareSetup: (input: CareSetupInput) => Promise<ActiveCareSetup>`, `onOpenProfileCare: () => void`, `onSaved: () => void`.
- QuickMedicationForm은 이 태스크부터 **SurfaceCard 없이** 렌더된다 (호출측 래핑 책임).

- [x] **Step 1: QuickMedicationForm 언랩**

`CareMedicationPanel.tsx`의 `QuickMedicationForm` return을 다음으로 변경 (기존 `<SurfaceCard><View style={styles.quickForm}>` → `<View style={styles.quickForm}>`, 닫는 태그도 대응):

변경 전:
```tsx
  return (
    <SurfaceCard>
      <View style={styles.quickForm}>
        ...
      </View>
    </SurfaceCard>
  );
```
변경 후:
```tsx
  return (
    <View style={styles.quickForm}>
      ...
    </View>
  );
```

같은 파일 import에서 `SurfaceCard` 제거 (이 파일에서 다른 사용처 없음):
```ts
import { NoticeBanner, PrimaryButton, SecondaryButton, SegmentedControl } from "../../../design-system/components";
```

- [x] **Step 2: 기존 호출부 시각 유지**

`CareModeScreen.tsx:145`를 SurfaceCard로 감싼다 (SurfaceCard는 이미 import되어 있음):

```tsx
      {temporaryFormOpen || editingDose ? (
        <SurfaceCard>
          <QuickMedicationForm onSave={onAddDose} editingDose={editingDose} onUpdate={onUpdateDose} onDelete={onDeleteDose} onCancelEdit={() => setEditingDoseId(null)} canDelete={canDeleteDose} />
        </SurfaceCard>
      ) : null}
```

- [x] **Step 3: 타입 레벨 테스트 작성**

`apps/mobile/src/presentation/screens/CareMedicationAddCard.test.tsx`:

```tsx
import type { ComponentProps } from "react";
import { CareMedicationAddCard } from "./CareMedicationAddCard";
import type { ActiveCareSetup } from "../../contexts/care/domain/carePlan";

const emptySetup: ActiveCareSetup = { conditions: [], plans: [], schedules: [] };
const props: ComponentProps<typeof CareMedicationAddCard> = {
  petId: "pet-1",
  onAddDose: async () => undefined,
  onSaveCareSetup: async () => emptySetup,
  onOpenProfileCare: () => undefined,
  onSaved: () => undefined,
};
void props;
```

- [x] **Step 4: 실패 확인**

Run: `node scripts/run-presentation-test.mjs apps/mobile/src/presentation/screens/CareMedicationAddCard.test.tsx`
Expected: FAIL — `Cannot find module './CareMedicationAddCard'`

- [x] **Step 5: 구현**

`apps/mobile/src/presentation/screens/CareMedicationAddCard.tsx`:

```tsx
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ActiveCareSetup, CareSetupInput } from "../../contexts/care/domain/carePlan";
import { SecondaryButton, SegmentedControl, SurfaceCard } from "../../design-system/components";
import { colors, spacing, type } from "../../design-system/tokens";
import { t } from "../../i18n/translations";
import { QuickMedicationForm, type QuickMedicationSaveHandler } from "../../contexts/medication/ui/CareMedicationPanel";
import { ShortTermMedicationForm } from "../../contexts/care/ui/ShortTermMedicationForm";

type AddScope = "today" | "short" | "daily";

export function CareMedicationAddCard({
  petId,
  onAddDose,
  onSaveCareSetup,
  onOpenProfileCare,
  onSaved,
}: {
  petId: string;
  onAddDose: QuickMedicationSaveHandler;
  onSaveCareSetup: (input: CareSetupInput) => Promise<ActiveCareSetup>;
  onOpenProfileCare: () => void;
  onSaved: () => void;
}) {
  const [scope, setScope] = useState<AddScope>("today");

  return (
    <SurfaceCard>
      <View style={styles.card}>
        <SegmentedControl
          value={scope}
          onChange={setScope}
          items={[
            { label: t("ko", "care.addScope.today"), value: "today" },
            { label: t("ko", "care.addScope.short"), value: "short" },
            { label: t("ko", "care.addScope.daily"), value: "daily" },
          ]}
        />
        {scope === "today" ? <QuickMedicationForm onSave={onAddDose} /> : null}
        {scope === "short" ? <ShortTermMedicationForm key={petId} onSave={onSaveCareSetup} onSaved={onSaved} /> : null}
        {scope === "daily" ? (
          <View style={styles.dailyBox}>
            <Text style={styles.dailyHint}>{t("ko", "care.addDailyHint")}</Text>
            <SecondaryButton label={t("ko", "care.addDailyManage")} onPress={onOpenProfileCare} />
          </View>
        ) : null}
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  dailyBox: { gap: spacing.md },
  dailyHint: { ...type.body, color: colors.textMuted },
});
```

`key={petId}`는 펫 전환 시 며칠간 폼 draft를 리셋하기 위한 remount 키다.

- [x] **Step 6: 통과 확인 + 전체 검증**

Run: `node scripts/run-presentation-test.mjs apps/mobile/src/presentation/screens/CareMedicationAddCard.test.tsx`
Expected: exit 0

Run: `npm run typecheck && npm run verify:presentation`
Expected: 모두 통과 (CareMedicationAddCard는 아직 어디서도 렌더되지 않음 — Task 6에서 배선)

- [x] **Step 7: Commit**

```bash
git add apps/mobile/src/contexts/medication/ui/CareMedicationPanel.tsx apps/mobile/src/presentation/screens/CareModeScreen.tsx apps/mobile/src/presentation/screens/CareMedicationAddCard.tsx apps/mobile/src/presentation/screens/CareMedicationAddCard.test.tsx
git commit -m "feat(care): add medication add card with scope branches"
```

---

### Task 5: CareModeScreen 레이아웃 교정 (감사 #1, #2, #3 + 인라인 편집)

**Files:**
- Modify: `apps/mobile/src/presentation/screens/CareModeScreen.tsx`

**Interfaces:**
- Consumes: Task 1의 `care.editShort` 키, Task 4의 언랩된 QuickMedicationForm.
- Produces: 편집 폼이 해당 아젠다 행 바로 아래 인라인 렌더됨. 하단 토글 폼은 추가 전용이 됨 (Task 6에서 AddCard로 대체).

- [x] **Step 1: 상태 버튼을 가로 배치로 (교정 #1)**

styles 변경:

```ts
  actionButtons: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  givenButton: { flex: 1, minHeight: 40, borderRadius: radius.md, backgroundColor: colors.mintDeep, alignItems: "center", justifyContent: "center" },
  skipButton: { flex: 1, minHeight: 40, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
```

주의: 이 두 개는 짧은 고정 라벨 **버튼**이라 390px 세로 스택 가드 대상이 아니다. 입력 필드는 건드리지 않는다.

- [x] **Step 2: 헤더 카운트의 가짜 링크 어포던스 제거 (교정 #3)**

`linkText` 스타일을 두 용도로 분리한다. 섹션 헤더의 카운트는 muted 캡션으로:

```tsx
        <Text style={styles.countText}>{t("ko", "care.todayMedicationProgress")} {pendingCount}</Text>
```

styles에 추가:
```ts
  countText: { ...type.caption, color: colors.textMuted },
```

- [x] **Step 3: 행 편집 트리거 교정 (교정 #2)**

`MedicationAgendaRow`의 편집 Pressable을:

```tsx
      {onEdit ? (
        <Pressable accessibilityRole="button" onPress={onEdit} style={styles.editButton}>
          <Text style={styles.editText}>{t("ko", "care.editShort")}</Text>
        </Pressable>
      ) : null}
```

styles 변경/추가 (`linkText` 스타일은 삭제):
```ts
  editButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.md },
  editText: { ...type.caption, color: colors.orangeDeep },
```

- [x] **Step 4: 편집 폼을 행 아래 인라인으로 이동**

`CarePanel`의 medList 렌더를 다음으로 교체:

```tsx
      <View style={styles.medList}>
        {agendaRows.length === 0 ? <Text style={styles.emptyText}>{t("ko", "care.noMedicationToday")}</Text> : null}
        {agendaRows.map((row) => {
          const rowKey = `${row.scheduleId ?? row.doseId}-${row.doseDate}-${row.scheduledTime}`;
          const isEditingRow = Boolean(editingDose && row.doseId === editingDose.id);
          return (
            <View key={rowKey} style={styles.medListItem}>
              <MedicationAgendaRow row={row} onEdit={row.doseId ? () => setEditingDoseId(row.doseId ?? null) : undefined} onStatusChange={(status) => onAgendaStatusChange?.(row, status)} />
              {isEditingRow ? (
                <SurfaceCard>
                  <QuickMedicationForm onSave={onAddDose} editingDose={editingDose} onUpdate={onUpdateDose} onDelete={onDeleteDose} onCancelEdit={() => setEditingDoseId(null)} canDelete={canDeleteDose} />
                </SurfaceCard>
              ) : null}
            </View>
          );
        })}
      </View>
```

하단 토글 폼은 추가 전용으로 축소 (editingDose 관련 prop 제거):

```tsx
      <SecondaryButton label={t("ko", "care.temporaryAdd")} icon="add" onPress={() => setTemporaryFormOpen((current) => !current)} />
      {temporaryFormOpen ? (
        <SurfaceCard>
          <QuickMedicationForm onSave={onAddDose} />
        </SurfaceCard>
      ) : null}
```

styles에 추가:
```ts
  medListItem: { gap: spacing.sm },
```

- [x] **Step 5: 검증**

Run: `npm run typecheck && npm run verify:presentation`
Expected: 모두 통과

- [x] **Step 6: Commit**

```bash
git add apps/mobile/src/presentation/screens/CareModeScreen.tsx
git commit -m "fix(care): row action buttons, real edit affordance, inline dose editing"
```

---

### Task 6: 케어 탭 재구성 — AddCard 배선, 약 일정 카드, CareSetupPanel 제거, 가드 갱신

**Files:**
- Create: `apps/mobile/src/presentation/screens/careScheduleSummary.ts`
- Test: `apps/mobile/src/presentation/screens/careScheduleSummary.test.ts`
- Modify: `apps/mobile/src/presentation/screens/CareModeScreen.tsx` (전면 재구성)
- Modify: `apps/mobile/src/presentation/PawBloomShell.tsx:244` (`onOpenProfileCare` 배선)
- Modify: `scripts/verify-presentation-state.mjs` (CareSetupPanel 조항 2건 교체)
- Delete: `apps/mobile/src/contexts/care/ui/CareSetupPanel.tsx`

**Interfaces:**
- Consumes: Task 4의 `CareMedicationAddCard`, Task 1 키들.
- Produces:
  - `schedulePeriodBadge(schedule: Pick<CareMedicationSchedule, "endsOn">): string | null` — 예: `"~7/17까지"`, endsOn 없으면 null
  - `CARE_SCHEDULE_PREVIEW_COUNT = 3`
  - `partitionCareSchedules<S>(schedules: S[], expanded: boolean): { visible: S[]; hiddenCount: number }`
  - `CareModeScreen`의 props에서 `onUseSchedule` 타입이 `(schedule: CareMedicationSchedule) => void`로 직접 선언되고, `onOpenProfileCare: () => void`가 **추가**됨 (required)

**중요:** 가드 스크립트가 (a) `CareModeScreen`에 `"CareSetupPanel"` 문자열 포함을 강제하고 (b) `CareSetupPanel.tsx` 파일을 `readFileSync`로 읽는다. 따라서 **화면 재구성·파일 삭제·가드 갱신은 반드시 이 태스크의 단일 커밋**으로 묶는다. `docs/design/DESIGN_QA.md`는 이 가드의 줄 번호를 참조하지만 exclusive 문서이므로 수정하지 않는다 (커밋 메시지에 명시).

- [x] **Step 1: 스케줄 요약 로직 테스트 작성**

`apps/mobile/src/presentation/screens/careScheduleSummary.test.ts`:

```ts
import { CARE_SCHEDULE_PREVIEW_COUNT, partitionCareSchedules, schedulePeriodBadge } from "./careScheduleSummary";

if (schedulePeriodBadge({ endsOn: undefined }) !== null) throw new Error("open-ended schedules must not show a period badge");
if (schedulePeriodBadge({ endsOn: "2026-07-17" }) !== "~7/17까지") throw new Error("short-term schedules must show an until badge");
if (schedulePeriodBadge({ endsOn: "2026-11-03" }) !== "~11/3까지") throw new Error("badge must strip leading zeros");
if (schedulePeriodBadge({ endsOn: "invalid" }) !== null) throw new Error("malformed dates must not render a badge");

const schedules = ["a", "b", "c", "d", "e"];
const collapsed = partitionCareSchedules(schedules, false);
if (collapsed.visible.length !== CARE_SCHEDULE_PREVIEW_COUNT || collapsed.hiddenCount !== 2) throw new Error("collapsed list must preview 3 rows and count the rest");
const expanded = partitionCareSchedules(schedules, true);
if (expanded.visible.length !== 5 || expanded.hiddenCount !== 0) throw new Error("expanded list must show every row");
const few = partitionCareSchedules(["a", "b", "c"], false);
if (few.visible.length !== 3 || few.hiddenCount !== 0) throw new Error("lists at the preview limit must not show a more button");
```

- [x] **Step 2: 실패 확인**

Run: `node scripts/run-presentation-test.mjs apps/mobile/src/presentation/screens/careScheduleSummary.test.ts`
Expected: FAIL — `Cannot find module './careScheduleSummary'`

- [x] **Step 3: 로직 구현**

`apps/mobile/src/presentation/screens/careScheduleSummary.ts`:

```ts
import type { CareMedicationSchedule } from "../../contexts/care/domain/carePlan";
import { t } from "../../i18n/translations";

export const CARE_SCHEDULE_PREVIEW_COUNT = 3;

export function schedulePeriodBadge(schedule: Pick<CareMedicationSchedule, "endsOn">): string | null {
  if (!schedule.endsOn) return null;
  const match = schedule.endsOn.match(/^\d{4}-(\d{2})-(\d{2})/);
  if (!match) return null;
  return t("ko", "care.scheduleUntil").replace("{date}", `${Number(match[1])}/${Number(match[2])}`);
}

export function partitionCareSchedules<S>(schedules: S[], expanded: boolean): { visible: S[]; hiddenCount: number } {
  if (expanded || schedules.length <= CARE_SCHEDULE_PREVIEW_COUNT) return { visible: schedules, hiddenCount: 0 };
  return {
    visible: schedules.slice(0, CARE_SCHEDULE_PREVIEW_COUNT),
    hiddenCount: schedules.length - CARE_SCHEDULE_PREVIEW_COUNT,
  };
}
```

Run: `node scripts/run-presentation-test.mjs apps/mobile/src/presentation/screens/careScheduleSummary.test.ts`
Expected: exit 0

- [x] **Step 4: CareModeScreen 전면 교체**

`apps/mobile/src/presentation/screens/CareModeScreen.tsx` 전체를 다음 내용으로 교체:

```tsx
import { useMemo, useState, type ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ActiveCareSetup, CareMedicationSchedule, CareSetupInput } from "../../contexts/care/domain/carePlan";
import type { DoseRecord } from "../../contexts/medication/domain/medication";
import { NoticeBanner, PrimaryButton, SecondaryButton, SegmentedControl, SurfaceCard } from "../../design-system/components";
import { AppIcon } from "../../design-system/iconography";
import { colors, iconSize, radius, spacing, type } from "../../design-system/tokens";
import { t } from "../../i18n/translations";
import { QuickMedicationForm, type QuickMedicationSaveHandler } from "../../contexts/medication/ui/CareMedicationPanel";
import { medicationAgendaSourceLabelKey, type TodayMedicationAgendaRow } from "../../contexts/medication/ui/todayMedicationAgenda";
import { CareMedicationAddCard } from "./CareMedicationAddCard";
import { CareReportPanel } from "./CareReportPanel";
import { partitionCareSchedules, schedulePeriodBadge } from "./careScheduleSummary";

type Segment = "care" | "reports";
type QuickMedicationUpdateHandler = NonNullable<ComponentProps<typeof QuickMedicationForm>["onUpdate"]>;

type CareModeScreenProps = {
  petId: string;
  doses: DoseRecord[];
  medicationAgenda?: TodayMedicationAgendaRow[];
  onAgendaStatusChange?: (row: TodayMedicationAgendaRow, status: "completed" | "skipped" | "partial") => void;
  onAddDose: QuickMedicationSaveHandler;
  onUpdateDose: (input: Parameters<QuickMedicationUpdateHandler>[0]) => void | Promise<void>;
  onDeleteDose: (dose: DoseRecord) => void | Promise<boolean | void>;
  onSaveCareSetup: (input: CareSetupInput) => Promise<ActiveCareSetup>;
  onUseSchedule: (schedule: CareMedicationSchedule) => void;
  onOpenProfileCare: () => void;
  onGenerateReport: () => void;
  conditionScore?: number;
  careSetup: ActiveCareSetup;
  canManageCare?: boolean;
  canDeleteDose?: boolean;
  canManageReports?: boolean;
};

export function CareModeScreen({ canManageCare = true, canDeleteDose = true, canManageReports = true, ...props }: CareModeScreenProps) {
  const [segment, setSegment] = useState<Segment>("care");

  return (
    <View style={styles.screen}>
      <SegmentedControl
        value={segment}
        onChange={setSegment}
        items={[
          { label: t("ko", "care.segment.care"), value: "care" },
          { label: t("ko", "care.segment.reports"), value: "reports" },
        ]}
      />

      {segment === "care" ? (
        <CarePanel {...props} canManageCare={canManageCare} canDeleteDose={canDeleteDose} canManageReports={canManageReports} />
      ) : (
        <CareReportPanel onOpenReports={props.onGenerateReport} canManageReports={canManageReports} />
      )}
    </View>
  );
}

function CarePanel({
  petId,
  doses,
  medicationAgenda = [],
  onAgendaStatusChange,
  onAddDose,
  onUpdateDose,
  onDeleteDose,
  onSaveCareSetup,
  onUseSchedule,
  onOpenProfileCare,
  onGenerateReport,
  conditionScore,
  careSetup,
  canManageCare,
  canDeleteDose,
  canManageReports,
}: Omit<CareModeScreenProps, "canManageCare" | "canDeleteDose" | "canManageReports"> & {
  canManageCare: boolean;
  canDeleteDose: boolean;
  canManageReports: boolean;
}) {
  const [editingDoseId, setEditingDoseId] = useState<string | null>(null);
  const [addCardOpen, setAddCardOpen] = useState(false);
  const [schedulesExpanded, setSchedulesExpanded] = useState(false);
  const editingDose = useMemo(() => doses.find((dose) => dose.id === editingDoseId) ?? null, [doses, editingDoseId]);
  const agendaRows = medicationAgenda.length > 0 ? medicationAgenda : doses.map((dose) => ({ source: "dose" as const, doseId: dose.id, scheduleId: dose.scheduleId, doseDate: dose.doseDate ?? "", medicationName: dose.medicationName, conditionName: dose.conditionName, dosageLabel: dose.dosageLabel, scheduledTime: dose.scheduledAt, status: dose.status }));
  const pendingCount = agendaRows.filter((row) => row.status === "pending").length;
  const { visible: visibleSchedules, hiddenCount } = partitionCareSchedules(careSetup.schedules, schedulesExpanded);

  return (
    <>
      {!canManageCare ? <NoticeBanner text={t("ko", "permission.careTeamOnly")} icon="shield" /> : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{t("ko", "care.todayMedicationTitle")}</Text>
        <Text style={styles.countText}>{t("ko", "care.todayMedicationProgress")} {pendingCount}</Text>
      </View>
      <View style={styles.medList}>
        {agendaRows.length === 0 ? <Text style={styles.emptyText}>{t("ko", "care.noMedicationToday")}</Text> : null}
        {agendaRows.map((row) => {
          const rowKey = `${row.scheduleId ?? row.doseId}-${row.doseDate}-${row.scheduledTime}`;
          const isEditingRow = Boolean(editingDose && row.doseId === editingDose.id);
          return (
            <View key={rowKey} style={styles.medListItem}>
              <MedicationAgendaRow row={row} onEdit={row.doseId ? () => setEditingDoseId(row.doseId ?? null) : undefined} onStatusChange={(status) => onAgendaStatusChange?.(row, status)} />
              {isEditingRow ? (
                <SurfaceCard>
                  <QuickMedicationForm onSave={onAddDose} editingDose={editingDose} onUpdate={onUpdateDose} onDelete={onDeleteDose} onCancelEdit={() => setEditingDoseId(null)} canDelete={canDeleteDose} />
                </SurfaceCard>
              ) : null}
            </View>
          );
        })}
      </View>

      {canManageCare ? (
        <>
          <SecondaryButton label={t("ko", "care.addMedication")} icon="add" onPress={() => setAddCardOpen((current) => !current)} />
          {addCardOpen ? <CareMedicationAddCard petId={petId} onAddDose={onAddDose} onSaveCareSetup={onSaveCareSetup} onOpenProfileCare={onOpenProfileCare} onSaved={() => setAddCardOpen(false)} /> : null}
        </>
      ) : null}

      <SurfaceCard>
        <View style={styles.scheduleCard}>
          <Text style={styles.sectionTitle}>{t("ko", "care.scheduleSummaryTitle")}</Text>
          {careSetup.schedules.length === 0 ? <Text style={styles.reportCopy}>{t("ko", "care.scheduleSummaryCopy")}</Text> : null}
          {visibleSchedules.map((schedule) => {
            const badge = schedulePeriodBadge(schedule);
            return (
              <Pressable key={schedule.id} style={styles.scheduleRow} disabled={!canManageCare} onPress={() => onUseSchedule(schedule)}>
                <AppIcon name="medication" size={iconSize.md} color={colors.orangeDeep} />
                <View style={styles.scheduleBody}>
                  <Text style={styles.medTitle}>{schedule.localTime.slice(0, 5)} · {schedule.medicationName}</Text>
                  <Text style={styles.medMeta}>{schedule.dosageLabel}{badge ? ` · ${badge}` : ""}</Text>
                </View>
                {canManageCare ? <Text style={styles.useText}>{t("ko", "care.useToday")}</Text> : null}
              </Pressable>
            );
          })}
          {hiddenCount > 0 ? (
            <Pressable accessibilityRole="button" style={styles.moreButton} onPress={() => setSchedulesExpanded(true)}>
              <Text style={styles.moreText}>{t("ko", "care.scheduleMore").replace("{count}", String(hiddenCount))}</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" style={styles.profileLinkButton} onPress={onOpenProfileCare}>
            <Text style={styles.profileLinkText}>{t("ko", "care.manageRoutineInProfile")}</Text>
          </Pressable>
        </View>
      </SurfaceCard>

      <SurfaceCard>
        <Text style={styles.sectionTitle}>{t("ko", "care.conditionFromDiaryTitle")}</Text>
        <Text style={styles.reportCopy}>{conditionScore ? `${t("ko", "care.latestCondition")} ${conditionScore}/5` : t("ko", "care.conditionFromDiaryCopy")}</Text>
      </SurfaceCard>
      {canManageReports
        ? <PrimaryButton label={t("ko", "care.generateVetReport")} icon="report" onPress={onGenerateReport} />
        : <NoticeBanner text={t("ko", "permission.reportCareTeamOnly")} icon="shield" />}
    </>
  );
}

function MedicationAgendaRow({ row, onEdit, onStatusChange }: { row: TodayMedicationAgendaRow; onEdit?: () => void; onStatusChange: (status: "completed" | "skipped") => void }) {
  const visual = row.status === "completed" ? { accent: colors.mint, icon: colors.mintDeep, label: t("ko", "care.status.completed") } : row.status === "skipped" ? { accent: colors.inactive, icon: colors.textSoft, label: t("ko", "care.status.skipped") } : row.status === "partial" ? { accent: colors.memo, icon: colors.orangeDeep, label: t("ko", "care.status.partial") } : { accent: colors.salmon, icon: colors.salmon, label: t("ko", "care.status.pending") };

  return (
    <View style={styles.agendaRow}>
      <View style={[styles.medAccent, { backgroundColor: visual.accent }]} />
      <AppIcon name="medication" size={iconSize.lg} color={visual.icon} />
      <View style={styles.agendaBody}>
        <Text style={styles.medTitle}>{row.medicationName}</Text>
        <Text style={styles.sourceLabel}>{t("ko", medicationAgendaSourceLabelKey(row))}</Text>
        <Text style={styles.medDetail}>{row.scheduledTime} · {visual.label}</Text>
        {row.conditionName ? <Text style={styles.medMeta}>{t("ko", "care.conditionLabel")}: {row.conditionName}</Text> : null}
        {row.dosageLabel ? <Text style={styles.medMeta}>{t("ko", "care.dosageLabel")}: {row.dosageLabel}</Text> : null}
        <View style={styles.actionButtons}>
          <Pressable style={styles.givenButton} onPress={() => onStatusChange("completed")}>
            <Text style={styles.givenButtonText}>{t("ko", "care.status.given")}</Text>
          </Pressable>
          <Pressable style={styles.skipButton} onPress={() => onStatusChange("skipped")}>
            <Text style={styles.skipButtonText}>{t("ko", "care.status.notGiven")}</Text>
          </Pressable>
        </View>
      </View>
      {onEdit ? (
        <Pressable accessibilityRole="button" onPress={onEdit} style={styles.editButton}>
          <Text style={styles.editText}>{t("ko", "care.editShort")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.lg,
  },
  sectionHeader: {
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    ...type.sectionTitle,
  },
  countText: { ...type.caption, color: colors.textMuted },
  medList: {
    gap: spacing.md,
  },
  medListItem: { gap: spacing.sm },
  agendaRow: {
    minHeight: 112,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    gap: spacing.md,
  },
  medAccent: { width: 8, height: "100%" },
  agendaBody: { flex: 1, gap: spacing.xs, paddingVertical: spacing.md },
  medTitle: { ...type.bodyStrong },
  sourceLabel: { ...type.tiny, color: colors.orangeDeep },
  medDetail: { ...type.caption },
  medMeta: { ...type.tiny, color: colors.textMuted },
  actionButtons: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  givenButton: { flex: 1, minHeight: 40, borderRadius: radius.md, backgroundColor: colors.mintDeep, alignItems: "center", justifyContent: "center" },
  givenButtonText: { ...type.bodyStrong, color: colors.white },
  skipButton: { flex: 1, minHeight: 40, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  skipButtonText: { ...type.bodyStrong, color: colors.textMuted },
  editButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.md },
  editText: { ...type.caption, color: colors.orangeDeep },
  scheduleCard: { gap: spacing.sm },
  scheduleRow: { minHeight: 58, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md },
  scheduleBody: { flex: 1 },
  useText: { ...type.caption, color: colors.orangeDeep },
  moreButton: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  moreText: { ...type.bodyStrong, color: colors.orangeDeep },
  profileLinkButton: { minHeight: 44, justifyContent: "center" },
  profileLinkText: { ...type.caption, color: colors.orangeDeep },
  emptyText: {
    ...type.body,
    color: colors.textMuted,
  },
  reportCopy: {
    ...type.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
});
```

주의: `CareSetupPanel`·`MedicationRow` import와 `temporaryFormOpen` 상태가 이 교체로 사라진다 (교정 #7 포함).

- [x] **Step 5: PawBloomShell 배선**

`apps/mobile/src/presentation/PawBloomShell.tsx:244`의 `<CareModeScreen ...>` 호출에 prop 추가:

```tsx
onOpenProfileCare={() => setShowPetSettings(true)}
```

(`setShowPetSettings`는 같은 컴포넌트의 기존 state setter — SettingsScreen의 `onOpenPetProfiles`가 이미 동일하게 사용.)

- [x] **Step 6: 가드 스크립트 갱신**

`scripts/verify-presentation-state.mjs`에서 두 블록을 교체.

(a) CareSetupPanel 포함 강제 조항:

변경 전:
```js
if (!careModeScreen.includes("CareSetupPanel")) {
  throw new Error("care screen must include care plan creation UI in the primary care flow");
}
```
변경 후:
```js
if (!careModeScreen.includes("CareMedicationAddCard")) {
  throw new Error("care screen must include the add-medication entry point in the primary care flow");
}

const careMedicationAddCard = readFileSync(join(root, "apps/mobile/src/presentation/screens/CareMedicationAddCard.tsx"), "utf8");
if (!careMedicationAddCard.includes("ShortTermMedicationForm")) {
  throw new Error("add-medication card must keep care plan creation (short-term course) reachable from the care flow");
}
```

(b) CareSetupPanel 세로 스택 가드 (파일 삭제로 readFileSync가 crash하므로 반드시 교체):

변경 전:
```js
const careSetupPanel = readFileSync(join(root, "apps/mobile/src/contexts/care/ui/CareSetupPanel.tsx"), "utf8");
if (/\n\s*row:\s*{\s*flexDirection:\s*"row"/s.test(careSetupPanel) || /\n\s*timePicker:\s*{\s*width:\s*112/s.test(careSetupPanel)) {
  throw new Error("care setup medication and time fields must remain stacked to avoid narrow mobile clipping");
}
```
변경 후:
```js
const shortTermMedicationForm = readFileSync(join(root, "apps/mobile/src/contexts/care/ui/ShortTermMedicationForm.tsx"), "utf8");
if (/\n\s*panel:\s*{[^}]*flexDirection:\s*"row"/s.test(shortTermMedicationForm)) {
  throw new Error("short-term medication fields must remain stacked to avoid narrow mobile clipping");
}
```

- [x] **Step 7: CareSetupPanel 삭제 + 잔여 참조 확인**

```bash
git rm apps/mobile/src/contexts/care/ui/CareSetupPanel.tsx
grep -rn "CareSetupPanel" apps/mobile/src scripts
```
Expected: grep 결과 없음 (있으면 해당 참조를 이 태스크에서 정리)

- [x] **Step 8: 전체 검증**

Run: `npm run typecheck && npm run verify:presentation && npm run verify:architecture && npm run verify:i18n`
Expected: 모두 통과

- [x] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(care): single add-medication entry point replaces duplicated care plan form

verify-presentation-state guard updated: care plan creation requirement now
points at CareMedicationAddCard/ShortTermMedicationForm. DESIGN_QA.md (exclusive)
references old guard line numbers; owner model to reconcile."
```

---

### Task 7: MedicationRow 제거 + inputStack rename (교정 #8, #9)

**Files:**
- Modify: `apps/mobile/src/contexts/medication/ui/CareMedicationPanel.tsx`
- Modify: `apps/mobile/src/contexts/medication/ui/CareMedicationPanel.test.tsx`
- Modify: `scripts/verify-presentation-state.mjs` (inputGrid 정규식 → inputStack)

**Interfaces:**
- Produces: `CareMedicationPanel.tsx`는 `QuickMedicationForm`(+타입들)만 export. `MedicationRow`와 `statusVisual`은 삭제됨.

- [x] **Step 1: MedicationRow 컴포넌트 삭제**

`CareMedicationPanel.tsx`에서 제거:
- `MedicationRow` 함수 전체 (export function MedicationRow ... 끝까지)
- `statusVisual` 함수 전체
- styles에서: `medRow`, `medEditTarget`, `medAccent`, `medBody`, `medTitle`, `medDetail`, `medMeta`, `medTime`, `doneCircle`, `doneCircleActive`
- import에서 이제 미사용이 된 것 제거: `AppIcon` (iconography), `iconSize` (tokens)

유지: `QuickMedicationForm`이 쓰는 `sectionTitle`, `quickForm`, `input`, `inputGrid`(다음 스텝에서 rename), `noteInput`, `editActions`, `dangerButton`, `dangerButtonText`.

- [x] **Step 2: inputGrid → inputStack rename (레이아웃 변경 없음)**

같은 파일에서 `styles.inputGrid` 사용처와 스타일 정의를 `inputStack`으로 rename:

```tsx
        <View style={styles.inputStack}>
```
```ts
  inputStack: { gap: spacing.sm },
```

`scripts/verify-presentation-state.mjs`의 정규식도 같은 커밋에서 갱신:

변경 전:
```js
if (/\n\s*inputGrid:\s*{\s*flexDirection:\s*"row"/s.test(careMedicationPanel)) {
```
변경 후:
```js
if (/\n\s*inputStack:\s*{\s*flexDirection:\s*"row"/s.test(careMedicationPanel)) {
```

- [x] **Step 3: 테스트 정리**

`CareMedicationPanel.test.tsx`에서 제거:
- import의 `MedicationRow`
- `rowProps` 선언 블록과 `void rowProps;` 라인

- [x] **Step 4: 검증**

```bash
grep -rn "MedicationRow" apps/mobile/src/contexts/medication/ui apps/mobile/src/presentation
```
Expected: 결과 없음 (application 레이어의 DB row 타입 alias `MedicationRow`는 별개 — `contexts/*/application` 결과는 무시)

Run: `npm run typecheck && npm run verify:presentation`
Expected: 모두 통과

- [x] **Step 5: Commit**

```bash
git add apps/mobile/src/contexts/medication/ui/CareMedicationPanel.tsx apps/mobile/src/contexts/medication/ui/CareMedicationPanel.test.tsx scripts/verify-presentation-state.mjs
git commit -m "refactor(medication): drop dead MedicationRow, rename inputGrid to inputStack"
```

---

### Task 8: ProfileCareDefaultsPanel 교정 (교정 #6, #10)

**Files:**
- Modify: `apps/mobile/src/contexts/care/ui/ProfileCareDefaultsPanel.tsx`

- [x] **Step 1: 시간 삭제 버튼 a11y 라벨 교정 (#10)**

144행 부근:

변경 전:
```tsx
                accessibilityLabel={t("ko", "pet.careDefaultsClearDate")}
```
변경 후:
```tsx
                accessibilityLabel={t("ko", "care.removeTimeA11y")}
```

- [x] **Step 2: 에러 색상 시멘틱 통일 (#6)**

styles:

변경 전:
```ts
  errorText: { ...type.caption, color: colors.coral },
```
변경 후:
```ts
  errorText: { ...type.caption, color: colors.danger },
```

- [x] **Step 3: 검증 + Commit**

Run: `npm run typecheck && npm run verify:presentation`
Expected: 통과

```bash
git add apps/mobile/src/contexts/care/ui/ProfileCareDefaultsPanel.tsx
git commit -m "fix(care): profile defaults a11y label and danger error color"
```

---

### Task 9: 미사용 i18n 키 정리 + 최종 검증

**Files:**
- Modify: `apps/mobile/src/i18n/translations.ts`

- [x] **Step 1: 후보 키 사용처 grep**

CareSetupPanel 삭제와 임시 투약 흐름 대체로 미사용이 되었을 후보들. **각 키마다 grep으로 0건 확인 후에만 삭제** (en/ko 양쪽 동시):

```bash
for key in care.temporaryAdd care.temporaryCopy care.setupTitle care.setupCopy care.setupRepeat care.setupEveryDay care.setupCustomRepeat care.setupCustomRepeatSuffix care.setupClearDate care.setupEndDate care.noConditionLinked care.useToday care.setupStartDate care.setupPeriod; do
  echo "== $key: $(grep -rn "\"$key\"" apps/mobile/src --include="*.ts" --include="*.tsx" | grep -v i18n/translations | wc -l | tr -d ' ') usages"
done
```

Expected 참고: `care.useToday`/`care.setupStartDate`/`care.setupPeriod`는 새 코드가 사용하므로 1건 이상 → **유지**. 0건인 키만 삭제.

- [x] **Step 2: 0건 키를 en/ko 양쪽에서 삭제**

- [x] **Step 3: 최종 전체 검증**

Run: `npm run verify:i18n && npm run typecheck && npm run verify:presentation && npm run verify:architecture`
Expected: 모두 통과

- [x] **Step 4: 육안 확인 (환경이 허용하면)**

```bash
npm run mobile:export-web && npm run mobile:preview-web
```
Browser로 `http://127.0.0.1:8082` 접속, viewport `390x844`:
1. 케어 탭 최상단이 "오늘 투약 확인"인지
2. "+ 약 추가" → 오늘만/며칠간/매일 3분기 전환
3. "며칠간" 저장 → 아젠다에 즉시 행 생성 + "약 일정" 카드에 `~M/D까지` 뱃지
4. "매일" → 프로필 케어 기본값 화면으로 이동
5. 먹였어요/못 먹였어요 버튼 가로 배치, 행 "수정" → 행 바로 아래 편집 폼
6. 스케줄 4개 이상일 때 "외 N개 더 보기"

브라우저 접근이 차단되면 이 스텝은 건너뛰고 커밋 메시지에 "visual check pending" 명시.

- [x] **Step 5: Commit**

```bash
git add apps/mobile/src/i18n/translations.ts
git commit -m "chore(i18n): drop keys orphaned by care setup panel removal"
```
