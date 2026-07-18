---
owner_model: claude-opus-4.8-extra
domain: planning
edit_policy: exclusive
---

# 0005. UI/UX 정합화 실행 계획 (2026-07-18)

- 근거: [docs/analysis/06-uiux-full-audit-2026-07-18.md](../../analysis/06-uiux-full-audit-2026-07-18.md) (확정 92 + P3 35)
- 원칙: 태스크 단위로 구현 → `npm run verify` 전체 통과 확인 후 다음 태스크 진행. 오류 발생 시 해결 우선.
- 가드 준수: verify-presentation-state.mjs 불변식(세로 스택 유지, CareMedicationAddCard/ShortTermMedicationForm 포함, DatePickerField 사용, 설정 탭 위치) 위반 금지. i18n 키는 en/ko 대칭 유지.

## Phase A — P1 버그 (데이터 손상·차단·에러 노출)

- [ ] A1. 산책 기록 편집 데이터 손상 수정 — 산책 카테고리 비활성이어도 기존 기록의 category를 보존, food로 폴백 금지 (DiaryEntryScreen).
- [ ] A2. 프리뷰 초기 체크리스트 walk '완료' 제거 — 샘플 레코드와 일치화(P3 '프리뷰 불일치' 동시 해소) (todayChecklist.ts).
- [ ] A3. 체크리스트 오탭 가드 — 레코드 생성 전 confirmAction 확인 + 투약 타일 잠금 모순 알림 문구 정리 (useTodayChecklistController, checklistActions).
- [ ] A4. '오늘 기록으로 불러오기' 중복 재탭 가드 + raw Postgres 에러를 i18n 메시지로 매핑 (PawBloomShell).
- [ ] A5. 사진 픽커 구조 교체 — 썸네일 탭 무동작(또는 확대 의도 예약), X 배지만 삭제 트리거 + confirmAction + a11y (DiaryPhotoPicker).

## Phase B — Auth·세션·로그아웃

- [ ] B1. Auth 폼 하드닝 — KeyboardAvoidingView+ScrollView, textContentType/autoComplete(emailAddress/password/newPassword), 비밀번호 표시 토글, 필드 라벨, 이메일 형식 사전 검증 + email_address_invalid 매핑 (AuthScreen, authFormState).
- [ ] B2. 로그아웃 확인 다이얼로그(공용 confirmAction, i18n 키 신설) 3곳 연결 + 로그아웃 실패 배너 렌더 (PawBloomShell, SettingsScreen, PetOnboardingScreen).
- [ ] B3. 펫 삭제 Alert.alert → confirmAction 교체(웹 no-op 해소) (PetOnboardingScreen).
- [ ] B4. 가입 전 언어 전환 — Auth 게이트에 KO/EN 토글 노출 (AuthScreen + languagePreference).
- [ ] B5. 세션 만료 시 안내 notice (authContextState).

## Phase C — 셸·홈

- [ ] C1. 셸 ScrollView `keyboardShouldPersistTaps="handled"` (PawBloomShell:240).
- [ ] C2. 저장 피드백 단일화 — SaveFeedbackBar를 유일한 성공 채널로, 중복 NoticeBanner 제거.
- [ ] C3. 히어로 메타 정리 — 빈 품종 처리, 나이 라벨 언어별 포맷('2y 3m' → '2살 3개월'/'2y 3m') (pet.ts, HomeScreen).
- [ ] C4. 오류 tone 일괄 — 홈 체크리스트/투약 실패·QuickMedicationForm·PetOnboarding 배너에 tone="error" 전달.
- [ ] C5. 헤더 정리 — 벨 아이콘 제거, 다이어리 헤더 제목/뒤로가기 정합화 (ShellHeaders).
- [ ] C6. 홈 a11y — 체크리스트 타일·타임라인 행·케어 요약 토글 role/label/state + 타임라인 행 44pt.

## Phase D — 다이어리

- [ ] D1. 목록 로딩·실패 상태 + 재시도 (useDiaryEntriesController, DiaryEntryList).
- [ ] D2. 주별 필터 행에 날짜 표시.
- [ ] D3. 달력 셀·월 이동 a11y + 44pt (DiaryCalendar).
- [ ] D4. 컨디션 점수·카테고리 타일·기록 행 a11y (DiaryConditionScore, DiaryEntryScreen, DiaryEntryList).
- [ ] D5. FieldLabel 컴포넌트 신설(design-system) + 다이어리 상세 적용 (DiaryDetailPanel).
- [ ] D6. diarySummary·diaryRecords 메시지 i18n화 — EN 모드 한국어 노출 제거.

