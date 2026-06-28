# PawBloom Weekly MVP Execution Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 2026-06-26부터 4주 안에 PawBloom의 Supabase 기반 MVP vertical slice를 병원 리포트 공유까지 실행 가능한 상태로 만든다.

**Architecture:** React Native + Expo 앱은 DDD bounded context 구조를 유지하고, Supabase row shape은 context application/infrastructure 경계에서 domain model로 변환한다. Mobile app에는 Supabase publishable key만 포함하고, service role key와 OpenAI key는 Edge Function 환경에만 둔다. 모든 DB 변경은 RLS, explicit GRANT, generated DB type 갱신, `npm run verify` 통과를 포함한다.

**Tech Stack:** Expo SDK 56, React Native, TanStack Query, Expo SecureStore, Expo SQLite, Supabase Auth/Postgres/Storage/Edge Functions, TypeScript.

---

## 운영 규칙

- [ ] 각 작업 시작 전 관련 문서만 읽는다: `docs/product/PRODUCT_SPEC.md`, `ARCHITECTURE.md`, 관련 engineering 문서.
- [ ] DB 변경이 있으면 `supabase/migrations/**`에 migration을 추가하고 remote 적용 후 DB type을 갱신한다.
- [ ] Mobile secret에는 publishable key만 사용한다. service role, OpenAI key, Supabase access token은 앱 코드와 git에 넣지 않는다.
- [ ] 사용자 문구는 `apps/mobile/src/i18n/translations.ts`에 둔다.
- [ ] 작업 단위마다 작은 검증을 먼저 실행하고, handoff 전에는 반드시 `npm run verify`를 실행한다.
- [ ] 기능 단위가 끝나면 커밋하고 원격 브랜치 `data-migratin-login`에 push한다.

## 현재 기준 상태

- Branch: `data-migratin-login`
- Remote branch: `origin/data-migratin-login`
- Latest completed commit: `f7b43da Bind today diary and care screens to Supabase`
- Required verification: `npm run verify`
- Expo dev URL: `http://localhost:8081/`

## Week 1: Auth, Pet, Today Data Binding 안정화

**기간:** 2026-06-26 금요일 - 2026-07-02 목요일

**목표:** 회원가입, 로그인 유지, 반려동물 생성/선택, Today/Diary/Care 실데이터 연결을 안정화하고 Reports 구현 전에 기록 데이터 품질을 확보한다.

### Day 1: 2026-06-26 금요일, 완료된 vertical slice 확인

**Files already changed:**
- `supabase/migrations/20260626000000_profiles_on_signup.sql`
- `apps/mobile/generated-supabase/database.types.ts`
- `apps/mobile/src/shared-kernel/supabase/client.ts`
- `apps/mobile/src/contexts/identity/**`
- `apps/mobile/src/contexts/diary/application/diaryRecords.ts`
- `apps/mobile/src/contexts/medication/application/medicationDoseRecords.ts`
- `apps/mobile/src/presentation/PawBloomShell.tsx`
- `apps/mobile/src/presentation/liveUiState.ts`
- `apps/mobile/src/presentation/screens/AuthScreen.tsx`
- `apps/mobile/src/presentation/screens/PetOnboardingScreen.tsx`
- `apps/mobile/src/presentation/screens/DiaryEntryScreen.tsx`
- `apps/mobile/src/presentation/screens/CareModeScreen.tsx`
- `scripts/verify-secrets.mjs`

- [x] Supabase project 연결과 remote migration 적용
- [x] DB type 갱신
- [x] 앱에 Supabase URL / publishable key 연결
- [x] service role key와 OpenAI key를 앱에서 제외
- [x] `.env`, `.env.*`, Supabase temp 파일 git 제외
- [x] secret 검증 script 추가
- [x] 회원가입 화면 구현
- [x] 로그인 화면 구현
- [x] Supabase Auth session 연결
- [x] Expo SecureStore session 유지
- [x] 가입 후 `profiles` row 생성
- [x] 반려동물 생성
- [x] 반려동물 선택
- [x] owner membership 연결
- [x] Today 화면에서 실제 pet 선택 사용
- [x] Today 타임라인을 실제 `diary_entries`에 연결
- [x] Today 체크리스트를 실제 diary/medication 기록으로 연결
- [x] Diary 저장을 실제 DB insert로 연결
- [x] Care medication dose 상태 변경을 실제 DB update로 연결
- [x] Supabase RLS smoke test 실행
- [x] `npm run verify` 통과
- [x] commit `a2cc617 Add Supabase auth and pet onboarding slice`
- [x] commit `f7b43da Bind today diary and care screens to Supabase`
- [x] 원격 브랜치 push

