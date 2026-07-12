---
owner_model: claude-opus-4.8-extra
domain: planning
edit_policy: exclusive
---

# 투약·식사 시간 로컬 알림 — 설계

status: approved-for-implementation · 구현계획: [`docs/exec-plans/active/0004-reminder-notifications-plan.md`](../../exec-plans/active/0004-reminder-notifications-plan.md)

## 배경과 문제

보호자가 반려동물별 투약 시간과 식사 시간을 설정하면, 설정한 각 시간에 핸드폰 로컬 알림이 도착해야 한다. 서버 push가 아니라 **기기 로컬 예약 알림**(expo-notifications)으로 구현한다. 앱이 꺼져 있어도 OS가 예약된 알림을 발송한다.

## 현재 상태 (2026-07-12 코드 조사)

- **투약 알림 스케줄링은 이미 구현됨**: `medication/application/medicationReminderNotifications.ts`가 daily/date 트리거, 계정 스코프 식별자(`medication:{userId}:…`), iOS pending 예산(60) 관리, 커버리지 가드까지 갖췄고, 케어 설정 저장 시(`PawBloomShell.saveCareSetupAndRefreshReminders`)와 마운트 시(silent, 권한 요청 없음) 재스케줄되며, 계정 전환 시 `identity/application/authContextState.ts`가 이전 계정 알림을 취소한다.
- **표시 계층이 없음(핵심 결손)**: 앱 어디에도 `setNotificationHandler`가 없어 **포그라운드에서 알림이 표시되지 않는다**. Android 알림 채널 설정과 `app.json`의 expo-notifications 플러그인도 없다. 즉 기존 투약 알림도 지금은 반쪽 동작이다.
- **식사 시간은 데이터 모델 자체가 없음**: `routine/domain/petRoutine.ts`의 `food.meals`는 끼니별 `offeredGrams`만 있다. 시간·알림 토글·알림 스케줄링·UI 전부 신규다.
- 루틴은 `pet_routines.routine` **jsonb 단일 컬럼**에 저장되고 `mapRoutineRow`가 defaults와 deep-merge하므로 **DB 마이그레이션 없이** 필드 확장이 가능하다.

## 목표

1. 보호자가 반려동물별로 아침/점심/저녁 식사 시간을 설정하고 식사 알림을 켜면, 매일 그 시간에 로컬 알림이 온다.
2. 기존 투약 알림이 포그라운드/Android에서도 실제로 보이도록 앱 공통 알림 표시 부트스트랩을 갖춘다.
3. 두 알림 기능이 서로(그리고 iOS pending 64 한도)를 깨뜨리지 않는 명시적 계약을 갖는다.

## 비목표 (이번 슬라이스 제외)

- 알림 탭 시 특정 화면으로 딥링크 이동(탭하면 앱만 열림 — OS 기본)
- 요일별로 다른 식사 시간, 간식 시간 UI(도메인 타입에는 snack 슬롯이 이미 있어 엔진은 처리하되 UI는 아침/점심/저녁만)
- 물/산책 알림, 원격 서버 push, 알림 히스토리, 기기 간 알림 상태 동기화 보장
- 구독 게이트(알림은 Free 포함 — PRODUCT_SPEC의 Free 제한 목록에 없음)

## 제품 결정

- **설정 위치**: 펫 설정의 루틴 패널(`RoutineSettingsPanel`). 끼니별 시간 입력(design-system `TimePickerField` 재사용) + 식사 알림 켜기/끄기 SegmentedControl(산책 토글 패턴 미러).
- **기본값**: `mealRemindersEnabled`는 기본 **켜짐**, 시간은 기본 미설정. 시간이 설정된 끼니만 알림이 예약되므로 "시간을 입력하면 알림이 온다"가 자연스러운 기본 경험이 된다. 토글은 시간을 지우지 않고 알림만 끄는 용도.
- **알림 카피** (i18n en/ko, `{petName}` 치환): 제목 "Time for {petName}'s meal" / "{petName} 밥 시간이에요", 본문은 끼니 라벨(기존 `routine.breakfast` 등 재사용). 투약 알림 카피는 기존 유지.
- **권한 UX**: 루틴 저장 시에만 권한을 요청하고(케어 저장과 동일), 마운트 시 재스케줄은 권한을 요청하지 않는다(silent). 거부 시 "식사 알림을 보내려면 알림 권한이 필요합니다" 안내 notice.
- **가족 계정**: 알림은 기기 로컬이다. 각 가족 구성원의 기기는 그 기기에서 해당 펫 루틴을 저장하거나 조회(마운트 재스케줄)한 시점 기준으로 알림이 잡힌다.

