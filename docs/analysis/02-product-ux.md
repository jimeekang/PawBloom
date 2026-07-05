---
owner_model: claude-opus-4.8-extra
domain: product-design
edit_policy: exclusive
---

# PawBloom 제품 · UI/UX 분석

- 작성일: 2026-07-05
- 방법: `apps/mobile/src` 전수 실측(화면·디자인 시스템·i18n·상태 로직) + 홈 스크린샷(`.codex-audits/pawbloom-home-final/`) 시각 평가
- [← 종합 요약으로](00-executive-summary.md)

---

## 요약

디자인 시스템 자체는 강점이다(토큰 중앙화, 카테고리 시각 언어 통일, 저장 피드백의 스크린리더 공지까지). 그러나 **1차 시장(호주)용 영어가 렌더링되지 않는 구조적 결함**, **체크리스트 오탭 회복 불가**, **접근성 속성 광범위 누락**, 그리고 리포트 공유·결제가 목업인 상태가 출시를 막는다.

---

## 강점

- **Design system 토큰화가 탄탄하다.** colors/spacing/radius/type/shadow가 `design-system/tokens.ts`에 중앙집중되고 거의 모든 화면이 참조 → 색·간격·타이포 일관성 높음. 로컬 StyleSheet도 raw hex/px 대신 토큰 사용.
- **카테고리 시각 언어 단일 소스**(`categoryVisuals.ts`) — 홈 체크리스트·다이어리 그리드·타임라인·리스트가 동일 아이콘/색/라벨 공유.
- **preview(로컬)/live(Supabase) 이중 모드**가 `databaseMode` 플래그로 깔끔히 분기 → 로그인/DB 없이 전체 UI 시연 가능(`PawBloomShell.tsx`). 저장·수정·삭제 각 경로가 두 모드 모두 구현.
- **의료 안전 톤 일관.** AI 요약이 "진단 아님" 디스클레이머(`briefing.disclaimer`)를 SummaryCard·ReportsScreen·CareReadiness 등 여러 곳에서 반복 노출.
- **저장 피드백 UX 우수.** `SaveFeedbackBar`가 성공 토스트 + `AccessibilityInfo.announceForAccessibility` + `accessibilityLiveRegion`으로 스크린리더에 공지.
- **정량 데이터 수집 폼.** 다이어리 입력이 카테고리별 구조화 폼(식사 g, 물 ml, 배변 상태/혈변, 컨디션 에너지)으로 병원 리포트에 바로 쓸 정량 데이터를 수집(`DiaryDetailPanel.tsx`). 기본 루틴(`RoutineSettingsPanel`)으로 기준값 프리필.
- **리포트 흐름 명확.** vet report 준비도 카드 + 단계 머신(empty→draft→confirmed→shared)으로 "기록→병원 공유" 서사가 UI에 반영.
- presentation 로직이 `.logic.ts`/`.formRules.ts`로 분리되고 테스트가 다수 존재.

---

## 문제점 (심각도 순)

### [Critical] 영어(호주 1차 시장) 미노출 — `t()` 263~271곳 전부 하드코딩 `"ko"`
`translations.ts`에 en/ko 전 키가 완비돼 있으나 `t(language, key)`의 첫 인자가 코드 전역에서 리터럴 `"ko"`로 고정. `'en'` 사용 0건, LanguageContext/setLanguage/언어 스위처 부재. **영어 번역은 렌더링되지 않는 죽은 코드이며 1차 시장이 호주라는 전제와 정면충돌.** 언어를 바꾸려면 모든 호출을 수정해야 하는 구조적 결함.
- 근거: `t("ko"` 263~271건 / `t("en"` 0건; `i18n/translations.ts` `t(language,key)`; 언어 상태 없음.

### [High] i18n을 우회한 인라인 한국어가 로직 계층에 존재
주의 신호 문구("컨디션 점수가 낮아요.", "오늘 물 기록이 아직 없어요."), 체크리스트 요약, care 상태 라벨, mock/sample 데이터가 `translations.ts`를 거치지 않고 하드코딩. 언어 전환을 도입해도 이 문구들은 한국어로 남아 이중언어가 근본적으로 불가.
- 근거: `liveUiState.ts:31-34,46-56`; `screens/HomeDashboardPanel.logic.ts:11-16`; 인라인 한국어 포함 파일 ~8개.

### [High] 홈 체크리스트 토글이 단방향 — 오탭 취소 불가
`toggleChecklist`는 이미 기록된 항목이면 `isChecklistRecordBlocked`로 차단하고 알림만 띄움. 한 번 탭하면 다이어리/투약 레코드가 생성되고, 취소하려면 홈이 아닌 Diary 탭으로 가 해당 항목을 찾아 삭제해야 함. **정확성이 생명인 P1(아픈 반려동물 보호자)의 신뢰를 깨는 회복 비용.**
- 근거: `PawBloomShell.tsx:84-99`; `shell/checklistActions.ts:12-31`.