### Day 2: Pet profile 수정과 sample data 제거 준비

**Files:**
- Modify: `apps/mobile/src/contexts/identity/application/authContextTypes.ts`
- Modify: `apps/mobile/src/contexts/identity/application/authContextState.ts`
- Modify: `apps/mobile/src/contexts/identity/application/authContextQueries.ts`
- Modify: `apps/mobile/src/presentation/screens/PetOnboardingScreen.tsx`
- Modify: `apps/mobile/src/i18n/translations.ts`

- [x] `updatePet` application API를 추가한다.
- [x] Supabase `pets` update query를 membership/RLS 기준으로 실행한다.
- [x] Pet onboarding 화면에서 이름, species, breed, 생년월일, 체중 수정 UI를 추가한다.
- [x] 수정 저장 후 TanStack/Auth state의 `pets`와 `activePet`이 갱신되게 한다.
- [x] sample pet fallback이 로그인 사용자 flow에 섞이지 않는지 확인한다.
- [x] `npm --prefix apps/mobile run typecheck`를 실행한다.
- [x] `npm run verify`를 실행한다.
- [x] `feat: add pet profile editing` 커밋을 만든다.

### Day 3: Diary list를 날짜 기준으로 확장

**Files:**
- Modify: `apps/mobile/src/contexts/diary/application/diaryRecords.ts`
- Modify: `apps/mobile/src/presentation/PawBloomShell.tsx`
- Modify: `apps/mobile/src/presentation/screens/DiaryEntryScreen.tsx`
- Modify: `apps/mobile/src/i18n/translations.ts`

- [x] `useDiaryEntriesByDate(petId, dateKey)` hook을 추가한다.
- [x] Today 전용 조회와 날짜별 조회가 같은 mapper를 공유하게 정리한다.
- [x] Diary 화면에서 오늘 기록 목록을 저장 직후 바로 보여준다.
- [x] condition score가 없는 category는 score를 저장하지 않도록 확인한다.
- [x] 저장 실패 시 사용자에게 짧은 오류 notice를 보여준다.
- [x] 달력 기반 날짜 선택과 일별/주별 필터를 추가한다.
- [x] 일상 다이어리 사진을 최대 5장까지 선택/저장하도록 연결한다.
- [x] Care 화면에서 식사, 음수, 컨디션 기록을 메모/사진과 함께 저장할 수 있게 한다.
- [x] 다이어리 사진 5장 제한과 condition score 무결성을 migration으로 추가한다.
- [x] `npm --prefix apps/mobile run typecheck`를 실행한다.
- [x] `npm run verify`를 실행한다.
- [x] `feat: show persisted diary entries by date` 커밋을 만든다.

### Day 4: Care quick dose를 실제 medication model로 정리

**Files:**
- Modify: `apps/mobile/src/contexts/medication/application/medicationDoseRecords.ts`
- Modify: `apps/mobile/src/presentation/screens/CareModeScreen.tsx`
- Modify: `apps/mobile/src/presentation/PawBloomShell.tsx`
- Modify: `apps/mobile/src/i18n/translations.ts`

- [x] 임시 이름의 quick medication 생성 흐름을 명확한 “빠른 투약 기록” UI로 바꾼다.
- [x] `pending`, `completed`, `skipped`, `partial` 상태 표시를 사용자가 이해하기 쉬운 문구로 정리한다.
- [x] dose status 변경 후 Today checklist medication 상태가 즉시 반영되는지 확인한다.
- [x] recorded time이 update 시점에 저장되는지 확인한다.
- [x] `npm --prefix apps/mobile run typecheck`를 실행한다.
- [x] `npm run verify`를 실행한다.
- [ ] `feat: stabilize quick medication records` 커밋을 만든다.

