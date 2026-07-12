---
owner_model: claude-opus-4.8-extra
domain: planning
edit_policy: exclusive
---

# PawBloom Weekly MVP Execution Checklist

> **에이전트 워커:** REQUIRED SUB-SKILL — `superpowers:subagent-driven-development`(권장) 또는 `superpowers:executing-plans`로 task-by-task 구현. 단계는 `- [ ]` 체크박스로 추적한다.

**Goal:** 2026-06-26부터 4주 안에 PawBloom Supabase 기반 MVP vertical slice를 병원 리포트 공유까지 실행 가능한 상태로 만든다.

**Architecture:** React Native + Expo 앱은 DDD bounded context 구조를 유지하고, Supabase row shape은 context application/infrastructure 경계에서 domain model로 변환한다. Mobile 앱에는 Supabase publishable key만 포함, service role key·OpenAI key는 Edge Function 환경에만 둔다. 모든 DB 변경은 RLS, explicit GRANT, generated DB type 갱신, `npm run verify` 통과를 포함한다.

**Tech Stack:** Expo SDK 56, React Native, TanStack Query, Expo SecureStore, Expo SQLite, Supabase Auth/Postgres/Storage/Edge Functions, TypeScript.

---

## 운영 규칙

- 작업 시작 전 관련 문서만 읽는다: `docs/product/PRODUCT_SPEC.md`, `ARCHITECTURE.md`, 관련 engineering 문서.
- DB 변경 시 `supabase/migrations/**`에 migration 추가 → remote 적용 → DB type 갱신.
- **Secret 정책:** Mobile secret에는 publishable key만 사용. service role, OpenAI key, Supabase access token은 앱 코드·git에 절대 넣지 않는다.
- **i18n 위치:** 사용자 문구는 `apps/mobile/src/i18n/translations.ts`에 둔다.
- 작업 단위마다 작은 검증을 먼저 실행하고, handoff 전에는 반드시 `npm run verify`를 실행한다.
- 기능 단위 완료 시 커밋 후 원격 브랜치 `codex/routine-diary-care-defaults`에 push.

## 현재 기준 상태 (2026-07-12)

- Latest commit: `88c88d5 feat: complete functional QA and atomic persistence` (브랜치는 현재 작업 워크트리 기준)
- Required verification: `npm run verify`
- Expo dev URL: `http://localhost:8081/` 또는 `http://localhost:3200/` (실행 명령에 따라 다름)
- **진행 상태:** Week 1 완료 · Week 2 Day 8~12 구현 커밋 확인(세부 검증은 Day 14 checkpoint에서 일괄) · Day 13~14 잔여 · Week 3 기간 진입.

## ▶ 다음 즉시 작업

**투약·식사 시간 로컬 알림 슬라이스 [0004](./0004-reminder-notifications-plan.md)** (2026-07-12 사용자 우선 지시). 완료 후 Week 2 잔여 Day 13(가족 초대 skeleton) → Day 14 checkpoint 순으로 복귀.

---

## Week 1 — Auth · Pet · Today Data Binding 안정화 (완료)

**기간:** 2026-06-26 ~ 2026-07-02. Day 1~7 및 Day 4A/5A 전부 완료(Auth·Pet CRUD·Diary/Care 실데이터 바인딩·기본 루틴·Reports draft skeleton·Today dashboard·smoke·RLS checkpoint). 상세 파일 목록·체크 항목·commit SHA(`a2cc617`, `f7b43da`, `4d1ce4a`)는 [../archive/week1-checklist-log.md](../archive/week1-checklist-log.md) 참조.

**남은 후속:** 미기록 개별 커밋 4건(`feat: stabilize quick medication records`, `feat: bind reports draft to records`, `test: complete week 1 smoke fixes`, `chore: harden week 1 auth data checks`)은 후속 커밋에 병합됨 — 아카이브 로그 참조.

---

## Week 2 — Care Plan · Medication Schedule · Walk · Offline (진행 중)

**기간:** 2026-07-03 금 ~ 2026-07-09 목. **목표:** Care Mode를 임시 dose 기록에서 care plan 중심 흐름으로 확장하고, 산책/오프라인 저장 MVP 경로를 만든다.

> 2026-07-12 확인: Day 8~12 산출물은 커밋 이력으로 확인됨(`6432844` care plan, `ea98713` medication schedule, `24ad354` walk, `7a8b0b8` outbox, `077acdc` replay + QA 후속 커밋). 체크박스는 Day 14 checkpoint에서 일괄 검증 후 채운다.

