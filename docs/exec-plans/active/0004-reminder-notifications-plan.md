---
owner_model: claude-opus-4.8-extra
domain: planning
edit_policy: exclusive
---

# 0004 투약·식사 시간 로컬 알림 구현계획

> **에이전트 워커(codex-high):** REQUIRED SUB-SKILL — `superpowers:subagent-driven-development`(권장) 또는 `superpowers:executing-plans`로 task-by-task 구현. 단계는 `- [ ]` 체크박스로 추적한다.

**Goal:** 보호자가 설정한 식사 시간에 매일 로컬 알림이 오게 하고, 기존 투약 알림이 포그라운드/Android에서 실제로 표시되게 한다.

**Architecture:** 식사 알림은 `routine` context가 소유하고 medication의 검증된 패턴(계정 스코프 식별자, 순수 플랜 + 주입 IO)을 미러링한다. **medication 코드는 수정하지 않는다.** 앱 공통 알림 표시 부트스트랩은 shared-kernel에 둔다. 설계 근거: [설계 스펙](../../superpowers/specs/2026-07-12-reminder-notifications-design.md).

**Tech Stack:** expo-notifications(설치됨, DAILY 트리거), 기존 `pet_routines.routine` jsonb(**DB 마이그레이션 없음**), design-system `TimePickerField`/`SegmentedControl`.

## Global Constraints (모든 Task에 적용)

- 알림 식별자 네임스페이스: 식사 = `meal:{userId}:{petId}:{slot}`, 투약(기존) = `medication:{userId}:…`. 자기 prefix 외 알림은 조회·취소 금지.
- `expo-notifications`는 테스트 러너(`scripts/run-presentation-test.mjs`) mock 목록에 없다 → **동적 import를 웹 가드·IO 경계 뒤에만** 두고, 순수 함수는 IO 콜백을 주입받게 설계한다(`medicationReminderNotifications.ts` 선례).
- `Platform.OS === "web"`이면 부트스트랩·스케줄링 모두 no-op으로 조용히 반환.
- 사용자 문구는 `apps/mobile/src/i18n/translations.ts`의 en/ko 두 블록에 모두 추가(`verify:i18n`이 parity 강제).
- 테스트는 리포 관례를 따른다: `*.test.ts` 최상위 스크립트 + `if (…) throw new Error("…")`. 실행: `node scripts/run-presentation-test.mjs <파일경로>`.
- 각 Task 종료 시 `npm --prefix apps/mobile run typecheck`, handoff 전 `npm run verify` 전체 통과. 커밋은 Task당 1개.
- iOS pending 예산: 식사 알림은 끼니당 DAILY 트리거 1개(펫당 최대 4개)만 사용. 별도 예산 로직을 만들지 않는다(medication이 이미 자기 외 pending을 차감).

---

## Task 1: 알림 표시 부트스트랩 (투약 알림 표시 결손도 함께 해결)

**Files:** Create `apps/mobile/src/shared-kernel/notifications/localNotificationBootstrap.ts`, Create `apps/mobile/src/shared-kernel/notifications/localNotificationBootstrap.web.test.ts`, Modify `apps/mobile/App.tsx`(모듈 최상위 `configureNetworkSync()` 호출 옆), Modify `apps/mobile/app.json`(plugins 배열에 `"expo-notifications"` 추가).

**Produces:** `configureLocalNotificationPresentation(): Promise<void>` — 멱등(1회만 실행), 웹 no-op, 기능 지식 없음.

- [ ] `.web.test.ts` 작성(웹 플랫폼 mock 경로): `await configureLocalNotificationPresentation()`이 throw 없이 resolve하는지 확인(웹에서 expo-notifications import에 도달하면 모듈 로드 실패로 테스트가 죽으므로 그 자체가 가드 검증).
- [ ] `node scripts/run-presentation-test.mjs apps/mobile/src/shared-kernel/notifications/localNotificationBootstrap.web.test.ts` 실행 → 구현 전 FAIL 확인.
- [ ] 구현:

