# PawBloom 에이전트 맵

이 파일은 전체 설명서가 아니라 문서 지도를 제공한다. 작업자는 현재 작업에 필요한 문서만 읽고 진행한다.

## 모델 라우팅

모호성, 아키텍처, 안전성, 여러 시스템에 걸친 위험이 있는 작업에만 더 강한 모델을 사용한다.

### Codex 5.5 Extra High

사용 대상:

- Product Architecture Lead
- Security Privacy Agent
- QA Release Agent의 최종 검증
- AI 안전 정책 결정
- Database/RLS 설계 리뷰
- mobile, backend, database를 함께 건드리는 교차 도메인 변경
- 릴리스 차단 버그 조사
- 구현 전 최종 계획 리뷰

목적:

- 아키텍처 결정
- 숨은 위험 식별
- 정확성, 안전성, 개인정보, 릴리스 준비 상태 검토
- 제품/기술 트레이드오프가 모호할 때 결정

### Codex 5.5 High

사용 대상:

- 일반 기능 구현
- Backend Edge Agent 구현
- Database Supabase Agent 구현
- UX, 상태, 데이터 흐름, 권한이 포함된 Frontend Mobile Agent 구현
- 공유 동작에 영향을 주는 리팩터링
- 단순하지 않은 흐름의 테스트 설계

목적:

- 프로덕션 코드 구현
- 기존 아키텍처와 컨벤션 유지
- 집중된 테스트 추가
- 중간 난이도 버그 수정

### gpt-5.3-codex-spark

사용 대상:

- 빠른 코드베이스 검색과 요약
- 작고 고립된 수정
- 문구, 문서, 주석, 이름 정리
- 지시가 명확한 기계적 리팩터링
- 테스트 fixture 갱신
- 기존 패턴 안에서의 단순 UI polish
- 의존성 없는 스크립트
- 릴리스 노트 초안
- 이슈 1차 분류

사용 금지 대상:

- 아키텍처 결정
- 보안/개인정보 결정
- RLS 정책 설계
- AI 안전 로직
- 결제, 인증, 의료, 법률 또는 고위험 흐름
- 여러 파일에 걸친 큰 동작 변경
- 최종 QA 승인

### 에스컬레이션 규칙

작업이 좁고, 되돌리기 쉽고, 완료 기준이 명확할 때만 `gpt-5.3-codex-spark`로 시작한다.

다음 조건에서는 `Codex 5.5 High`로 올린다.

- 런타임 동작에 영향을 준다.
- 둘 이상의 하위 시스템이 관련된다.
- 기존 테스트가 없거나 불명확하다.
- 기계적 수정 이상의 판단이 필요하다.

다음 조건에서는 `Codex 5.5 Extra High`로 올린다.

- 아키텍처, 데이터 모델, Auth, RLS, AI 안전, 개인정보, 릴리스 흐름을 바꾼다.
- 문서나 코드 지침이 서로 충돌한다.
- 결과가 배포 전 최종 승인을 필요로 한다.

### 토큰 효율 규칙

- 모든 에이전트가 모든 문서를 읽지 않는다.
- 역할과 작업에 필요한 문서만 읽는다.
- 탐색과 기계적 작업에는 `gpt-5.3-codex-spark`를 사용한다.
- 구현에는 `Codex 5.5 High`를 사용한다.
- 계획, 위험 리뷰, 최종 검증에는 `Codex 5.5 Extra High`를 사용한다.
- 릴리스에 중요한 작업은 여러 약한 리뷰어보다 한 명의 강한 리뷰어를 선호한다.

## 필수 문서

- 제품 범위: `docs/product/PRODUCT_SPEC.md`
- AI 안전: `docs/product/AI_SAFETY.md`
- 아키텍처: `ARCHITECTURE.md`
- 프론트엔드 규칙: `docs/engineering/FRONTEND.md`
- 백엔드 규칙: `docs/engineering/BACKEND.md`
- 데이터베이스 규칙: `docs/engineering/DATABASE.md`
- 품질 게이트: `docs/engineering/QUALITY.md`
- 릴리스 흐름: `docs/engineering/RELEASE.md`

## 역할별 수정 범위

- Product Architecture Lead: `ARCHITECTURE.md`, `docs/product/**`, `docs/exec-plans/**`
- Frontend Mobile Agent: `apps/mobile/**`
- Backend Edge Agent: `supabase/functions/**`, `packages/backend/**`
- Database Supabase Agent: `supabase/migrations/**`, `supabase/seed/**`, `docs/engineering/DATABASE.md`
- Security Privacy Agent: 보안 문서, RLS 테스트, AI 안전 점검
- QA Release Agent: `scripts/**`, 릴리스 문서, EAS 설정, e2e 테스트

## 검증

작업을 넘기기 전 `npm run verify`를 실행한다.