### Day 4A: 기본 루틴과 care plan 불러오기 선행 구현

**Files:**
- Create: `supabase/migrations/20260627000000_pet_routines.sql`
- Create: `apps/mobile/src/contexts/routine/**`
- Create: `apps/mobile/src/contexts/care/application/carePlanRecords.ts`
- Create: `apps/mobile/src/contexts/care/domain/carePlan.ts`
- Create: `apps/mobile/src/presentation/screens/RoutineSettingsPanel.tsx`
- Create: `apps/mobile/src/presentation/screens/CareSetupPanel.tsx`
- Create: `apps/mobile/src/contexts/routine/application/petRoutineSpecies.test.ts`
- Modify: `apps/mobile/src/presentation/screens/DiaryEntryScreen.tsx`
- Modify: `apps/mobile/src/presentation/screens/PetOnboardingScreen.tsx`
- Modify: `apps/mobile/src/presentation/screens/CareModeScreen.tsx`
- Modify: `apps/mobile/src/presentation/PawBloomShell.tsx`
- Modify: `apps/mobile/src/i18n/translations.ts`

- [x] 반려동물 프로필에서 기본 식사량, 물, 선택형 산책, 배변, 컨디션 기준값을 저장한다.
- [x] Diary 입력에서 저장된 기본 루틴을 카테고리별 초깃값으로 불러온다.
- [x] 산책은 강아지 기본 ON, 고양이/기타 기본 OFF로 두고 프로필에서 수정할 수 있게 한다.
- [x] Diary는 일상 기록만 쓰고 Care Mode가 care plan, 약, 용량, 투약 상태, 반응을 담당한다.
- [x] 상태/진단명, care plan, 약 이름, 용량, 복용 시간을 한 번 저장한다.
- [x] Care 화면에서 저장된 약 정보를 오늘 투약 기록 초깃값으로 불러온다.
- [x] 실제 오늘 기록은 `diary_entries`와 `medication_doses`에 별도로 저장한다.
- [x] `npm --prefix apps/mobile run typecheck`를 실행한다.
- [x] `npm run verify`를 실행한다.

### Day 5: Reports 탭 실데이터 skeleton 연결

**Files:**
- Create: `apps/mobile/src/contexts/report/application/reportDraftRecords.ts`
- Modify: `apps/mobile/src/presentation/PawBloomShell.tsx`
- Modify: `apps/mobile/src/presentation/screens/ReportsScreen.tsx`
- Modify: `apps/mobile/src/i18n/translations.ts`

- [x] 최근 7일 `diary_entries`와 `medication_doses`를 pet 기준으로 조회하는 report draft hook을 만든다.
- [x] Reports 화면의 mock summary를 실제 기록 개수, condition trend, missed medication count 기반으로 바꾼다.
- [x] 기록이 없는 경우 empty state를 보여준다.
- [x] AI 생성 전 단계에서는 “기록 기반 초안”만 표시한다.
- [x] `npm --prefix apps/mobile run typecheck`를 실행한다.
- [x] `npm run verify`를 실행한다.
- [ ] `feat: bind reports draft to records` 커밋을 만든다.

### Day 6: Week 1 모바일 smoke test

**Files:**
- Modify only if needed: `apps/mobile/src/**`

- [ ] Expo dev 화면에서 로그인 상태를 확인한다.
- [ ] 반려동물 생성, 선택, 수정이 정상 동작하는지 확인한다.
- [ ] Today checklist 기록이 DB에 저장되고 reload 후 유지되는지 확인한다.
- [ ] Diary 저장 후 Today timeline과 Diary 목록에 반영되는지 확인한다.
- [ ] Care quick dose 추가와 상태 변경이 DB에 저장되는지 확인한다.
- [x] Reports draft가 실제 기록 기반으로 표시되는지 확인한다.
- [ ] 발견한 오류를 먼저 수정한다.
- [x] `npm run verify`를 실행한다.
- [ ] `test: complete week 1 smoke fixes` 커밋을 만든다.