```ts
import { Platform } from "react-native";
let configured = false;
export async function configureLocalNotificationPresentation() {
  if (configured || Platform.OS === "web") return;
  configured = true;
  const Notifications = await import("expo-notifications");
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", { name: "PawBloom reminders", importance: Notifications.AndroidImportance.HIGH });
  }
}
```

- [ ] `App.tsx`에서 `void configureLocalNotificationPresentation();` 호출, `app.json` plugins에 `"expo-notifications"` 추가.
- [ ] 테스트 재실행 PASS + `npm --prefix apps/mobile run typecheck`.
- [ ] commit `feat: configure local notification presentation`

## Task 2: 루틴 도메인 식사 시간 확장 (DB 변경 없음)

**Files:** Modify `apps/mobile/src/contexts/routine/domain/petRoutine.ts`, Modify `apps/mobile/src/contexts/routine/application/petRoutineDefaults.ts`, Create `apps/mobile/src/contexts/routine/domain/petRoutine.test.ts`.

**Produces:** `meals` 슬롯 값에 `localTime?: string`("HH:mm" 24h), `food.mealRemindersEnabled?: boolean`(기본 true), `isValidMealReminderTime(value: string): boolean`.

- [ ] 실패 테스트 작성: `isValidMealReminderTime("08:30") === true`, `"25:00"`/`"8:30"`/`"08:3"`/`""` → false. `createDefaultPetRoutine("pet-1", "dog")`의 `food.mealRemindersEnabled === true`이고 각 끼니에 `localTime`이 없는지.
- [ ] 테스트 FAIL 확인 후 구현:

```ts
// petRoutine.ts — food 타입 교체 + 검증기 추가
food: {
  meals: Partial<Record<RoutineMealSlot, { offeredGrams?: string; localTime?: string }>>;
  appetite?: RoutineAppetite;
  mealRemindersEnabled?: boolean;
};
export function isValidMealReminderTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
```

- [ ] `petRoutineDefaults.ts`의 기본 루틴 생성에 `mealRemindersEnabled: true` 포함. 기존 행 하위호환은 `petRoutineRecords.ts`의 `mapRoutineRow` defaults 병합이 이미 보장하므로 그 파일은 수정하지 않는다.
- [ ] 테스트 PASS + typecheck. commit `feat: add meal times to pet routine domain`

## Task 3: 식사 알림 스케줄링 엔진 (routine/application)

**Files:** Create `apps/mobile/src/contexts/routine/application/mealReminderNotifications.ts`, Create `…/mealReminderNotifications.test.ts`.

**Consumes:** Task 2의 `PetRoutine`, `RoutineMealSlot`, `isValidMealReminderTime`.
**Produces:** (Task 5가 이 시그니처 그대로 사용)

```ts
export type MealReminderPlanRequest = { identifier: string; slot: RoutineMealSlot; title: string; body: string; trigger: { kind: "daily"; hour: number; minute: number } };
export type MealReminderIo = { schedule: (request: MealReminderPlanRequest) => Promise<unknown>; cancel: (identifier: string) => Promise<unknown> };
export function setActiveMealReminderAccount(userId: string | null): void;
export function isMealReminderAccountActive(userId: string): boolean;
export function mealReminderIdentifier(userId: string, petId: string, slot: RoutineMealSlot): string; // meal:{userId}:{petId}:{slot}
export function buildMealReminderPlan(args: { userId: string; petId: string; petName: string; title: string; slotLabels: Partial<Record<RoutineMealSlot, string>>; routine: PetRoutine }): MealReminderPlanRequest[];
export function shouldCancelMealReminderForAccount(notification: { identifier: string }, userId: string): boolean;
export function selectMealRemindersToCancel(pending: { identifier: string }[], args: { userId: string; petId: string; keepIdentifiers: ReadonlySet<string> }): { identifier: string }[];
export async function applyMealReminderPlan(plan: MealReminderPlanRequest[], pending: { identifier: string }[], args: { userId: string; petId: string }, io: MealReminderIo): Promise<void>;
export async function rescheduleMealReminders(args: { userId: string; petId: string; petName: string; title: string; slotLabels: Partial<Record<RoutineMealSlot, string>>; routine: PetRoutine; requestPermission: boolean }): Promise<boolean>;
export async function cancelMealRemindersForAccount(userId: string): Promise<void>;
```

