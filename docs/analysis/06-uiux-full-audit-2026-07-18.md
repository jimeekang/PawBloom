---
owner_model: claude-opus-4.8-extra
domain: analysis
edit_policy: exclusive
---

# 06. 전 화면 UI/UX 전수 감사 (2026-07-18)

- 방법: 8개 영역(로그인/온보딩, 홈, 다이어리, 케어/투약, 리포트/브리핑, 설정/루틴/구독, 디자인시스템/셸, 스펙-구현 갭) 병렬 코드 전수 정독 → finding 130건 수집 → 전 건 적대적 검증(반박 시도) 통과분만 확정.
- 판정: **확정 92건 + 경미(P3) 35건, 기각 2건**. 모든 확정 건은 file:line 근거 재확인 완료.
- 기준: `docs/product/PRODUCT_SPEC.md`, `docs/design/DESIGN_QA.md`(390x844), `docs/engineering/FRONTEND.md`, 2026-07-12 감사 잔여 백로그.
- 실행 계획: [docs/exec-plans/active/0005-uiux-refinement-plan.md](../exec-plans/active/0005-uiux-refinement-plan.md)

## 1. 2026-07-12 백로그 §6 이행 판정 (8개 영역 교차 확인 합산)

| 항목 | 판정 | 근거 요약 |
| --- | --- | --- |
| 삭제 확인 다이얼로그 | **partial** | 다이어리·투약 done(confirmAction 경유). 로그아웃 3곳(SettingsScreen:30, PawBloomShell:215, PetOnboardingScreen:246) 무확인. 펫 삭제는 raw Alert.alert라 웹에서 no-op |
| 사진 픽커 탭=삭제 교체 | **not-done** | DiaryPhotoPicker:88 썸네일 전체 탭이 여전히 즉시 삭제. X 배지는 장식 |
| Auth 폼 하드닝 | **not-done** | KeyboardAvoiding·textContentType/autoComplete·비밀번호 토글 전무 (AuthScreen:52-106) |
| 셸 keyboardShouldPersistTaps | **not-done** | PawBloomShell:240 미지정 (온보딩 화면만 적용) |
| 탭별 스크롤 초기화 | **done** | PawBloomShell:240 `key={activeTab}` 리마운트 |
| 투약 토글 30x30 | **done** | flex:1 minHeight 40 버튼 2개로 교체(단 role/state·44pt는 잔여) |
| a11y 일괄 (수제 Pressable) | **partial** | DS 컴포넌트·BottomNav·펫스위치 done. 체크리스트 타일·달력 셀·점수·카테고리 타일·온보딩 다수 잔여 |
| SectionHeader 교체 | **partial** | 홈 done. 다이어리 7곳·케어·온보딩 잔여 |
| 온보딩 SurfaceCard화 | **not-done** | 수제 styles.card(무그림자·radius.md) 유지 |
| 날짜 로컬라이즈 | **partial** | 캘린더·리포트 만료일 done. DatePickerField ISO 원문·나이 라벨 '2y 3m' 잔여 |
| 리포트 KO/EN 분리 | **not-done** | reportDraftRecords 영문 스캐폴드 + KO 콘텐츠 혼재 |
| 케어 탭 리포트 세그먼트 IA | **not-done** | 하단 리포트 탭과 중복 유지, 내부 버튼 2개가 모두 탭 이동만 수행 |
| 필드 라벨 체계 | **not-done** | Auth·온보딩·케어·루틴·다이어리 상세 전부 placeholder 단독 |
| 4-옵션 세그먼트 반응형 | **not-done** | 식욕/배변 4분할 numberOfLines/축소 미처리 |

## 2. P1 — 사용자 체감 결함 (전건 검증 확정)

