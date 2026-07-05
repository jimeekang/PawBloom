---
owner_model: codex-high
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

- `identity`: Auth profile, 언어, 계정 설정
- `pet`: 반려동물 프로필, 종, 품종, 나이, 체중
- `routine`: 반려동물별 기본 식사량, 물, 산책, 배변, 컨디션 기준값
- `diary`: 식사, 물, 산책, 배변, 컨디션, 메모, 사진. 컨디션 점수의 원천
- `care`: 질병/상태, care plan, 프로필 기반 케어 기본값
- `medication`: 약 일정, 투약 기간, 반복 간격, 로컬 알림, 오늘 투약 체크, 임시 투약, 누락, 부분 투약, 완료
- `briefing`: AI 요약, 누락 기록, 변화 패턴
- `report`: 병원 리포트, 공유 token, 사용자 확인
- `media`: 사진/영상과 Supabase Storage metadata
- `subscription`: Free, Plus, Family entitlement gate
- `sync`: 오프라인 outbox와 idempotent replay

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
- `application`은 자기 `domain`, 자기 `infrastructure` 인터페이스, `shared-kernel`만 import한다.
- `infrastructure`는 자기 `domain`, 생성된 Supabase type, provider client를 import한다.
- `ui`는 자기 `application`, 자기 `domain`, 공유 UI primitive를 import한다.
- `apps/mobile/src/App.tsx`는 앱 wiring 역할이며 context를 조합할 수 있다.

## 강제 검증

리포지터리는 에이전트가 읽고 수정하기 쉬운 상태를 유지하기 위해 custom script를 사용한다.

- `scripts/verify-architecture.mjs`: context 경계와 파일 크기 점검
- `scripts/verify-i18n.mjs`: 영어/한국어 번역 key 일치 점검
- `scripts/verify-presentation-state.mjs`: presentation 로직 테스트 실행
- `scripts/verify-ai-safety.mjs`: 앱과 Edge Function 출력에서 위험한 의료 문구 차단
- `scripts/verify-secrets.mjs`: secret hard-code 차단
- `scripts/verify-supabase.mjs`: migration의 GRANT와 RLS 적용 범위 점검
- `scripts/verify-offline-sync.mjs`: outbox contract 검증
- `scripts/verify-docs.mjs`: 문서 300줄 제한과 모델 배타 소유 frontmatter 강제 (AGENTS.md 라우팅 계약)