### Day 7: Week 1 보안/RLS checkpoint

**Files:**
- Modify if needed: `supabase/migrations/**`
- Modify if needed: `scripts/verify-supabase.mjs`
- Modify if needed: `scripts/verify-secrets.mjs`

- [ ] public table 전체에 RLS와 explicit GRANT가 유지되는지 확인한다.
- [ ] pet membership 기준 조회/insert/update 권한이 의도대로 동작하는지 확인한다.
- [ ] 앱 bundle에 service role, OpenAI key, Supabase access token이 들어가지 않는지 확인한다.
- [ ] Supabase smoke test를 publishable key 기준으로 다시 실행한다.
- [ ] `npm run verify`를 실행한다.
- [ ] 필요한 수정이 있으면 `chore: harden week 1 auth data checks` 커밋을 만든다.

## Week 2: Care Plan, Medication Schedule, Walk, Offline

**기간:** 2026-07-03 금요일 - 2026-07-09 목요일

**목표:** Care Mode를 임시 dose 기록에서 care plan 중심 흐름으로 확장하고, 산책/오프라인 저장의 MVP 경로를 만든다.

### Day 8: Care condition과 care plan 생성

**Files:**
- Create: `apps/mobile/src/contexts/care/application/carePlanRecords.ts`
- Create: `apps/mobile/src/contexts/care/domain/carePlan.ts`
- Modify: `apps/mobile/src/presentation/screens/CareModeScreen.tsx`
- Modify: `apps/mobile/src/i18n/translations.ts`

- [ ] condition name, start date, status를 저장하는 care plan domain type을 만든다.
- [ ] Supabase `conditions`와 `care_plans` query/mutation hook을 만든다.
- [ ] Care 화면에서 care plan 생성 UI를 추가한다.
- [ ] active care plan이 있으면 Care Mode가 실제 plan 기준으로 표시되게 한다.
- [ ] `npm --prefix apps/mobile run typecheck`를 실행한다.
- [ ] `npm run verify`를 실행한다.
- [ ] `feat: add care plan creation flow` 커밋을 만든다.

### Day 9: Medication schedule 생성

**Files:**
- Create: `apps/mobile/src/contexts/medication/domain/medicationSchedule.ts`
- Create: `apps/mobile/src/contexts/medication/application/medicationScheduleRecords.ts`
- Modify: `apps/mobile/src/presentation/screens/CareModeScreen.tsx`
- Modify: `apps/mobile/src/i18n/translations.ts`

- [ ] medication name, dosage note, schedule time을 입력하는 domain type을 만든다.
- [ ] `medications`와 `medication_schedules` insert/query hook을 만든다.
- [ ] schedule에서 오늘 dose를 생성하거나 조회하는 흐름을 추가한다.
- [ ] quick dose와 scheduled dose가 같은 화면에서 혼동되지 않도록 label을 분리한다.
- [ ] `npm --prefix apps/mobile run typecheck`를 실행한다.
- [ ] `npm run verify`를 실행한다.
- [ ] `feat: add medication schedule flow` 커밋을 만든다.

### Day 10: 건강 관찰형 산책 기록

**Files:**
- Modify: `apps/mobile/src/contexts/diary/domain/diaryEntry.ts`
- Modify: `apps/mobile/src/contexts/diary/application/diaryRecords.ts`
- Modify: `apps/mobile/src/presentation/screens/DiaryEntryScreen.tsx`
- Modify: `apps/mobile/src/presentation/liveUiState.ts`
- Modify: `apps/mobile/src/i18n/translations.ts`

- [ ] walk category에 duration, intensity, stool/urine observation, symptom note 입력값을 추가한다.
- [ ] DB schema에 이미 있는 구조로 저장 가능한지 확인하고 부족하면 migration을 추가한다.
- [ ] Today timeline에서 walk record가 산책 관찰 기록으로 보이게 한다.
- [ ] checklist walk 상태가 실제 walk 기록 기준으로 반영되게 한다.
- [ ] `npm --prefix apps/mobile run typecheck`를 실행한다.
- [ ] `npm run verify`를 실행한다.
- [ ] `feat: add walk observation records` 커밋을 만든다.