| # | 결함 | 근거 |
| --- | --- | --- |
| 1 | **산책 기록 편집 시 데이터 손상** — 산책 카테고리 비활성(개 아님 등) 상태에서 기존 산책 기록을 열어 저장하면 detail이 food로 소리 없이 덮어써짐 | DiaryEntryScreen.tsx 카테고리 fallback 로직 |
| 2 | **프리뷰 모드 산책 기록 영구 차단** — 초기 체크리스트가 walk를 '완료'로 시작해 탭 불가(잠금) | todayChecklist.ts 초기값 |
| 3 | **체크리스트 오탭 복구 불가** — 탭 1회로 다이어리/투약 레코드가 즉시 영구 생성, 취소·되돌리기 경로 없음 | useTodayChecklistController.ts |
| 4 | **'오늘 기록으로 불러오기' 재탭 시 raw Postgres 에러 노출** — 중복 키 원문이 알림 배너에 표시되고 동작 실패 | PawBloomShell.tsx 케어 플랜 로드 |
| 5 | **사진 썸네일 탭=즉시 삭제** — 미리보기 의도 탭으로 사진 소실, 확인·피드백·a11y 전무 | DiaryPhotoPicker.tsx:88 |
| 6 | **Auth 폼 키보드 가림** — 가입 모드에서 하단 필드·CTA·에러 배너가 키보드에 가려지고 스크롤 불가 | AuthScreen.tsx:52-106 |
| 7 | **AI 브리핑 미구현** — edge function(generate-ai-brief)·도메인·i18n 완비, 호출 UI 0건. 홈 SummaryCard는 정적 카피를 '기록 기반 요약'으로 표시 | aiBrief.ts, PRODUCT_SPEC §AI |
| 8 | **계정 삭제(탈퇴) 흐름 부재** — 생성 경로만 있고 삭제 경로 전무(스토어 심사·프라이버시 리스크) | SettingsScreen.tsx |
| 9 | **가족/케어기버 초대 UI 전무** — member.invite 권한만 정의, 초대 흐름 없음(MVP 차별화 미구현) | permissions.ts, PRODUCT_SPEC |

## 3. P2 — 확정 클러스터 (중복 병합 후)

**흐름·동작 (bug/contradiction)**
- 셸 ScrollView `keyboardShouldPersistTaps` 부재 — 키보드 열린 채 저장 버튼 첫 탭이 키보드 닫기로 소모 (PawBloomShell:240).
- 저장 1회에 피드백 3중 노출 — 셸 NoticeBanner + 화면 내 배너 + SaveFeedbackBar 동시 표시.
- 로그아웃: 확인 없음(3곳) + 실패 시 설정 탭 무피드백 + 온보딩 화면과 로그아웃 중복 IA.
- 펫 삭제 확인이 raw Alert.alert — 웹 타깃에서 완전 무동작(confirmAction 우회).
- 투약 타일이 첫 dose 후 잠김 — 히어로 '확인할 투약 N'과 모순되는 차단 알림 (checklistActions).
- 다이어리 목록 로딩·실패 상태 부재 — 네트워크 실패가 '기록 없음'으로 위장 (useDiaryEntriesController).
- 주별(Week) 필터 기록 행에 날짜 없음 — 7일치 구분 불가 (DiaryEntryList).
- ProfileCareDefaultsPanel 종료일<시작일 미검증 — 스케줄이 조용히 사라짐 (ShortTermMedicationForm과 불일치).
- 리포트: 초기 로딩 무피드백(버튼만 소실), 로드 실패 재시도 없음 + 존재하지 않는 pull-to-refresh 안내, 타임라인 정렬 결함(투약 항상 상위·날짜 누락), 펫 상세 디버그 포맷('breed: null') 노출.
- 온보딩 게이트 SafeAreaView 부재 — 노치에 히어로 침범 (App.tsx).

**이중언어 모순 (스펙 위반)**
- diarySummary 구조화 요약 한국어 하드코딩 — EN 모드 목록·타임라인·리포트에 한국어 노출.
- diaryRecords·medicationDoseRecords application 레이어 메시지 하드코딩 — i18n 우회.
- reportDraftRecords 누락기록·수의사 질문·타임라인 영문 하드코딩 + raw ISO 날짜.
- 가입 전 언어 전환 수단 없음 — Auth/온보딩 게이트 ko 고정.
- 홈 히어로 나이 라벨 '2y 3m' 언어 무관 영문 + 빈 품종 시 ' - --' 조합.
- DatePickerField ISO 원문 표시 + clearLabel 영문 기본값.

**tone/피드백 오류 표시**
- 에러가 success 톤(민트 체크)으로 표시: 홈 체크리스트/투약 실패, QuickMedicationForm 검증·저장 실패, PetOnboardingScreen 에러 배너.
- NoticeBanner live region 부재 — 스크린리더에 진행/오류 미공지.

