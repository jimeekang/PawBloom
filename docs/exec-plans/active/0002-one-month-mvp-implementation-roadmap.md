# 0002 PawBloom 1개월 MVP 구현 로드맵

> 에이전트 작업자 지침: 이 계획은 `superpowers:subagent-driven-development` 또는 `superpowers:executing-plans` 방식으로 작은 단위로 나누어 진행한다. 진행 상태는 checkbox로 추적한다.

## 목표

30일 안에 PawBloom의 테스트 가능한 MVP를 만든다.

MVP 범위:

- 계정 필수 login/signup
- 다중 반려동물 profile
- Today 중심 일상 기록
- 건강 관찰형 강아지 산책 기록
- Care Mode
- 투약 schedule과 dose status
- AI briefing
- 병원 방문 report와 만료형 공유 link
- 가족/caregiver 공동 기록
- 오프라인 임시 저장과 재동기화
- iOS/Android preview build

## 제품 방향

PawBloom는 단순 반려동물 기록 앱이 아니다.

핵심 포지션:

> 가족이 함께 남긴 일상/케어 기록을 병원용 briefing으로 정리해주는 앱

MVP는 `Care/Vet Report 중심`으로 구현한다. 가족 공동 기록은 MVP에 포함하고, pet sitter 기간 제한 초대는 beta 후반 또는 V2로 미룬다.

## 아키텍처 원칙

- DDD bounded context 구조를 유지한다.
- 각 기능은 자기 context 안에서 구현한다.
- 다른 context와 연결할 때는 application use case 또는 domain event를 사용한다.
- Supabase row shape은 infrastructure boundary에서 domain model로 변환한다.
- Mobile app은 service role key와 OpenAI API key를 절대 포함하지 않는다.
- AI 호출은 Supabase Edge Function에서만 수행한다.
- 사용자 문구는 `apps/mobile/src/i18n/translations.ts`에 둔다.
- 스타일은 `apps/mobile/src/design-system`의 token, icon, typography, spacing, component를 기준으로 한다.

## 모델 라우팅

사용자가 수정한 현재 `AGENTS.md` 정책을 따른다.

- `gpt-5.3-codex-spark`: 빠른 탐색, 요약, 작은 문서/문구 수정, 기계적 작업
- `Codex 5.5 High`: 일반 기능 구현, frontend/backend/database 구현, UX/state/data flow가 포함된 작업
- `Codex 5.5 Extra High`: 아키텍처, 보안, RLS, AI safety, 개인정보, release 최종 검토

모든 role을 일괄적으로 Extra High로 고정하지 않는다.

## 현재 구현 상태

### 완료됨

- [x] 에이전트 진입 문서 `AGENTS.md`
- [x] DDD 구조 문서 `ARCHITECTURE.md`
- [x] 제품 범위 문서 `docs/product/PRODUCT_SPEC.md`
- [x] AI 안전 문서 `docs/product/AI_SAFETY.md`
- [x] 프론트엔드, 백엔드, 데이터베이스, 품질, 릴리스 문서
- [x] Expo mobile app 구조 `apps/mobile`
- [x] `identity`, `pet`, `diary`, `care`, `medication`, `briefing`, `report`, `media`, `subscription`, `sync` context folder
- [x] 전역 디자인 token, iconography, category visual, 공통 UI component
- [x] Today, Diary, Care, Reports, bottom navigation UI shell
- [x] UI/UX 우선 mock state 연결
- [x] 반려동물 전환 UI
- [x] Today checklist toggle
- [x] Diary 입력, 사진 placeholder, 저장 후 timeline 반영
- [x] Care dose status cycle
- [x] Report 단계 흐름: empty, draft, confirmed, shared
- [x] i18n key parity 검증
- [x] AI safety 검증 script
- [x] Supabase 초기 schema migration
- [x] Edge Function skeleton: `generate-ai-brief`, `generate-vet-report`, `get-vet-report`
- [x] Emulator 없이 확인 가능한 web export/preview script
- [x] 포지셔닝 및 기능 전략 문서

### 부분 구현됨

