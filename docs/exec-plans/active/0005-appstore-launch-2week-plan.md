---
owner_model: claude-opus-4.8-extra
domain: planning
edit_policy: exclusive
---

# 0005 앱스토어 출시 2주 실행계획

> **에이전트 워커(codex-high):** REQUIRED SUB-SKILL — `superpowers:subagent-driven-development`(권장) 또는 `superpowers:executing-plans`로 task-by-task 구현. 단계는 `- [ ]` 체크박스로 추적한다.

**Goal:** 2주(D1~D14) 안에 [감사 05](../../analysis/05-app-store-readiness.md)의 블로커 3건·필수 6건을 해소하고 App Store 첫 심사 제출을 완료한다.

**전제:** iOS 우선(Play는 P2 후속). Supabase 프로덕션 프로젝트 가동 중. Apple Developer 미등록 상태에서 시작.

**역할:** `[코드]`=codex-high(apps/mobile·supabase), `[문서/판정]`=claude-opus-4.8-extra, `[운영]`=사용자 직접 액션(결제·계정·콘솔 입력). 계정 삭제는 Auth·개인정보를 건드리므로 AGENTS.md 에스컬레이션 규칙에 따라 **강한 리뷰 경로**(구현 후 claude 최종 승인) 대상이다.

## Global Constraints (모든 Task 적용)

- 사용자 문구는 `apps/mobile/src/i18n/translations.ts` en/ko 두 블록 동시 추가(`verify:i18n` parity 강제).
- 스토어·인앱 카피 전부 "record-based summary" 원칙(RELEASE.md:31) — "AI 진단"·미출시 기능(AI briefing, Plus/Family 요금제) 언급 금지.
- 각 Task 종료: `npm --prefix apps/mobile run typecheck`, handoff 전 `npm run verify` 전체 통과. Task당 커밋 1개.
- 테스트 관례: `*.test.ts` + `node scripts/run-presentation-test.mjs <경로>` (0004 선례). expo 모듈은 동적 import를 IO 경계 뒤에 두고 순수 함수에 IO 주입.
- 비밀값(데모 계정 비밀번호, ASC API key)은 저장소에 커밋 금지(`verify:secrets`) — env·ASC 노트·비밀 관리자에만 둔다.

## 우선순위 개요 (감사 05 매핑)

| 순위 | Task | 감사 항목 | 기간 |
| --- | --- | --- | --- |
| P0-1 | T1 계정 삭제 end-to-end | B1 | D1~D3 |
| P0-2 | T2 운영 병렬 트랙(Apple 등록→ASC→eas init) | M5·M6 | D1 시작~D8 |
| P0-3 | T3 개인정보처리방침·지원 페이지 + 인앱 링크 | B2 | D2~D5 |
| P0-4 | T4 스토어 설정 일괄(app.json) | m1~m3·m7·m8 + B3 완화 | D4 |
| P1-1 | T5 scheme·가입 확인 흐름 복구 | M2 | D5 |
| P1-2 | T6 언어 기본값·Environment 카드 정리 | m4·m5 | D5~D6 |
| P1-3 | T7 데모 계정 시드 | M1 | D6~D7 |
| P1-4 | T8 프로덕션 빌드·TestFlight·실기기 QA | m12 + 게이트 | D8~D10 |
| P1-5 | T9 스토어 메타데이터 작성·입력 | M3·M4·m9·m10·m13 | D9~D11 |
| P1-6 | T10 스크린샷 EN/KO | B3 | D10~D11 |
| P1-7 | T11 리뷰 노트·제출 | 최종 | D12 |
| — | 버퍼·리젝 대응 | — | D13~D14 |

---

## Task 1: 계정 삭제 end-to-end `[코드]` (D1~D3)

