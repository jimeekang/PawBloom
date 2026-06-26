# 릴리스 엔지니어링

## EAS Profile

- `development`: 내부 development client
- `preview`: simulator/APK preview build
- `production`: App Store와 Play Store build

## iOS

1. Preview build를 생성한다.
2. TestFlight internal tester에 제출한다.
3. TestFlight external beta에 제출한다.
4. App Store review에 제출한다.

## Android

1. Preview build를 생성한다.
2. Play internal testing에 업로드한다.
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
