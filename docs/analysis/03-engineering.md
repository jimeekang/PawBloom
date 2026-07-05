---
owner_model: claude-opus-4.8-extra
domain: analysis
edit_policy: exclusive
---

# PawBloom 엔지니어링 · 출시 준비도 (CTO 관점)

- 작성일: 2026-07-05
- 방법: 저장소 전수 실측(엣지 함수·마이그레이션·컨텍스트·빌드 설정·의존성). 아래는 코드 grep/read로 확인한 정정 포함.
- [← 종합 요약으로](00-executive-summary.md)

---

## 실측으로 정정된 사실 (분석의 핵심을 바꿈)

- **"AI 브리핑"은 AI가 아니다.** `supabase/functions/generate-ai-brief/index.ts`, `generate-vet-report/index.ts`는 LLM 호출 0건. `entries.length`·`doses.filter(status==='skipped').length` 등을 문자열 템플릿에 끼워 넣는 **결정론적 요약**(anthropic/openai/claude/gpt/completions grep 전부 0건). → "AI 비용 스케일링"은 현재 없는 문제. 동시에 헤드라인 기능이 미구현.
- **백엔드는 실재하고 보안이 탄탄하다.** 초기 마이그레이션에 RLS 정책 80개, 공유 토큰은 `crypto.randomUUID()×2`를 SHA-256 해시로 저장(원문 미저장), 7일 만료·`last_accessed_at` 기록(`get-vet-report/index.ts`). **만료형 링크가 실제로 구현돼 있다.**
- **그런데 앱이 백엔드를 호출하지 않는다.** `functions.invoke`/`generate-vet-report` 호출이 앱 전역 0건. 프론트는 `MockShareCard`(고정 URL) 목업 → **동작하는 안전한 백엔드가 고아 상태.** 프론트-백 연결만 하면 됨.
- **결제/구독 미집행.** `subscription/domain/entitlement.ts`에 free/plus/family 티어가 정의됐으나 앱 어디서도 참조 안 함(사용처 grep 0건). 페이월·게이팅·IAP 라이브러리 전무.
- **푸시 알림 — 투약 리마인더는 동작.** `medicationReminderNotifications.ts`의 `rescheduleMedicationReminders`가 `PawBloomShell.tsx:224`에서 호출, `expo-notifications ~56.0.18`이 정식 의존성. `app.json` plugins에 `expo-notifications`는 없으나 **SDK 49+부터 plugin 없이도 기본 알림은 동작**(plugin은 커스텀 아이콘/색상/사운드용). 남는 실제 문제는 **알림 제목이 하드코딩 한국어**(`${petName} 약 먹일 시간이에요`)와 **투약 없는 펫엔 재방문 훅 0**.
- **테스트 러너 없음.** `.test.ts` ~28개가 jest/vitest 없이 `scripts/verify-presentation-state.mjs`가 `require.extensions`로 TS를 직접 트랜스파일해 돌리는 수제 하네스. `package.json`에 `test` 스크립트 자체가 없음.
- **관측성 전무.** Sentry/Crashlytics/PostHog/Amplitude 0건, React ErrorBoundary 0건.
- 잘된 위생: `.env` gitignore, Supabase 세션은 `expo-secure-store`(persistSession/autoRefreshToken), 오프라인은 netinfo + react-query `onlineManager` 연동.

---

## 아키텍처 · 코드 품질

### 잘한 점
- **DDD 바운디드 컨텍스트 분리가 실제로 지켜진다.** `src/contexts/{diary,care,medication,report,pet,identity,media,routine,sync,subscription,briefing}` 각각 domain/application/infrastructure로 분리, 순수 로직(`.logic.ts`, `.formRules.ts`)이 UI/Supabase에서 분리. 총 ~8,900 LOC(src ts/tsx ~117개)로 1인 개발치고 규율 높음.
- **보안 설계 성숙.** RLS 80개가 `is_pet_member`/`has_pet_role(owner/caregiver)`로 역할 기반 접근 강제, 리포트 공유는 토큰 해시만 저장 + 만료 검사. 엣지 함수는 `serviceClient()`를 쓰되 진입에서 `requireUser`+`requirePetMember`로 인가. 시니어 백엔드 수준.
- **"AI" 비용 리스크 = 0**(요약이 결정론적). 규제 톤도 `disclaimer` 강제.
- **오프라인 기초·세션 보안 올바름**, **verify 게이트**(`npm run verify` = typecheck + architecture/i18n/presentation/ai-safety/secrets/supabase/offline)가 CI스럽게 회귀 방지.