## 아키텍처 결정

1. **식사 알림은 routine context가 소유** (ddd-feature-isolation). medication의 검증된 패턴을 미러링하되 medication 코드는 **한 줄도 수정하지 않는다**(회귀 리스크 0). 범용 notification context나 레지스트리는 만들지 않는다 — 세 번째 알림 소스(산책·케어플랜 등)가 생기는 시점에 레지스트리 역전을 검토한다.
2. **식별자 네임스페이스 계약**: `medication:{userId}:…`(기존) / `meal:{userId}:{petId}:{slot}`(신규). 각 기능은 자기 prefix의 알림만 조회·취소한다. 이 계약을 `docs/engineering/FRONTEND.md`에 기록한다.
3. **iOS pending 예산 협력**: 전역 상한은 기존 상수 60(iOS 실제 한도 64 대비 여유). 식사 알림은 끼니당 DAILY 반복 트리거 1개(펫당 최대 4개)로 소량이라 자체 예산 로직이 불필요하다. medication은 이미 자기 외 pending을 `unrelatedCount`로 차감하므로 식사 알림 수만큼 스스로 줄어든다(협력 기구축).
4. **공통 표시 부트스트랩**: `shared-kernel/notifications/localNotificationBootstrap.ts`(신규, 기능 지식 없음)가 `setNotificationHandler`(배너/리스트/사운드 표시)와 Android `default` 채널(importance HIGH)을 1회 설정. `apps/mobile/App.tsx`가 기존 `configureNetworkSync()` 옆에서 호출. shared-kernel의 provider 접근은 `shared-kernel/supabase/client.ts` 선례를 따른다. `app.json` plugins에 `expo-notifications` 추가.
5. **재스케줄 시점** (medication과 동일 3지점): 루틴 저장 시(권한 요청 O) · 셸 마운트/펫 전환 시(권한 요청 X) · 계정 전환/로그아웃 시 이전 계정 취소(`authContextState`).
6. **웹 no-op**: `Platform.OS === "web"`이면 스케줄링·부트스트랩 모두 조용히 skip. expo-notifications는 SDK 53+에서 웹 예약을 지원하지 않고, 테스트 러너 mock 목록에도 없으므로 **동적 import는 반드시 웹 가드·IO 경계 뒤에** 둔다. 순수 로직(플랜 생성/취소 선택/적용 diff)은 IO를 주입받아 테스트한다(medication 테스트 선례).

## 데이터 모델 (DB 마이그레이션 없음)

```ts
// routine/domain/petRoutine.ts — food 확장
food: {
  meals: Partial<Record<RoutineMealSlot, { offeredGrams?: string; localTime?: string }>>; // "HH:mm" 24h
  appetite?: RoutineAppetite;
  mealRemindersEnabled?: boolean; // 기본 true
};
```

기존 행에는 새 필드가 없어도 `mapRoutineRow`의 defaults 병합으로 하위호환된다. 유효하지 않은 시간 문자열은 플랜 생성에서 조용히 제외한다.

## 리스크와 완화

- **포그라운드 핸들러가 전역 설정이라 투약 알림 동작도 바뀜(의도된 개선)** → Task 6 QA에 투약 알림 회귀 시나리오 포함.
- **iOS 예산 경합**: 식사+투약이 동시에 60에 근접하면 medication 커버리지 가드가 기존대로 오류를 던진다(동작 유지, 신규 리스크 아님). 식사 알림은 펫당 ≤4개로 상한.
- **Expo Go 제약**: SDK 53+ Expo Go는 원격 push만 제한되고 로컬 예약 알림은 동작하나, 최종 확인은 development build/실기기 QA로 한다.

## 수용 기준

1. 식사 시간 설정·저장 후 그 시간에 알림 도착(백그라운드·포그라운드 모두, iOS/Android).
2. 토글 끄기 저장 시 해당 펫의 `meal:*` 예약이 모두 취소된다.
3. 계정 전환/로그아웃 시 이전 계정의 식사 알림이 남지 않는다.
4. 멀티펫에서 펫별 시간이 섞이지 않는다(식별자에 petId 포함).
5. 투약 알림 기존 흐름(케어 저장 notice, 스케줄) 회귀 없음. web preview 크래시 없음.
6. `npm run verify` 전체 통과.