### Day 8: Care condition과 care plan 생성
**신규:** `care/application/carePlanRecords.ts`, `care/domain/carePlan.ts`. **수정:** `CareModeScreen.tsx`, `i18n/translations.ts`
- [ ] condition name, start date, status를 저장하는 care plan domain type
- [ ] Supabase `conditions`·`care_plans` query/mutation hook
- [ ] Care 화면에 care plan 생성 UI 추가
- [ ] active care plan이 있으면 Care Mode가 실제 plan 기준으로 표시
- [ ] `npm --prefix apps/mobile run typecheck` + `npm run verify`
- [ ] commit `feat: add care plan creation flow`

### Day 9: Medication schedule 생성
**신규:** `medication/domain/medicationSchedule.ts`, `medication/application/medicationScheduleRecords.ts`. **수정:** `CareModeScreen.tsx`, `i18n/translations.ts`
- [ ] medication name, dosage note, schedule time 입력 domain type
- [ ] `medications`·`medication_schedules` insert/query hook
- [ ] schedule에서 오늘 dose를 생성/조회하는 흐름
- [ ] quick dose와 scheduled dose가 같은 화면에서 혼동되지 않게 label 분리
- [ ] `npm --prefix apps/mobile run typecheck` + `npm run verify`
- [ ] commit `feat: add medication schedule flow`

### Day 10: 건강 관찰형 산책 기록
**수정:** `diary/domain/diaryEntry.ts`, `diary/application/diaryRecords.ts`, `DiaryEntryScreen.tsx`, `liveUiState.ts`, `i18n/translations.ts`
- [ ] walk category에 duration, intensity, stool/urine observation, symptom note 추가
- [ ] 기존 DB schema로 저장 가능한지 확인, 부족하면 migration 추가
- [ ] Today timeline에서 walk record가 산책 관찰 기록으로 표시
- [ ] checklist walk 상태가 실제 walk 기록 기준으로 반영
- [ ] `npm --prefix apps/mobile run typecheck` + `npm run verify`
- [ ] commit `feat: add walk observation records`

### Day 11: Offline outbox 저장
**수정:** `contexts/sync/**`, `diary/application/diaryRecords.ts`, `medication/application/medicationDoseRecords.ts`
- [ ] Expo SQLite outbox 저장 adapter 구현
- [ ] diary insert 실패 시 outbox에 idempotent mutation 저장
- [ ] medication dose update 실패 시 outbox에 idempotent mutation 저장
- [ ] online 복귀 시 replay할 application API
- [ ] 같은 `client_mutation_id` 중복 저장 방지 확인
- [ ] `npm --prefix apps/mobile run typecheck` + `npm run verify`
- [ ] commit `feat: persist offline outbox records`

### Day 12: Offline replay와 conflict policy
**수정:** `contexts/sync/**`, `scripts/verify-offline-sync.mjs`
- [ ] outbox replay 성공 시 mutation 완료 처리
- [ ] replay 실패 시 retryable/non-retryable 상태 구분
- [ ] 동일 record update는 server `updated_at` 기준 last-write 적용
- [ ] offline sync contract 검증 script가 새 mutation shape 검사
- [ ] `npm --prefix apps/mobile run typecheck` + `npm run verify`
- [ ] commit `feat: replay offline mutations`

### Day 13: Family/caregiver 최소 초대 구조
**신규:** `identity/application/memberRecords.ts`. **수정(필요 시):** `supabase/migrations/**`, `PetOnboardingScreen.tsx`, `i18n/translations.ts`
- [ ] 기존 `pet_members` schema로 owner/caregiver 목록 조회 hook
- [ ] owner가 caregiver email 초대 intent를 만드는 UI skeleton
- [ ] 실제 email 발송 전에는 pending member row 또는 invite row만 생성
- [ ] caregiver가 diary/care/medication 기록 가능하고 pet 삭제는 불가한지 RLS 확인
- [ ] `npm --prefix apps/mobile run typecheck` + `npm run verify`
- [ ] commit `feat: add caregiver membership skeleton`

### Day 14: Week 2 integration checkpoint
- [ ] Auth/Pet/Diary/Care/Medication/Offline 경로를 한 계정으로 end-to-end 확인
- [ ] 다중 pet에서 기록이 섞이지 않는지 확인
- [ ] RLS smoke test를 owner·caregiver 기준으로 실행
- [ ] `npm run verify`
- [ ] Week 2 known issues를 이 파일 하단에 기록
- [ ] commit `test: complete week 2 integration checkpoint`

---

## Week 3 — AI Briefing · Vet Report · Share Link · Media

**기간:** 2026-07-10 금 ~ 2026-07-16 목. **목표:** 실제 기록 기반 AI briefing과 병원용 report를 만들고, 앱 가입 없이 열 수 있는 sanitized share link MVP를 구현한다.

