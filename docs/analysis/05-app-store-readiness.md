---
owner_model: claude-opus-4.8-extra
domain: analysis
edit_policy: exclusive
---

# 05. 앱스토어 제출 준비도 감사

- 작성일: 2026-07-19
- 판정: **현재 상태로는 App Store 제출 불가.** 하드 블로커 3건(계정 삭제 부재, 개인정보처리방침·지원 URL 부재, 스토어 스크린샷 부재)이 해소되어야 하며, 제출 전 필수(major) 6건이 뒤따른다.
- 방법: 5개 차원 병렬 감사(빌드 설정 / Apple 심사 가이드라인 / 백엔드·개인정보 / 스토어 메타데이터 / 2026-07 기준 최신 제출 요건 웹 검증) 후, 발견 39건 전건을 독립 검증 에이전트가 코드 재확인으로 적대적 검증. 38건 확정, 1건 반박(§6).
- 전제: 1차 타깃 Apple App Store(호주·한국), 2차 Google Play. Expo SDK 56 managed workflow + EAS Build.

## 1. 종합 판정

앱의 **내용물(코드 품질·정책 리스크 관리)은 심사 관점에서 예상보다 준비도가 높다** — RLS 전면 적용, 추적 SDK 제로, IAP 없음, 의료 면책 문구 코드 강제, 로컬 알림 전용, 맥락적 권한 요청 등 흔한 리젝 사유 다수가 이미 해소돼 있다(§5). 반면 **제출 절차물(계정 삭제, 정책 URL, 스크린샷, 데모 계정, 스토어 카피, EAS 연결)은 사실상 전무**하다. 즉 "심사에서 떨어질 앱"이 아니라 "아직 심사대에 올릴 수 없는 앱"이다.

## 2. 블로커 (해소 전 제출 불가/리젝 확정)

| # | 항목 | 근거 | 조치 |
| --- | --- | --- | --- |
| B1 | **앱 내 계정 삭제 부재** — 가이드라인 5.1.1(v). 이메일 가입(`useAuthActions.ts:76`)이 있는데 Settings에는 로그아웃뿐(`SettingsScreen.tsx:30`). 삭제 RPC·edge function 전무(전 저장소 grep 0건) | 4개 차원에서 중복 확정. 리젝 확실 | `auth.admin.deleteUser` 호출 edge function(service-role) + Settings '계정 삭제' UI(확인 절차 포함). DB는 `auth.users` cascade FK로 자동 정리되나 **Storage 사진은 cascade가 없어 서버측 purge를 함수에 포함**해야 함(`pet-media` 버킷 `{pet_id}/%` 삭제) |
| B2 | **개인정보처리방침·지원 URL 부재** — 5.1.1(i) + App Store Connect 필수 입력 필드. 저장소 전체에 호스팅된 정책 URL·지원 이메일 없음(문서상 TODO만: `RELEASE.md:42`, `0003-weekly-execution-checklist.md:237`) | 3개 차원에서 중복 확정 | EN/KO 정책 작성·호스팅(이메일, 반려동물 건강기록, 사진, 오프라인 캐시, Supabase 처리, 호주 Privacy Act·한국 개인정보보호법 커버) + 지원 페이지/이메일. ASC 입력 + 인앱 링크(Auth 화면·Settings) |
| B3 | **스토어 스크린샷 전무** — ASC 제출 필수 자산. 기기 스크린샷 0장. `supportsTablet: true`(app.json:10)라 iPhone 6.9" 외 **iPad 13"도 필수**. `.codex-audits`의 웹 프리뷰 캡처는 제출 불가 | 확정 | 최종 UI로 iPhone 6.9"(+6.5") EN/KO 세트 캡처. iPad 미대응이면 `supportsTablet: false`로 내려 iPad 요건 자체를 제거(권장, §4-m2) |

## 3. 제출 전 필수 (major)

