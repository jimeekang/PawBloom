# 디자인 QA 기록

## 발견 사항

- [P0] 시각 브라우저 캡처가 차단됨
  - 위치: Product Design QA 캡처 단계
  - 근거: 기준 디자인 이미지는 `docs/design/pawbloom-app-design-draft-02.png`에 있으나, in-app browser가 `http://127.0.0.1:8082`와 `http://localhost:8082` 접근을 Browser Use URL 정책으로 거부했다. 따라서 렌더링된 앱 스크린샷을 캡처하지 못했다.
  - 영향: 동일 viewport에서 구현된 모바일 UI와 기준 mockup을 정직하게 비교할 수 없다.
  - 수정 방향: 승인된 Browser/Chrome 도구에서 로컬 Expo URL을 열 수 있는 환경으로 Product Design QA를 다시 실행하고, Today, Diary, Care 화면을 `390x844` viewport로 캡처한다.

## 미해결 질문

- 목표 디자인 자체에 대한 미해결 질문은 없다.
- 현재 blocker는 로컬 preview URL에 대한 도구 접근 권한이다.

## 구현 확인 목록

- 로컬 기준 이미지: `docs/design/pawbloom-app-design-draft-02.png`
- 구현 대상: `http://localhost:8082`의 Expo web preview
- 비교 대상 viewport: `390x844`
- 비교 대상 상태: Today tab, Diary tab, Care tab

## 후속 polish

시각 캡처가 가능해지면 mockup과 구현 화면을 아래 항목 중심으로 비교한다.

- Typography weight
- Icon scale
- Hero image crop
- Vertical rhythm
- Card border contrast

## 증거 상태

- Source visual truth path: `docs/design/pawbloom-app-design-draft-02.png`
- Implementation screenshot path: unavailable
- Viewport: `390x844`
- State: Today / Diary / Care intended, screenshot unavailable
- Full-view comparison evidence: browser URL policy로 차단됨
- Focused region comparison evidence: 전체 캡처가 차단되어 없음
- Previous QA pass 이후 patch: 기준 mockup 기반 초기 UI 구현
- Final result: blocked