- [ ] 실패 테스트 먼저(순수 함수만, IO는 fake 주입 — expo-notifications를 직접 import하는 테스트 금지):
  - `buildMealReminderPlan`: `localTime`이 유효한 끼니만 포함, `mealRemindersEnabled === false` → `[]`, 잘못된 시간(`"9시"`) 슬롯 제외, identifier가 `meal:user-1:pet-1:breakfast` 형식, `"08:30"` → `trigger { kind: "daily", hour: 8, minute: 30 }`, title/body에 펫 이름·끼니 라벨 반영.
  - `selectMealRemindersToCancel`: 같은 계정·같은 펫의 계획 외 항목만 선택하고 `medication:*`·타 계정 `meal:*`·타 펫 `meal:*`은 건드리지 않음.
  - `shouldCancelMealReminderForAccount`: 자기 계정 prefix true, 타 계정 false, `meal:` 아닌 식별자 false.
  - `applyMealReminderPlan`: fake io로 desired 설치·obsolete 취소 호출 목록 검증.
  - 계정 가드: `setActiveMealReminderAccount("user-2")` 후 `rescheduleMealReminders({ userId: "user-1", … })` → IO 호출 없이 false (IO 도달 전에 가드).
- [ ] 구현. `rescheduleMealReminders`는 medication 선례를 미러: 웹이면 즉시 false → 계정 가드 → `const Notifications = await import("expo-notifications")` → `requestPermission ? requestPermissionsAsync() : getPermissionsAsync()` → 미허용 시 false → `getAllScheduledNotificationsAsync()` pending 조회 → `buildMealReminderPlan` + `applyMealReminderPlan`(DAILY 트리거는 `{ type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute }`, `content.data`에 `{ userId, petId, slot }`) → true. `cancelMealRemindersForAccount`는 자기 계정 `meal:*` pending 전체 취소.
- [ ] `node scripts/run-presentation-test.mjs apps/mobile/src/contexts/routine/application/mealReminderNotifications.test.ts` PASS + typecheck.
- [ ] commit `feat: add meal reminder scheduling engine`

## Task 4: 루틴 설정 UI + i18n

**Files:** Modify `apps/mobile/src/contexts/routine/ui/RoutineSettingsPanel.tsx`, Create `apps/mobile/src/contexts/routine/ui/routineSettingsState.ts`(+`.test.ts`), Modify `apps/mobile/src/i18n/translations.ts`.

**Consumes:** Task 2 도메인 타입. **Produces:** 패널 draft 갱신 순수 헬퍼 `updateMealTime(draft, slot, localTime | undefined)`, `setMealRemindersEnabled(draft, enabled)` (careMedicationPanelState.ts 선례).

- [ ] i18n 키 추가(en/ko 두 블록, key 동일): `routine.mealTimesTitle` "Meal times"/"식사 시간" · `routine.mealTimeUnset` "Not set"/"미설정" · `routine.mealTimeClear` "Remove"/"지우기" · `routine.mealRemindersLabel` "Meal reminders"/"식사 알림" · `routine.mealRemindersOn` "On"/"켜기" · `routine.mealRemindersOff` "Off"/"끄기" · `routine.mealReminderTitle` "Time for {petName}'s meal"/"{petName} 밥 시간이에요" · `routine.mealReminderScheduled` "Meal reminders updated."/"식사 알림이 업데이트되었습니다." · `routine.mealReminderPermissionDenied` "Meal reminders need notification permission."/"식사 알림을 보내려면 알림 권한이 필요합니다." · `routine.mealReminderScheduleFailed` "The routine was saved, but meal reminders could not be updated."/"루틴은 저장됐지만 식사 알림을 업데이트하지 못했습니다."
- [ ] `routineSettingsState.ts` 실패 테스트 → 구현: `updateMealTime`은 유효 시간만 반영(무효 입력은 기존 값 유지), `undefined`로 시간 제거. `setMealRemindersEnabled`는 food 나머지 필드 보존.
- [ ] 패널 UI: 식사 알림 SegmentedControl(산책 토글 패턴 미러, `mealRemindersEnabled === false`일 때만 "끄기") + 아침/점심/저녁 각각 `TimePickerField`(design-system 기존 컴포넌트, "HH:mm" 저장) + 시간 지우기 액션. 켜기/끄기와 무관하게 시간 입력은 항상 가능.
- [ ] `npm run verify:i18n` + 패널·상태 테스트 PASS + typecheck.
- [ ] commit `feat: add meal time reminder settings ui`