**Files:** Create `supabase/functions/delete-account/index.ts`, Modify `supabase/config.toml`(functions 섹션에 `[functions.delete-account]` `verify_jwt = true`), Modify `apps/mobile/src/contexts/identity/ui/SettingsScreen.tsx`, Create `apps/mobile/src/contexts/identity/application/useAccountDeletion.ts`(+`accountDeletionState.test.ts`), Modify `apps/mobile/src/i18n/translations.ts`, Modify `apps/mobile/src/contexts/identity/application/authContextTypes.ts`.

**Produces:** edge function `delete-account`(POST, bearer 필수) — 소유 pet의 Storage 객체 purge 후 `auth.admin.deleteUser`; 클라이언트 `deleteAccount(): Promise<{ ok: boolean }>`.

- [ ] edge function 구현 — `_shared/supabase.ts`의 `requireUser()` 선례 사용, service-role 클라이언트로:
```ts
// 1) requireUser(req)로 userId 확보
// 2) 소유 pet 조회: from("pets").select("id").eq("owner_id", userId)
// 3) 각 pet에 대해 storage.from("pet-media").list(petId) → remove(전체 경로 배열) (빈 목록 허용, 100개 단위 페이지네이션)
// 4) admin.auth.admin.deleteUser(userId)  → DB 행은 auth.users cascade FK로 자동 정리(감사 05 §5)
// 5) 200 { ok: true }; 3~4단계 실패 시 500 + 재시도 안전(멱등: 이미 삭제된 객체 무시)
```
- [ ] 공동 소유 경계: 본인이 **member로만** 속한 pet 데이터는 건드리지 않는다(`pet_members` 행은 cascade로만 소멸). 소유 pet은 가족 공유 중이어도 전체 삭제 — 확인 문구에 명시.
- [ ] `useAccountDeletion.ts`: `supabase.functions.invoke("delete-account")` 성공 시 `cancelMedicationRemindersForAccount`·`cancelMealRemindersForAccount` 호출 후 `signOut()`. 상태는 `idle | confirming | deleting | error` 순수 리듀서로 분리, `accountDeletionState.test.ts`에서 전이 검증(실패 테스트 먼저 → FAIL 확인 → 구현 → PASS).
- [ ] SettingsScreen: 로그아웃 버튼 아래 destructive 스타일 '계정 삭제' + 2단계 확인(`Alert.alert` — 삭제 범위 고지: 계정·반려동물 기록·사진 영구 삭제, 복구 불가). i18n 키: `settings.deleteAccount`("Delete account"/"계정 삭제"), `settings.deleteAccountConfirmTitle`, `settings.deleteAccountConfirmBody`("This permanently deletes your account, all pet records, and photos. This cannot be undone."/"계정과 모든 반려동물 기록·사진이 영구 삭제되며 복구할 수 없습니다."), `settings.deleteAccountConfirmAction`("Delete permanently"/"영구 삭제"), `settings.deleteAccountError`("Could not delete the account. Try again."/"계정을 삭제하지 못했습니다. 다시 시도해 주세요.").
- [ ] 수동 검증: 테스트 계정으로 pet+사진+투약 기록 생성 → 삭제 실행 → ① 재로그인 불가 ② `pets`/`diary_entries`/`medication_doses` 잔존 0행 ③ Storage `pet-media`에 해당 pet 폴더 없음 ④ 로컬 예약 알림 소멸.
- [ ] `npm run verify` 통과 → commit `feat: add in-app account deletion` → **claude 최종 승인 리뷰**(강한 리뷰 경로).

## Task 2: 운영 병렬 트랙 `[운영]` (D1 시작 — 리드타임이 길어 최우선 착수)

