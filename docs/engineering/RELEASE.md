---
owner_role: codex
domain: release
edit_policy: exclusive
---

# 릴리스 엔지니어링

## 아바타 첫 버전 적용 범위 (2026-10-18)

- 제품·구현 정본: [PRODUCT_SPEC](../product/PRODUCT_SPEC.md), [0009](../exec-plans/active/0009-avatar-care-memories-implementation.md).
- 아래 기존 출시 운영 절차는 유지한다. 새 기능 준비는 0009 M0~M6 완료 후 공개 출시 단계로 연결한다.
- 스토어 자산은 실제 동작하는 우리 집·사진 캐릭터·아이별 케어·공동 추억을 기준으로 다시 준비한다.
- 현재 템플릿 브리핑을 LLM·사진 의료 진단처럼 홍보하지 않는다. 생성 서비스 미구성 기능도 출시 완료로 표시하지 않는다.
- 제공자·외부 사진 전송/동의·보관/학습/삭제·비용 한도, 새 객체의 계정 삭제를 출시 전 검증한다.
- 공개 개인정보처리방침과 App Privacy/Data safety는 실제 제공자·처리 조건 확정 후 게시본을 갱신한다.
- 무료 v1은 아래 권장 전략이다. 현재 서버 Free/Plus/Family 한도·초대 gate와의 정합은 정책 결정 후 구현한다.
- 새 기능 계획만으로 billing/entitlement를 해제하지 않는다. 베타는 승인된 테스트 권한으로 검증할 수 있다.
- 신규 DB/Storage/함수는 additive 준비·역할 검증·강한 리뷰 후 승인된 배포에서 적용한다.
- 이번 문서 갱신은 기존 미커밋 릴리스 작업을 보존하며 원격 적용·게시·심사 제출을 실행하지 않는다.

## App Store v1 권장 전략

- v1은 **무료 앱**으로 출시한다. 결제 구현 전에는 Plus/Family 요금제, 잠금 기능, 구독 유도 문구를 노출하지 않는다.
- 계정 생성부터 계정 삭제까지의 전체 생명주기를 TestFlight 실기기에서 통과시킨 뒤 심사를 요청한다.
- 브랜드와 앱 식별자를 먼저 확정한다. 이름이나 bundle ID가 바뀌면 인증 redirect, 개인정보처리방침, 스토어 자산까지 다시 바뀌므로 이후 작업보다 앞선다.
- 아래 단계는 앞 단계의 완료 조건을 통과한 뒤 순서대로 진행한다. 1~3단계 안의 독립 작업만 병행할 수 있다.

## 권장 실행 순서

### 0. 브랜드와 앱 식별자 확정

현재 App Store에 같은 이름의 `PawBloom - Plant & Pet Care`가 있고, Google Play에는 이 저장소와 같은 Android package `com.pawbloom.app`을 사용하는 앱이 확인됐다.

1. 기존 PawBloom 스토어 자산을 소유·통제하는지 확인한다.
2. 소유하지 않는다면 새 앱 이름을 결정하고 Apple에서 사용 가능 여부를 확인한다.
3. 이름, Expo slug, URL scheme, iOS bundle ID, Android package를 한 세트로 확정한다.
4. Support/Privacy URL, 지원 이메일, Supabase Auth redirect URL도 같은 브랜드로 맞춘다.

완료 조건:

- Apple Developer, App Store Connect, Google Play, EAS, Supabase에서 사용할 식별자와 URL이 충돌 없이 확정됐다.
- 변경 범위와 마이그레이션 대상이 문서와 설정에 동일하게 반영될 준비가 됐다.

### 1. 계정 생성·인증·삭제 완성

현재 앱에는 이메일 회원가입, 로그인, 이메일 확인 안내, 비밀번호 재설정, 계정 삭제 UI와 서버 함수 코드가 있다. 이 단계는 해당 기능을 운영 환경에서 하나의 흐름으로 완성한다.

