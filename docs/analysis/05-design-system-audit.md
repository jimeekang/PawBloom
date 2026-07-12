---
owner_model: claude-opus-4.8-extra
domain: analysis
edit_policy: exclusive
---

# 05. 디자인 시스템·UI/UX 전수 감사 (2026-07-12)

- 방법: 전 UI 코드(37 tsx) 정밀 감사 + 토큰 우회 정적 스캔 + Expo web preview(`390x844`) 실기 검증 + WCAG 대비 계산.
- 기준: `src/design-system` 토큰·컴포넌트 canon, `docs/design/pawbloom-app-design-draft-02.png`, FRONTEND.md "디자인 token 우선" 규칙.
- 결론 요약: **색·간격 토큰 기강은 우수**(하드코딩 hex 0건, 간격 위반 6건뿐)하나, **컴포넌트 재구현·입력 높이 파편화·상태 피드백 부재·접근성 공백**이 세련도를 깎는 주범. 글로벌 토큰 자체도 대비 미달(CTA 1.94:1)과 계층 모호(17px vs 18px 제목)가 있어 이번 커밋에서 리파인함(§5).

---

## 1. 실기 검증으로 확인된 P1 (사용자 체감 결함)

| # | 결함 | 근거 |
| --- | --- | --- |
| 1 | **Home 히어로 텍스트 이중 렌더링** — `assets/mochi-hero.png`에 목업 텍스트("Mochi / Shiba Inu · 2y 3m" + Diary mode 필)가 구워져 있고, 앱이 그 위에 실제 펫 이름을 또 그림 | 웹 프리뷰 실측. 프로필 사진 미등록 사용자 전원 노출 |
| 2 | **NoticeBanner에 톤 개념이 없어 오류가 성공처럼 보임** — 아이콘 색이 `mintDeep` 고정(components.tsx:74). 리포트 탭 "로그인해 주세요" 차단 배너의 ✗ 아이콘이 민트색으로 실측됨. Auth 로그인 실패·투약 저장 실패도 동일 | 웹 프리뷰 실측 + 코드 |
| 3 | **탭 전환 시 스크롤 위치 이월** — 셸이 ScrollView 하나를 5개 탭이 공유(PawBloomShell.tsx:239). Today에서 600px 스크롤 후 다이어리 진입 시 화면 중간부터 시작됨을 실측 | 웹 프리뷰 실측(scrollTop 600 유지) |
| 4 | **파괴적 동작 확인 부재** — 다이어리 삭제(DiaryEntryScreen.tsx:198)·투약 삭제(CareMedicationPanel.tsx:97)·로그아웃 2곳이 즉시 실행. `diary.delete*`, `care.quickDoseDelete*` 확인 문구가 카탈로그에 준비돼 있으나 미연결. 펫 삭제만 Alert 확인 있음 | 코드 추적 |
| 5 | **사진 썸네일 탭 = 삭제** — DiaryPhotoPicker.tsx:58, 72px 썸네일 전체가 삭제 버튼이고 X 배지는 장식. 미리보기 의도 탭으로 사진 소실 | 코드 |
| 6 | **저장 중 피드백 부재** — CareSetupPanel:109·ProfileCareDefaultsPanel:158·CareMedicationPanel:150이 `onPress` 가드만 하고 `disabled={isSaving}` 미전달 → 저장 중에도 버튼이 밝게 유지. Routine·OfflineConflict는 올바름 | 코드 |
| 7 | **CTA 대비 미달** — 흰 텍스트 on `#FFA733` = **1.94:1** (WCAG 최소 3:1도 미달). 액션 텍스트 `#F47D38`도 2.68:1 | 대비 계산 |
| 8 | **투약 완료 토글 30×30** — CareMedicationPanel:239, 케어 핵심 액션이 44pt 미만 + role/label/checked 상태 부재 | 코드 |
| 9 | **Auth 폼 기본기 부재** — KeyboardAvoiding 없음(3필드 가림), textContentType/autoComplete 없음(키체인·자동완성 불가), 비밀번호 표시 토글 없음. Diary 폼도 셸 ScrollView에 `keyboardShouldPersistTaps` 없음 | 코드 |

## 2. P2 (규격 위반·일관성)

