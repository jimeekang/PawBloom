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

## 로컬 알림 공통 계약

모든 로컬 알림은 `apps/mobile/src/shared-kernel/notifications/localNotificationBootstrap.ts`에서 앱 시작 시 표시 핸들러를 멱등 설정한다. 이 모듈은 알림 종류를 알지 않으며, 웹에서는 동적 `expo-notifications` import와 네이티브 설정을 수행하지 않는다.

알림 기능은 자기 계정·기능 namespace만 조회하고 취소한다.

- 투약: `medication:${userId}:...` (`daily` 또는 날짜형 suffix)
- 식사: `meal:${userId}:${petId}:${slot}`
- 식사 알림은 `routine/application/mealReminderNotifications.ts`가 소유하고, `HH:mm` 유효 시간만 `DAILY` 트리거로 예약한다. 펫당 슬롯 최대 4개이며 시간 미설정 또는 토글 off인 슬롯은 예약하지 않는다.
- 계정 전환·로그아웃 시 `authContextState.ts`가 이전 계정의 `medication:`과 `meal:` 예약을 각각 취소한다. 한 기능이 다른 기능의 prefix를 조회·취소하지 않는다.
- 예약 저장 흐름에서만 권한을 요청하고, 앱 시작·포그라운드 복귀·펫 전환 재예약은 현재 권한을 확인하기만 한다. 웹의 예약·취소는 조용한 no-op이다.
- iOS 전역 pending 안전 예산은 투약 예약이 60개로 관리한다. 식사 알림은 슬롯당 DAILY 1개(펫당 최대 4개)이므로 별도 전역 예산을 만들지 않고, 투약 예약이 다른 pending 알림을 포함해 남은 용량을 계산한다.

## 투약 알림 로컬 예약

투약 알림은 기기 로컬 알림(expo-notifications)으로만 예약한다. 서버 push에 의존하지 않는다.

- **구현 위치**: `apps/mobile/src/contexts/medication/application/medicationReminderNotifications.ts`.
- **알림 identifier 규약**: 최종 예약 identifier는 날짜형 `medication:${userId}:${scheduleId}:${dateKey}`, 무기한 매일형 `medication:${userId}:${scheduleId}:daily` 형식이다. 이 접두사(`medication:`), 알림 `data.userId`, `data.petId`로 소유 범위를 판별한다.
- **예약 범위**: 이미 시작한 무기한 매일 일정은 네이티브 `DAILY` 반복 알림 1개를 쓴다. 그 외 일정은 `scheduleAppliesOnDate`로 가까운 시각부터 계산하고, 다른 앱 알림을 제외한 전역 안전 예산 60개 안에서 날짜형 알림을 채운다. 앱 시작·포그라운드 복귀 때 권한을 다시 묻지 않고 rolling 일정을 보충한다.
- **재예약(reschedule)**: 저장 완료 후 반환된 최신 일정으로 새 알림을 먼저 설치한 다음, 현재 반려동물의 이전 알림만 제거한다. 다른 반려동물 알림은 유지하며, 설치 중 실패해도 아직 대체되지 않은 기존 알림은 취소하지 않는다. 저장 버튼 흐름에서만 알림 권한을 요청한다.
- **trigger 계산**: `triggerDate`는 `dateKey`와 스케줄의 `localTime`(`HH:mm`)으로 기기 로컬 시각을 만든다. `SchedulableTriggerInputTypes.DATE`를 사용한다.
- **content**: title은 현재 앱 언어의 `care.reminderTitle`에 반려동물 이름을 넣고, body는 `schedule.medicationName`을 사용한다.

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
  - `getDiarySummaryForSave(category, memo)`: `memo`일 때만 `memo.trim()`, 아니면 빈 문자열. 사진 전용 폼은 숨겨진 메모 상태를 저장하지 않는다.
  - `getDiaryPhotosForSave(category, photos, isEditing)`: `photo`이고 신규 작성(`!isEditing`)일 때만 photos, 아니면 `undefined`.
- 관련 계획: [../exec-plans/archive/week1-completion-log.md](../exec-plans/archive/week1-completion-log.md) (완료 기록으로 통합).