### Day 15: AI briefing contract
**신규:** `packages/backend/briefingContract.ts`. **수정:** `supabase/functions/generate-ai-brief/index.ts`, `docs/product/AI_SAFETY.md`, `scripts/verify-ai-safety.mjs`
- [ ] request에는 pet id, date range, user confirmed language만 포함
- [ ] response에는 summary, missingRecords, trendNotes, vetQuestions만 포함
- [ ] diagnosis, emergency judgment, dosage recommendation 문구를 contract로 차단
- [ ] AI safety 검증 script가 금지 문구를 검사
- [ ] `npm run verify` · commit `feat: define ai briefing contract`

### Day 16: `generate-ai-brief` 구현
**수정:** `supabase/functions/generate-ai-brief/index.ts`, `packages/backend/**`, `ReportsScreen.tsx`
- [ ] Edge Function에서 service role로 pet membership 확인
- [ ] diary/care/medication records를 server side에서 조회
- [ ] OpenAI 호출은 Edge Function 내부에서만 실행
- [ ] output을 AI safety contract로 sanitize
- [ ] Reports 화면에서 briefing draft 요청·표시
- [ ] `npm run verify` · commit `feat: generate record based ai briefing`

### Day 17: Vet report 생성
**신규:** `packages/backend/reportContract.ts`. **수정:** `supabase/functions/generate-vet-report/index.ts`, `ReportsScreen.tsx`
- [ ] report에 pet profile, recent timeline, medication adherence, owner notes, AI briefing summary 포함
- [ ] report 문구는 영어 병원용 summary 기본 생성
- [ ] 사용자 확인 전에는 공유 token 미생성
- [ ] Reports 화면에 confirm 단계 UI 연결
- [ ] `npm run verify` · commit `feat: generate vet report draft`

### Day 18: Report confirmation과 share token
**수정(필요 시):** `supabase/migrations/**`. **수정:** `supabase/functions/generate-vet-report/index.ts`, `ReportsScreen.tsx`
- [ ] user confirmation 후 sanitized payload version 저장
- [ ] share token은 만료 시간·revoked 상태를 가짐
- [ ] 원본 diary/care/medication table을 viewer에게 직접 노출 안 함
- [ ] Reports 화면에서 shared state와 만료 시간 표시
- [ ] `npm run verify` · commit `feat: confirm and share vet reports`

### Day 19: `get-vet-report` public viewer
**수정:** `supabase/functions/get-vet-report/index.ts`, `ReportsScreen.tsx`. **신규:** `report/domain/vetReport.ts`
- [ ] token으로 sanitized report만 조회
- [ ] expired/revoked token은 안전한 오류 메시지 반환
- [ ] viewer response에 owner email, internal ids, original records 미포함
- [ ] 모바일 화면에서 share link preview 확인
- [ ] `npm run verify` · commit `feat: expose sanitized vet report links`

### Day 20: Private media upload
**수정(필요 시):** `supabase/migrations/**`. **신규:** `media/application/mediaRecords.ts`. **수정:** `DiaryEntryScreen.tsx`, `i18n/translations.ts`
- [ ] private Supabase Storage bucket 정책 확인/추가
- [ ] object path에 pet id·membership 검증 기준 포함
- [ ] Diary 사진 placeholder를 실제 upload action으로 연결
- [ ] 업로드된 media metadata를 diary entry와 연결
- [ ] `npm run verify` · commit `feat: upload private diary media`

### Day 21: Week 3 safety/privacy checkpoint
- [ ] AI output에 진단·처방·응급 판단 문구 없는지 확인
- [ ] report share response에 원본 table 데이터·개인정보 없는지 확인
- [ ] Storage policy가 private이고 membership을 확인하는지 검토
- [ ] `npm run verify` · Week 3 known issues를 하단에 기록
- [ ] commit `test: complete week 3 privacy checkpoint`

---

## Week 4 — Entitlement · QA · Preview Build · Beta 준비

**기간:** 2026-07-17 금 ~ 2026-07-23 목. **목표:** MVP 기능을 잠금 UI, 반복 가능한 smoke test, preview build, beta 준비 상태로 정리한다.

### Day 22: Free/Plus/Family locked state
**신규:** `subscription/application/entitlementState.ts`. **수정:** `PawBloomShell.tsx`, `ReportsScreen.tsx`, `i18n/translations.ts`
- [ ] 결제 없이 local entitlement state 생성
- [ ] Free 제한은 report share, family member count, media count 등 MVP에서 설명 가능한 항목에만
- [ ] locked state는 기능 설명 대신 명확한 잠금 상태 + upgrade placeholder만 표시
- [ ] `npm run verify` · commit `feat: add entitlement locked states`

### Day 23: caregiver UX polish
**수정:** `PetOnboardingScreen.tsx`, `presentation/shell/ShellHeaders.tsx`, `i18n/translations.ts`
- [ ] 현재 사용자 role을 pet switcher 또는 pet profile 근처에서 확인 가능
- [ ] caregiver는 owner-only action을 숨김 또는 disabled로 봄
- [ ] role 제한 메시지는 짧고 비기술적 문구
- [ ] `npm run verify` · commit `feat: polish caregiver role states`