- **입력 높이 파편화**: 42(Diary compact)/44(Routine·Diary)/46(Care 3종)/48(피커)/52(Auth) — `layout.inputHeight`(54)를 참조하는 필드가 **0개**. → §5에서 52로 수렴.
- **SectionHeader 우회**: Diary 계열 ~8곳 + CareModeScreen이 제목을 수제 `Text`로 재구현 → 섹션 수직 리듬이 화면마다 다름.
- **헤더-콘텐츠 정렬 어긋남**: ShellHeaders paddingHorizontal 16 vs 콘텐츠 `screenPadding` 20 → 좌측 기준선 4px 어긋남(실측 가시).
- **SegmentedControl 선택 시 1px 점프**: 활성 세그먼트에만 border 추가(components.tsx:188).
- **온보딩 카드가 SurfaceCard 재구현**: 그림자 없음·radius/패딩 상이(PetOnboardingScreen.styles.ts:22) → 유일하게 평평한 화면.
- **가짜 알림 점**: 벨 아이콘에 항상 켜진 빨간 점(ShellHeaders:153), 벨 자체도 탭 불가. DiaryHeader 캘린더 아이콘도 장식인데 버튼처럼 보임.
- **터치 타깃 44pt 미만 다수**: petSwitch 34·달력 이전/다음 34·species pill 34·시간 삭제 42·투약 칩 ~40.
- **접근성 기본 부재**: 공용 컴포넌트 외 수제 Pressable 대부분 role/label/state 없음(달력 날짜, 점수 1–5, 카테고리 타일, 리스트 행, 체크리스트 원형 등).
- **날짜 ISO 원문 노출**: 케어 기간이 "2026-07-12" 그대로 표기(DatePickerField displayValue). 목업은 "May 12, 2025 (Mon)".
- **리포트 타임라인 한/영 혼재**: "20:00 - Medication 심장사상충 예방약: not given yet" — EN 수의사용 텍스트가 한국어 미리보기에 그대로 노출, 행별 시각 포맷도 불일치.
- **IA 중복**: 케어 탭 내부 "케어/리포트" 세그먼트 vs 하단 "리포트" 탭 — 같은 이름의 진입로 2개.
- **아이콘 패밀리 혼용**: 하단 탭에서 케어만 filled material(medical-bag), 나머지는 outline ion — 시각 무게 불일치(실측 가시).
- **상태 배지 컨테이너 3종**: 48 원형(readiness)·52 라운드 사각(reports)·IconBubble — 동일 역할에 3가지 형태.
- **큰 제목 오남용**: Auth·PetOnboarding이 `heroTitle`(34px, 흰색 스펙)을 재색칠해 사용 + 헤더 제목과 이중 표기.
- **raw fontWeight 문자열 18곳**(DS 자체 4곳 포함) — `font.weight` 토큰 우회. → §5에서 전량 치환.
- **필드 라벨이 placeholder뿐**: 루틴 5개 숫자 필드 등 입력 후 필드 구분 불가.
- **4-옵션 세그먼트 클리핑 위험**: 식욕/배변 4분할이 좁은 화면에서 잘릴 수 있음(numberOfLines 미처리).

## 3. P3 (경미)

빈 스타일 잔재(`timePicker:{}`, `inputHalf:{}` — 세로 스택 전환의 흔적, 가드가 행 복귀를 막는 중이므로 이름만 오해 소지), 미사용 `signOutText`/`ReportsHeaderProps`, `homeScrollContent` no-op, SummaryCard `paddingRight:72`·`minHeight:184` 등 raw 수치 6건, AttentionStrip 신호 `join(" ")`, 다이어리/홈 빈 상태 타이포 불일치, 온보딩 진행 표시·스킵 부재, 리포트 empty 리스트 행 부재, 공유 URL 복사 버튼 부재, `t()` 첫 인자가 죽은 파라미터(367곳 "ko" 전달, 런타임 오버라이드가 실효 — 언어 전환 자체는 정상 작동함을 실측 확인)이며 `setRuntimeLanguage`가 렌더 중 사이드이펙트.

## 4. 잘된 것 (유지)

