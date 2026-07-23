---
owner_model: claude-opus-4.8-extra
domain: analysis
edit_policy: exclusive
---

# 07. 전 화면 UI/UX 전수 재감사 (2026-07-23)

- 방법: 9개 영역(로그인/세션, 온보딩, 홈·셸, 다이어리, 케어·투약, 리포트·AI브리핑, 설정·루틴·구독·계정삭제, 디자인시스템·i18n, 스펙-구현 갭) 병렬 코드 전수 정독 → finding 72건 수집 → 전 건 적대적 검증(반박 시도), 기각 0건·조정 3건.
- 판정: **확정 72건, 중복 병합 후 고유 60건 (P1 2 + P2 24 + P3 34)**. 모든 확정 건은 file:line 근거 재확인 완료.
- 배경: 2026-07-18 감사(06) 이후 UI/UX 리파인(0005 Phase A~D), 앱스토어 준비, 계정삭제 하드닝이 머지됨. 이번 감사는 ① 0005 백로그 전 항목의 코드 실검증 재판정 + ② 신규 결함 발굴의 2축.
- 기준: `docs/product/PRODUCT_SPEC.md`, `docs/design/DESIGN_QA.md`(390x844), `docs/analysis/06-uiux-full-audit-2026-07-18.md`, `docs/exec-plans/active/0005-uiux-refinement-plan.md`.
- 실행 계획: [docs/exec-plans/active/0006-uiux-alignment-plan.md](../exec-plans/active/0006-uiux-alignment-plan.md)

## 1. 0005 백로그 이행 판정 (코드 실검증)

문서의 체크 표시를 믿지 않고 전 항목을 현재 코드로 재판정했다. **Phase A~C는 사실상 완료, D는 D6에 완료 표기 오류, E~H는 대부분 미이행**이다.

| Phase | 판정 | 비고 |
| --- | --- | --- |
| A1~A5 (P1 버그) | **done** | A5는 X 배지 분리·a11y까지 완료(confirmAction만 미적용 — 미저장 스테이징 사진이라 데이터 손실 아님) |
| B1~B4 (Auth·로그아웃) | **done** | 단, App.tsx:78 pet-load-error 화면의 로그아웃만 confirm 미경유(신규 P3) |
| B5 (세션 만료 notice) | **partial** | 로직은 있으나 명시적 로그아웃·계정삭제 시에도 '세션 만료' 오발화(신규 P2, 아래 §3) |
| C1~C6 (셸·홈) | **done** | keyboardShouldPersistTaps·피드백 단일화·히어로 메타·tone·헤더·a11y 전부 확인 |
| D1~D5 (다이어리) | **done** | 로딩/실패+재시도, 주별 날짜, 달력/점수/타일 a11y, FieldLabel 확인 |
| D6 (diary 메시지 i18n) | **partial — 완료 표기 오류** | 표시 요약은 i18n화됐으나 diaryRecords.ts:89~189·diarySummary.ts:18,40-44·mediaUpload.ts:33~77에 한국어 하드코딩 throw 잔존, EN 모드 사용자 배너에 그대로 노출. 0005의 `[x]` 표기와 모순 |
| E1 (케어 IA) | **partial** | 리포트 세그먼트 제거·CTA 통합은 완료. CareReportReadinessCard(VetReportReadinessCard)는 여전히 미마운트 죽은 코드 |
| E2 (아젠다 행 a11y) | **partial** | role/label/state 완료. given/partial/skip 버튼 minHeight 40pt(44 미달), 선택 버튼 시각 강조 없음 |
| E3 (날짜 역전 검증) | **not-done** | ProfileCareDefaultsPanel.tsx:52-57 검증 없음 — 역전 저장 시 스케줄 영구 미적용(P2) |
| E4 (케어 폼 FieldLabel) | **not-done** | CareMedicationPanel·ShortTermMedicationForm·ProfileCareDefaultsPanel 전부 placeholder 단독 |
| E5 (DatePickerField) | **partial** | clearLabel i18n만 완료. 표시값 ISO 원문, clear 버튼 36pt |
| E6 (medicationDoseRecords i18n) | **not-done** | '로그인이 필요합니다' 등 한국어 Error 9곳 잔존 |
| F1~F2 (리포트 KO/EN·포맷) | **not-done** | 미리보기 영문 하드코딩+정렬 결함, 'breed: null' 디버그 포맷 그대로 |
| F3 (리포트 로딩/재시도) | **partial** | 오류 카피는 신설. 초기 로딩 무피드백(버튼만 소실)·재시도 버튼 없음·EN 카피가 없는 pull-to-refresh 안내 |
| F4 (NoticeBanner liveRegion) | **not-done** | tone 2종뿐, liveRegion 부재 |
| F5 (공유 URL 복사) | **not-done** | Clipboard 사용 0건 |
| G1 (루틴 패널) | **not-done** | 라벨/FieldLabel/44pt 전부 미이행, mealRemindersLabel은 죽은 키 |
| G2 (투약 알림 토글) | **not-done** | 식사 알림만 토글 존재 — 투약 알림은 끌 수단 전무(스케줄 있으면 앱 활성화마다 자동 재예약) |
| G3 (온보딩 정리) | **partial** | a11y 속성만 반영. SafeArea·SurfaceCard·히어로 카피 모순·SpeciesPill 44pt·몸무게 피드백 미이행 |
| G4 (설정 정리) | **partial** | '환경' 카드 문구는 해소. 언어 선택지 자기 언어 표기 미이행, 배지 통일 미완 |
| H1 (AI 브리핑) | **not-done** | 아래 §2 P1 |
| H2 (죽은 i18n 키) | **not-done** | 실측 57개 잔존(en/ko 대칭 587/587 자체는 유지) |
| H3 (BottomNav 아이콘) | **partial** | today만 activeIcon. care는 유일하게 filled Material 글리프 |
| H4 (exec-plans 정합화) | **not-done** | 0004 active 잔존·전체 미체크(구현은 완료됨), 0002:67·:75 및 0003 Day8~13 서술이 구현 현실과 모순 |
| H5 (DangerButton) | **not-done** | 4개 화면에서 수제 위험 버튼 중복 구현 |
| 보류: 계정삭제 | **done(결함 有)** | in-app 흐름 구현·스토어 블로커 해소. 단 확인이 raw Alert.alert라 웹 무동작 + 진행/완료 피드백 부재(§3) |
| 보류: 가족초대 UI | **done** | PetMembersCard가 manage-pet-members에 실배선(목록/초대/삭제/에러 매핑/잠금 게이팅) |
| 보류: 구독 잠금 UI | **done** | SubscriptionPlanCard + entitlement 실조회, 베타 수동 플랜 경로 유효 |
| 보류: 사진 오프라인 큐 | **not-done** | outbox는 diary insert·dose만. 사진 업로드는 직접 업로드, 오프라인 경로 없음 |

