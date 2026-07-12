---
owner_model: claude-opus-4.8-extra
domain: planning
edit_policy: exclusive
---

# 0002 PawBloom 1개월 MVP 로드맵 (PM)

> 에이전트 작업자 지침: `superpowers:subagent-driven-development` 또는 `superpowers:executing-plans` 방식으로 작은 vertical slice 단위로 진행하고 checkbox로 상태를 추적한다.
> 상세 일정(주차별 Day-by-Day, Task 단위, 하루 리듬)은 [0003](./0003-weekly-execution-checklist.md)로 위임한다. 이 문서는 PM 로드맵 서술(방향/우선순위/마일스톤 개요)만 유지한다.

## 목표

30일 안에 테스트 가능한 PawBloom MVP를 만든다.

MVP 범위: 계정 필수 login/signup, 다중 반려동물 profile, Today 중심 일상 기록, 건강 관찰형 강아지 산책 기록, Care Mode, 투약 schedule과 dose status, AI briefing, 병원 방문 report와 만료형 공유 link, 가족/caregiver 공동 기록, 오프라인 임시 저장과 재동기화, iOS/Android preview build.

## 제품 방향과 차별화 포지셔닝

PawBloom는 단순 반려동물 기록 앱이 아니다. 핵심 포지션:

> 가족이 함께 남긴 일상/케어 기록을 병원용 briefing으로 정리해주는 앱

- MVP는 `Care/Vet Report 중심`으로 구현한다. 실제 기록이 쌓인 뒤 AI briefing과 vet report의 가치가 커진다.
- **가족 공동 기록은 MVP에 포함**한다. PawBloom 차별화의 핵심이 owner/family 공동 기록이다.
- pet sitter 기간 제한 초대는 beta 후반 또는 V2로 미룬다.
- **건강 관찰형 산책**은 강아지용 차별화 기록으로, vet report source가 되도록 설계한다.

## 아키텍처 원칙

DDD bounded context 구조를 유지하고, 각 기능은 자기 context 안에서 구현한다. 다른 context 연결은 application use case 또는 domain event를 통한다. Supabase row shape은 infrastructure boundary에서 domain model로 변환한다.

- Mobile app은 service role key와 OpenAI API key를 절대 포함하지 않는다. AI 호출은 Supabase Edge Function에서만 수행한다.
- 사용자 문구는 `apps/mobile/src/i18n/translations.ts`에 둔다.
- 스타일은 `apps/mobile/src/design-system`의 token, icon, typography, spacing, component를 기준으로 한다.

모델 라우팅 정책은 재서술하지 않는다 — [`AGENTS.md`](../../../AGENTS.md)를 단일 출처로 참조한다.

## 완료된 계획 흡수

### Week 0 부트스트랩 (구 0001, 완료)

- **완료일**: 부트스트랩 단계 완료.
- **목표**: 초기 리포지터리 하네스, Expo 앱 shell, Supabase schema, Edge Function skeleton, 검증 script 구축.
- **핵심 결정**: DDD 구조 채택, 역할별 수정 범위와 품질 gate 정의, AI/report Edge Function은 안전한 stub으로 선구축.
- **산출**: `AGENTS.md`(역할·문서 진입점), `ARCHITECTURE.md`(DDD 구조·import 규칙), `apps/mobile` Expo shell, `supabase/migrations` 초기 schema(GRANT·RLS 포함), `supabase/functions` skeleton(`generate-ai-brief`/`generate-vet-report`/`get-vet-report`), `verify` script 통과.
- **후속**: schema/함수 skeleton을 실제 구현으로 채우는 작업은 아래 우선순위 P0~P3로 이관됨.

## 현재 구현 상태

### 완료됨

- 에이전트/제품/AI 안전/frontend/backend/database/품질/릴리스 문서 (`AGENTS.md`, `ARCHITECTURE.md`, `docs/product/PRODUCT_SPEC.md`, `docs/product/AI_SAFETY.md` 등).
- Expo mobile app 구조와 context folder: `identity`, `pet`, `diary`, `care`, `medication`, `briefing`, `report`, `media`, `subscription`, `sync`.
- 전역 design token/iconography/category visual/공통 UI component.
- Today, Diary, Care, Reports, bottom navigation UI shell + UI/UX 우선 mock state 연결.
- 반려동물 전환 UI, Today checklist toggle, Diary 입력·사진 placeholder·저장 후 timeline 반영, Care dose status cycle, Report 단계 흐름(empty→draft→confirmed→shared).
- i18n key parity 검증 script, AI safety 검증 script, Supabase 초기 schema migration, Edge Function skeleton, emulator 없이 확인하는 web export/preview script, 포지셔닝·기능 전략 문서.

### 부분 구현됨

- Supabase schema는 있으나 remote project 연결, migration 적용, generated DB type 최신화 필요.
- Edge Function skeleton은 있으나 실제 prompt, contract test, secret 설정 필요.
- Offline sync contract는 있으나 SQLite persistence와 Supabase replay 구현 필요.
- EAS 흐름 문서는 있으나 production-ready `eas.json`, credentials 정책, store metadata checklist 필요.
- Free/Plus/Family 잠금은 제품 결정만 있고 실제 UI gate 구현 필요.
- 투약 알림은 스케줄링·계정 스코프까지 구현되었으나 표시 계층(포그라운드 핸들러, Android 채널, expo-notifications 플러그인)이 없고, 식사 시간 설정·식사 알림은 미구현 — [0004](./0004-reminder-notifications-plan.md)로 진행.

