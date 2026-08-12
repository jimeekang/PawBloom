---
owner_model: codex-high
domain: release
edit_policy: exclusive
---

# 릴리스 엔지니어링

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
- 실제 구독 결제는 beta 이후 RevenueCat 또는 StoreKit/Play Billing으로 연결한다.

## 릴리스 전 확인

- Android 실제 기기에서 preview build를 확인한다.
- iOS는 TestFlight 또는 development build로 확인한다.
- Store screenshot은 최종 UI 기준으로 다시 캡처한다.
- Support email과 privacy policy URL을 준비한다.
