---
owner_model: claude-opus-4.8-extra
domain: planning
edit_policy: exclusive
---

# Week 1 완료 로그 (Auth · Pet · Today Data Binding 안정화)

> **아카이브 문서.** 활성 추적은 [../active/0003-weekly-execution-checklist.md](../active/0003-weekly-execution-checklist.md) 참조.
> **기간:** 2026-06-26 금 ~ 2026-07-02 목. **상태:** 완료(smoke/RLS checkpoint 커밋만 미기록, 아래 후속 참조).
> **목표:** 회원가입·로그인 유지·반려동물 생성/선택/수정, Today/Diary/Care 실데이터 연결을 안정화하고 Reports 구현 전 기록 데이터 품질을 확보.

## Day 1 (06-26): 완료된 vertical slice 확인

**변경 파일:** `supabase/migrations/20260626000000_profiles_on_signup.sql`, `apps/mobile/generated-supabase/database.types.ts`, `apps/mobile/src/shared-kernel/supabase/client.ts`, `apps/mobile/src/contexts/identity/**`, `apps/mobile/src/contexts/diary/application/diaryRecords.ts`, `apps/mobile/src/contexts/medication/application/medicationDoseRecords.ts`, `apps/mobile/src/presentation/PawBloomShell.tsx`, `apps/mobile/src/presentation/liveUiState.ts`, `apps/mobile/src/presentation/screens/{AuthScreen,PetOnboardingScreen,DiaryEntryScreen,CareModeScreen}.tsx`, `scripts/verify-secrets.mjs`

- [x] Supabase project 연결 + remote migration 적용, DB type 갱신
- [x] 앱에 Supabase URL / publishable key 연결, service role·OpenAI key 앱에서 제외
- [x] `.env`, `.env.*`, Supabase temp 파일 git 제외 + secret 검증 script 추가
- [x] 회원가입/로그인 화면, Supabase Auth session 연결, Expo SecureStore session 유지
- [x] 가입 후 `profiles` row 생성, 반려동물 생성/선택, owner membership 연결
- [x] Today 화면 실제 pet 선택 사용, Today 타임라인·체크리스트를 실제 `diary_entries`/medication 기록에 연결
- [x] Diary 저장 → DB insert, Care medication dose 상태 변경 → DB update 연결
- [x] Supabase RLS smoke test 실행, `npm run verify` 통과, 원격 브랜치 push
- [x] commit `a2cc617 Add Supabase auth and pet onboarding slice`
- [x] commit `f7b43da Bind today diary and care screens to Supabase`

## Day 2 (완료): Pet profile 수정 + sample data 제거 준비

**파일:** `apps/mobile/src/contexts/identity/application/{authContextTypes,authContextState,authContextQueries}.ts`, `PetOnboardingScreen.tsx`, `i18n/translations.ts`

- [x] `updatePet` application API 추가, Supabase `pets` update를 membership/RLS 기준 실행
- [x] Pet onboarding에 이름·species·breed·생년월일·체중 수정 UI 추가
- [x] 저장 후 TanStack/Auth state의 `pets`·`activePet` 갱신, sample pet fallback이 로그인 flow에 섞이지 않음 확인
- [x] `npm --prefix apps/mobile run typecheck` + `npm run verify`
- [x] commit `feat: add pet profile editing`

## Day 3 (완료): Diary list 날짜 기준 확장

**파일:** `diary/application/diaryRecords.ts`, `PawBloomShell.tsx`, `DiaryEntryScreen.tsx`, `i18n/translations.ts`

- [x] `useDiaryEntriesByDate(petId, dateKey)` hook 추가, Today 조회와 날짜별 조회가 같은 mapper 공유
- [x] Diary 화면에서 저장 직후 오늘 기록 즉시 표시, condition score 없는 category는 score 미저장 확인
- [x] 저장 실패 시 짧은 오류 notice, 달력 기반 날짜 선택 + 일별/주별 필터
- [x] 일상 다이어리 사진 최대 5장 선택/저장, Care 화면 식사·음수·컨디션 기록을 메모/사진과 함께 저장
- [x] 사진 5장 제한 + condition score 무결성 migration 추가
- [x] `npm --prefix apps/mobile run typecheck` + `npm run verify`
- [x] commit `feat: show persisted diary entries by date`

## Day 4 (완료, 커밋 미기록): Care quick dose를 실제 medication model로 정리

**파일:** `medication/application/medicationDoseRecords.ts`, `CareModeScreen.tsx`, `PawBloomShell.tsx`, `i18n/translations.ts`

