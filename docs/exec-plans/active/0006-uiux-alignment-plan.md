---
owner_model: claude-opus-4.8-extra
domain: planning
edit_policy: exclusive
---

# 0006. UI/UX 정합화 실행 계획 2차 (2026-07-23)

- 근거: [docs/analysis/07-uiux-full-audit-2026-07-23.md](../../analysis/07-uiux-full-audit-2026-07-23.md) (확정 72건 → 고유 60건: P1 2 + P2 24 + P3 34).
- 선행 관계: 0005의 Phase A~C·D1~D5는 완료 확인됨. 이 계획은 0005 잔여(D6 정정, E~H) + 신규 발견을 통합 승계한다. 이 계획 확정 시 0005는 archive로 이동한다.
- 원칙: 태스크 단위 구현 → `npm run verify` 전체 통과 후 다음 태스크. 오류 해결 우선. 커밋은 태스크 단위.
- 가드 준수: verify-presentation-state.mjs 불변식(세로 스택 유지, CareMedicationAddCard/ShortTermMedicationForm 포함, DatePickerField 사용, 설정 탭 위치) 위반 금지. i18n 키는 en/ko 대칭 유지(verify:i18n). 에러 문자열의 키화 시 verify:ai-safety·verify:architecture 재확인.

## Phase A — P1: 출시 블로커·필수 기능

- [ ] A1. **개인정보처리방침·지원 링크 인앱 노출** — `shared-kernel/config.ts`에 `PRIVACY_POLICY_URL`·`SUPPORT_URL` 상수 추가(호스팅 URL은 docs/product/PRIVACY_POLICY.md 게시본). SettingsScreen 하단·AuthScreen 하단에 `Linking.openURL` 텍스트 링크 2개(신규 키 `settings.privacyPolicy`·`settings.support`, en/ko 대칭, 44pt·accessibilityRole="link"). 수용 기준: 두 화면에서 탭 시 외부 브라우저 열림, 웹 프리뷰에서도 동작.
- [ ] A2. **계정 삭제 확인·피드백 정합화** — SettingsScreen.tsx:28의 raw `Alert.alert`를 `confirmDestructiveAction`으로 교체(취소 시 `cancelConfirm`, 확인 시 `deleteAccount`), `Alert` import 제거. deleting 상태에서 버튼 텍스트를 진행 문구(신규 키 `settings.deleteAccountInProgress`)+ActivityIndicator로 교체. 성공 시 Auth 게이트에 '계정이 삭제되었습니다' 안내(A4의 authMessage tone 분기 재사용). 수용 기준: 웹 프리뷰에서 확인/취소 모두 동작, 'confirming' 고착 재현 불가.
- [ ] A3. **비밀번호 재설정 흐름** — AuthScreen 로그인 모드에 '비밀번호를 잊으셨나요?' 진입점 → 이메일 입력 후 `supabase.auth.resetPasswordForEmail(email, { redirectTo })` 호출, 발송 안내 배너. 앱 딥링크(expo-linking) 수신 시 새 비밀번호 입력 폼 → `updateUser({ password })`. 신규 키 `auth.forgotPassword`·`auth.resetEmailSent`·`auth.newPassword`·`auth.resetDone` (en/ko). 수용 기준: 재설정 메일 발송→링크 진입→변경→재로그인 루프 완주. ※Auth 영역이므로 AGENTS.md 에스컬레이션 규칙상 강한 리뷰 경로.
- [ ] A4. **AI 브리핑 UI 연결(H1 승계) — 제품 결정 선행**: (a) 연결 시 — `contexts/briefing/application`에 generate-ai-brief 호출 훅(react-query mutation) 신설, 홈(체크리스트 아래) 또는 리포트 상단에 브리핑 카드(로딩·실패·재시도·`briefing.disclaimer` 필수 노출, AI_SAFETY.md 준수, 실데이터 없으면 빈 상태). (b) 미출시 결정 시 — sampleBrief·briefing.* 죽은 키 정리(F2와 병합)하고 PRODUCT_SPEC §AI 범위 하향. 수용 기준: 어느 쪽이든 '스펙-구현-i18n' 3자 일치.

## Phase B — P2: 동작·데이터 결함