- [ ] D1: Apple Developer Program 등록(개인 계정 권장 — 법인은 D-U-N-S로 1~2주 지연 위험. 연 USD 99, 승인 1~2일 소요).
- [ ] 승인 즉시: App Store Connect에서 `com.pawbloom.app` 앱 레코드 생성(이름 PawBloom, 기본 로케일 **en-AU**, ko 로케일 추가).
- [ ] `apps/mobile`에서 `eas init` 실행 → app.json에 `extra.eas.projectId`·`owner` 생성 커밋 `[코드]` → `eas credentials`로 iOS 배포 인증서 생성.
- [ ] eas.json `submit.production.ios`에 `ascAppId`·`appleTeamId` 추가 `[코드]`(ASC 레코드 생성 후 값 확보. API key 사용 시 `.p8`은 EAS 서버 저장, 저장소 커밋 금지).
- [ ] D8 전까지: ASC 가용성에서 **EU 스토어프런트 제외**(DSA trader 미신고 노이즈 방지), 호주·한국·뉴질랜드 등 타깃만 선택. 한국 기반 개발자로 등록한 경우 한국 컴플라이언스 정보(사업자 정보) 입력.

## Task 3: 개인정보처리방침·지원 페이지 `[문서/판정]`→`[운영]`→`[코드]` (D2~D5)

- [ ] D2~D3 초안 작성(EN/KO): 수집 항목은 감사 05 §7 표 그대로(이메일·반려동물 건강기록·다이어리·사진·UUID), 처리자 Supabase, 보관·삭제(계정 삭제 시 전체 파기 — T1과 문구 일치), 오프라인 기기 캐시, 제3자 제공 없음·추적 없음, 호주 Privacy Act APP + 한국 개인정보보호법 열람·정정·파기 조항, 문의처. 저장소에는 `docs/product/PRIVACY_POLICY.md`로 원문 보관(300줄 제한 준수).
- [ ] D4 호스팅 `[운영]`: GitHub Pages(무료·즉시) 또는 보유 도메인에 `/privacy`(EN)·`/privacy-ko` 게시 + 지원 채널 확정(`support@` 메일 또는 간단한 지원 페이지). URL 2종 확보가 완료 조건.
- [ ] D5 인앱 링크 `[코드]`: SettingsScreen과 AuthScreen 하단에 `Linking.openURL` 텍스트 링크 2개(개인정보처리방침·지원). i18n 키 `settings.privacyPolicy`("Privacy Policy"/"개인정보처리방침"), `settings.support`("Support"/"지원"). URL 상수는 `apps/mobile/src/shared-kernel/config.ts`에 `PRIVACY_POLICY_URL`·`SUPPORT_URL`로. commit `feat: link privacy policy and support`.

## Task 4: 스토어 설정 일괄 `[코드]` (D4)

**Files:** Modify `apps/mobile/app.json`, Modify `apps/mobile/package.json`(expo-splash-screen 추가).

- [ ] app.json 변경(한 커밋):
```jsonc
"ios": {
  "supportsTablet": false,            // iPad 스크린샷·심사 표면 제거(감사 m2)
  "bundleIdentifier": "com.pawbloom.app",
  "infoPlist": {
    "ITSAppUsesNonExemptEncryption": false,          // Missing Compliance 정지 제거(m1)
    "CFBundleLocalizations": ["en", "ko"],           // m7
    "CFBundleAllowMixedLocalizations": true
  }
},
"scheme": "pawbloom",                  // T5에서 검증하지만 설정은 여기서 일괄
```
- [ ] `npx expo install expo-splash-screen` 후 plugins에 `["expo-splash-screen", { "image": "./assets/splash-icon.png", "imageWidth": 200, "backgroundColor": "#E6F4FE" }]` — 고아 자산 연결, 흰 화면 제거(m3).
- [ ] plugins의 `"expo-notifications"`를 `["expo-notifications", { "icon": "./assets/android-icon-monochrome.png", "color": "#E06D10" }]`로 교체(m8 — Android 상태바 흰 사각형 방지. iOS 무영향).
- [ ] `npx expo-doctor` 통과 확인 → commit `chore: configure store submission settings`.

## Task 5: 가입 확인 딥링크 복구 `[코드]` (D5)