### 미구현

- 계정 필수 login/signup, Supabase Auth session의 Expo SecureStore adapter, profile 생성/수정 UI.
- Supabase 연결 pet CRUD, 가족/caregiver 초대와 role 관리, Supabase 연결 diary CRUD.
- 건강 관찰형 산책 record 저장, 사진/영상 private Storage upload.
- 질병/상태 등록과 care plan workflow, medication schedule과 dose status 저장.
- 실제 기록 기반 AI briefing/vet report 생성, PDF/출력 가능한 report export, sanitized report share link 접근 경로.
- React Native e2e smoke test, Android/iOS device preview build, TestFlight·Google Play internal testing 준비.

## 우선순위

| 우선순위 | 영역 | 먼저 해야 하는 이유 | 완료 기준 |
| --- | --- | --- | --- |
| P0 | 개발 환경, Harness, 문서, 검증 | 기반이 흔들리면 이후 구현이 계속 불안정하다. | `verify` 통과, web preview 확인 가능 |
| P0 | Supabase Auth와 generated DB type | 모든 사용자 데이터 기능의 기준이다. | session 유지, profile 생성, 최신 DB type |
| P1 | Pet profile과 membership | diary, care, medication, media, report의 기준이 pet이다. | owner가 pet 생성/선택, membership 기반 조회 |
| P1 | Family/caregiver role | PawBloom 차별화의 핵심인 공동 기록에 필요하다. | owner/family 권한 분리 |
| P1 | Diary와 timeline | 평상시 사용 가치의 핵심이다. | 기록 저장, 조회, timeline 표시 |
| P1 | 건강 관찰형 산책 | 강아지용 차별화 기록이다. | 산책 시간, 거리, 배변/소변, 증상 관찰 저장 |
| P1 | Care Mode와 medication | 아플 때 사용하는 핵심 기능이다. | condition, medication schedule, dose status 저장 |
| P2 | AI briefing과 vet report | 충분한 실제 기록 이후 가치가 커진다. | 안전한 record-based summary와 report 생성 |
| P2 | Report share link | 병원 공유 경험의 핵심이다. | 원본 table 없이 sanitized report만 조회 |
| P2 | Media upload | 증상 사진과 diary 품질을 높인다. | private Storage upload/download |
| P3 | Subscription gate | 실제 결제 전 구조만 필요하다. | Free/Plus/Family locked state |
| P3 | Store readiness | 기능 smoke test 이후 packaging 단계다. | preview build, metadata, privacy wording |

## 주차별 마일스톤 개요

상세 Day-by-Day 일정, 담당 role, 산출물, Task 단위 파일 목록은 [0003](./0003-weekly-execution-checklist.md)에 있다.

- **Week 1 — 기반 설정과 실제 Auth**: Supabase project 생성/연결, migration 적용, DB type 생성. Supabase Auth client + SecureStore session adapter + login/signup + profile 생성. Pet create/select/edit와 owner membership. Auth/RLS cross-review 후 Week 1 안정화 build.
- **Week 2 — Diary, 산책, Care, Medication, Offline**: Diary command/query(food/water/stool/condition/memo), 건강 관찰형 walk record, 실제 data 기반 timeline·Today checklist, Care condition과 care plan, medication schedule과 dose status(completed/skipped/partial), offline outbox SQLite persistence와 idempotent replay. Week 2 integration review.
- **Week 3 — AI, Report, 공유, Media**: AI briefing request/response contract, `generate-ai-brief` prompt와 안전 output(record-based summary), vet report generation(영어 병원용), report confirmation UI와 share token, `get-vet-report` sanitized viewer(만료 link), private media upload와 Storage policy. AI safety/RLS/report privacy cross-review.
- **삽입 슬라이스 — 투약·식사 시간 로컬 알림 (2026-07-12 사용자 지시)**: Week 3 기간에 우선 병행. 식사 시간 설정과 식사 알림(routine context 소유), 알림 표시 부트스트랩(포그라운드/Android). 상세: [0004](./0004-reminder-notifications-plan.md), 설계: [스펙](../../superpowers/specs/2026-07-12-reminder-notifications-design.md).
- **Week 4 — Entitlement, QA, Build, Beta 준비**: Free/Plus/Family locked state UI, 가족/caregiver role UI polish, 반응형·web preview polish, login~report e2e smoke test, `eas.json`·app identifier·build profile, Android preview build(Galaxy 설치), iOS preview/TestFlight build, store metadata·screenshot·privacy·medical wording review, 최종 regression과 beta go/no-go 판단(30일 MVP checkpoint).

## 이관된 내용 (링크만 유지)

- 설치·계정·EAS·Supabase CLI·로컬 실행 명령·필요한 다운로드/설정·참고 링크: [`docs/engineering/SETUP.md`](../../engineering/SETUP.md).
- Merge gate(verify 통과, RLS/GRANT/generated type/RLS matrix, Edge Function contract·AI safety wording, i18n 문구 위치, cross-context use case/event 연결, store-facing medical wording 회피, Product Architecture Lead 승인 범위): [`docs/engineering/QUALITY.md`](../../engineering/QUALITY.md).
- 모델 라우팅 정책: [`AGENTS.md`](../../../AGENTS.md).