- [ ] B1. **세션 만료 오발화 수정** — useAuthActions.ts signOut 진입부(supabase.auth.signOut() 호출 전)에서 explicitSignOutRef를 true로 선설정(실패 시 원복). useAccountDeletion 경로 포함. 수용 기준: 로그아웃·계정삭제 후 '세션 만료' 미표시, 실제 토큰 만료 시에만 표시(기존 테스트 + 신규 회귀 테스트).
- [ ] B2. **홈 로딩/에러 상태 전달** — diaryQuery·dosesQuery의 isLoading/isError를 HomeScreen props로 전달, 로딩 스켈레톤(또는 로딩 배너)+실패 시 오류 배너·재시도(다이어리 D1 패턴 재사용). 로딩 중 체크리스트 타일 탭 가드(disabled). 수용 기준: 네트워크 차단 시 '기록 없음' 대신 오류+재시도 노출, 로딩 중 중복 기록 생성 불가.
- [ ] B3. **케어 탭 로딩/에러 상태 전달** — dosesQuery·careSetupQuery의 상태를 CareModeScreen까지 전달, B2와 동일 패턴. 수용 기준: 조회 실패가 `care.noMedicationToday`로 위장되지 않음.
- [ ] B4. **리포트 미리보기 실패 구분** — useReportDraftSummary가 isError/isLoading 반환, ReportsScreen이 실패 시 emptyState 대신 오류+재시도 분기. 수용 기준: 쿼리 실패≠'최근 7일 기록 없음'.
- [ ] B5. **케어 저장 거짓 권한 오류 제거** — saveCareSetupAndRefreshReminders(PawBloomShell.tsx:151-162)에 식사 경로와 동일한 `!databaseMode || !userId` 가드(웹 포함) 적용, 리마인더 통지 스킵. 수용 기준: 프리뷰/웹 케어 저장 시 성공 피드백만 노출.
- [ ] B6. **ProfileCareDefaultsPanel 날짜 역전 검증(E3)** — save()에 `endsOn && endsOn < startsOn` 검증, `care.shortTermPeriodInvalid` 재사용 인라인 오류. shortTermMedicationDraft.ts:34와 규칙 통일. 수용 기준: 역전 저장 차단 + 테스트.
- [ ] B7. **투약 알림 On/Off 토글(G2)** — carePlan에 `medicationRemindersEnabled` 플래그 추가, ProfileCareDefaultsPanel에 식사 알림과 동일 패턴 토글(전용 키 신설), false면 buildMedicationReminderPlan이 빈 계획 반환→기존 알림 취소. reminderScheduling.ts:65 autoRefresh도 플래그 존중. 수용 기준: 토글 off 후 예약 알림 0건, 식사 알림과 UI 대칭. ※알림 스케줄링 로직 변경이므로 회귀 테스트 필수.
- [ ] B8. **홈 케어 요약 카운트 agenda 통일** — HomeDashboardPanel 카운트·확장 목록을 medicationAgenda 기반으로 교체, 예약 pending 행 표시. 수용 기준: 히어로 '확인할 투약 N'과 카드 카운트 항상 일치.
- [ ] B9. **식사 알림 off 저장 시 권한 팝업 스킵** — rescheduleMealReminders에서 계획이 비면 requestPermission 생략·기존 취소만 수행, 비활성 저장 성공 문구 중립화. 수용 기준: off 상태 저장 시 OS 팝업 미노출.

## Phase C — P2/P3: i18n·현지화 (EN 모드 한국어 제거)