### Day 11: Offline outbox 저장

**Files:**
- Modify: `apps/mobile/src/contexts/sync/**`
- Modify: `apps/mobile/src/contexts/diary/application/diaryRecords.ts`
- Modify: `apps/mobile/src/contexts/medication/application/medicationDoseRecords.ts`

- [ ] Expo SQLite outbox 저장 adapter를 구현한다.
- [ ] diary insert 실패 시 outbox에 idempotent mutation을 저장한다.
- [ ] medication dose update 실패 시 outbox에 idempotent mutation을 저장한다.
- [ ] online 복귀 시 replay할 application API를 만든다.
- [ ] 같은 `client_mutation_id`가 중복 저장되지 않게 확인한다.
- [ ] `npm --prefix apps/mobile run typecheck`를 실행한다.
- [ ] `npm run verify`를 실행한다.
- [ ] `feat: persist offline outbox records` 커밋을 만든다.

### Day 12: Offline replay와 conflict policy

**Files:**
- Modify: `apps/mobile/src/contexts/sync/**`
- Modify: `scripts/verify-offline-sync.mjs`

- [ ] outbox replay 성공 시 mutation을 완료 처리한다.
- [ ] replay 실패 시 retryable/non-retryable 상태를 구분한다.
- [ ] 동일 record update는 server `updated_at` 기준으로 마지막 쓰기를 적용한다.
- [ ] offline sync contract 검증 script가 새 mutation shape을 검사하게 한다.
- [ ] `npm --prefix apps/mobile run typecheck`를 실행한다.
- [ ] `npm run verify`를 실행한다.
- [ ] `feat: replay offline mutations` 커밋을 만든다.

### Day 13: Family/caregiver 최소 초대 구조

**Files:**
- Create: `apps/mobile/src/contexts/identity/application/memberRecords.ts`
- Modify if needed: `supabase/migrations/**`
- Modify: `apps/mobile/src/presentation/screens/PetOnboardingScreen.tsx`
- Modify: `apps/mobile/src/i18n/translations.ts`

- [ ] 기존 `pet_members` schema로 owner/caregiver 목록 조회 hook을 만든다.
- [ ] owner가 caregiver email 초대 intent를 만들 수 있는 UI skeleton을 추가한다.
- [ ] 실제 email 발송 전에는 pending member row 또는 invite row만 생성한다.
- [ ] caregiver가 diary/care/medication을 기록할 수 있고 pet 삭제는 못 하는지 RLS를 확인한다.
- [ ] `npm --prefix apps/mobile run typecheck`를 실행한다.
- [ ] `npm run verify`를 실행한다.
- [ ] `feat: add caregiver membership skeleton` 커밋을 만든다.

### Day 14: Week 2 integration checkpoint

- [ ] Auth/Pet/Diary/Care/Medication/Offline 경로를 한 계정으로 end-to-end 확인한다.
- [ ] 다중 pet에서 기록이 섞이지 않는지 확인한다.
- [ ] RLS smoke test를 owner와 caregiver 기준으로 실행한다.
- [ ] `npm run verify`를 실행한다.
- [ ] Week 2 known issues를 이 파일 하단에 기록한다.
- [ ] `test: complete week 2 integration checkpoint` 커밋을 만든다.

## Week 3: AI Briefing, Vet Report, Share Link, Media

**기간:** 2026-07-10 금요일 - 2026-07-16 목요일

**목표:** 실제 기록 기반 AI briefing과 병원용 report를 만들고, 앱 가입 없이 열 수 있는 sanitized share link의 MVP를 구현한다.

### Day 15: AI briefing contract

**Files:**
- Create: `packages/backend/briefingContract.ts`
- Modify: `supabase/functions/generate-ai-brief/index.ts`
- Modify: `docs/product/AI_SAFETY.md`
- Modify: `scripts/verify-ai-safety.mjs`