## Phase E — 케어·투약

- [ ] E1. 케어 탭 IA 정리 — 리포트 세그먼트 제거, CareReportReadinessCard 마운트, 리포트 이동 CTA 1개로 통합 (CareModeScreen). ※가드의 CareMedicationAddCard 포함 조건 유지.
- [ ] E2. 투약 아젠다 행 버튼 a11y + 44pt + 선택 상태 반영.
- [ ] E3. ProfileCareDefaultsPanel 날짜 역전 검증 + '새 약 추가' 라벨 전용 키.
- [ ] E4. 케어/루틴 폼 FieldLabel 적용 (CareMedicationPanel, ShortTermMedicationForm).
- [ ] E5. DatePickerField — 표시값 locale 포맷, clear 44pt+a11y, clearLabel i18n (DatePickerField + logic).
- [ ] E6. medicationDoseRecords 메시지 i18n화.

## Phase F — 리포트

- [ ] F1. reportDraftRecords KO/EN 분리 + 날짜 로컬라이즈 + 타임라인 정렬(일시 기준 단일 정렬) 수정.
- [ ] F2. reportArtifactSnapshot — 펫 상세 사람용 포맷, 생성 후 타임라인 포맷 생성 전과 통일.
- [ ] F3. 리포트 초기 로딩 피드백 + 실패 재시도 버튼 + 오류 카피 수정 (ReportsScreen, useVetReportWorkflow).
- [ ] F4. NoticeBanner accessibilityLiveRegion + 진행 배너 중립 톤 (components.tsx).
- [ ] F5. 공유 URL 원탭 복사 (ReportArtifactSections).

## Phase G — 설정·루틴·온보딩

- [ ] G1. RoutineSettingsPanel — 식사 알림 토글 라벨(기존 키 사용), 에너지 세그먼트 라벨, 숫자 필드 FieldLabel, '지우기' 44pt.
- [ ] G2. 투약 알림 끄기 토글 — 식사 알림과 대칭 (PawBloomShell 알림 스케줄링 연동).
- [ ] G3. 온보딩 정리 — SafeArea(App.tsx), SurfaceCard화, 히어로 카피 모순 해소, SpeciesPill·사진 픽커·펫 선택 행 a11y+44pt, 몸무게 비숫자 피드백.
- [ ] G4. 설정 화면 정리 — 상태 배지 표현 통일, '환경' 카드 개발자 문구 정리, 언어 선택지 자기 언어 표기.

## Phase H — 미구현 기능·죽은 코드·문서 정합화

- [ ] H1. AI 브리핑 UI 연결 — generate-ai-brief 호출 훅 + 홈/리포트 노출(로딩·실패·disclaimer 포함). 실데이터 없으면 빈 상태.
- [ ] H2. 죽은 i18n 키 정리(~49개) — 단, H1에서 사용될 briefing 키는 보존. 죽은 컴포넌트/헬퍼 제거(E1에서 마운트되는 ReadinessCard 제외).
- [ ] H3. BottomNav 아이콘 패밀리 통일(outline 기본 + 활성 filled).
- [ ] H4. exec-plans 정합화 — 0004 archive 이동, 0002·0003 서술 현행화, 02-product-ux 해소 항목 주석.
- [ ] H5. 위험 버튼 DS 컴포넌트(DangerButton) 신설 + 3곳 교체.

## 보류 (이번 사이클 제외, 별도 계획 필요)

- 계정 삭제 흐름: Supabase service-role edge function + 데이터 파기 정책 필요 → DB/보안 소유(codex-high) 검토 선행.
- 가족 초대 UI, 구독 잠금 UI: 백엔드 멤버십/결제 미구현 상태라 UI 단독 구현 불가. 스펙 재확정 필요.
- 사진 오프라인 큐: sync 컨텍스트 확장 설계 필요(진행 피드백은 A5에서 부분 개선).
- 고양이 템플릿·산책 관찰 구조화 확장: 제품 결정 필요.

## 완료 기준

- 각 태스크 후 `npm run verify` 9종 통과. Phase 완료 시 웹 프리뷰(8083, 390x844) 실기 확인.
- 전체 완료 후 docs/design/DESIGN_QA.md 소유 모델에 회귀 체크 항목 이관 요청.
