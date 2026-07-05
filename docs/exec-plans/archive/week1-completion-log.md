---
owner_model: codex-high
domain: implementation
edit_policy: exclusive
---

# Week 1 완료 구현 기록 (2026-06-27 ~ 06-30)

2026-06-27~06-30에 TDD로 완료된 Week 1 실행 계획 7개를 통합한 구현 기록이다.
각 섹션은 [완료일 / 목표 / 핵심 결정 / 변경 영역 / 후속]으로 정리했고, 잃으면 안 되는
계약만 압축 보존했다. inline 테스트 전문·헬퍼 구현·git 커맨드 덤프는 제거하고 시그니처와
규칙만 남긴다. 관련 계획: [../active/0003-weekly-execution-checklist.md](../active/0003-weekly-execution-checklist.md).

## 보존 계약 → commit 매핑 요약

- (1) `pet_routines` 스키마 + prefill-only 기본값 원칙 — **fef426d**
- (2) 종별 `getDiaryCategoriesForSpecies` + `walk.enabled` optional + 루틴 편집=프로필 카드 — **fef426d**
- (3) diary/dose 편집·삭제 인코딩 + `createDashboardSummary` attentionSignals — **4d1ce4a**
- (4) Reports 7일 요약 파생 + dose 상태 사이클 + `recorded_at` 규칙 — **369fced**
- (5) `ActiveCareSetup` 타입 + `normalizeCareLocalTime` + `care.setupRequired` — **25d3806**
- (6) 홈 체크리스트 가시성(walk 숨김/투약 기본) + `verify:presentation` 게이트 — **4c91b91**
- (7) 카테고리별 폼 헬퍼 + `CareRecordPanel` 삭제 + 정적 가드 + `TimePickerField` — **4c91b91**

---

## 1. Routine & Care Plan Defaults (2026-06-27, commit fef426d)

- **목표:** 각 펫의 baseline 일일 루틴과 active care/medication plan을 한 번 설정하면
  일일 diary·dose 기록 시 그 기본값을 재사용한다.
- **핵심 결정 — prefill-only 원칙:** 일일 diary/medication dose 기록이 "오늘 실제 일어난 일"의
  source of truth로 남고, 기본값은 그 일일 레코드를 **prefill만** 한다(덮어쓰기 아님).
  default→diary 변환 로직은 `diary` context 경계 밖에 둔다.
- **DB 계약 — `pet_routines`:** `supabase/migrations/20260627000000_pet_routines.sql`.
  컬럼: `pet_id`, `routine jsonb`, `created_by`, timestamps. **unique(`pet_id`)**,
  explicit GRANT, pet membership 기준 RLS. baseline routine은 pet-scoped.
- **domain:** `contexts/routine/domain/petRoutine.ts` — food/water/walk/stool/condition baseline.
  `contexts/routine/application/petRoutineRecords.ts` — TanStack Query query/upsert 훅.
  care 기본값은 기존 `care`·`medications`·`medication_schedules` 테이블 재사용.
- **변경 영역:** 위 migration·domain·application + `RoutineSettingsPanel.tsx`/`CareSetupPanel.tsx`
  신설, `DiaryEntryScreen`·`CareModeScreen`·`PawBloomShell`·`mockUiState`·`translations` 배선,
  docs(PRODUCT_SPEC/ARCHITECTURE/FRONTEND/DATABASE) 갱신.
- **후속:** 루틴 편집 위치는 06-27 split 계획(2번)에서 프로필 카드로 이동 확정.

## 2. Profile Routine & Diary/Care Split (2026-06-27, commit fef426d)

- **목표:** 기본 루틴 설정을 선택된 펫 프로필로 옮기고, walk 기본값을 종별 optional로,
  Diary는 diary 기록 전용·Care Mode는 질병/투약 전용으로 분리.
- **핵심 결정 — 종별 카테고리:** `getDiaryCategoriesForSpecies(species)`.
  - `dog` → `food,water,walk,stool,condition,memo`
  - `cat`·`other` → 위에서 **산책(walk) 제외**
- **walk optional flag:** `PetRoutine.walk`에 optional `enabled` 추가.
  `walk.enabled === false`이면 `buildRoutineDiaryDetail("walk")`는 minutes를 prefill하지 않는
  빈 walk detail 반환(`durationMinutes === undefined`).