- [ ] Supabase schema는 있으나 remote project 연결, migration 적용, generated DB type 최신화가 필요하다.
- [ ] Edge Function skeleton은 있으나 실제 prompt, contract test, secret 설정이 필요하다.
- [ ] Offline sync contract는 있으나 SQLite persistence와 Supabase replay 구현이 필요하다.
- [ ] EAS 흐름 문서는 있으나 production-ready `eas.json`, credentials 정책, store metadata checklist가 필요하다.
- [ ] Free/Plus/Family 잠금 구조는 제품 결정이 있으나 실제 UI gate는 더 구현해야 한다.

### 미구현

- [ ] 계정 필수 login/signup flow
- [ ] Supabase Auth session을 Expo SecureStore에 저장하는 adapter
- [ ] 사용자 profile 생성/수정 UI
- [ ] Supabase에 연결된 pet CRUD
- [ ] 가족/caregiver 초대와 role 관리
- [ ] Supabase에 연결된 diary CRUD
- [ ] 건강 관찰형 산책 record 저장
- [ ] 사진/영상 private Supabase Storage upload
- [ ] 질병/상태 등록과 care plan workflow
- [ ] Medication schedule과 dose status 저장
- [ ] 실제 기록 기반 AI briefing 생성
- [ ] 실제 기록 기반 vet report 생성
- [ ] PDF 또는 출력 가능한 report export
- [ ] Sanitized report share link 접근 경로
- [ ] React Native e2e smoke test
- [ ] Android/iOS device preview build
- [ ] TestFlight와 Google Play internal testing 준비

## 우선순위

| 우선순위 | 영역 | 먼저 해야 하는 이유 | 완료 기준 |
| --- | --- | --- | --- |
| P0 | 개발 환경, Harness, 문서, 검증 | 기반이 흔들리면 이후 구현이 계속 불안정하다. | `npm.cmd run verify` 통과, web preview 확인 가능 |
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

## 필요한 다운로드, 계정, 설정

### 지금 필요한 항목

| 항목 | 목적 | 설정 | 확인 |
| --- | --- | --- | --- |
| Node.js 22.11+ / npm 10+ | Expo, TypeScript, script 실행 | Node 공식 installer 사용 | `node -v`, `npm -v` |
| Git | branch, worktree, PR workflow | Git 공식 installer 사용 | `git --version` |
| VS Code 또는 동급 editor | TypeScript 탐색과 터미널 작업 | TypeScript/ESLint extension 권장 | workspace 정상 열림 |
| Docker Desktop | Supabase local stack | Windows에서는 WSL2 backend 권장 | `docker --version` |
| Supabase CLI | local DB, migration, generated type | 전역 설치 또는 `npx supabase` 사용 | `npx supabase --version` |
| Supabase account/project | Auth, Postgres, Storage, Edge Functions | region은 `ap-southeast-2` Sydney | Dashboard project 생성 |
| Expo account | EAS Build/Submit | expo.dev 계정 생성 | `eas login` |
| EAS CLI | iOS/Android cloud build | `npm.cmd install --global eas-cli` | `eas --version` |
| Android 실제 기기 | Galaxy/Android QA | Developer Options, USB debugging 활성화 | APK 설치 가능 |
| iPhone 실제 기기 | iOS QA | TestFlight 또는 development build 확인 | 앱 설치 가능 |

### Store 제출 전에 필요한 항목

| 항목 | 목적 | 완료 기준 |
| --- | --- | --- |
| Apple Developer Program | TestFlight와 App Store 제출 | App Store Connect app record |
| Google Play Console | Play internal testing과 production release | Play Console app record |
| Google service account key | EAS Submit으로 Google Play 제출 | key를 git 밖에 보관 |
| Privacy policy URL | Store review와 사용자 신뢰 | 공개 URL |
| Support email | Store metadata와 문의 | listing 입력 가능 |
| App screenshots | Store listing | Apple/Google 필수 크기별 screenshot |

### 있으면 좋은 항목

- Android Studio: local Android SDK, device log, emulator
- macOS + Xcode: local iOS build/simulator
- Deno CLI: Edge Function local type check
- GitHub CLI: PR 생성과 review 자동화
- Bruno 또는 Postman: Edge Function/API 수동 테스트