- [ ] C1. **application 계층 에러 키화(1/3: 다이어리·미디어)** — diaryRecords.ts:89~189·diarySummary.ts:18,40-44·mediaUpload.ts:33~77·authContextQueries.ts:141~225의 하드코딩 한국어/raw Postgres message를 에러코드로 교체, UI 경계(useDiaryEntriesController 등)에서 t() 매핑(A4 패턴 재사용). raw message는 로깅 전용. 완료 시 0005 D6 표기를 partial로 정정(→F4).
- [ ] C2. **application 계층 에러 키화(2/3: 케어·투약, E6)** — medicationDoseRecords.ts 9곳·carePlanRecords.ts:38·carePlanPersistence.ts:19·useCareSetupState.ts:40-42 동일 처리. fallback 의약명 '투약'도 키화.
- [ ] C3. **리포트 미리보기 로컬라이즈+정렬(F1)** — reportDraftRecords의 누락기록·타임라인·수의사질문을 언어 인자 기반 t()로 재구성, 날짜 로케일 포맷, sortKey를 실제 타임스탬프(occurredAt/scheduledAt) 단일 정렬로 교체. 영문 사본은 englishPreview 블록 한정. reportDraftRecords.test.ts의 영문 단언 갱신.
- [ ] C4. **리포트 생성 후 포맷 정합(F2)** — formatPetDetails를 라벨 로컬라이즈+빈 값 '미기록' 사람용 포맷으로 교체('null' 노출 제거). 타임라인 항목 빌더를 생성 전/후 공유 단일 함수로 통합. disclaimer는 보호자 화면에서 항상 로컬라이즈 문구(영문 원문은 병원용 사본에만).
- [ ] C5. **DatePickerField 로케일 표시(E5 잔여)** — displayValue를 언어별 포맷(ko '2026년 7월 23일' / en 'Jul 23, 2026')으로 변환(저장값 ISO 유지), clear 버튼 minHeight 44. ※가드의 DatePickerField 사용 불변식 유지.
- [ ] C6. **언어 선택지 자기 표기(G4 잔여)** — 설정·Auth의 언어 SegmentedControl 라벨을 정적 '한국어'/'English'로 고정(번역 대상 제외).

## Phase D — 디자인시스템·a11y 일괄

- [ ] D1. **NoticeBanner 개선(F4)** — NoticeTone에 'progress'(중립) 추가, tone별 accessibilityLiveRegion(오류 assertive/그 외 polite)·accessibilityRole('alert' for error) 부여. 진행성 메시지(reports.generateInProgress 등) 중립 톤 전환. 오류 tone 미전달 화면 일괄 정리: DiaryEntryScreen.tsx:211(검증 오류 error 톤), AuthScreen authMessage(종류별 tone 매핑 — sessionExpired/checkEmail은 비성공 톤), PetOnboarding photoPartial(경고 톤).
- [ ] D2. **DangerButton 신설+교체(H5)** — components.tsx에 DangerButton(label/onPress/disabled, dangerBg·danger 텍스트·minHeight 44·role/label) 신설, 4곳 교체(SettingsScreen 계정삭제, DiaryEntryActions, CareMedicationPanel, PetOnboardingScreen 펫 삭제). PetMembersCard '접근 제거'도 위험 시각으로 전환.
- [ ] D3. **터치 타깃 44pt 일괄** — SegmentedControl segment 42→44(components.tsx:209), 케어 아젠다 given/partial/skip 40→44(CareModeScreen.styles.ts:40-44)+선택 버튼 시각 강조, SpeciesPill 40→44(PetOnboardingScreen.styles.ts:76), 루틴 '지우기' minHeight 44+role/label(G1), DatePicker clear(C5와 병합).
- [ ] D4. **SegmentedControl 라벨 반응형** — segmentText에 numberOfLines={1}+adjustsFontSizeToFit. EN 'Diarrhea'/'Refused'·접근성 글꼴 확대 조합을 390px 프리뷰에서 실측.
- [ ] D5. **FieldLabel 적용 확대(E4·G1)** — CareMedicationPanel(병명/약/용량/투여량/반응 5필드), ShortTermMedicationForm, ProfileCareDefaultsPanel, RoutineSettingsPanel(숫자 5필드+에너지 세그먼트 라벨, 식사 알림 헤더를 routine.mealRemindersLabel로 교체 — 죽은 키 부활).
- [ ] D6. **BottomNav 아이콘 통일(H3)** — care를 Ionicons outline 계열(예: medkit-outline)로 교체, 5개 탭 전부 activeIcon(filled) 제공.
- [ ] D7. **토큰 정리** — tokens.ts에 scrim 계열 토큰(scrimStrong 0.92/scrimSoft 0.55) 추가, DiaryEntryList.tsx:178·:194 하드코딩 rgba 교체.