하드코딩 색 0건(텍스트 섀도 2건 제외), 간격 위반 6건뿐, 카테고리 파스텔 시스템(categoryVisuals) 일관, 오프라인 충돌 UI(확인·진행 피드백·비파괴 문구)는 모범, 펫 삭제 확인 다이얼로그는 role/state까지 정석, SaveFeedbackBar의 a11y announce, 390px 클리핑 회귀 가드 체계.

## 5. 이번 커밋에 적용한 글로벌 디자인 리파인 (요지)

목표: 따뜻한 브랜드 성격 유지 + 채도 정돈·명도 계층·대비 확보 = "세련".

**색 (tokens.ts)**
| 토큰 | 이전 | 이후 | 근거 |
| --- | --- | --- | --- |
| appBackground | #FFFCF7 | **#FAF6EF** | 흰 카드와의 명도차 3.1배 확대 → 레이어감. 보더 의존 축소 |
| orange (CTA) | #FFA733 | **#E06D10** | 흰 텍스트 대비 1.94→**3.30:1** (UI 컴포넌트 AA 통과) |
| orangePressed(신설) | — | **#C25510** | Primary pressed 상태(4.56:1) |
| orangeDeep (액션 텍스트) | #F47D38 | **#D2600E** | on-white 2.68→**3.87:1** |
| text | #171A22(쿨) | **#1F1A14(웜)** | 웜 서피스와 톤 통일, 16:1 유지 |
| textMuted | #6F7077(쿨) | **#6B645A(웜)** | 5.84:1, 웜 그레이 통일 |
| textSoft | #9A9690 | **#9C9284** | placeholder용 웜 정렬 |
| danger/dangerBg/dangerBorder(신설) | — | **#D64545 / #FFF1F0 / #F3C1BC** | 오류 톤 체계(4.38:1) |

**타이포**: screenTitle 18/600→**18/700**(sectionTitle 17/600과 무게로 계층 분리), 대형 타이틀에 음수 자간(brand -0.4, heroTitle -0.6, screenTitle -0.3, sectionTitle -0.2), caption 행간 17→18, tiny 자간 +0.2. 크기 체계는 유지(레이아웃 리스크 회피).

**레이아웃/그림자**: `inputHeight` 54→**52**를 전 필드 단일 기준으로 수렴(42–52 파편 제거, 피커 포함), buttonHeight 54 유지(CTA 위계). 그림자 card 0.08/16→**0.06/20**, soft 0.05/10→**0.04/12**(부드럽게, 확산 넓게).

**컴포넌트**: Primary/Secondary/OutlineIcon 버튼 **pressed 상태 추가**(기존 전무), OutlineIconButton 40→44, SegmentedControl 상시 border로 **1px 점프 제거**, NoticeBanner **tone("success"|"error") 도입** + Auth 오류·오프라인 실패 배너에 연결, SectionHeader 액션 11px→13px(caption 기반), raw fontWeight 전량 토큰화, 헤더 패딩 20 정렬, 가짜 알림 점 제거, 저장 버튼 3곳 `disabled={isSaving}` 연결, BottomNav role/selected 상태 + pressed 피드백, 히어로 에셋 텍스트 영역 크롭.

## 6. 남은 권고 (우선순위순 후속 작업)

1. 삭제 확인 다이얼로그 연결(다이어리·투약·로그아웃 — 문구 기성품 존재), 사진 픽커 탭=삭제 구조 교체.
2. Auth 폼 하드닝(KeyboardAvoiding·textContentType·비밀번호 토글) + 셸 ScrollView `keyboardShouldPersistTaps` + 탭별 스크롤 초기화.
3. 접근성 일괄: 수제 Pressable에 role/label/state, 44pt 미만 타깃 정리(투약 토글 우선).
4. SectionHeader로 수제 제목 8곳 교체, 온보딩 카드 SurfaceCard화, 큰 제목 전용 토큰 신설.
5. 날짜 로컬라이즈 포맷터, 리포트 타임라인 KO/EN 분리, 케어 탭 내 리포트 세그먼트 IA 재검토.
6. 필드 라벨 체계(placeholder 의존 탈피), 4-옵션 세그먼트 반응형 처리.
7. `t()` 시그니처 정리(죽은 첫 인자 제거·`useLanguage` 마이그레이션 — verify:i18n 가드와 함께).