1. 회원가입 화면에서 이메일 정규화, 비밀번호 확인, 최소 강도, 중복 계정, 약한 비밀번호, 요청 제한, 네트워크 오류를 한국어·영어로 검증한다.
2. 가입 전에 Privacy와 Support 링크가 실제 HTTPS 페이지로 열리는지 확인한다.
3. Supabase 이메일 확인 링크가 확정된 앱 scheme으로 돌아오고, 로그인 세션과 profile row를 정상 생성하는지 확인한다.
4. 신규 계정의 온보딩과 첫 반려동물 생성까지 연결한다.
5. 비밀번호 재설정 링크, 앱 복귀, 새 비밀번호 로그인까지 확인한다.
6. `delete-account` Edge Function을 운영 Supabase에 배포하고 앱에서 호출되도록 한다.
7. 삭제 시 Auth 사용자, profile/반려동물/기록, Storage 파일, 로컬 세션과 예약 알림이 정리되는지 확인한다.
8. 삭제된 계정으로 로그인이 실패하고 같은 이메일로 재가입 가능한지 정책에 맞춰 확인한다.
9. App Review용 안정적인 demo account를 생성하고 심사 기간에는 삭제하거나 비밀번호를 바꾸지 않는다.

운영 보강:

- 유출 비밀번호 차단을 활성화한다.
- 운영용 custom SMTP와 발신 도메인을 설정한다.
- 가입·로그인 rate limit과 CAPTCHA 적용 여부를 확정한다.
- Supabase 관리자 계정에 MFA를 적용한다.

완료 조건:

- TestFlight 실기기에서 `가입 → 이메일 확인 → 로그인 → 온보딩 → 데이터·사진 생성 → 비밀번호 재설정 → 계정 삭제`가 끝까지 통과한다.
- 삭제 후 서버 데이터와 Storage 잔존 여부를 관리자 쿼리로 확인한다.

### 2. v1 제품 범위와 판매 방식 정리

권장안은 무료 v1이다.

1. 베타 표시와 “구매할 수 없는 요금제” 노출을 제거한다.
2. Plus/Family 전용으로 잠겨 있으나 결제할 수 없는 기능은 v1에서 무료로 열거나 화면에서 제외한다.
3. App Store 설명과 앱 내부 기능 목록을 실제 제공 범위에 맞춘다.
4. 유료 판매가 필요하면 다음 중 하나를 별도 릴리스 범위로 확정한다.
   - 앱 자체를 유료로 판매하고 앱 안에 요금제를 두지 않는다.
   - 디지털 기능·구독은 StoreKit In-App Purchase로 구현한다.

완료 조건:

- 사용자가 볼 수 있는 모든 기능은 실제 사용할 수 있고, 결제할 수 없는 구독 유도나 beta 문구가 없다.
- 무료/유료 여부와 App Store 가격 설정이 일치한다.

### 3. 개인정보·지원·운영 보강

1. Privacy Policy를 안정적인 공개 HTTPS 주소에 게시하고 앱의 실제 수집·보관·삭제 동작과 맞춘다.
2. 연락처와 지원 절차가 있는 공개 HTTPS Support 페이지를 만든다. `mailto:`만으로 제출하지 않는다.
3. App Store Privacy 답변을 Auth, 사진, 반려동물 건강 기록, 알림, AI 처리 방식과 대조한다.
4. 운영자 법적 이름, 저작권 표기, 지원 이메일을 확정한다.
5. Supabase 운영 요금제, 백업/PITR, 장애 대응, 로그 보존, 접근 권한을 확인한다.
6. `npm audit --omit=dev` 결과는 현재 Expo SDK와 호환되는 상위 버전으로 단계적으로 해소하고, 강제 downgrade는 하지 않는다.

완료 조건:

- 앱, 정책, App Store Privacy 답변이 서로 모순되지 않는다.
- Privacy와 Support URL이 로그인 없이 열리고 HTTP 200을 반환한다.
- 운영 백엔드의 복구 방법과 담당자가 정해졌다.

### 4. Apple·EAS 배포 연결

1. Apple Developer Program, 계약, 세금·은행 정보 상태를 확인한다.
2. App Store Connect 앱 레코드와 bundle ID, push capability를 생성한다.
3. EAS project를 연결하고 `extra.eas.projectId`, owner, iOS credential을 설정한다.
4. `eas.json`에 production submit 설정을 추가한다.
5. 심사 대상 코드를 원격 저장소에 push하고 release 기준 commit/tag를 고정한다.
6. production archive를 생성해 App Store Connect에 업로드한다.

