---
owner_role: codex
domain: implementation
edit_policy: exclusive
---

# PawBloom 아키텍처

PawBloom는 DDD 방식과 bounded context 구조를 사용한다. 각 업무 도메인은 자기 규칙을 소유하고, 외부에는 use case를 통해 기능을 제공한다. 다른 도메인과 협력해야 할 때는 application use case나 명시적인 domain event를 사용한다.

## 기술 스택

- React Native + Expo SDK 56
- Supabase Auth, Postgres, Storage, Edge Functions
- 서버 상태 관리를 위한 TanStack Query
- Auth session 저장을 위한 Expo SecureStore
- 오프라인 outbox를 위한 Expo SQLite
- iOS/Android 빌드를 위한 EAS

## Bounded Context

- `identity`: Auth profile, 언어, 계정 설정, 비밀번호 복구·재인증 변경, 계정 삭제
- `pet`: 반려동물 프로필, 종, 품종, 나이, 체중
- `routine`: 반려동물별 기본 식사량·식사 시간, 식사 알림, 물, 산책, 배변, 컨디션 기준값
- `diary`: 식사, 물, 산책, 배변, 컨디션, 메모, 사진. 컨디션 점수의 원천
- `care`: 질병/상태, care plan, 프로필 기반 케어 기본값
- `medication`: 약 일정, 투약 기간, 반복 간격, 로컬 알림, 오늘 투약 체크, 임시 투약, 누락, 부분 투약, 완료
- `briefing`: 기록 기반 브리핑, 누락 기록, 변화 패턴
- `report`: 병원 리포트, 공유 token, 사용자 확인
- `media`: 사진과 Supabase Storage metadata
- `subscription`: Free, Plus, Family entitlement gate
- `sync`: 계정별 오프라인 outbox, idempotent replay, 충돌 격리·검토 후 폐기

로컬 알림 표시 부트스트랩은 기능별 context가 아니라 `shared-kernel/notifications/localNotificationBootstrap.ts`가 소유한다. 앱 시작 시 한 번 실행해 포그라운드 배너/리스트 표시와 Android 기본 알림 채널을 설정하며, 알림 예약 규칙 자체는 `medication`과 `routine` application 계층이 각각 소유한다.

DB에 저장되는 기본 문구는 현재 UI 언어를 포함하지 않는다. 기본 투약명은 `shared-kernel/recordSentinels.ts`의 언어 중립 sentinel을 사용하고, 내용이 없는 다이어리 기록은 빈 요약을 저장한다. 현재 언어 번역과 과거 한·영 기본 문구 호환은 i18n/UI 경계에서 렌더링할 때 처리한다.

프로필 화면은 `pet`, `routine`, `care`, `medication` use case를 조합할 수 있지만, 병명/상태와 약 일정의 데이터 소유권은 `care`와 `medication` context에 둔다.

## Context 구조

각 context는 아래 구조를 따른다.

```text
apps/mobile/src/contexts/<context>/
  domain/
  application/
  infrastructure/
  ui/
```

레이어 규칙:

- `domain`은 `shared-kernel`만 import한다.
- `application`은 자기 `domain`, 자기 `infrastructure` 인터페이스, `shared-kernel`을 import한다. 다른 context와 협력해야 하면 상대 context의 `application` use case나 `domain` 타입만 명시적으로 import한다.
- `infrastructure`는 자기 `domain`, 생성된 Supabase type, provider client를 import한다.
- `ui`는 자기 `application`, 자기 `domain`, 공유 UI primitive를 import한다.
- `apps/mobile/App.tsx`는 앱 wiring 역할이며 context를 조합할 수 있다.

## 강제 검증

리포지터리는 에이전트가 읽고 수정하기 쉬운 상태를 유지하기 위해 custom script를 사용한다.

- `scripts/verify-architecture.mjs`: context 경계와 파일 크기 점검
- `scripts/verify-i18n.mjs`: 영어/한국어 번역 key 일치와 미사용 key 0건 점검
- `scripts/verify-presentation-state.mjs`: presentation 로직 테스트 실행
- `scripts/verify-ai-safety.mjs`: 앱과 Edge Function 출력에서 위험한 의료 문구 차단
- `scripts/verify-secrets.mjs`: secret hard-code 차단
- `scripts/verify-supabase.mjs`: migration의 GRANT와 RLS 적용 범위 점검
- `scripts/verify-offline-sync.mjs`: outbox와 오프라인 실행 모드 contract 검증
- `scripts/verify-docs.mjs`: 문서 300줄 제한과 모델 배타 소유 frontmatter 강제 (AGENTS.md 라우팅 계약)

## 아바타·공동 추억 목표 구조 (2026-10-18, 미구현)

현재 코드를 설명하는 위 구조에 다음을 추가할 계획이다. 실행 정본은
[0009](docs/exec-plans/active/0009-avatar-care-memories-implementation.md)이며 목표와 구현 완료를 혼동하지 않는다.

- `avatar` 신규 context: 사진 기반 생성 job·검증된 자산·확인 후 적용. 기존 petId를 참조한다.
- `memory` 신규 context: 가족 사진/이야기·여러 pet 연결·작성자·공개 범위·전송 대기 초안.
- `presentation/house` 예정: 여러 캐릭터의 선택·제스처·개인 배치·작은 움직임. 서버 game/room context는 만들지 않는다.
- presentation은 네 메뉴와 아이 상세를 조합한다. 기존 diary/routine/care/medication/briefing/report use case를 재사용한다.
- 다중 아이 조회는 user+pet별 cache를 유지한다. activePet을 반복 전환해 전체 데이터를 읽지 않는다.
- `media`는 private 객체 검증·업로드·정리를 재사용하되 공동 사진 권한을 pet 하나의 경로로 대체하지 않는다.
- `sync`는 기존 케어 outbox를 유지한다. 새 추억 사진은 계정별 안정적인 초안 파일과 온라인 명시적 재시도로 시작한다.
- `identity` 삭제 경계에 신규 job/자산/초안/공동 사진 수명주기를 연결한다. 기존 durable cleanup·replay 장벽을 보존한다.

```text
pet ── avatar job/asset ── presentation 우리 집 ── 아이 요약/상세
 │                                             ├─ 기존 케어/기록 → 기존 요약/report
 └─ memory_pets ── memory ── private media       └─ 가족 추억
```

캐릭터 교체는 pet/기록 교체가 아니다. 공동 추억을 의료 source로 자동 연결하지 않는다.
복수 태그의 작성·변경은 같은 활성 owner/caregiver 집합을 원자 검증하며 조회는 모든 대상에 현재 권한이 있어야 한다.
family membership이나 account metadata를 방 전체의 무조건적인 권한으로 사용하지 않는다.
기존 레이어/import 규칙·계정 경계·번역 경계는 신규 context에도 그대로 적용한다.