**IA·일관성**
- 케어 탭 '리포트' 세그먼트가 하단 리포트 탭과 중복 + 내부 버튼 2개('병원 리포트 생성'/'리포트 링크 공유')가 라벨만 다르고 모두 탭 이동.
- CareReportReadinessCard 완성·번역 완료 상태로 미마운트(죽은 컴포넌트).
- 홈 헤더 벨 아이콘 장식(알림 기능 부재) + 다이어리 헤더 '다이어리 추가' 제목·뒤로가기 모순.
- 하단 탭 아이콘 패밀리 혼용(care만 filled Material) + 상태 배지 컨테이너 파편화.
- 위험(삭제) 버튼 3개 컨텍스트 제각각 재구현 — DS 컴포넌트 부재.
- 케어 기본값 '새 약 추가' 라벨이 placeholder 문자열('+ 약 이름') 재사용.
- 온보딩: 히어로 카피 재사용 모순(프로필 화면인데 '계정 설정'), 수제 카드(SurfaceCard 미사용).

**a11y·터치 타깃**
- role/label/state 부재: 홈 체크리스트 타일·타임라인 행(28pt)·케어 요약 토글, 달력 날짜 셀(~40pt)·월 이동, 컨디션 점수 1-5·카테고리 타일·기록 행, 투약 아젠다 행 버튼(40pt), SpeciesPill(40pt)·사진 픽커·펫 선택 행, DatePickerField 3곳(clear 36pt).
- placeholder 단독 라벨: Auth·온보딩·케어/루틴 폼·다이어리 상세 전부. 루틴 식사알림 토글·에너지 세그먼트 무라벨(키는 존재하나 미사용).

**미구현 (스펙 대비)**
- 구독 Free/Plus/Family 잠금 UI 미구현 — entitlement 도메인 죽은 코드.
- 사진 파이프라인: 오프라인 큐 없음, 실패 업로드 잔존물 정리 불가, 진행 피드백 부재.
- 투약 알림 끄기 수단 없음 — 식사 알림(토글 有)과 비대칭.

**문서-코드 모순**
- 0004 알림 계획 전부 구현됐는데 active 미체크 잔존, 0002 로드맵 '미구현' 목록 대부분 구현 완료와 모순, 02-product-ux Critical 다수 해소됨.
- POSITIONING 'Care Mode 활성화' 개념 폐기됨(careMode 항상 true).

## 4. P3 — 경미 (35건 요약)

- 죽은 코드 군집: 미사용 i18n 키 ~49개(auth.title/preview, 홈 퀵액션 3종, reports 8종, care 12종, diary.date 샘플 리터럴 등), CareReportReadinessCard·sampleReport 픽스처·OutlineIconButton·icon.menu/lock·HomeHeader.onManagePets·noticeKey 반환값.
- 마감: CareMedicationAddCard 분기 전환 시 초안 소실·'오늘만' 저장 후 카드 미닫힘, 단기약 재저장 시 중복 스케줄 무경고 누적, 프리뷰 투약 7일 미필터 요약 부풀림, 홈 타임라인 정렬 프리뷰/DB 상반, 케어 요약 '0/0' 병립, 히어로 기본사진 폴백.
- 표기: 언어 선택지 라벨 자기 언어 미표기, 설정 '환경' 카드 개발자 진단 문구 노출, 공유 텍스트 뷰어 UTC 고정, 미로그인 차단 배너 오류 톤, SegmentedControl 42pt·4옵션 클리핑, raw 수치 산재(SummaryCard 등), 세션 만료 무통보, 이메일 형식 사전 검증 없음, 몸무게 비숫자 무피드백, updatePetRow role 'owner' 하드코딩, 로직 계층 인라인 한국어 리터럴(petRoutineRecords), 고양이 템플릿·산책 관찰 항목 스펙 대비 부족.

## 5. 기각 (검증 반박 성립, 수정 불필요)

1. "메모 체크리스트 탭이 고정 문구 레코드 생성·타일 잠금" — 메커니즘 사실이나 의도된 계약(체크리스트=완료 표시)으로 판정.
2. "스케줄 행 저장 실패 catch(()=>undefined) 무음 처리" — 실제로는 컨트롤러 레이어에서 오류 배너가 표시됨.

## 6. 잘된 것 (유지)

- 토큰 기강: 2026-07-12 리파인 팔레트(CTA #E06D10, danger 체계) 적용 유지, 하드코딩 hex 0건.
- 다이어리·투약 삭제 확인, 탭별 스크롤 초기화, 펫 삭제 확인 다이얼로그(모바일), 오프라인 충돌 UI, SaveFeedbackBar a11y announce, 390px 회귀 가드 체계.
