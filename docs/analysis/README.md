---
owner_model: claude-opus-4.8-extra
domain: analysis
edit_policy: exclusive
---

# PawBloom 전면 분석 — 인덱스

- 작성일: 2026-07-05
- 대상: PawBloom (Expo/React Native + Supabase, 영/한 이중언어 반려동물 다이어리·케어 기록 앱)
- 분석 방법: 코드베이스 전수 실측(프론트엔드/백엔드/엔지니어링) + 호주·한국 시장 웹 조사 + 개발자·CEO·마케터 3관점 평가 + 완결성 교차검증

이 디렉터리는 PawBloom 제품 전면 분석 5종과, 2026-07-04에 수행된 제품 감사(archived)의 진입 설명을 담는다.

## 분석 문서 5종

- [00. 종합 요약](00-executive-summary.md) — 전체 분석의 핵심 결론·우선순위·의사결정 요약.
- [01. 시장 조사 (호주·한국)](01-market-research.md) — 대상 시장 규모·경쟁·수요 근거.
- [02. 제품 UX](02-product-ux.md) — 화면별 사용성 진단과 개선 방향.
- [03. 엔지니어링](03-engineering.md) — 아키텍처·구현 상태·기술 부채 실측.
- [04. 비즈니스·수익화](04-business-monetization.md) — 과금 모델·전환·수익화 준비도.
- [05. 디자인 시스템·UI/UX 전수 감사 (2026-07-12)](05-design-system-audit.md) — 토큰·컴포넌트 규격 위반, 접근성·상태 피드백 결함 실측, 글로벌 디자인 리파인 근거.

## 감사 이력 요약 (Product Analysis, 2026-07-04, archived)

원본: `.codex-audits/pawbloom-product-analysis-2026-07-04/` 스크린샷 9종 (audit-notes.md는 이 문서로 흡수 후 제거). 아래는 그 감사에서 나온 유일 자산을 이 인덱스로 흡수한 것이며, **미해결 레이아웃 버그의 실제 회귀 추적은 중복 없이 [docs/design/DESIGN_QA.md](../design/DESIGN_QA.md)에서 관리**한다.

### 감사 범위·방법

- 범위: Auth, Today, Diary, Care, Reports 화면 + 제품/아키텍처/프론트·백·DB 규칙 문서 + `apps/mobile`·Supabase 마이그레이션·Edge Functions 구현 상태.
- 증거: 스크린샷 9종 — `00-auth.png`, `00-signup.png`, `01-today-viewport.png`, `02-diary.png`, `03-diary-form.png`, `04-care-top.png`, `04-care.png`, `05-reports.png`, `06-reports-actions.png`.

### 화면별 핵심 발견 (스크린샷 1:1 연결)

- **Auth** (`00-auth`/`00-signup`): 기록의 민감성·보안 동기화는 명확하나, 카피가 사용자 가치가 아닌 Supabase/RLS에 집중 → 가치 미리보기("7일 수의사 리포트", "가족 케어 로그", "안전한 기록 기반 요약")를 계정 생성 전에 노출 권장. 전환 관점 취약.
- **Today** (`01-today-viewport`): pet hero·완료 수·투약 수·체크리스트·타임라인은 이해 가능. **[미해결 버그] hero 텍스트가 pet 이미지와 겹치고 일부 한/영 텍스트 가독성 저하** → hero scrim 강화 또는 pet 메타데이터를 이미지 하단으로 이동, care 기록 존재 시 care/report CTA 노출.
- **Diary 화면** (`02-diary`): 날짜 선택·카테고리 타일·선택일 기록·편집 흐름은 유용하나 월간 캘린더가 첫 화면을 지배해 일일 기록 액션이 지연됨 → 기본은 Today/이번 주 compact 컨트롤, 전체 월간은 요청 시 확장.
- **Diary form** (`03-diary-form`): 카테고리별 구조화 필드는 전략에 부합. **[미해결 버그] 2열 음식 입력 필드가 390px 모바일 뷰포트에서 우측으로 오버플로우** → 좁은 화면에서 페어 입력을 세로 스택 또는 1열 반응형.
- **Care 화면** (`04-care-top`): care defaults·quick dose 기록은 수의사 리포트 제품에 맞는 올바른 primitive이나, 유료 핵심 가치인 리포트 생성이 긴 설정/입력 흐름 아래에 위치 → "오늘 투약"·"활성 케어 플랜"·"수의사 리포트 준비도"로 분할하고 준비도를 상단에 노출.
- **Care form** (`04-care`): 약명·상태·처방량·투여량·상태·반응 노트를 포착. **[미해결 버그] 2열 dose 입력 필드가 Diary와 동일하게 390px에서 우측 오버플로우** → 베타 테스트 전 반응형 필드 레이아웃 수정 필수.
- **Reports 화면** (`05-reports`): 안전 disclaimer·공유 전 확인 흐름은 양호하나 현재 리포트는 대부분 카운트라 임상용 산출물 느낌 부족 → 타임라인 하이라이트·누락 데이터 목록·수의사 질문·영문 요약 미리보기·공유 링크 상태·export 증거 추가.
- **Reports 액션** (`06-reports-actions`): "초안 확정"·"기록 추가"는 안전한 공유 프로세스에 매핑되나, 공유 URL·만료·수신자 뷰·PDF/export·유료 업그레이드 순간이 미노출 → 확정/공유 상태를 구체화하고 수의사가 볼 화면을 표시.

### 미해결 레이아웃 버그 (회귀 감시 대상)

세 건 모두 **미수정 상태**로 아카이브되었으며 회귀 감시 항목이다. 실제 추적은 [docs/design/DESIGN_QA.md](../design/DESIGN_QA.md)의 회귀 감시 섹션에서 수행한다(여기서는 중복 기록하지 않음).

1. Diary form 2열 dose/음식 입력의 390px 우측 오버플로우.
2. Care form 2열 dose 입력의 390px 우측 오버플로우(1과 동일 유형).
3. Today hero 텍스트와 pet 이미지 겹침·가독성 저하.

### 증거 한계 (Evidence Limits)

- 스크린샷은 **Expo web preview**에서 캡처, 네이티브 iOS/Android 빌드 아님.
- 인증된 Supabase 흐름은 실제 계정 생성 없이 **코드·문서 기준**으로만 검토.
- 라이브 사용자 분석·리텐션·CAC·전환·지불 의향(WTP) 데이터 부재.
- 시장 분석은 방향성 있고 출처 기반이나, 유료 사용자 발굴(discovery)을 대체하지 못함.