- [ ] request에는 pet id, date range, user confirmed language만 포함한다.
- [ ] response에는 summary, missingRecords, trendNotes, vetQuestions만 포함한다.
- [ ] diagnosis, emergency judgment, dosage recommendation 문구가 들어가지 않게 contract를 제한한다.
- [ ] AI safety 검증 script가 금지 문구를 검사하게 한다.
- [ ] `npm run verify`를 실행한다.
- [ ] `feat: define ai briefing contract` 커밋을 만든다.

### Day 16: `generate-ai-brief` 구현

**Files:**
- Modify: `supabase/functions/generate-ai-brief/index.ts`
- Modify: `packages/backend/**`
- Modify: `apps/mobile/src/presentation/screens/ReportsScreen.tsx`

- [ ] Edge Function에서 service role로 pet membership을 확인한다.
- [ ] diary, care, medication records를 server side에서 조회한다.
- [ ] OpenAI 호출은 Edge Function 내부에서만 실행한다.
- [ ] output은 AI safety contract로 sanitize한다.
- [ ] Reports 화면에서 briefing draft를 요청하고 표시한다.
- [ ] `npm run verify`를 실행한다.
- [ ] `feat: generate record based ai briefing` 커밋을 만든다.

### Day 17: Vet report 생성

**Files:**
- Create: `packages/backend/reportContract.ts`
- Modify: `supabase/functions/generate-vet-report/index.ts`
- Modify: `apps/mobile/src/presentation/screens/ReportsScreen.tsx`

- [ ] report에는 pet profile, recent timeline, medication adherence, owner notes, AI briefing summary를 포함한다.
- [ ] report 문구는 영어 병원용 summary를 기본으로 생성한다.
- [ ] 사용자가 확인하기 전에는 공유 token을 만들지 않는다.
- [ ] Reports 화면에 confirm 단계 UI를 연결한다.
- [ ] `npm run verify`를 실행한다.
- [ ] `feat: generate vet report draft` 커밋을 만든다.

### Day 18: Report confirmation과 share token

**Files:**
- Modify if needed: `supabase/migrations/**`
- Modify: `supabase/functions/generate-vet-report/index.ts`
- Modify: `apps/mobile/src/presentation/screens/ReportsScreen.tsx`

- [ ] user confirmation 후 sanitized payload version을 저장한다.
- [ ] share token은 만료 시간과 revoked 상태를 가진다.
- [ ] 원본 diary/care/medication table은 viewer에게 직접 노출하지 않는다.
- [ ] Reports 화면에서 shared state와 만료 시간을 보여준다.
- [ ] `npm run verify`를 실행한다.
- [ ] `feat: confirm and share vet reports` 커밋을 만든다.

### Day 19: `get-vet-report` public viewer

**Files:**
- Modify: `supabase/functions/get-vet-report/index.ts`
- Create: `apps/mobile/src/contexts/report/domain/vetReport.ts`
- Modify: `apps/mobile/src/presentation/screens/ReportsScreen.tsx`

- [ ] token으로 sanitized report만 조회한다.
- [ ] expired/revoked token은 안전한 오류 메시지를 반환한다.
- [ ] viewer response에는 owner email, internal ids, original records를 포함하지 않는다.
- [ ] 모바일 화면에서 share link preview를 확인한다.
- [ ] `npm run verify`를 실행한다.
- [ ] `feat: expose sanitized vet report links` 커밋을 만든다.

### Day 20: Private media upload

**Files:**
- Modify if needed: `supabase/migrations/**`
- Create: `apps/mobile/src/contexts/media/application/mediaRecords.ts`
- Modify: `apps/mobile/src/presentation/screens/DiaryEntryScreen.tsx`
- Modify: `apps/mobile/src/i18n/translations.ts`

- [ ] private Supabase Storage bucket 정책을 확인하거나 추가한다.
- [ ] object path에 pet id와 membership 검증 기준을 포함한다.
- [ ] Diary 사진 placeholder를 실제 upload action으로 연결한다.
- [ ] 업로드된 media metadata를 diary entry와 연결한다.
- [ ] `npm run verify`를 실행한다.
- [ ] `feat: upload private diary media` 커밋을 만든다.