## 로컬 실행 명령

Windows PowerShell 기준:

```powershell
node -v
npm -v
npm.cmd install --prefix apps/mobile
npm.cmd run verify
```

Emulator 없이 web preview 확인:

```powershell
npm.cmd run mobile:export-web
npm.cmd run mobile:preview-web
```

브라우저 주소:

```text
http://127.0.0.1:8082/
```

Supabase local setup:

```powershell
npx supabase --version
npx supabase login
npx supabase start
npx supabase db reset
npx supabase gen types typescript --local > apps/mobile/src/shared-kernel/supabase/database.types.ts
npm.cmd run verify
```

EAS setup:

```powershell
npm.cmd install --global eas-cli
eas login
eas init
eas build:configure
eas build --platform android --profile preview
eas build --platform ios --profile preview
```

## 1개월 일정표

### Week 1: 기반 설정과 실제 Auth

| 날짜 | 작업 | 담당 role | 산출물 |
| --- | --- | --- | --- |
| Day 1 | 현재 `AGENTS.md` 정책 확정, 필수 프로그램 설치, web preview 확인 | Product Architecture Lead, QA Release Agent | setup checklist, 통과한 `npm.cmd run verify` |
| Day 2 | Supabase project 생성/연결, local stack 실행, migration 적용, DB type 생성 | Database Supabase Agent | local/remote DB baseline |
| Day 3 | Supabase Auth client, SecureStore session adapter, login/signup screen | Frontend Mobile Agent | 계정 필수 onboarding |
| Day 4 | Profile 생성과 language preference 구현 | Frontend Mobile Agent | signup 이후 profile row 생성 |
| Day 5 | Pet create/select/edit flow와 owner membership 연결 | Frontend Mobile Agent, Database Supabase Agent | sample data 대신 실제 pet 사용 |
| Day 6 | Identity/pet repository 검증과 smoke test | Frontend Mobile Agent | auth/pet 핵심 경로 통과 |
| Day 7 | Auth/RLS cross-review와 Week 1 checkpoint build | Security Privacy Agent, Product Architecture Lead | Week 1 안정화 build |

### Week 2: Diary, 산책, Care, Medication, Offline

| 날짜 | 작업 | 담당 role | 산출물 |
| --- | --- | --- | --- |
| Day 8 | Diary repository와 command 구현 | Frontend Mobile Agent | food/water/stool/condition/memo 저장 |
| Day 9 | 건강 관찰형 walk record 구현 | Frontend Mobile Agent | walk observation 저장/조회 |
| Day 10 | Timeline query와 Today checklist를 실제 data로 연결 | Frontend Mobile Agent | 날짜별 timeline |
| Day 11 | Care condition과 care plan workflow | Frontend Mobile Agent | Care Mode 실제 전환 |
| Day 12 | Medication schedule과 dose status 저장 | Frontend Mobile Agent | completed/skipped/partial 기록 |
| Day 13 | Offline outbox SQLite persistence와 replay | Frontend Mobile Agent | idempotent replay |
| Day 14 | Week 2 integration review | Product Architecture Lead, Security Privacy Agent | diary/care/medication 안정화 |

### Week 3: AI, Report, 공유, Media

| 날짜 | 작업 | 담당 role | 산출물 |
| --- | --- | --- | --- |
| Day 15 | AI briefing request/response contract 확정 | Backend Edge Agent | typed contract |
| Day 16 | `generate-ai-brief` prompt와 안전 output 구현 | Backend Edge Agent | record-based AI summary |
| Day 17 | Vet report generation 구현 | Backend Edge Agent | 영어 병원용 report |
| Day 18 | Report confirmation UI와 share token 생성 | Frontend Mobile Agent, Backend Edge Agent | 사용자 확인 후 공유 |
| Day 19 | `get-vet-report` sanitized viewer path 구현 | Backend Edge Agent | 만료 link 조회 |
| Day 20 | Private media upload와 Storage policy 구현 | Database Supabase Agent, Frontend Mobile Agent | 증상 사진 upload |
| Day 21 | AI safety, RLS, report privacy cross-review | Security Privacy Agent | Week 3 안전성 검토 |