### 위험한 점
- **[P0] 프론트-백엔드 단절.** 핵심 서사(기록→병원 브리핑→만료형 공유)가 백엔드엔 완성인데 앱은 목업만 노출. "거의 다 됐는데 배선이 안 된" 상태.
- **[P0] 결제 게이팅 부재.** `entitlement`가 죽은 코드라 무료/유료 경계가 코드에 없음. 매출 모델 미구현.
- **[P1] 관측성 제로.** 크래시 리포팅·애널리틱스·ErrorBoundary 없음 → 출시 후 크래시 원인 추적 불가. react-query 에러를 `.catch(e => setNotice(e.message))`로 raw 노출(`PawBloomShell.tsx:112,173,191`) → UX·정보노출 양면 문제.
- **[P1] 테스트가 표준 도구가 아님.** 수제 하네스는 신규 기여자·CI·IDE 통합 어렵고 커버리지 측정 불가.
- **[P2] i18n 하드코딩** ([02. 제품·UX](02-product-ux.md) 참조), 알림 제목까지 한국어.
- **[P2] 오프라인 아웃박스가 스텁.** `offlineOutbox.ts`에 enqueue/list는 있으나 어떤 쓰기 경로도 사용 안 함(write-path 연결 0건). 다이어리/투약 쓰기는 `supabase.from(...).insert()`로 직접. "오프라인 지원"은 상태 감지까지만 실재.

---

## 출시 전 필수 항목 우선순위

### P0 (없으면 출시 무의미 / 매출 불가)
1. **엣지 함수 배선.** 리포트 화면에서 `supabase.functions.invoke('generate-vet-report')`·`get-vet-report` 호출로 교체, `MockShareCard` 제거, 실제 공유 URL(뷰어 웹페이지) 1개. 백엔드 준비됨 → 프론트 mutation 3~4개 연결이 전부.
2. **결제 연동 + 페이월.** Expo이므로 **RevenueCat** 표준(StoreKit2/Play Billing 추상화 + 서버 검증). `entitlement.ts`를 RevenueCat 엔타이틀먼트에 매핑해 UI 게이팅 연결. **Plus에 3~14일 트라이얼**(전환 18~45% vs 프리미엄 ~2%).
3. **크래시 리포팅 + ErrorBoundary.** `sentry-expo` 도입, 루트 ErrorBoundary 래핑, raw 에러 메시지를 사용자 문구로 치환하고 원본은 Sentry로.
4. **스토어 심사 필수물.** 개인정보처리방침 URL(현재 없음), **Apple 앱 내 계정삭제 필수(2024~ 강제, 없으면 리젝)**, 데이터 세이프티 폼(반려동물 건강데이터는 호주 Privacy Act상 민감정보로 분류 가능), 의료 성격 문구 검토(disclaimer 존재는 유리).

### P1 (출시 품질·운영)
5. **푸시 정상화·i18n화.** `app.json` plugins에 `expo-notifications` 추가(커스텀 아이콘/사운드), 알림 카피 i18n, iOS 권한 프리프롬프트.
6. **애널리틱스.** 최소 이벤트(온보딩 완료, 첫 다이어리 저장, 리포트 생성, 공유, 페이월 노출→전환). PostHog 또는 Amplitude. 없으면 퍼널·리텐션 측정 불가(그로스 검증의 전제).
7. **i18n 실집행** ([02. 제품·UX](02-product-ux.md) P0와 동일).
8. **테스트 러너 표준화.** `vitest` 도입, 기존 ~28개 이관, `npm test`를 verify에 편입.

### P2 (출시 후 곧)
9. 오프라인 아웃박스 실배선(쓰기 경로→enqueue→재전송) 또는 "온라인 필요" 명시로 스코프 축소.
10. 접근성 속성 보강.
11. 홈 체크리스트 토글 취소, night/memo 충돌 해소.