## 2. P1 — 필수 기능 부재·스토어 리스크 (2건 + 승격 후보 1건)

| # | 결함 | 근거 |
| --- | --- | --- |
| 1 | **AI 브리핑 전면 미연결** — 스펙 5대 MVP 축이자 핵심 차별점(AI 요약·누락 기록·수의사 질문)인데 edge function(generate-ai-brief)·도메인·i18n까지 완비된 상태로 UI 호출 0건. buildSampleBrief는 테스트에서만 참조, briefing.* 키 사장. 06 감사 P1-7 그대로 잔존 | briefing/ui/sampleBrief.ts:4, PRODUCT_SPEC §AI |
| 2 | **개인정보처리방침·지원 링크 인앱 부재** — Linking.openURL/PRIVACY_POLICY_URL 참조 0건. PRIVACY_POLICY.md 문서는 존재하나 인앱 노출 없음. 앱스토어 심사 필수 요건이며 0005-appstore-launch 계획 D5가 요구했으나 미구현 | shared-kernel/config.ts:1, 0005-appstore-launch:76 |
| 승격 후보 | **비밀번호 재설정 흐름 전무** — resetPasswordForEmail·딥링크 처리 0건, '비밀번호를 잊으셨나요?' 진입점 없음. 비밀번호 분실 = 계정·전체 기록 영구 접근 불가. 출시 기준 P1 취급 권고 | AuthScreen.tsx:141, useAuthActions.ts |

## 3. P2 — 사용자 체감 결함 (병합 후 24건)