### Week 4: Entitlement, QA, Build, Beta 준비

| 날짜 | 작업 | 담당 role | 산출물 |
| --- | --- | --- | --- |
| Day 22 | Free/Plus/Family locked state UI | Frontend Mobile Agent | 실제 결제 없는 잠금 UI |
| Day 23 | 가족/caregiver role UI polish | Frontend Mobile Agent | 공동 기록 흐름 |
| Day 24 | 반응형 UI, 작은 화면, web preview polish | Frontend Mobile Agent, QA Release Agent | 주요 화면 시각 검증 |
| Day 25 | Login, pet, diary, care, briefing, report smoke test | QA Release Agent | 반복 가능한 e2e smoke test |
| Day 26 | `eas.json`, app identifiers, build profile 설정 | QA Release Agent | preview build 설정 |
| Day 27 | Android preview build와 Galaxy 기기 설치 | QA Release Agent | Android 설치 확인 |
| Day 28 | iOS preview 또는 TestFlight build 생성 | QA Release Agent | iOS 설치 경로 확인 |
| Day 29 | Store metadata, screenshot, privacy policy, medical wording review | Product Architecture Lead, Security Privacy Agent | internal testing 제출 package |
| Day 30 | 최종 regression, known issues, beta go/no-go 판단 | Product Architecture Lead | 30일 MVP checkpoint |

## 구현 작업 단위

### Task 1: Harness와 setup 정리

파일:

- `AGENTS.md`
- `docs/engineering/QUALITY.md`
- `docs/engineering/SETUP.md` 생성 후보

작업:

- [ ] 현재 모델 라우팅 정책 확인
- [ ] 설치/계정 setup 문서화
- [ ] `npm.cmd run verify` 실행

### Task 2: Supabase project baseline

파일:

- `supabase/config.toml`
- `supabase/migrations/**`
- `apps/mobile/src/shared-kernel/supabase/database.types.ts`

작업:

- [ ] Supabase project 생성
- [ ] Local migration 실행
- [ ] Generated type 갱신
- [ ] `npm.cmd run verify:supabase`

### Task 3: 계정 필수 Auth

파일:

- `apps/mobile/src/contexts/identity/**`
- `apps/mobile/src/presentation/PawBloomShell.tsx`
- `apps/mobile/src/i18n/translations.ts`

작업:

- [ ] Supabase Auth session use case
- [ ] SecureStore persistence
- [ ] Login/signup UI
- [ ] Signup 후 profile 생성

### Task 4: Pet profile과 membership

파일:

- `apps/mobile/src/contexts/pet/**`
- `apps/mobile/src/presentation/PawBloomShell.tsx`

작업:

- [ ] Pet repository
- [ ] Pet create/select/edit
- [ ] Owner membership 연결
- [ ] UI에서 membership 없는 pet 숨김

### Task 5: Family/caregiver 공유

파일:

- `apps/mobile/src/contexts/pet/application/memberUseCases.ts`
- `apps/mobile/src/contexts/subscription/**`
- `supabase/migrations/**`

작업:

- [ ] Owner invite/remove 흐름
- [ ] Family/caregiver 기록 권한
- [ ] RLS role matrix test

### Task 6: Diary와 timeline

파일:

- `apps/mobile/src/contexts/diary/**`
- `apps/mobile/src/presentation/screens/DiaryEntryScreen.tsx`
- `apps/mobile/src/presentation/screens/HomeScreen.tsx`

작업:

- [ ] Diary command
- [ ] Diary query
- [ ] Timeline 연결
- [ ] Sample data 제거

### Task 7: 건강 관찰형 산책

파일:

- `apps/mobile/src/contexts/diary/**`
- `apps/mobile/src/presentation/screens/DiaryEntryScreen.tsx`

작업:

- [ ] `walk_observation` entry type
- [ ] 시간, 대략 거리, 배변/소변, 절뚝임, 기침, 호흡, 피로, 산책 후 식욕/음수 변화
- [ ] Vet report source로 사용 가능하게 저장

### Task 8: Offline outbox

파일:

- `apps/mobile/src/contexts/sync/**`
- `apps/mobile/src/contexts/diary/application/diaryUseCases.ts`