### Day 21: Week 3 safety/privacy checkpoint

- [ ] AI output에 진단, 처방, 응급 판단 문구가 없는지 확인한다.
- [ ] report share response에 원본 table 데이터와 개인정보가 없는지 확인한다.
- [ ] Storage policy가 private이고 membership을 확인하는지 검토한다.
- [ ] `npm run verify`를 실행한다.
- [ ] Week 3 known issues를 이 파일 하단에 기록한다.
- [ ] `test: complete week 3 privacy checkpoint` 커밋을 만든다.

## Week 4: Entitlement, QA, Preview Build, Beta 준비

**기간:** 2026-07-17 금요일 - 2026-07-23 목요일

**목표:** MVP 기능을 잠금 UI, 반복 가능한 smoke test, preview build, beta 준비 상태로 정리한다.

### Day 22: Free/Plus/Family locked state

**Files:**
- Create: `apps/mobile/src/contexts/subscription/application/entitlementState.ts`
- Modify: `apps/mobile/src/presentation/PawBloomShell.tsx`
- Modify: `apps/mobile/src/presentation/screens/ReportsScreen.tsx`
- Modify: `apps/mobile/src/i18n/translations.ts`

- [ ] 결제 없이 local entitlement state를 만든다.
- [ ] Free 제한은 report share, family member count, media count처럼 MVP에서 설명 가능한 항목에만 둔다.
- [ ] locked state는 기능 설명 대신 명확한 잠금 상태와 upgrade placeholder만 보여준다.
- [ ] `npm run verify`를 실행한다.
- [ ] `feat: add entitlement locked states` 커밋을 만든다.

### Day 23: caregiver UX polish

**Files:**
- Modify: `apps/mobile/src/presentation/screens/PetOnboardingScreen.tsx`
- Modify: `apps/mobile/src/presentation/shell/ShellHeaders.tsx`
- Modify: `apps/mobile/src/i18n/translations.ts`

- [ ] 현재 사용자의 role을 pet switcher 또는 pet profile 근처에서 확인 가능하게 한다.
- [ ] caregiver는 owner-only action을 볼 수 없거나 disabled state로 본다.
- [ ] role 제한 메시지는 짧고 비기술적인 문구로 표시한다.
- [ ] `npm run verify`를 실행한다.
- [ ] `feat: polish caregiver role states` 커밋을 만든다.

### Day 24: 화면 polish와 접근성

**Files:**
- Modify: `apps/mobile/src/presentation/screens/**`
- Modify: `apps/mobile/src/design-system/**`

- [ ] 작은 화면에서 버튼 text overflow가 없는지 확인한다.
- [ ] Today, Diary, Care, Reports의 empty/loading/error state를 정리한다.
- [ ] icon button에 명확한 accessibility label을 넣는다.
- [ ] iOS simulator와 web preview에서 주요 화면을 확인한다.
- [ ] `npm run verify`를 실행한다.
- [ ] `style: polish mvp screens` 커밋을 만든다.

### Day 25: 반복 가능한 smoke test script

**Files:**
- Create: `scripts/smoke-mobile-data-flow.mjs`
- Modify: `package.json`
- Modify: `docs/engineering/QUALITY.md`

- [ ] Supabase publishable key로 login, pet 조회, diary insert/delete, dose insert/update/delete를 실행하는 script를 만든다.
- [ ] script는 test data를 마지막에 cleanup한다.
- [ ] `npm run smoke:mobile-data-flow` 명령을 추가한다.
- [ ] 실패 시 어느 단계에서 실패했는지 출력하게 한다.
- [ ] `npm run smoke:mobile-data-flow`를 실행한다.
- [ ] `npm run verify`를 실행한다.
- [ ] `test: add mobile data flow smoke script` 커밋을 만든다.

### Day 26: EAS preview build 설정

**Files:**
- Create or modify: `apps/mobile/eas.json`
- Modify: `apps/mobile/app.json`
- Modify: `docs/engineering/RELEASE.md`