### Day 24: 화면 polish와 접근성
**수정:** `presentation/screens/**`, `design-system/**`
- [ ] 작은 화면에서 버튼 text overflow 없는지 확인
- [ ] Today/Diary/Care/Reports의 empty/loading/error state 정리
- [ ] icon button에 명확한 accessibility label
- [ ] iOS simulator·web preview에서 주요 화면 확인
- [ ] `npm run verify` · commit `style: polish mvp screens`

### Day 25: 반복 가능한 smoke test script
**신규:** `scripts/smoke-mobile-data-flow.mjs`. **수정:** `package.json`, `docs/engineering/QUALITY.md`
- [ ] publishable key로 login, pet 조회, diary insert/delete, dose insert/update/delete 실행 script
- [ ] script는 test data를 마지막에 cleanup
- [ ] `npm run smoke:mobile-data-flow` 명령 추가, 실패 시 실패 단계 출력
- [ ] `npm run smoke:mobile-data-flow` + `npm run verify`
- [ ] commit `test: add mobile data flow smoke script`

### Day 26: EAS preview build 설정
**신규/수정:** `apps/mobile/eas.json`, `apps/mobile/app.json`, `docs/engineering/RELEASE.md`
- [ ] iOS/Android preview profile 생성, app identifier·slug를 PawBloom 기준 확인
- [ ] env var는 EAS secret 또는 local ignored env로만 관리
- [ ] release 문서에 preview build 절차 업데이트
- [ ] `npm run verify` · commit `chore: configure eas preview builds`

### Day 27: Android preview build
**수정(빌드 이슈 시만):** `apps/mobile/**`
- [ ] Android preview build 생성, Galaxy 실기기 설치
- [ ] login/pet/diary/care/report draft 확인, runtime 오류 수정
- [ ] `npm run verify` · 수정 있으면 commit `fix: resolve android preview issues`

### Day 28: iOS preview build
**수정(빌드 이슈 시만):** `apps/mobile/**`
- [ ] iOS simulator 또는 TestFlight preview build 생성
- [ ] login/pet/diary/care/report draft 확인, SecureStore session 유지가 iOS에서 동작하는지 확인, runtime 오류 수정
- [ ] `npm run verify` · 수정 있으면 commit `fix: resolve ios preview issues`

### Day 29: Store/Beta package 준비
**수정:** `docs/engineering/RELEASE.md`, `docs/product/AI_SAFETY.md`(필요 시)
- [ ] privacy policy용 데이터 처리 요약 정리, medical safety wording 점검
- [ ] App Store·Google Play internal testing용 screenshot checklist, known limitations를 beta notes로 정리
- [ ] `npm run verify` · commit `docs: prepare beta release notes`

### Day 30: MVP go/no-go checkpoint
**수정:** 이 파일, `docs/engineering/RELEASE.md`(필요 시)
- [ ] 계정 생성 → report share link까지 한 계정으로 end-to-end 확인
- [ ] owner/caregiver 역할별 권한 확인, offline 기록 후 online replay 확인
- [ ] AI briefing·report가 안전 문구 기준 통과 확인, iOS/Android preview build 결과 기록
- [ ] launch blocker와 post-beta backlog 분리
- [ ] `npm run verify` · commit `docs: record mvp go no go checkpoint`

---

## 실행 순서 메모

- Reports 실데이터 연결: Week 1 Day 5에서 완료(초안 skeleton). 완전한 report generation은 Week 3.
- Care plan·medication schedule: Week 2에서 quick dose 흐름 위에 확장(Day 8~9).
- AI briefing: 최소 1주일치 실제 diary/care 데이터 구조 안정화 후 Week 3에서 시작.
- Store/Beta 준비: MVP smoke test 안정화 후 Week 4에서 시작.

## Known Issues

- [ ] Reports 화면은 아직 완전한 실데이터 report generation이 아니다. Week 3에서 단계적으로 연결(초안은 Day 5 완료).
- [ ] Quick medication은 아직 실제 schedule 기반 flow가 아니다. Week 2 Day 9에서 schedule 기반으로 확장.
- [ ] Offline outbox contract는 있으나 실제 SQLite persistence/replay는 Week 2 Day 11-12에서 구현.
- [ ] Family/caregiver 초대는 membership 기반 skeleton부터(Day 13) 만들고 실제 email delivery는 beta 이후로 분리.
- [ ] 알림 표시 계층 결손: `setNotificationHandler`·Android 채널·`app.json` expo-notifications 플러그인이 없어 투약 알림이 포그라운드에서 표시되지 않는다. [0004](./0004-reminder-notifications-plan.md) Task 1에서 해결.