완료 조건:

- 서명된 production build가 TestFlight Internal Testing에 설치된다.
- 어떤 commit과 백엔드 배포가 해당 build에 대응하는지 추적할 수 있다.

### 5. TestFlight 실기기 QA

1. `npm run verify`와 iOS Release build를 통과시킨다.
2. 새 설치, 앱 업데이트, 로그아웃·재로그인, 한국어·영어를 확인한다.
3. 계정 생성·비밀번호 재설정·계정 삭제 전체 흐름을 다시 실행한다.
4. 반려동물, 사진, 기록, 약속, 공유 보호자, 보고서, AI 요약 핵심 흐름을 확인한다.
5. 오프라인 저장과 온라인 복귀 후 replay, 약한 네트워크와 서버 오류를 확인한다.
6. 실제 iPhone에서 알림 허용/거부, foreground/background 수신, 알림 센터 표시를 확인한다.
7. 현지 시각 23:30 전후 날짜 저장, 카메라·사진 권한, 큰 글자와 작은 화면을 확인한다.
8. crash, Edge Function 오류, Auth/DB 로그를 점검하고 치명·주요 결함을 0건으로 만든다.

완료 조건:

- 물리 iPhone의 TestFlight build에서 필수 시나리오가 통과하고 차단 결함이 없다.
- 계정 삭제 함수가 실제 운영 환경에서 성공한다.

### 6. 스토어 메타데이터와 자산

1. 한국어·영어 앱 이름, subtitle, description, keywords, promotional text를 최종 기능 기준으로 작성한다.
2. Lifestyle category, 연령 등급, 가격, 지역, 저작권을 설정한다.
3. Privacy URL, Support URL, marketing URL 여부를 입력한다.
4. 6.9-inch iPhone 기준 한국어·영어 screenshot을 최종 TestFlight UI와 가상 데이터로 촬영한다.
5. App Review Notes에 demo account, 이메일 확인 처리, 계정 삭제 위치, AI 안내, 특별 테스트 절차를 적는다.

완료 조건:

- screenshot과 설명에 미구현 기능, 실제 개인정보, beta 문구가 없다.
- 심사자가 별도 문의 없이 로그인하고 모든 핵심 기능과 계정 삭제에 접근할 수 있다.

### 7. 제출과 출시

1. 필요하면 External TestFlight에서 마지막 회귀 테스트를 진행한다.
2. 제출 직전 production backend와 demo account를 다시 확인한다.
3. 선택한 build, App Privacy, 수출 규정, 콘텐츠 권한, Review Notes를 검토하고 심사를 요청한다.
4. 심사 중에는 backend schema, demo account, 필수 URL을 변경하지 않는다.
5. 승인 후 수동 출시 또는 단계적 출시를 선택하고 crash/Auth/Edge Function 지표를 모니터링한다.

완료 조건:

- App Store Connect의 필수 항목이 모두 완료되고 심사 build와 운영 backend가 고정됐다.
- 거절 대응 담당, rollback 기준, 사용자 지원 경로가 준비됐다.

## 예상 작업 순서

| 순서 | 작업 | 선행 조건 | 권장 목표 |
| --- | --- | --- | --- |
| 0 | 브랜드·식별자 결정 | 없음 | Day 0 |
| 1 | 계정 생명주기 완성 | 0 | Day 1~3 |
| 2 | 무료 v1 범위 정리 | 0 | Day 1~3 |
| 3 | 정책·지원·운영 보강 | 0 | Day 1~4 |
| 4 | Apple·EAS 연결 | 0, 계정/계약 준비 | Day 3~5 |
| 5 | TestFlight 실기기 QA | 1~4 | Day 5~7 |
| 6 | 메타데이터·screenshot | 안정된 TestFlight UI | Day 6~8 |
| 7 | 심사 제출 | 1~6 완료 | Day 9 이후 |

목표일은 계정·계약 승인, 브랜드 결정, 심사 결과에 따라 달라지는 작업 기준이며 출시 보장은 아니다.