- [ ] iOS/Android preview profile을 만든다.
- [ ] app identifier와 slug를 PawBloom 기준으로 확인한다.
- [ ] env var는 EAS secret 또는 local ignored env로만 관리한다.
- [ ] release 문서에 preview build 절차를 업데이트한다.
- [ ] `npm run verify`를 실행한다.
- [ ] `chore: configure eas preview builds` 커밋을 만든다.

### Day 27: Android preview build

**Files:**
- Modify only if build issue requires it: `apps/mobile/**`

- [ ] Android preview build를 생성한다.
- [ ] Galaxy 실제 기기에 설치한다.
- [ ] login, pet, diary, care, report draft를 확인한다.
- [ ] build에서 발견한 runtime 오류를 수정한다.
- [ ] `npm run verify`를 실행한다.
- [ ] 필요한 수정이 있으면 `fix: resolve android preview issues` 커밋을 만든다.

### Day 28: iOS preview build

**Files:**
- Modify only if build issue requires it: `apps/mobile/**`

- [ ] iOS simulator 또는 TestFlight preview build를 생성한다.
- [ ] login, pet, diary, care, report draft를 확인한다.
- [ ] SecureStore session 유지가 iOS에서 동작하는지 확인한다.
- [ ] build에서 발견한 runtime 오류를 수정한다.
- [ ] `npm run verify`를 실행한다.
- [ ] 필요한 수정이 있으면 `fix: resolve ios preview issues` 커밋을 만든다.

### Day 29: Store/Beta package 준비

**Files:**
- Modify: `docs/engineering/RELEASE.md`
- Modify if needed: `docs/product/AI_SAFETY.md`

- [ ] privacy policy에 들어갈 데이터 처리 요약을 정리한다.
- [ ] medical safety wording을 점검한다.
- [ ] App Store와 Google Play internal testing용 screenshot checklist를 만든다.
- [ ] known limitations를 beta notes로 정리한다.
- [ ] `npm run verify`를 실행한다.
- [ ] `docs: prepare beta release notes` 커밋을 만든다.

### Day 30: MVP go/no-go checkpoint

**Files:**
- Modify: `docs/exec-plans/active/0003-weekly-execution-checklist.md`
- Modify if needed: `docs/engineering/RELEASE.md`

- [ ] 계정 생성부터 report share link까지 한 계정으로 end-to-end 확인한다.
- [ ] owner/caregiver 역할별 권한을 확인한다.
- [ ] offline 상태에서 diary/care 기록 후 online replay를 확인한다.
- [ ] AI briefing과 report가 안전 문구 기준을 통과하는지 확인한다.
- [ ] iOS/Android preview build 결과를 기록한다.
- [ ] launch blocker와 post-beta backlog를 분리한다.
- [ ] `npm run verify`를 실행한다.
- [ ] `docs: record mvp go no go checkpoint` 커밋을 만든다.

## 실행 순서 메모

- [ ] 다음 즉시 실행 작업은 Week 1 Day 2 `Pet profile 수정과 sample data 제거 준비`이다.
- [ ] Reports 실데이터 연결은 Week 1 Day 5에서 진행한다.
- [ ] Care plan과 medication schedule은 Week 2에서 quick dose 흐름 위에 확장한다.
- [ ] AI briefing은 최소 1주일치 실제 diary/care 데이터 구조가 안정화된 뒤 Week 3에서 시작한다.
- [ ] Store/Beta 준비는 MVP 기능 smoke test가 안정화된 뒤 Week 4에서 시작한다.

## Known Issues

- [ ] Reports 화면은 아직 완전한 실데이터 report generation이 아니다. Week 1 Day 5와 Week 3에서 단계적으로 연결한다.
- [ ] Pet 수정 UI는 아직 없다. Week 1 Day 2에서 추가한다.
- [ ] Quick medication은 실제 schedule 기반 medication flow가 아니다. Week 2 Day 9에서 schedule 기반으로 확장한다.
- [ ] Offline outbox contract는 있으나 실제 SQLite persistence/replay는 Week 2 Day 11-12에서 구현한다.
- [ ] Family/caregiver 초대는 membership 기반 skeleton부터 만들고 실제 email delivery는 beta 이후로 분리한다.