**동작·데이터 결함**
- **세션 만료 오발화**: 명시적 로그아웃·계정삭제 후에도 로그인 화면에 '세션이 만료되었습니다' 표시. explicitSignOutRef가 `await signOut()` 이후에만 true가 되는데 auth-js 2.108.2는 SIGNED_OUT 콜백을 signOut() await 내부에서 실행 → 가드 무력화 (useAuthSessionSync.ts:90, useAuthActions.ts:104-110).
- **계정 삭제 확인이 raw Alert.alert** — 웹에서 삭제·취소 모두 무동작, 상태 'confirming' 고착. B3에서 펫 삭제를 같은 이유로 confirmAction으로 교체한 패턴과 불일치 (SettingsScreen.tsx:28). 진행 중 스피너·완료 안내 부재도 동반(P3).
- **홈 대시보드 로딩/에러 상태 부재**: 네트워크 실패·초기 로딩이 '기록 없음'으로 위장, 로딩 중 체크리스트 탭 시 서버 기존 기록을 못 막아 중복 생성 가능 (HomeScreen.tsx:39, useDiaryEntriesController.ts:43).
- **케어 탭 로딩/에러 상태 부재**: doses·care setup 조회 실패가 '오늘 먹일 약이 없습니다'로 위장 (useMedicationDosesController.ts:36, useCareSetupState.ts:21).
- **리포트 미리보기 조회 실패 위장**: 다이어리/투약 쿼리 실패가 '최근 7일 기록 없음' 빈 상태로 표시 (reportDraftRecords.ts:52-54).
- **케어 저장 시 거짓 '알림 권한 필요' 오류**: 프리뷰/웹에서 refreshMedicationReminders가 항상 false → 저장 성공 피드백과 오류 배너 동시 노출. 식사 알림 경로(databaseMode 가드)와 비대칭 (PawBloomShell.tsx:151-162).
- **ProfileCareDefaultsPanel 날짜 역전 미검증**(E3): 역전 저장 시 스케줄이 모든 날짜에서 조용히 사라짐. ShortTermMedicationForm은 검증함 — 두 폼 불일치 (ProfileCareDefaultsPanel.tsx:52-57).
- **투약 알림 끄기 수단 전무**(G2): 식사 알림은 토글 존재. 투약은 enabled 플래그·토글·i18n 키 전무, 앱 활성화마다 자동 재예약 (reminderScheduling.ts:65-79).
- **홈 케어 요약 카운트 모순**: 카드(doses 기준) vs 히어로·pendingCopy(agenda 기준) — 예약만 있고 dose 미기록인 매일 아침 '확인할 투약 N'과 '0/0'·'기록 없음'이 병립 (HomeDashboardPanel.tsx:51).
- **비밀번호 재설정 부재** (§2 승격 후보 참조).

**i18n·현지화 (EN 모드 한국어/영문 혼입)**
- **application 계층 한국어 하드코딩 에러 클러스터**: diaryRecords.ts(:89~:189 raw Postgres 포함) + mediaUpload.ts:33~77·authContextQueries.ts:141~225 + medicationDoseRecords.ts 9곳·carePlanRecords.ts:38·useCareSetupState.ts:40-42 — 전부 사용자 배너에 원문 노출. D6 완료 표기와 모순, E6 미이행.
- **리포트 미리보기 영문 하드코딩 + 정렬 결함**(F1): 누락기록·타임라인·수의사질문이 KO 모드에서도 영문, sortKey `medication ...` 접두 문자열 정렬로 투약이 항상 다이어리 위 (reportDraftRecords.ts:108-155).
- **리포트 생성 후 'breed: null' 디버그 포맷**(F2): snake_case 영문 + null 리터럴 노출, 생성 전/후 타임라인 포맷 상이 (reportArtifactSnapshot.ts:66-73).
- **disclaimer 언어 뒤바뀜**: 생성 전 한국어 → 생성 후 영문 상수 (ReportsScreen.tsx:66, vetReportContract.ts:4).

**셸·온보딩·폼**
- **온보딩 SafeArea 부재**(G3): App.tsx:84 게이트가 SafeAreaView 없이 렌더 — 노치 침범 (첫 실행 경로만).
- **온보딩 히어로 카피 모순**(G3): 프로필 관리 재사용 경로에서 '반려동물 프로필' 헤더 + '등록해 주세요' 본문 병립 (PetOnboardingScreen.tsx:146).
- **온보딩 KeyboardAvoidingView 부재**: 하단 필드·저장 버튼 키보드 가림 (PetOnboardingScreen.tsx:145). Auth(B1)와 비대칭.
- **펫 전환 시 '미리보기용' 오문구**: 실계정 다중 펫 전환에도 'UI 미리보기용 프로필을 바꿨습니다' (PawBloomShell.tsx:140, today.petSwitched).
- **케어/투약 폼 placeholder 단독 라벨**(E4): 5개 입력이 값 입력 후 식별 불가 (CareMedicationPanel.tsx:129-134 외).
- **리포트 초기 로딩 무피드백·재시도 부재·EN 허위 pull-to-refresh 안내**(F3) (useVetReportWorkflow.ts:202).