- [x] 임시 이름 quick medication 생성을 "빠른 투약 기록" UI로 변경
- [x] `pending`/`completed`/`skipped`/`partial` 상태를 이해하기 쉬운 문구로 정리
- [x] dose status 변경 후 Today checklist medication 상태 즉시 반영, recorded time을 update 시점에 저장 확인
- [x] `npm --prefix apps/mobile run typecheck` + `npm run verify`
- [ ] commit `feat: stabilize quick medication records` (미기록)

## Day 4A (완료): 기본 루틴 + care plan 불러오기 선행 구현

**신규:** `supabase/migrations/20260627000000_pet_routines.sql`, `contexts/routine/**`, `care/application/carePlanRecords.ts`, `care/domain/carePlan.ts`, `screens/{RoutineSettingsPanel,CareSetupPanel}.tsx`, `routine/application/petRoutineSpecies.test.ts`
**수정:** `DiaryEntryScreen.tsx`, `PetOnboardingScreen.tsx`, `CareModeScreen.tsx`, `PawBloomShell.tsx`, `i18n/translations.ts`

- [x] 프로필에서 기본 식사량·물·선택형 산책·배변·컨디션 기준값 저장, Diary 입력에서 카테고리별 초깃값으로 불러옴
- [x] 산책 기본값: 강아지 ON, 고양이/기타 OFF (프로필에서 수정 가능)
- [x] 역할 분리: Diary=일상 기록, Care Mode=care plan·약·용량·투약 상태·반응
- [x] 상태/진단명·care plan·약 이름·용량·복용 시간 1회 저장, Care 화면에서 오늘 투약 기록 초깃값으로 불러옴
- [x] 실제 오늘 기록은 `diary_entries`·`medication_doses`에 별도 저장
- [x] `npm --prefix apps/mobile run typecheck` + `npm run verify`

## Day 5 (완료, 커밋 미기록): Reports 탭 실데이터 skeleton 연결

**신규:** `report/application/reportDraftRecords.ts`. **수정:** `PawBloomShell.tsx`, `ReportsScreen.tsx`, `i18n/translations.ts`

- [x] 최근 7일 `diary_entries`·`medication_doses`를 pet 기준 조회하는 report draft hook
- [x] Reports mock summary를 실제 기록 개수·condition trend·missed medication count 기반으로 교체
- [x] 기록 없을 때 empty state, AI 생성 전 단계는 "기록 기반 초안"만 표시
- [x] `npm --prefix apps/mobile run typecheck` + `npm run verify`
- [ ] commit `feat: bind reports draft to records` (미기록)

## Day 5A (완료): Diary/Care record correction + Today dashboard

**수정:** `liveUiState.ts`, `HomeScreen.tsx`, `PawBloomShell.tsx`, `i18n/translations.ts`. **신규:** `liveUiState.dashboard.test.ts`, `screens/HomeDashboardPanel.tsx`

- [x] Diary 기록 목록에서 열어 편집, 확인 후 삭제
- [x] Care medication 기록 열어 편집, 확인 후 삭제
- [x] Today dashboard: completion, attention signals, care summary, recent timeline, quick actions 표시
- [x] `npm --prefix apps/mobile run typecheck` + `npm run verify`

## Day 6 (완료, 커밋 미기록): Week 1 모바일 smoke test

- [x] Expo dev에서 로그인 상태, 반려동물 생성/선택/수정 정상 확인
- [x] Today checklist 기록 DB 저장 + reload 후 유지, Diary 저장이 Today timeline·Diary 목록 반영
- [x] Care quick dose 추가/상태 변경 DB 저장, Reports draft가 실제 기록 기반 표시
- [x] 발견 오류 선수정, `npm run verify`
- [ ] commit `test: complete week 1 smoke fixes` (미기록)

## Day 7 (완료, 커밋 조건부): Week 1 보안/RLS checkpoint

**파일(필요 시):** `supabase/migrations/**`, `scripts/verify-supabase.mjs`, `scripts/verify-secrets.mjs`

- [x] public table 전체 RLS + explicit GRANT 유지 확인, pet membership 기준 조회/insert/update 권한 동작 확인
- [x] 앱 bundle에 service role·OpenAI key·Supabase access token 미포함 확인
- [x] Supabase smoke test를 publishable key 기준 재실행, `npm run verify`
- [ ] commit `chore: harden week 1 auth data checks` (수정 있을 때만)

## Week 1 후속(미기록 커밋)

Day 4/5/6의 완료 항목은 후속 커밋(`4d1ce4a feat: edit diary care records and dashboard` 등)에 병합됨. 아래 개별 커밋 메시지는 미기록 상태로 남음 — 이력 정리 시 참고:
`feat: stabilize quick medication records`, `feat: bind reports draft to records`, `test: complete week 1 smoke fixes`, `chore: harden week 1 auth data checks`.
