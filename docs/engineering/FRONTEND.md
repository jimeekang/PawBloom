---
owner_model: codex-high
domain: implementation
edit_policy: exclusive
---

# 프론트엔드 엔지니어링

모바일 앱 구현 계약(implementation contract)만 다룬다. 화면 동작·MVP 화면 구성 등 제품 성격의 결정은 [../product/PRODUCT_SPEC.md](../product/PRODUCT_SPEC.md)에 있다. 앱 코드는 `apps/mobile` 아래에 둔다.

## 스택

- **Expo**: SDK 56 API와 versioned Expo documentation을 사용한다.
- **TypeScript**: strict mode를 유지한다.
- **TanStack Query**: Supabase read/mutation에 사용한다.
- **Expo SecureStore**: Supabase Auth session 저장에 사용한다.
- **Expo SQLite**: offline outbox에 사용한다.

## 필수 구현 규칙

- **디자인 token 우선**: 전역 디자인 token, icon, spacing, typography, layout rule을 우선 사용한다. 화면별 임의 스타일 추가는 금지한다. 새 스타일이 필요하면 design system(`src/design-system`)에 먼저 반영한 뒤 사용한다.
- **i18n**: 사용자에게 보이는 모든 문구는 `src/i18n/translations.ts`에 둔다. 화면에 리터럴 문자열을 하드코딩하지 않는다.
- **Edge Function 호출**: typed request/response wrapper 없이 직접 호출하지 않는다. 모든 Edge Function 호출은 typed wrapper를 통한다.
- **Supabase secret**: 앱 코드에 hard-code하지 않는다.

## 투약 알림 로컬 예약

투약 알림은 기기 로컬 알림(expo-notifications)으로만 예약한다. 서버 push에 의존하지 않는다.

- **구현 위치**: `apps/mobile/src/contexts/medication/application/medicationReminderNotifications.ts`.
- **알림 identifier 규약**: `medication:${scheduleId}:${dateKey}` 형식. 이 접두사(`medication:`)로 기존 예약을 식별·취소한다.
- **예약 범위**: 오늘(`fromDate`) 기준 앞으로 **30일** 치를 예약한다(`buildMedicationReminderRequests`의 `daysAhead: 30`). 각 날짜마다 `scheduleAppliesOnDate`로 해당 일정이 그 날에 적용되는지 확인한 뒤에만 요청을 만든다.
- **재예약(reschedule)**: 사용자가 일정, 기간, 반복 간격, 시간을 바꾸면 `rescheduleMedicationReminders`가 `medication:` 접두사를 가진 기존 로컬 알림을 모두 취소하고 다시 예약한다. 권한이 없으면(`requestPermissionsAsync` 미허용) `false`를 반환하고 예약하지 않는다.
- **trigger 계산**: `triggerDate`는 `dateKey`와 스케줄의 `localTime`(`HH:mm`)으로 기기 로컬 시각을 만든다. `SchedulableTriggerInputTypes.DATE`를 사용한다.
- **content**: title은 `${petName} 약 먹일 시간이에요`, body는 `schedule.medicationName`.

### 스케줄 시간별 분리 저장

하루 여러 번 복용하는 약은 UI에서는 같은 약 아래 여러 복용 시간으로 보여주되, 저장은 **시간별 개별 일정**(`CareMedicationSchedule`, 각각 고유 `id`/`localTime`)으로 분리한다. 알림 예약도 이 분리된 시간별 일정 단위로 이뤄진다.

## 타임라인 탭 라우팅 UI 계약

Home 타임라인 항목 탭 동작은 Diary record origin으로 분기한다.

- **구현 위치**: `apps/mobile/src/presentation/shell/timelineRouting.ts`.
- **계약**: `getTimelineEntryRoute(entry): "diaryEdit" | "checklistNotice"`.
  - `entry.origin === "checklist"` → `"checklistNotice"` (Today에 머물고 Diary edit를 열지 않음. `PawBloomShell.tsx`에서 `today.checklistTimelineReadOnly` notice 표시).
  - 그 외(`origin: "diary"`) → `"diaryEdit"` (해당 카테고리 Diary edit 폼을 연다).
- **근거**: Today checklist가 만든 기록(`origin: "checklist"`)은 상세 수정 대상이 아니고, 직접 작성한 Diary 기록(`origin: "diary"`)만 카테고리별 수정 화면으로 보낸다. 구조화 카테고리를 그 날짜에 직접 저장하면 같은 날 기존 record(checklist-origin 포함)를 갱신하고 `origin: "diary"`로 승격한다.
- 관련 계획: [../exec-plans/archive/care-report-2026-07-completion-log.md](../exec-plans/archive/care-report-2026-07-completion-log.md) (2026-07-04 구현 완료, 완료 기록으로 통합).

## 카테고리별 Diary 폼 헬퍼

Diary 입력 화면은 선택한 카테고리에 따라 노출 필드를 헬퍼로 결정한다. `DiaryEntryScreen.tsx`는 이 헬퍼 결과만 신뢰하고 화면에서 조건 분기를 중복 작성하지 않는다.

- **구현 위치**: `apps/mobile/src/contexts/diary/ui/DiaryEntryScreen.formRules.ts`.
- **구조화 카테고리 집합**: `food`, `water`, `walk`, `stool`, `condition`.
- **`getDiaryCategoryFormState(category)`** → `{ showsDetail, showsMemo, showsPhotos }`:
  - `showsDetail`: 구조화 카테고리일 때만 true (전용 상세 입력 노출).
  - `showsMemo`: `category === "memo"`일 때만 true.
  - `showsPhotos`: `category === "photo"`일 때만 true.
- **저장 헬퍼(같은 파일)**:
  - `getDiaryDetailForSave(category, detail)`: 구조화 카테고리이고 `detail.category`가 일치할 때만 detail 저장, 아니면 `undefined`.
  - `getDiarySummaryForSave(category, memo)`: `memo`/`photo`일 때만 `memo.trim()`, 아니면 빈 문자열.
  - `getDiaryPhotosForSave(category, photos, isEditing)`: `photo`이고 신규 작성(`!isEditing`)일 때만 photos, 아니면 `undefined`.
- 관련 계획: [../exec-plans/archive/week1-completion-log.md](../exec-plans/archive/week1-completion-log.md) (완료 기록으로 통합).