- **핵심 결정 — 루틴 편집 배치:** routine settings는 Diary가 아니라 **선택된 펫 프로필
  편집 카드** 하위(프로필 save/delete 컨트롤 아래)에서 렌더한다. `DiaryEntryScreen`은
  defaults용 `routine`만 받고 `onSaveRoutine`·루틴 패널은 제거. Diary의 daily/care
  세그먼트 컨트롤 제거 → 종별 카테고리만 노출.
- **변경 영역:** `petRoutineRecords.ts`(+`petRoutineSpecies.test.ts`), `PetOnboardingScreen`,
  `PawBloomShell`, `DiaryEntryScreen`, `RoutineSettingsPanel`, `CareModeScreen`, `translations`,
  PRODUCT_SPEC/FRONTEND.
- **후속:** Care Mode가 care plan/medication/symptom/report 입력의 유일 소유처로 유지.

## 3. Diary/Care Edit·Delete & Today Dashboard (2026-06-28, commit 4d1ce4a)

- **목표:** 저장된 Diary·Care 투약 레코드의 편집·삭제, Today를 완료율/주의신호/케어상태/
  퀵액션 대시보드로 승격.
- **핵심 결정 — mutation 배치:** 데이터 mutation은 각 bounded context 안, 스크린은 presentation
  전용. `PawBloomShell`이 mutation·local preview·save feedback·navigation·dashboard props의
  coordinator. Supabase RLS는 이미 update/delete 허용 → 모바일 mutation·UI만 추가.
- **보존 시그니처 (인코딩 계약):**
  - `buildDiaryUpdatePayload(input: UpdateDiaryEntryInput)` → `{category, summary(구조화 detail
    JSON 인코딩, `"version":1` 포함), condition_score(condition만 값·아니면 null),
    entry_date(선택 날짜 유지), occurred_at(편집 시각 `T08:15`), updated_at}`.
    `UpdateDiaryEntryInput = CreateDiaryEntryInput & { id; occurredTime? }`.
  - `removeDiaryEntryFromList<T extends {id}>(entries, id)` → 매칭 id만 필터 제거.
  - `buildMedicationDoseUpdatePayload(input: UpdateMedicationDoseInput)` →
    `{medication_name(trim·빈값이면 "투약"), scheduled_at(`T21:10`), status, recorded_at(status
    파생), reaction_note(care note 인코딩·"sleepy" 보존), updated_at}`.
    `UpdateMedicationDoseInput = QuickMedicationDoseInput & { id; scheduledTime? }`.
  - `updateLocalDoseRecord(current, input)` → local preview용 dose 병합;
    `recordedAt = status === "pending" ? undefined : new Date().toISOString()`.
- **핵심 결정 — `createDashboardSummary(checklist, entries, doses)`:**
  `DashboardSummary = { completedCount, totalCount, pendingMedicationCount, attentionSignals[] }`.
  `attentionSignals` 규칙: 낮은 컨디션 점수 / skipped·partial dose / 물 미기록 / stool의
  혈변·점액 detail.
- **변경 영역:** `diaryRecords.ts`(+`editDelete.test.ts`), `medicationDoseRecords.ts`(+test),
  `DiaryEntryList`(row tappable, `onEntryPress`), `DiaryEntryScreen`(edit mode·update/delete/cancel),
  `CareMedicationPanel`(editingDose props), `CareModeScreen`(row body edit vs status action),
  `PawBloomShell`(DB/local update·delete·Alert 확인·dashboard nav), `localMedicationState`,
  `liveUiState`(dashboard 파생), `HomeScreen`(hero/attention strip/care summary/quick actions/
  tappable timeline), `saveFeedback`(diaryUpdated·diaryDeleted·medicationUpdated·medicationDeleted),
  `translations`.
- **후속:** dose 상태 사이클·recorded_at 세부는 다음 stabilization(4)에서 확정.

## 4. Week 1 Care & Reports Stabilization (2026-06-28, commit 369fced)