## 역할 구분

사용자 결정·승인이 필요한 항목:

- 기존 PawBloom 브랜드 소유 여부와 새 이름 선택
- Apple Developer 계정, 2단계 인증, 계약, 세금·은행 정보
- 운영자 법적 이름, 도메인, 지원 이메일, Privacy 문구의 법률 검토
- 무료/유료 판매 결정과 최종 가격
- 물리 iPhone 접근 및 App Store 제출 최종 승인

Codex 구현·검증 항목:

- 브랜드 결정 후 앱 설정, Auth redirect, bundle/package 식별자 반영
- 계정 생성·복구·삭제 코드와 운영 함수 배포, 자동/수동 테스트
- 무료 v1 화면 정리 또는 확정된 결제 구현
- EAS/submit 설정, release build, 검증 스크립트, 배포 추적
- TestFlight QA 지원과 기술 결함 수정

## App Store 제출 완료 정의

- 신규 사용자가 TestFlight 실기기에서 계정을 만들고 이메일 확인 후 로그인할 수 있다.
- 비밀번호 복구와 앱 내 계정 삭제가 운영 backend에서 성공한다.
- beta 및 구매 불가능한 요금제 문구가 없다.
- Privacy와 Support 페이지가 공개되어 있고 앱 동작 및 App Store Privacy 답변과 일치한다.
- production build, demo account, screenshot, 한국어·영어 metadata, Review Notes가 준비됐다.
- `npm run verify`와 필수 실기기 QA가 통과했다.
- 브랜드·식별자, 심사 build, backend version을 추적할 수 있다.

## EAS Profile

- `development`: 내부 development client
- `preview`: 내부 배포용 build. Android는 APK, iOS는 등록된 기기용 internal distribution
- `production`: App Store와 Play Store build

현재 `preview` profile에는 iOS simulator 설정이 없다. Simulator 전용 build가 필요하면 별도 profile을 추가하고 `ios.simulator: true`를 명시한다.

## iOS

1. Preview build를 등록된 iPhone에 설치해 네이티브 기능을 확인한다.
2. `production` build를 생성해 TestFlight internal tester에 제출한다.
3. TestFlight external beta에 제출한다.
4. 같은 production 계열 build를 App Store review에 제출한다.

## Android

1. Preview APK를 실제 기기에 설치해 네이티브 기능을 확인한다.
2. `production` AAB를 생성해 Play internal testing에 업로드한다.
3. Closed/open testing으로 승격한다.
4. Staged rollout으로 production에 배포한다.

## Store 문구

- "AI diagnosis" 대신 "record-based summary"를 사용한다.
- 개인정보 처리방침 URL을 포함한다.
- 리뷰용 demo account를 제공한다.
- 의료/건강 관련 오해를 줄이기 위해 AI 화면과 report에 수의사 상담 안내를 포함한다.
- 구독을 출시할 때는 StoreKit/Play Billing으로 연결한다. RevenueCat은 선택적 운영 계층이다.

## 릴리스 전 확인

- `PAWBLOOM_REQUIRE_SDK_TEST=1 npm run test:db`로 실제 SDK 테스트 미실행을 차단한다.
- 사진→캐릭터 제공자 전환(2026-11-01, OpenAI): migration `20261101090000` 적용 후 이전 동의 버전(`avatar-ai-2026-10-31`)을 보내는 구버전 앱과 대기 중이던 구버전 job은 `avatar_invalid_input`이 된다(미출시라 수용). 배포 순서는 Secrets에 `OPENAI_API_KEY` 등록 → migration → 함수 배포 → 개인정보처리방침 재게시 → 원격 `CLAUDE_API_KEY` 삭제(`supabase secrets unset CLAUDE_API_KEY`)다.

- Android 실제 기기에서 preview build를 확인한다.
- iOS는 TestFlight 또는 development build로 확인한다.
- Store screenshot은 최종 UI 기준으로 다시 캡처한다.
- 공개 Support URL과 Privacy Policy URL을 준비한다.

## 공식 기준

- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [App Store Connect 앱 정보](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/)
- [App privacy details](https://developer.apple.com/app-store/app-privacy-details/)
- [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