| # | 항목 | 근거 | 조치 |
| --- | --- | --- | --- |
| M1 | **심사용 데모 계정·시드 데이터 없음** — 2.1. 전 기능이 로그인 뒤에 있고 이메일 확인 게이트(`authSignUpPolicy.ts` → 'auth.checkEmail')까지 있어 리뷰어가 빈 앱/로그인 장벽을 만남. 시드 스크립트 부재 | 사전 확인된 데모 계정 + 반려동물·수일치 다이어리/투약 기록·생성된 리포트 시드 스크립트(`supabase/seed`). 자격증명·사용 경로를 App Review Notes에 기재 |
| M2 | **딥링크 scheme 미선언으로 가입 확인 흐름 단절** — `supabase/config.toml:13-14`가 `site_url="pawbloom://auth"`로 리다이렉트하는데 app.json에 `scheme` 키가 없어 확인 링크가 앱으로 돌아오지 못함. 리뷰어가 신규 가입 시 막히는 실동작 결함(2.1 위험) | `"scheme": "pawbloom"` 추가 + Supabase redirect URL 정합 확인, 또는 이메일 확인 비활성화 결정 |
| M3 | **App Privacy(Apple)/데이터 안전(Google) 질문지 미준비** — 이메일·사진·반려동물 건강기록을 수집하므로 제출 시 필수 | §7의 데이터 인벤토리 그대로 답변: Contact Info(이메일)·User Content(사진, 다이어리)·건강 인접 기록 — 전부 사용자 연결, 목적 App Functionality, 추적 없음. 매핑을 저장소에 문서화해 스키마 변경과 동기화 |
| M4 | **스토어 등록 카피 부재** — 설명(EN/KO)·부제(≤30자)·키워드 미작성. `POSITIONING_STRATEGY.md`의 한국어 산문만 존재 | 포지셔닝 문서 기반으로 작성. `RELEASE.md:31` 규칙 준수: "AI 진단"이 아니라 "record-based summary". 미출시 기능(AI briefing, Plus/Family 요금제 — 코드에 존재하나 미노출) 광고 금지(2.3) |
| M5 | **EAS 프로젝트 미연결** — app.json에 `extra.eas.projectId`/`owner` 없음. `appVersionSource: remote`+`autoIncrement`(eas.json:4,18)와 태그 트리거 CI(`.eas/workflows/release.yml`)가 연결 전엔 동작 불가 | `eas init` 1회 실행 후 태그 빌드 그린 확인. SETUP.md:142-148에 이미 예정된 절차 |
| M6 | **Apple Developer Program·ASC 앱 레코드 미생성** — 운영 선행 조건(SETUP.md:58-62) | 개발자 프로그램 등록(법인이면 D-U-N-S 선행) → `com.pawbloom.app` 앱 레코드 생성 → RELEASE.md의 TestFlight internal→external→심사 순서 실행 |

## 4. 권장 (minor — 리젝 사유는 아니나 제출 전 정리 권장)

- m1. `ios.infoPlist.ITSAppUsesNonExemptEncryption: false` 추가 — 미설정 시 매 빌드가 'Missing Compliance'로 정지(HTTPS만 사용하므로 면제 대상). `ios.config`보다 `infoPlist` 경로가 EAS에서 안정적.
- m2. `supportsTablet: false` 권장 — 코드에 iPad 대응 없음(반응형 처리 0건). true 유지 시 iPad 스크린샷 의무 + 레이아웃 심사 표면 증가.
- m3. 스플래시 미설정 — `expo-splash-screen` 미설치, `splash` 키 없음 → 기동 시 흰 화면. `assets/splash-icon.png`(1024²)이 고아 상태이므로 플러그인으로 연결.
- m4. 첫 실행 언어가 한국어 고정(`languagePreference.ts:5 DEFAULT_LANGUAGE='ko'`, 기기 로케일 감지 없음) — 호주 1차 시장·영어 리뷰어와 상충. `expo-localization` 도입 또는 리뷰 노트에 전환 경로 명시. ASC 기본 로케일은 en-AU + ko 병기.
- m5. Settings 'Environment' 카드가 프로덕션에서 Supabase 구성 상태·'Free preview' 플랜 노출(`SettingsScreen.tsx:60-69`) — `__DEV__` 게이트 또는 제거.
- m6. `eas.json` submit에 iOS 블록(ascAppId/appleTeamId) 없음, Android `serviceAccountKeyPath` 없음 — 제출 자동화 시 필요(대화형 제출은 가능).
- m7. `CFBundleLocalizations: ["en","ko"]` 미선언 — 바이너리 기준 지원 언어 표기 누락.
- m8. `expo-notifications` 플러그인에 Android 알림 아이콘/색 미설정 — 상태바 흰 사각형 위험(iOS 무관).
- m9. 카테고리 미결정 — **Lifestyle 1차 권장**(Medical 회피로 1.4.1 정밀 심사 표면 축소, 'record-based summary' 포지셔닝과 일치).
- m10. EU DSA trader 미신고 상태로 두려면 ASC 가용성에서 EU 스토어프런트 제외(AU·KR 타깃이므로 무해).
- m11. 데이터 내보내기 경로 없음 — 스토어 블로커는 아니나 호주 APP 12/한국 열람권 대응용 export 함수 또는 수동 절차를 정책에 명시.
- m12. New Architecture(SDK 56 기본 on) + 커스텀 Hermes Podfile 플러그인(`plugins/withHermesBuildPhaseWarningFix.js:11-13`이 앵커 불일치 시 빌드 hard-fail) — 실기기 프로덕션 빌드 1회로 전 네이티브 의존성 검증 필수.
- m13. 2025 개편 연령 등급 질문지 — 신규 앱은 제출 시 작성하면 됨. 투약 기록 특성상 의료/웰니스 문항에 "기록, 진단 아님"으로 응답(내장 면책 문구가 근거).
- m14. 한국 기반 개발자로 등록하는 경우 ASC 한국 컴플라이언스 정보(사업자등록번호 등) 입력 필요 — 코드 변경 없음.

## 5. 이미 통과 상태인 것 (강점)

