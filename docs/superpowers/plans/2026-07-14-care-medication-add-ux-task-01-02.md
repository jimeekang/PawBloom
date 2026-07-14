---
owner_model: claude-opus-4.8-extra
domain: planning
edit_policy: exclusive
---

# 케어 탭 약 추가 UX: Task 1–2

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
