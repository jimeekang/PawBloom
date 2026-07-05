---
owner_model: claude-opus-4.8-extra
domain: qa
edit_policy: exclusive
---

# 디자인 QA 기록 (DESIGN_QA)

> PawBloom 모바일 UI의 시각 QA 기준·재실행 절차·미해결 회귀 감시 항목을 관리하는 문서.
> 기준 디자인 자산(`docs/design/`) 옆에 위치한다. `edit_policy: exclusive` — 소유 모델(claude-opus-4.8-extra) 외 수정 금지.

---

## 1. 재실행 파라미터 (Product Design QA)

시각 캡처 도구가 로컬 preview URL에 접근 가능한 환경에서 Product Design QA를 다시 실행할 때 아래 파라미터를 고정한다.

| 항목 | 값 |
| --- | --- |
| 기준 이미지 (source visual truth) | `docs/design/pawbloom-app-design-draft-02.png` |
| 구현 대상 | Expo web preview (`http://localhost:8082`) |
| 비교 viewport | `390x844` |
| 비교 대상 상태 | Today tab / Diary tab / Care tab |

절차: 승인된 Browser/Chrome 도구에서 로컬 Expo URL을 열고, Today·Diary·Care 화면을 `390x844`로 캡처한 뒤 기준 mockup과 대조한다.

> **각주 — 이전 pass 차단 사유:** 직전 QA는 in-app browser가 `http://127.0.0.1:8082` / `http://localhost:8082` 접근을 Browser Use URL 정책으로 거부해 렌더 스크린샷 캡처에 실패했다(final result: blocked). 목표 디자인 자체에 대한 미해결 질문은 없고, blocker는 로컬 preview URL에 대한 도구 접근 권한뿐이다.

---

## 2. Polish 체크리스트

시각 캡처가 가능해지면 mockup과 구현 화면을 아래 항목 중심으로 비교한다. 각 항목은 기준 이미지 대비 편차를 기록한다.

- **Typography weight** — 헤딩/본문 굵기가 기준 mockup과 일치하는지.
- **Icon scale** — 아이콘 크기·optical weight가 기준과 일치하는지.
- **Hero image crop** — Today hero의 pet 이미지 crop·초점이 기준과 일치하는지.
- **Vertical rhythm** — 섹션 간 수직 간격·리듬이 기준과 일치하는지.
- **Card border contrast** — 카드 테두리 대비가 기준과 일치하는지.

---

## 3. 미해결 회귀 감시 항목 (Regression Watch)

`.codex-audits/pawbloom-product-analysis-2026-07-04`에서 제기된 레이아웃 버그를 이 문서로 흡수해 회귀 감시 대상으로 관리한다. 각 항목은 현재 코드 대조 결과와 해결 상태를 표기한다.

관련 계획: [`../exec-plans/archive/care-report-2026-07-completion-log.md`](../exec-plans/archive/care-report-2026-07-completion-log.md) (완료 기록으로 통합됨)
정적 가드: [`../../scripts/verify-presentation-state.mjs`](../../scripts/verify-presentation-state.mjs) — `npm run verify:presentation`로 실행.

### 3.1 Diary/Care 2열 dose 입력 390px 우측 오버플로우 — ✅ 해결됨 (가드 있음)

- **원 증상 (07-04):** Diary 음식 입력의 2열(paired) 필드와 Care의 dose 필드(quick medication, setup 기본값)가 390px viewport에서 우측으로 오버플로/클리핑됨.
- **현재 코드 대조:** clinic-report plan에서 필드를 세로 스택(one-column)으로 전환 완료. 정적 가드가 row 기반 클리핑 패턴으로의 회귀를 차단한다:
  - `verify-presentation-state.mjs:64-65` — Diary 음식 meal 필드(`mealRow` `flexDirection:"row"` 또는 `mealLabel` `width:42`)가 다시 나타나면 실패.
  - `verify-presentation-state.mjs:70` — Care quick medication dose 필드가 row로 회귀하면 실패.
  - `verify-presentation-state.mjs:75` — Care setup medication/time 필드가 row로 회귀하면 실패.
- **감시 방법:** 위 정적 가드 유지. 가드를 삭제/우회하는 변경은 이 회귀를 되살릴 수 있으므로 리뷰에서 차단.

### 3.2 Today hero 텍스트가 pet 이미지와 겹침 — ✅ 해결됨 (전용 정적 가드 없음)

- **원 증상 (07-04):** Today hero의 텍스트가 pet 이미지 위에 겹쳐 한/영 텍스트 가독성이 떨어짐.
- **현재 코드 대조:** `apps/mobile/src/presentation/screens/HomeScreen.tsx`에서 가독성 보강 완료.
  - `heroOverlay`가 `colors.heroScrim` 배경 스크림을 적용(HomeScreen.tsx:135).
  - `heroName`/`heroMeta`에 `textShadow`를 추가해 이미지 위 텍스트 대비 확보(HomeScreen.tsx:136-137).
- **주의:** 이 항목에는 3.1과 달리 전용 정적 가드가 없다. 재실행 시 §1 파라미터로 `390x844` 캡처를 떠 hero 텍스트 가독성(Polish 체크리스트의 hero crop / typography weight 포함)을 육안 확인한다.

---

## 4. 증거 상태 (Evidence Log)

| 항목 | 상태 |
| --- | --- |
| Source visual truth | `docs/design/pawbloom-app-design-draft-02.png` |
| Implementation screenshot | 직전 pass 기준 unavailable (URL 정책 차단) |
| Viewport | `390x844` |
| 대상 상태 | Today / Diary / Care (intended) |
| Full-view comparison | browser URL policy로 차단 |
| Focused-region comparison | 전체 캡처 차단으로 없음 |
| 직전 QA 이후 patch | 07-04 clinic-report plan에서 dose/hero 회귀 수정 반영 |
| 07-04 audit 스크린샷 | `.codex-audits/pawbloom-product-analysis-2026-07-04/` (`01-today-viewport.png`, `03-diary-form.png`, `04-care.png` 등) |

재실행 시 이 표의 unavailable 항목을 캡처 경로로 갱신하고, §3 회귀 항목의 해결 상태를 현재 코드 기준으로 재대조한다.