- **목표:** Care quick dose 동작 명확화, Reports를 실제 최근 기록에 바인딩, Supabase 상태 검증.
- **핵심 결정 — dose 상태 사이클:** `대기 -> 정량 -> 일부 -> 건너뜀 -> 대기`
  (pending → completed → partial → skipped → pending). UI 헬퍼 문구·row 라벨이 이 순서 안내.
- **핵심 결정 — `recorded_at` 규칙:** `useCreateMedicationDose`는 `pending`에 `recorded_at: null`,
  `completed`·`partial`·`skipped`에 현재 시각 저장. `useUpdateMedicationDoseStatus`는 `pending`으로
  되돌리면 `recorded_at` clear, 그 외엔 설정. 저장 후 quick dose 폼은 status를 `completed`로 리셋.
- **핵심 결정 — Today 완료 판정:** quick dose가 `completed`·`partial`·`skipped`로 저장되거나
  기존 pending dose가 pending 밖으로 갱신되면 투약 체크리스트 complete.
- **핵심 결정 — Reports 7일 요약 파생 규칙:** `reportDraftRecords.ts`가 오늘 포함 inclusive
  last-7-day 범위 파생. Supabase는 `useDiaryEntriesByDateRange`, medication은 `scheduled_at`
  범위 필터 훅(+`mapDoseRow` 재사용). 파생 지표: 총 diary 기록 수 / 최신·직전 condition 점수 /
  condition 추세 라벨 / dose 수 / `skipped`+`partial` 미달 수 / diary·dose 둘 다 0이면 empty state.
  AI·backend function 호출 없음, 스키마 추가 없음(기존 `diary_entries`·`medication_doses` read).
  AI disclaimer·staged 버튼은 유지.
- **변경 영역:** `reportDraftRecords.ts` 신설, `diaryRecords`·`medicationDoseRecords`·`ReportsScreen`·
  `PawBloomShell`·`translations`·`CareMedicationPanel`·`CareModeScreen`.
- **후속:** care plan domain 강화·time normalize는 다음 smoke 계획(5)에서.

## 5. Week 1 Smoke & Care Plan Hardening (2026-06-30, commit 25d3806)

- **목표:** iOS/웹 Week 1 스모크 검증, Care Mode를 실제 care plan·medication schedule 중심으로 안정화.
- **핵심 결정 — active care 타입:** `contexts/care/domain/carePlan.ts`.
  - `CareConditionStatus = "active" | "resolved" | "archived"`.
  - `ActiveCareCondition = { id; name; status; startsOn? }`.
  - `ActiveCarePlanSummary = { id; title; instructions?; startsOn? }`.
  - `ActiveCareSetup = { condition?; plan?; conditionName?; planTitle?; instructions?; schedules[] }`.
    `conditionName`·`planTitle`·`instructions`는 기존 UI 호환 위해 임시 유지.
  - 순수 mapper `mapCareSetup(...)`로 Supabase row → `ActiveCareSetup` 매핑.
- **핵심 결정 — `normalizeCareLocalTime(value)`:** `':'` split 후 `hour`·`minute` 2자리 pad →
  `HH:MM:00`. 예: `'8:5' -> '08:05:00'`, `'' -> '08:00:00'`.