- [ ] T4의 `"scheme": "pawbloom"` 전제. Supabase 대시보드(프로덕션)의 Auth Redirect URLs에 `pawbloom://auth` 등록 여부 확인(`supabase/config.toml:13-14`는 로컬 기준 — 프로덕션 콘솔 값이 실효).
- [ ] 실기기(development build)에서 신규 가입 → 수신 메일 확인 링크 탭 → 앱 복귀·세션 성립 확인. 복귀가 성립하지 않으면 **이메일 확인 OFF를 D8 전 결정**(리뷰어 차단 방지가 우선 — 판정 `[문서/판정]`).
- [ ] commit `fix: restore signup confirmation deep link`.

## Task 6: 언어 기본값·프로덕션 폴리시 `[코드]` (D5~D6)

- [ ] `npx expo install expo-localization` → `apps/mobile/src/i18n/languagePreference.ts`: 저장된 선호가 없을 때 `getLocales()[0]?.languageCode === "ko" ? "ko" : "en"`(m4 — AU 리뷰어가 영어 UI를 보게 함). `readLanguagePreference` 폴백과 `languageContext.tsx:16` 초기 상태 동일 로직 적용. 기존 저장 선호는 그대로 존중.
- [ ] 순수 함수 `resolveInitialLanguage(stored: Language | null, deviceLanguageCode: string | undefined): Language` 분리 + `resolveInitialLanguage.test.ts`(stored 우선, ko 기기→ko, 그 외→en, undefined→en) — 실패 테스트 먼저.
- [ ] SettingsScreen 'Environment' 카드(60~69행)를 `__DEV__` 게이트로 감싼다(m5 — Supabase 상태·'Free preview' 라벨 프로덕션 비노출).
- [ ] `npm run verify` 통과 → commit `feat: device-locale language default and prod settings polish`.

## Task 7: 데모 계정 시드 `[코드]` (D6~D7)

**Files:** Create `scripts/seed-demo-account.mjs`.

- [ ] service-role key는 `SUPABASE_SERVICE_ROLE_KEY` env로만 주입(커밋 금지). 스크립트가 하는 일: ① `auth.admin.createUser({ email: DEMO_EMAIL, password: env, email_confirm: true })`(이메일 확인 게이트 우회) ② pet 1마리(사진 1장 포함) ③ 최근 7일 다이어리 4건·투약 스케줄 1개·dose 기록 6건·측정치 2건 ④ vet report 초안 1건 생성(`generate-vet-report` 호출) — 리뷰어가 Today·Diary·Care·Reports 전부를 데이터 있는 상태로 보게 한다(M1).
- [ ] 멱등성: 기존 데모 계정 있으면 삭제 후 재생성(T1 edge function 재사용 가능).
- [ ] 실행·검증: 데모 자격증명으로 실제 로그인해 4개 탭 데이터 확인. 자격증명은 ASC 리뷰 노트·비밀 관리자에만 기록.
- [ ] commit `chore: add demo account seed script`.

## Task 8: 프로덕션 빌드·TestFlight·실기기 QA `[코드]`+`[문서/판정]` (D8~D10)

- [ ] `eas build -p ios --profile production` → 성공 확인(New Architecture + `plugins/withHermesBuildPhaseWarningFix.js` 앵커가 여기서 최초 검증됨 — 실패 시 최우선 수정, 감사 m12).
- [ ] `eas submit -p ios` 또는 ASC 업로드 → TestFlight internal 배포.
- [ ] 실기기 QA 체크리스트: ① 콜드 스타트~가입~온보딩 ② 데모 계정 로그인 4개 탭 ③ 사진 첨부(카메라·앨범 권한 문구 확인) ④ 투약·식사 알림 수신(0004 QA 잔여 흡수) ⑤ 비행기 모드 기록→복구 동기화 ⑥ 계정 삭제 전체 흐름(T1) ⑦ 언어 en/ko 전환 ⑧ 스플래시·아이콘 표시. 발견 이슈는 fix 커밋 분리.
- [ ] QA 결과 `[문서/판정]` 승인 후 D11 스크린샷 캡처 허용(최종 UI 확정 시점).