## Task 5: 셸·계정 생명주기 배선

**Files:** Modify `apps/mobile/src/presentation/PawBloomShell.tsx`, Modify `apps/mobile/src/contexts/identity/application/authContextState.ts`.

**Consumes:** Task 3 시그니처, Task 4 i18n 키.

- [ ] `authContextState.ts`: 기존 `setActiveMedicationReminderAccount(nextUserId)` / `cancelMedicationRemindersForAccount(previousUserId)` 호출(101~103행 부근) 바로 옆에 meal 대응 두 줄 추가(`setActiveMealReminderAccount`, `cancelMealRemindersForAccount` — 실패 무시 `.catch(() => undefined)` 동일).
- [ ] `PawBloomShell.tsx`: `saveCareSetupAndRefreshReminders` 패턴을 미러한 `saveRoutineAndRefreshMealReminders(input)` 추가 — `routine.saveRoutine(input)` 성공 후 `rescheduleMealReminders({ …, requestPermission: true })`, notice는 성공/권한거부/실패 각각 `routine.mealReminderScheduled` / `routine.mealReminderPermissionDenied` / `routine.mealReminderScheduleFailed`. `PetOnboardingScreen`의 `onSaveRoutine={routine.saveRoutine}`을 wrapper로 교체. `title`은 `t(언어, "routine.mealReminderTitle")`의 `{petName}` 치환, `slotLabels`는 `routine.breakfast/lunch/dinner/snack` — 셸의 기존 `t(…)` 언어 인자 관례를 그대로 따른다.
- [ ] 마운트/펫 전환 silent 재스케줄: 기존 medication silent refresh useEffect(75~77행 부근)와 같은 지점에 `rescheduleMealReminders({ …, requestPermission: false }).catch(() => undefined)` 추가(활성 펫 루틴 로드 후).
- [ ] `npm run verify:presentation` 전체 PASS + typecheck.
- [ ] commit `feat: wire meal reminders into shell and account lifecycle`

## Task 6: 문서 동기화 · 수동 QA · 게이트

**Files:** Modify `ARCHITECTURE.md`(routine 항목에 "식사 시간·식사 알림", shared-kernel 알림 부트스트랩 언급 — codex 소유), Modify `docs/engineering/FRONTEND.md`(알림 식별자 네임스페이스 계약과 iOS pending 예산 협력 규칙 기록).

- [ ] 실기기/시뮬레이터 QA: ① 식사 시간을 2분 뒤로 설정·저장 → 권한 요청 → 백그라운드에서 배너 수신 ② 포그라운드에서도 배너 표시(Task 1 핸들러) ③ 토글 끄기 저장 → 해당 펫 `meal:*` 예약 취소 ④ 멀티펫: 펫별 시간 분리 ⑤ 로그아웃/계정 전환 → 이전 계정 식사 알림 소멸 ⑥ **투약 알림 회귀**: 케어 저장 시 기존 notice·스케줄 정상 ⑦ web preview(`npm --prefix apps/mobile run export:web` 또는 dev web): 루틴 저장 정상, 콘솔 에러 없음.
- [ ] QA에서 발견된 이슈 수정 후 `npm run verify` 전체 통과.
- [ ] commit `docs: record reminder notification architecture` (+ 수정 있으면 `fix:` 커밋 분리)

## 완료 기준

설계 스펙의 수용 기준 6항 전부 충족. 완료 시 이 파일을 `docs/exec-plans/archive/`로 이동하고 [0003](./0003-weekly-execution-checklist.md)의 "다음 즉시 작업"을 갱신한다.