## Phase E — 흐름·카피 폴리시

- [ ] E1. **온보딩 정리(G3 잔여)** — App.tsx:84 pet-onboarding 게이트 SafeAreaView 적용, 히어로 카피 온보딩/관리 모드 분기(pet.manageTitle 활용), ScrollView를 KeyboardAvoidingView로 래핑, styles.card→SurfaceCard 교체, 몸무게 비숫자 인라인 오류(전용 키), 추가 폼 '취소' SecondaryButton, 사진 isLoading/isError 표시, 필수(이름)/선택 표기 규칙 통일.
- [ ] E2. **홈 폴리시** — 타임라인 렌더 직전 occurredAt 단일 정렬, today.petSwitched 중립 문구 교체(프리뷰/실계정 분기), 주의 신호 개별 행 렌더, 성공 배너 아이콘 check로 통일(홈/셸), checklistTimelineReadOnly '메인'→'오늘'.
- [ ] E3. **케어 폴리시** — care.todayMedicationProgress를 카운트 포함 플레이스홀더형('{count}건 남음'/'{count} left')으로 교체, '새 약 추가' 전용 키 신설(E3 잔여), skipped 기록 시 체크리스트 타일에 주의 보조 라벨(완료와 시각 구분).
- [ ] E4. **리포트 마감(F3·F5 잔여)** — 초기 로딩 스피너/문구, 로드 실패 배너에 재시도 버튼(refetch), EN loadFailed에서 'Pull to retry' 제거(EN/KO 의미 대칭), expo-clipboard로 '링크 복사' 버튼(44pt·성공 토스트).
- [ ] E5. **설정 마감** — SubscriptionPlanCard·PetMembersCard 플랜 실패 시 재시도 버튼(entitlementQuery.refetch), App.tsx:78 pet-load-error 로그아웃 confirmAndSignOut 통일+실패 배너, 가입 폼 비밀번호 최소 요건 사전 힌트.

## Phase F — 죽은 코드·문서 정합화

- [ ] F1. **CareReportReadinessCard 양자택일(E1 잔여)** — 케어 탭 리포트 CTA 위 마운트(원안) 또는 컴포넌트+care.readiness* 키 삭제. ※가드의 CareMedicationAddCard 포함 불변식 유지.
- [ ] F2. **죽은 i18n 키 정리(H2)** — 실측 57개 중 부활 예정분(A4 채택 시 briefing.*, D5의 routine.mealRemindersLabel) 제외 후 en/ko 대칭 삭제. 죽은 DS 자산(OutlineIconButton, icon.menu/spark/bell) 제거.
- [ ] F3. **t() 죽은 첫 인자 정리 방침 결정** — 비테스트 566곳의 `t("ko", …)` 리터럴. 권고: t 시그니처에서 language 인자 제거(runtimeLanguage 단일 소스) 코드모드 1회. 규모가 커 별도 태스크로 격리, verify 전체 통과 필수.
- [ ] F4. **exec-plans 정합화(H4)** — 0004를 archive로 이동+완료 표기, 0005 D6 체크를 partial로 정정 후 0005 archive 이동(본 계획이 승계), 0002-mvp-roadmap:67·:75, 0003 Day8~13 서술 현행화.

## 보류 (별도 계획 필요)

- **사진 오프라인 큐**: offlineOutbox에 media 뮤테이션 종류 추가 설계 필요(sync 컨텍스트 확장). DDD 경계(media↔sync) 결정 선행.
- **딥링크 전반 설계**: A3(비밀번호 재설정)에 최소 구현하되, 이메일 확인·공유 링크 오픈 등 전역 딥링크 라우팅은 별도 설계.

## 완료 기준

- 각 태스크 후 `npm run verify` 통과(typecheck + architecture/i18n/presentation/ai-safety/secrets/supabase/docs/offline-sync). Phase 완료 시 웹 프리뷰(390x844) 실기 확인 — 특히 EN 모드 한국어 혼입 0건(Phase C 후), 웹 계정삭제 확인 동작(A2 후).
- 전체 완료 후 docs/design/DESIGN_QA.md에 회귀 체크 항목 이관, docs/analysis/07 재감사로 잔여 판정.