작업:

- [ ] 실패 mutation을 SQLite에 저장
- [ ] `client_mutation_id` 기반 idempotent replay
- [ ] `npm.cmd run verify:offline`

### Task 9: Care Mode와 medication

파일:

- `apps/mobile/src/contexts/care/**`
- `apps/mobile/src/contexts/medication/**`
- `apps/mobile/src/presentation/screens/CareModeScreen.tsx`

작업:

- [ ] Condition과 care plan command
- [ ] Medication schedule
- [ ] Dose status: completed, skipped, partial
- [ ] Care Mode Today 강조

### Task 10: AI briefing

파일:

- `supabase/functions/generate-ai-brief/index.ts`
- `apps/mobile/src/contexts/briefing/**`
- `apps/mobile/src/presentation/screens/HomeScreen.tsx`

작업:

- [ ] 3일/7일 contract
- [ ] 누락 기록과 vet question
- [ ] 안전 고지문
- [ ] Contract test

### Task 11: Vet report와 share link

파일:

- `supabase/functions/generate-vet-report/index.ts`
- `supabase/functions/get-vet-report/index.ts`
- `apps/mobile/src/contexts/report/**`
- `apps/mobile/src/presentation/screens/ReportsScreen.tsx`

작업:

- [ ] Report 생성
- [ ] 사용자 공유 전 확인
- [ ] Sanitized share token
- [ ] 만료/취소 상태

### Task 12: Media upload

파일:

- `apps/mobile/src/contexts/media/**`
- `supabase/migrations/**`
- `apps/mobile/src/presentation/screens/DiaryEntryScreen.tsx`

작업:

- [ ] Private bucket upload
- [ ] `pet_id/object_id` path 검증
- [ ] Storage policy

### Task 13: Entitlement gate

파일:

- `apps/mobile/src/contexts/subscription/**`
- `apps/mobile/src/presentation/screens/**`

작업:

- [ ] Free/Plus/Family 판정
- [ ] LockedFeature component
- [ ] 결제 없는 beta 안내 UI

### Task 14: QA, build, beta package

파일:

- `eas.json`
- `docs/engineering/RELEASE.md`
- `docs/engineering/STORE_CHECKLIST.md`
- `tests/e2e/**`

작업:

- [ ] EAS profile
- [ ] Smoke test
- [ ] Android preview build
- [ ] iOS preview/TestFlight build
- [ ] Store metadata와 privacy wording

## 하루 작업 리듬

- 09:00-09:30: 오늘 실행할 작은 execution plan 1개 선택
- 09:30-12:00: 하나의 vertical slice 구현
- 12:00-12:30: 가장 가까운 focused verification 실행
- 13:30-16:00: 실패 수정과 app shell 연결
- 16:00-17:00: `npm.cmd run verify`, 문서/self-review 갱신
- 17:00-17:30: cross-review 또는 다음 execution plan 작성

파트타임으로 진행하는 날에는 순서는 유지하고 하루 scope만 줄인다. 검증은 생략하지 않는다.

## Merge gate

- `npm.cmd run verify` 통과
- Supabase schema 변경은 RLS, explicit GRANT, generated type, RLS matrix review 포함
- Edge Function 변경은 request/response contract와 AI safety wording check 포함
- Mobile UI 변경은 사용자 문구를 `apps/mobile/src/i18n/translations.ts`에 둠
- Cross-context 동작은 application use case 또는 domain event를 통해 연결
- Store-facing copy는 diagnosis, prescription, dosage recommendation, emergency triage로 오해될 표현을 피함
- Product Architecture Lead는 auth, role, RLS, AI safety, privacy, release 변경을 승인

## 참고 자료

- OpenAI Harness Engineering: https://openai.com/ko-KR/index/harness-engineering/
- Expo EAS app store submission: https://docs.expo.dev/deploy/submit-to-app-stores/
- Expo development builds: https://docs.expo.dev/develop/development-builds/create-a-build/
- React Native environment setup: https://reactnative.dev/docs/set-up-your-environment
- Supabase local development: https://supabase.com/docs/guides/local-development
- Supabase changelog: https://supabase.com/changelog