---

## 확장 시 병목

- **AI 비용:** 현재 문제 아님. 진짜 LLM 도입 시 브리핑 1건 ≈ US$0.004로 저렴하나, 완화책 준비: (a) 결정론적 집계로 축약 후 요약 지표만 LLM에 전달, (b) `ai_briefs` 테이블 캐시(이미 insert 구조 있음)로 동일 입력 재생성 방지, (c) 프롬프트 캐싱, (d) Plus 이상만 실AI.
- **스토리지:** 사진이 유일한 실질 병목. `enforce_daily_diary_photo_limit` 마이그레이션으로 남용은 막힘. 업로드 시 클라이언트 리사이즈/압축, CDN 캐시 헤더 확인.
- **쿼리:** 엣지 함수가 `.gte('occurred_at', since)`로 범위 조회 → `diary_entries(pet_id, occurred_at)`, `medication_doses(pet_id, scheduled_at)` **복합 인덱스** 존재 확인 필요. RLS의 `is_pet_member` 서브쿼리가 매 행 평가되므로 `pet_members` 인덱스도 중요.
- **엣지 함수 service_role 경계:** 인가 체크 회귀가 곧 데이터 유출 → 함수별 통합 테스트 필요.

---

## 1인/소규모 팀 유지 가능성 — 가능. 이 규모에 잘 맞음

~8,900 LOC, 컨텍스트별 순수 로직 분리, verify 게이트, RLS로 서버 로직 최소화(별도 백엔드 서버 없이 Supabase) → 인프라 운영 부담 낮음.

유지 가능성을 깎는 3가지: (1) 관측성 부재 → 크래시 재현에 시간 소모, (2) 비표준 테스트 하네스 → 온보딩 마찰, (3) 프론트-백 단절/죽은 코드(entitlement, outbox, 영어 i18n) → "구현됐다고 착각"하기 쉬운 유령 기능. **이 셋만 정리하면 소규모 유지에 이상적.**

---

## 기술 로드맵

- **지금 → 2주 (배선 스프린트, 코드 대부분 존재):** 엣지 함수 3개 연결 + MockShareCard 제거 + 공유 뷰어 웹페이지, Sentry + 루트 ErrorBoundary + raw 에러 정리, `expo-notifications` plugin 등록 + 알림 카피 i18n, vitest 도입 후 기존 테스트 이관.
- **출시 전 → 4~6주:** RevenueCat 결제 + entitlement 실게이팅 + Plus 트라이얼, i18n 실집행(영어 기본값), 스토어 심사물 + 복합 인덱스 확인, PostHog 핵심 퍼널.
- **출시 후 3개월:** 결정론적 요약 위에 실제 LLM 브리핑을 캐시·엔타이틀먼트 게이팅과 함께 도입(선점 창이 빠르게 닫히므로 속도 우선), 오프라인 아웃박스 실배선 또는 스코프 명시, 접근성·UX 버그 수정.

---

## 핵심 파일 참조

- 고아 백엔드(연결만 하면 됨): `supabase/functions/generate-vet-report/index.ts`, `get-vet-report/index.ts`, `generate-ai-brief/index.ts`
- 죽은 코드: `apps/mobile/src/contexts/subscription/domain/entitlement.ts`(게이팅 미사용), `contexts/sync/application/offlineOutbox.ts`(쓰기 경로 미연결)
- 푸시: `apps/mobile/src/presentation/notifications/medicationReminderNotifications.ts`(호출 `PawBloomShell.tsx:224`), `app.json` plugins에 `expo-notifications` 미등록(기본 동작엔 불필요)
- 관측성 공백: `apps/mobile/App.tsx`(ErrorBoundary 없음), raw 에러 노출 `PawBloomShell.tsx:112,173,191`
- 테스트 하네스: `scripts/verify-presentation-state.mjs`(수제 TS transpile)
- 보안 우수: `supabase/migrations/20260625000100_initial_pawcare_schema.sql`(RLS 80개), `supabase/functions/_shared/supabase.ts`(`requirePetMember`)