- **1.4.1 의료 리스크**: 사용자 입력 기록만 저장, 용량 제안·진단 없음. 면책 문구("record-based summary, not a diagnosis")를 `vetReportArtifact.ts:36`이 검증하고 `ReportsScreen.tsx:66`이 렌더 — 코드 수준 강제.
- **4.8 로그인**: 이메일/비밀번호 전용, 소셜 로그인 없음 → Sign in with Apple 의무 비발동.
- **3.1.1 결제**: IAP·페이월·구매 유도 카피 없음(구독 티어 코드는 미노출 dead code).
- **5.1.2/ATT**: 분석·추적 SDK 0개, IDFA 미사용 → ATT 프롬프트 불필요.
- **보안·개인정보 기반**: 공개 18개 테이블 전부 RLS + pet-membership 정책, `pet-media` 버킷 private 강제, 클라이언트는 publishable key만 사용, 커밋된 시크릿 없음(CI 가드 `verify-secrets.mjs`), edge function 인증 검사, 공유 리포트 엔드포인트는 토큰·만료·확정 상태 검증.
- **알림**: 로컬 예약 전용(APNs·푸시 토큰 서버 저장 없음), 권한은 케어 설정 저장 시점에 맥락적으로 요청(cold-open 프롬프트 없음).
- **권한 문자열**: 사진·카메라 목적 구체적, 마이크 명시적 비활성.
- **오프라인 내성**: 세션 secure-store 유지, SQLite outbox 큐, 오프라인 기동 크래시 경로 없음 — 리뷰어 네트워크 불안정에 안전.
- **자산·식별자**: 아이콘 1024² RGB 무알파, 번들 ID `com.pawbloom.app` 일관, Android adaptive icon 3종 완비, 버전 체계 정상.
- **2026 요건 자동 충족**: Xcode 26/iOS 26 SDK 요건은 Expo SDK 56 기본 빌드 이미지가 충족. 외부 AI 전송 없음(5.1.2(i) 제3자 AI 고지 비발동 — 실제 LLM 연결 시 재점검).

## 6. 반박된 발견 (조치 불필요)

- 프라이버시 매니페스트 미구성 주장(ITMS-91053 위험) — **반박됨.** required-reason API(UserDefaults CA92.1, FileTimestamp C617.1, DiskSpace E174.1)는 react-native·expo 패키지에 번들된 `PrivacyInfo.xcprivacy`가 이미 선언하며 표준 EAS 빌드가 앱 전체로 집계한다. 별도 `expo.ios.privacyManifests` 설정 불필요.

## 7. App Privacy 질문지 답변 초안 (데이터 인벤토리)

마이그레이션 실측 기준. 전 항목 "사용자에 연결됨 / 목적 App Functionality / 추적 없음".

| Apple 데이터 유형 | 실제 데이터 | 출처 |
| --- | --- | --- |
| Contact Info → Email | `profiles.email` | 초기 스키마 L14 |
| Health & Fitness(또는 Other) | 반려동물 질환·투약·용량·상태 점수·측정치 | `conditions`, `medications`, `medication_doses`, `measurements` |
| User Content | 다이어리 텍스트, 사진 | `diary_entries`, `media_assets` + private 버킷 |
| Identifiers | 사용자 ID(UUID) | auth.users |
| 수집 안 함 | 위치, 연락처, 검색 기록, 푸시 토큰, 광고 식별자 | 해당 코드·SDK 부재 확인 |

## 8. 제출 로드맵 (권장 순서)

1. **코드(codex-high 소유)**: 계정 삭제 edge function+UI(Storage purge 포함, B1) → `scheme` 추가(M2) → `supportsTablet:false`·암호화 플래그·스플래시·언어 기본값(m1~m4) → 시드 스크립트(M1).
2. **인프라/계정**: Apple Developer 등록·ASC 앱 레코드(M6) → `eas init`(M5) → 프로덕션 빌드 1회 실기기 검증(m12).
3. **정책/자산**: 개인정보처리방침·지원 페이지 호스팅(B2) → 스토어 카피 EN/KO(M4) → App Privacy 답변(§7, M3) → 스크린샷(B3) → 카테고리·가용 지역·연령 등급(m9, m10, m13).
4. **심사 대응**: 데모 계정+리뷰 노트(M1) → TestFlight internal→external → 제출.

블로커·major가 전부 절차·단일 기능 수준이므로, 계정 삭제 구현이 유일하게 유의미한 개발 작업이다. 위 순서 기준 **엔지니어링 1주 내외 + 운영/문서 병행으로 첫 제출 가능** 수준으로 판단한다.

## 9. 증거 한계

- 코드·설정·문서 실측 기반이며, 실기기 프로덕션 빌드는 실행하지 않음(EAS 미연결 상태) — m12 검증으로 보완 필요.
- 웹 검증 항목(Xcode 요건, DSA, 연령 등급, 한국 컴플라이언스)은 2026-07 시점 공개 자료 기준이며 제출 시점에 ASC 공지 재확인 권장.
- App Store Connect 계정 내부 상태(앱 레코드, 크레덴셜)는 저장소 밖이라 미확인 — 부재로 가정.