- **핵심 결정 — `care.setupRequired` 빈저장 방지:** `conditionName|planTitle|medicationName` 중
  하나라도 있어야 저장. 없으면 `care.setupRequired`("병명, 케어 플랜명, 약 이름 중 하나는 입력해
  주세요.") 로컬 에러. schedule tap 시 quick dose 폼은 "오늘 기록으로 불러오기"(`care.useToday`)로
  표기 — 영구 처방 변경이 아니라 오늘 편집 가능 레코드임을 명시.
- **변경 영역:** `carePlan.ts`(+`carePlanRecords.ts`·test), `CareSetupPanel`(active context 블록·
  검증·copy), `CareModeScreen`(상단 기준값), `SaveFeedbackBar`(가시성), `translations`,
  `scripts/verify-*`(필요 시 최소 수정).
- **보안 후속(Day7 RLS/시크릿 체크포인트):** 전 public table RLS+explicit GRANT, pet membership
  권한, bundle 내 service role·OpenAI·Supabase access token 미포함, publishable key 스모크는
  이미 [../../engineering/DATABASE.md](../../engineering/DATABASE.md)로 흡수 — 상세는 링크 참조.

## 6. Home Today Simplification (2026-06-30, commit 4c91b91)

- **목표:** Today 홈 단순화, 펫 사진 가독성 유지, 중복 퀵액션 제거, diary/care를 별도 모드로
  제시하지 않고 가시 체크리스트 노출.
- **핵심 결정 — 체크리스트 가시성:** 순수 규칙은 `liveUiState.ts`에 두어 RN 렌더 없이 검증.
  - `activeRoutine.walk.enabled === false`이면 `산책` 숨김.
  - `투약`은 Today 체크리스트에 **기본 표시**. medication 가시성을 DB pet mapping flag에서
    파생하지 **않음**(향후 suppressed context용 optional flag만 유지).
- **핵심 결정 — 게이트 배선:** `scripts/verify-presentation-state.mjs`가 실제로
  `liveUiState.dashboard.test.ts`를 실행하고, `verify:presentation`을 `npm run verify`에 포함.
- **변경 영역:** `HomeDashboardPanel`·`HomeScreen`(hero엔 이름·detail만, 요약은 이미지 아래,
  Diary/Care 모드 버튼 제거, 중복 퀵액션 `다이어리 추가`/`투약 기록`/`리포트 보기` 제거,
  네비는 하단 탭바), `PawBloomShell`, `components.tsx`(`SectionHeader` `onActionPress`,
  timeline `모두 보기`→오늘 Diary), `liveUiState`(+`dashboard.test.ts`), `verify-presentation-state.mjs`,
  `package.json`.
- **후속:** 없음(스펙·코드 리뷰·시뮬레이터 스크린샷 승인 완료).

## 7. Diary Category-Specific Forms (2026-06-30, commit 4c91b91)

- **목표:** Diary가 선택된 카테고리의 폼만 표시, photo·memo를 diary 전용 카테고리로 분리,
  Care의 중복 care-record 입력 제거.
- **핵심 결정 — 카테고리별 폼 헬퍼:** `DiaryEntryScreen.formRules.ts`.
  - `getDiaryCategoryFormState(category)` → `{ showsDetail, showsMemo, showsPhotos }`.
  - `getDiaryDetailForSave(category, detail)` → 구조화 카테고리(food/water/walk/stool/condition)만 detail.
  - `getDiarySummaryForSave(category, memo)` → `memo`·`photo`만 trim 텍스트, 그 외 빈 문자열.
  - `getDiaryPhotosForSave(category, photos, isEditing)` → 신규 `photo` 항목에만 photos.
  - 편집도 entry.category에서 가시성 파생(동일 규칙). `DiaryCategory`에 `"photo"` 추가.
- **핵심 결정 — CareRecordPanel 삭제:** `CareModeScreen`에서 `CareRecordPanel` import·JSX 제거,
  `onSaveCareEntry` prop과 shell care-entry bridge 제거, 파일 삭제. Diary 카테고리 기록+Care
  medication/setup 데이터가 리포트로 집계된다는 방향으로 문서 정정.
- **핵심 결정 — 정적 가드:** `scripts/verify-presentation-state.mjs`가 `CareModeScreen.tsx`의
  `CareRecordPanel` import 시 실패.
- **핵심 결정 — `TimePickerField` 도입:** `@react-native-community/datetimepicker`(Expo SDK 호환)
  기반 공유 시간 입력. `TimePickerField.logic.ts`가 기존 `HH:mm` 저장값 보존하는 parse/format.
  Diary 기록 시각·Care plan 약 시간·medication 편집 시간의 직접 text input을 대체.
- **변경 영역:** `formRules.ts`·`TimePickerField.{tsx,logic.ts,test.ts}` 신설,
  `DiaryEntryScreen`·`diaryEntry.ts`·`petRoutineRecords`·`CareModeScreen`·`PawBloomShell`·
  `CareSetupPanel`·`CareMedicationPanel`·`translations`·`categoryVisuals`(필요 시)·
  `verify-presentation-state.mjs`·`package.json`, `CareRecordPanel.tsx` 삭제.
- **후속:** 없음(최종 verify·시뮬레이터 스모크로 카테고리 격리·Care 중복 입력 제거 확인).