**디자인시스템**
- **DangerButton 부재**(H5): 4개 화면 수제 위험 버튼 — 배경·높이 제각각 (SettingsScreen·DiaryEntryActions·CareMedicationPanel·PetOnboarding).
- **NoticeBanner liveRegion·중립 톤 부재**(F4): 스크린리더 미공지, 진행 배너가 성공 톤 (components.tsx:77-88).
- **BottomNav 아이콘 혼용**(H3): care만 filled Material, activeIcon은 today만 (BottomNav.tsx:8-13, iconography.tsx:25).
- **문서-구현 모순**(H4): 0004 미체크 잔존(구현 완료), 0002:67·:75, 0003 Day8~13 서술 모순.

## 4. P3 — 경미 (병합 후 34건, 요지)

| 영역 | 항목 |
| --- | --- |
| Auth | 경고 메시지가 성공 톤 체크 배너(sessionExpired/checkEmail), 비밀번호 정책 사전 안내 없음, pet-load-error 로그아웃 confirm 미경유(App.tsx:78) |
| 온보딩 | SpeciesPill 40pt, 수제 card(SurfaceCard 미사용), 몸무게 비숫자 silent 무시, 추가 폼 취소 버튼 없음, 사진 로드 실패=빈 상태 위장, photoPartial 경고가 성공 톤, 필수/선택 표기 비일관 |
| 홈 | 타임라인 정렬 프리뷰↔DB 상반, 주의 신호 문장 공백 이어붙임, 성공 배너 아이콘 check/shield 불일치, '메인' 용어 불일치(checklistTimelineReadOnly) |
| 다이어리 | DiaryEntryScreen 자체 배너 tone 미전달(검증 오류가 성공 톤), 빈 메모 저장 시 한국어 기본 summary 생성, 4-옵션 세그먼트 numberOfLines 미처리+42pt |
| 케어 | DatePickerField ISO 표시+clear 36pt(E5), '새 약 추가' placeholder 재사용 라벨(E3), 아젠다 액션 버튼 40pt(E2), 'Medication to check 3' 어색한 카운트 결합, skipped도 체크리스트 '완료' 표시 |
| 리포트 | 공유 URL 원탭 복사 없음(F5), 죽은 reports.* 키 6개 |
| 설정 | 언어 선택지 자기 언어 미표기(G4), 계정삭제 진행/완료 피드백 부재, 케어기버 제거가 중립 버튼(위험 시각 불일치), 플랜 실패 카피-동작 모순(재시도 없음), 루틴 패널 라벨/44pt(G1), 식사 알림 off 저장에도 권한 팝업+성공 배너 |
| DS·i18n | SegmentedControl 42pt 전역, 사진 뷰어 rgba 하드코딩(토큰 우회), 죽은 DS 자산(OutlineIconButton·menu/spark/bell 아이콘), 죽은 i18n 키 57개(H2), t() 죽은 첫 인자 't("ko",…)' 비테스트 566곳(동작은 하나 provider 밖 'ko' 폴백 위험) |

## 5. 죽은 코드·문서 정합성

- **죽은 컴포넌트**: CareReportReadinessCard(번역까지 완비, 마운트 0건 — E1 마운트 또는 삭제 양자택일), OutlineIconButton, icon.menu/spark/bell.
- **죽은 i18n 키 57개**: briefing.*(H1 연결 시 부활 예정분 보존), care.copy/doses/medicationToday 등, reports.eyebrow/title 등, settings.supabaseReady 등, routine.mealRemindersLabel(G1에서 사용 예정).
- **문서 모순**: 0005 D6 `[x]` 표기 오류(실제 partial), 0004 active 잔존+전체 미체크(구현은 완료), 0002-mvp-roadmap:67·:75, 0003 Day8~13 서술이 구현 현실과 불일치.
- **06 감사 대비 해소 확인**: 홈 가짜 'AI 요약' 정적 카드는 제거됨(obsolete 판정). 계정삭제·가족초대·구독 잠금은 '보류'에서 구현 완료로 전환.

## 6. 다음 단계

우선순위·태스크 분해·수용 기준은 [0006-uiux-alignment-plan.md](../exec-plans/active/0006-uiux-alignment-plan.md)에서 관리한다.