## Task 9: 스토어 메타데이터 작성·입력 `[문서/판정]`→`[운영]` (D9~D11)

- [ ] 카피 작성(EN/KO, `docs/product/STORE_LISTING.md`로 저장): 이름 PawBloom · 부제 ≤30자(예: EN "Pet care records for vet visits" / KO "병원에 가져가는 반려동물 기록") · 설명(POSITIONING_STRATEGY.md의 "가족 기록→병원 briefing" 서사 기반, 기능은 다이어리·투약 기록·수의사용 요약·가족 공유·오프라인만) · 키워드 100자(pet, dog, cat, medication, diary, vet, 반려동물, 투약, 병원 등). AI·구독 문구 금지.
- [ ] App Privacy 입력: 감사 05 §7 표를 그대로 ASC 질문지에 매핑(전 항목 linked-to-user / App Functionality / 추적 없음).
- [ ] 카테고리 Lifestyle(1차)·Health & Fitness(2차 선택), 연령 등급 질문지(의료/웰니스 문항 = 기록 도구·진단 아님), 가격 무료, 저작권.
- [ ] Privacy Policy URL·Support URL(T3 산출) 입력.

## Task 10: 스크린샷 `[코드]`+`[문서/판정]` (D10~D11)

- [ ] iPhone 6.9" 시뮬레이터(iPhone 17 Pro Max)에서 데모 계정 데이터로 캡처: Today·Diary(기록 있음)·Care(투약 현황)·Reports(리포트+면책 문구 노출)·설정 중 5~6장 × EN/KO 두 세트. `xcrun simctl status_bar override --time "9:41" --batteryState charged --batteryLevel 100`으로 상태바 정리.
- [ ] supportsTablet=false이므로 iPad 세트 불필요(T4 전제). 6.5"는 6.9"에서 자동 축소 적용 확인.
- [ ] `[문서/판정]` 검수: 면책 문구 노출 컷 1장 이상 포함(1.4.1 방어), 카피와 화면 정합.

## Task 11: 리뷰 노트·제출 `[운영]`+`[문서/판정]` (D12)

- [ ] App Review Notes 작성: 데모 계정 이메일/비밀번호, 로그인 후 추천 경로(Today→Care 투약 기록→Reports 리포트 확인), "기록 기반 요약이며 진단 기능 없음" 명시, 언어 전환 경로(Settings), 알림은 로컬 전용임을 부기.
- [ ] 빌드 선택 → 심사 제출. 제출 직후 Supabase 프로덕션 가동 상태(에지 함수 포함) 유지 확인 — 심사 중 다운타임은 2.1 리젝.

## D13~D14 버퍼 · 리스크

- 버퍼 용도: 심사 반려 대응(24~48h 내 재제출), T8 QA 이슈 잔여 수정.
- 리스크: ① Apple 등록 지연(T2를 D1에 시작하는 이유 — 지연 시 전체 −N일) ② 이메일 확인 딥링크 미복구(T5 실패 시 확인 OFF로 전환 결정) ③ New Arch 빌드 실패(D8 발견 → 버퍼 소진 전 `newArchEnabled: false` 옵트아웃 검토) ④ 리포트 공유 링크 등 미완 노출 기능 발견 시 숨김 우선.
- 이 계획에서 하지 않는 것(P2 후속): Google Play 트랙, 데이터 내보내기(m11), IAP/구독, AI briefing 노출, iPad 대응.

## 완료 기준

블로커 3·필수 6 전부 체크 + `npm run verify` 그린 + 심사 "Waiting for Review" 상태 도달. 완료 시 이 파일을 `docs/exec-plans/archive/`로 이동하고 [0003](./0003-weekly-execution-checklist.md) "다음 즉시 작업"을 갱신한다.