### [Medium] night 체크리스트 항목이 memo 카테고리와 충돌
`checklistKeyToDiaryCategory`에서 night→'memo'로 매핑되고, `createChecklistFromRecords`가 memo와 night를 모두 `category==='memo'`로 동일 판정. 메모 하나를 남기면 night 체크도 켜지고 그 역도 성립 → 두 항목이 사실상 구분 안 됨.
- 근거: `shell/checklistActions.ts:9`; `liveUiState.ts:12,14`.

### [Medium] 정보 위계·텍스트 클리핑·FAB 겹침 (스크린샷)
홈 캡처에서 상단 NoticeBanner와 "주의 신호" 스트립 본문이 잘리거나 겹치고, 케어 체크리스트 6개 타일 라벨(식사/물/산책/배변/투약/야간)이 11px로 판독성 낮음. 우하단 설정 FAB가 "오늘 타임라인" 카드 위를 덮음. 주의 신호 vs 체크리스트 vs 타임라인의 시각 서열이 불명확.
- 근거: `.codex-audits/pawbloom-home-final/01·02-home-final.png`; `HomeScreen.tsx` `checkLabel type.tiny(11px)`.

### [Medium] 인터랙티브 요소의 접근성 속성 누락 광범위
홈 체크리스트/타임라인 Pressable, 다이어리 카테고리 타일·컨디션 점수 버튼, 캘린더 날짜 셀, 투약 상태 원형 버튼, BottomNav 탭 등 핵심 터치 타깃 다수에 `accessibilityRole/Label/State` 없음. 스크린리더 사용자는 "식사"가 버튼인지, 선택/완료 상태인지 알기 어려움.
- 근거: `HomeScreen.tsx:76,108`; `DiaryEntryScreen.tsx:170,238`; `DiaryCalendar.tsx:52`; `CareMedicationPanel.tsx:181`; `ui/BottomNav.tsx:21`.

### [Low] 홈 히어로가 기본 일러스트로 폴백 — 개인화 약함
`usePetProfilePhotoUrl`가 사진을 반환하지 않으면 heroSource가 번들 `mochi-hero.png`로 폴백. 실제 펫이 다른 종/이름이어도 동일한 곰 캐릭터가 340px 히어로 전체 차지 → 개인화·브랜드 신뢰 저해.
- 근거: `HomeScreen.tsx:15,33-34`; `03-home-top-drag-final.png`.

### [Low] 리포트 공유·구독은 목업, care 리포트 세그먼트 중복
`ReportsScreen`의 공유 링크는 `MockShareCard`(고정 URL `pawbloom.app/vet/demo-7day`)로 실제 토큰/뷰어 미구현(단, **백엔드는 완성** — [03. 엔지니어링](03-engineering.md) 참조), 결제 연동 없음. `CareModeScreen`에 'reports' 세그먼트가 있는데 하단 BottomNav에도 리포트 탭이 있어 진입점 중복.
- 근거: `screens/ReportArtifactSections.tsx` MockShareCard; `CareModeScreen.tsx:66-68,135-146`.

---

## 온보딩 퍼널 (그로스 직결)

- **계정 가입이 첫 가치 경험보다 앞에 있음.** `AuthScreen`에 guest/skip/demo 경로 0건. 실제 배포(Supabase configured)에서 `!user → AuthScreen`으로 첫 기록 전에 가입 강제. preview 모드는 Supabase 환경변수가 없을 때만 뜨는 개발 상태이지 사용자용 "체험 후 가입"이 아님.
- **대안(우선순위 순):** ① 이미 있는 `databaseMode` 이중 모드를 활용해 "가입 없이 로컬로 펫 등록→첫 3개 기록→브리핑 미리보기" 체험 후 "저장/공유하려면 가입" 재배선(신규 아키텍처 아님, 저비용). ② Apple/Google 소셜 로그인(소셜 로그인 제공 시 Apple 로그인 필수). ③ 가입 화면 상단 "왜 가입?" 한 줄.

---

## 구현 상태

- preview 모드 초기 상태는 `mockUiState.ts`(모찌/루나 2마리)와 `sampleData.ts`(밀로, 식사/물/배변, 투약 2건)로 시드.
- 네비게이션은 스택이 아니라 `PawBloomShell`의 `activeTab` state로 4개 탭(today/diary/care/reports)을 조건부 렌더.
- [design QA 문서](../design/DESIGN_QA.md)는 브라우저 URL 정책으로 실제 스크린샷 캡처가 차단돼 mockup 대비 비교가 'blocked' 상태로 남아있음을 기록.

## 권장 조치 요약

1. **P0:** LanguageContext + `useTranslation()` 도입, `t("ko")` 일괄 치환, 인라인 한국어 8개 파일 이관, 알림 문구 포함(→ 1차 시장 전제 충족).
2. **P1:** 체크리스트 단방향 토글 취소 경로, night↔memo 충돌 해소, 핵심 터치 타깃 접근성 속성 보강.
3. **P1:** 로컬-우선 온보딩 재배선 + 소셜 로그인.
4. **P2:** 홈 정보 위계 정리·라벨 판독성, 히어로 개인화 폴백 개선, 리포트 진입점 중복 정리.
