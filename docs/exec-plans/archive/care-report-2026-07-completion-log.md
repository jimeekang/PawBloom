---
owner_model: codex-high
domain: implementation
edit_policy: exclusive
---

# Care & Report 완료 구현 기록 (2026-07)

2026-07-01 ~ 07-04 사이 완료된 대형 TDD 계획 3개(checklist/diary record boundary,
care profile defaults simplification, clinic report value proof)를 하나로 통합한
완료 기록. 원본 계획의 inline 코드/QA 스텝은 이미 코드에 흡수되어 제거하고,
살아있는 계약(규칙·시그니처·마이그레이션·경로)만 남긴다. 상세 규칙은 아래 링크된
현행 문서로 흡수되었다.

- 대응 commit: `4c91b91` (diary/care entry flow 단순화), `8cca48a` (care medication scheduling 단순화)
- 현행 규칙 문서: [PRODUCT_SPEC](../../product/PRODUCT_SPEC.md) · [FRONTEND](../../engineering/FRONTEND.md) · [DATABASE](../../engineering/DATABASE.md) · [ARCHITECTURE](../../../ARCHITECTURE.md)

---

## 1. Checklist / Diary Record Boundary

- **완료일:** 2026-07-04 (검증·구현 완료). 대응 commit `4c91b91`.
- **목표:** Today 체크리스트 완료 기록과 상세 Diary 카테고리 기록을 분리해, 체크리스트
  타임라인 항목이 잘못된 Diary 편집 플로를 열거나 중복 카테고리 데이터를 만들지 않게 한다.
- **핵심 결정 (origin 3분류 규칙):**
  - `diary_entries` 테이블·타임라인 UI는 유지하고, 명시적 `origin`을 추가한다.
    `DiaryRecordOrigin = "diary" | "checklist"` (`diaryEntry.ts`), DB 컬럼은 `record_origin`.
  - 원래 sketch보다 규칙을 강화: 구조화 Diary 카테고리를 저장하면 같은 날 존재하는
    같은 카테고리 record(체크리스트-origin 포함)를 **업데이트**하고 그 record를
    `origin: "diary"`로 **승격**한다. 체크리스트-origin 타임라인 탭은 Today에 머무르며
    Diary 편집을 직접 열지 않는다.
  - 완료 계산(liveUiState)과 생성 차단(`isChecklistRecordBlocked`)은 **카테고리 기준**으로
    유지 — 상세 Diary food 기록도 Today food 체크리스트를 만족시킨다. origin이 갈리는 지점은
    완료 계산이 아니라 **편집 라우팅**뿐.
  - `structuredDailyCategories = Set(["food","water","walk","stool","condition"])`.
    `isStructuredDailyDiaryCategory(category)`는 이 집합 멤버십. memo/photo는 appendable로 제외.
  - `findEditableDailyStructuredEntry(entries, category, dateKey)`: 구조화 카테고리일 때
    `origin !== "checklist"` && 같은 category && 같은 entryDate인 첫 entry 반환.
  - `getTimelineEntryRoute(entry)` 헬퍼(`shell/timelineRouting.ts`):
    `origin === "checklist" ? "checklistNotice" : "diaryEdit"`. 체크리스트 탭 시
    `today.checklistTimelineReadOnly` notice를 띄우고 return.
- **마이그레이션 `20260701000100_add_diary_record_origin.sql`:**
  - `diary_entries.record_origin text not null default 'diary'`.
  - check 제약 `diary_entries_record_origin_check`: `record_origin in ('diary','checklist')`.
  - `diaryRecords.ts` select에 `record_origin` 추가, 매핑 `origin: row.record_origin ?? "diary"`,
    생성 payload `record_origin: input.origin ?? "diary"`.
- **변경된 파일/영역:**
  - domain/app: `contexts/diary/domain/diaryEntry.ts`, `contexts/diary/application/diaryRecords.ts`
    (+ `diaryRecordOrigin.ts`, `diaryRecordPayload.ts` 추출), `generated-supabase/database.types.ts`.
  - presentation: `shell/checklistActions.ts`, `shell/timelineRouting.ts`, `PawBloomShell.tsx`,
    `screens/DiaryEntryScreen.{tsx,logic.ts}`, `mockUiState.ts`, `i18n/translations.ts`.
  - 검증: `scripts/verify-presentation-state.mjs`에 pure TS 테스트(timelineRouting 등) 등록.
  - 살아있는 product/UI 규칙은 [PRODUCT_SPEC](../../product/PRODUCT_SPEC.md),
    [FRONTEND](../../engineering/FRONTEND.md)로 흡수.
- **남은 후속 항목:** 체크리스트 전용 테이블은 의도적으로 미도입. 체크리스트 데이터가
  커지면 별도 architecture 변경으로 분리 가능(현 scope 제외).

---

## 2. Care Profile Defaults Simplification

- **완료일:** 2026-07-05 구현·검증 완료. 대응 commit `8cca48a`.
- **목표:** 장기 care setup을 pet profile로 이동하고, Care 탭을 period/recurrence-aware,
  reminder-backed, 중복-안전한 "오늘의 투약 체크" 단일 surface로 단순화한다. condition score의
  소유는 Diary에 유지.
- **핵심 결정 — 반복 규칙 (`medicationScheduleRules.ts`):**
  - `scheduleAppliesOnDate({ startsOn, endsOn?, recurrenceIntervalDays }, dateKey)`:
    `dateKey < startsOn`이면 false(before-start 제외), `endsOn && dateKey > endsOn`이면
    false(endsOn 경계 포함 = 종료일 당일까지 적용), interval은 `max(1, floor(recurrenceIntervalDays||1))`,
    `daysBetweenLocalDates(startsOn, dateKey) % interval === 0`이면 적용.
  - `daysBetweenLocalDates(from, to)`: local date key를 로컬 `Date`로 파싱해 밀리초 차이를
    일 단위로 `Math.round`. 예: 07-04→07-06 = 2. every-2-days는 07-04 적용, 07-05 skip,
    07-06 적용, 07-11(endsOn 07-10 초과) 미적용.
- **핵심 결정 — agenda 병합 (`screens/todayMedicationAgenda.ts`):**
  - `createTodayMedicationAgendaRows({ schedules, doses, doseDate })`: 적용되는 schedule을
    `source:"schedule", status:"pending"` 가상 row로 만들고(Map by scheduleId), 저장된 dose가
    같은 scheduleId면 `source:"dose"` row로 **덮어씀**(중복 방지), scheduleId 없는 dose는
    one-time row. 최종 `scheduledTime` 오름차순 정렬. 적용 안 되는 날짜의 schedule은 row 미생성.
- **핵심 결정 — 직접 액션 & reminder:**
  - `careStatusActionLabel(status)`: `completed → "먹였어요"`, `skipped → "못 먹였어요"`.
    cyclic status 탭 대신 두 버튼 직접 액션. (구 `nextDoseStatus`/`cycleDoseStatus` primary 경로 제거.)
  - `buildMedicationReminderRequests({ petName, schedules, fromDate, daysAhead })`:
    `fromDate`부터 `daysAhead`일 각각에 `scheduleAppliesOnDate`로 필터해 요청 생성.
    identifier `medication:{scheduleId}:{dateKey}`, title에 petName, body에 medicationName,
    `triggerDate`는 localTime 기반. `rescheduleMedicationReminders`가 기존 `medication:*` 취소
    후 30일치 재등록(권한 거부 시 앱 유지 + non-blocking notice).
  - `ProfileCareDefaultsPanel` props 계약: `{ setup: ActiveCareSetup; onSave: (input: CareSetupInput) => void }`.
    condition/medication + local time마다 schedule row 1개를 저장. profile에서 렌더.
  - domain 확장: `ActiveCareSetup.conditions[]`(최신 우선, 단일 `condition`은 `conditions[0]`),
    `CareMedicationSchedule`에 `conditionId/conditionName/startsOn/endsOn/recurrenceIntervalDays` 노출.
- **마이그레이션 `20260704000100_medication_dose_schedule_date_guard.sql`:**
  - `medication_schedules.recurrence_interval_days integer not null default 1`
    (+ `>= 1` check 제약).
  - `medication_doses.dose_date date` 추가.
  - 백필: `dose_date = (scheduled_at at time zone 'Australia/Sydney')::date` (null 대상),
    이후 `set not null`.
  - 부분 유니크 인덱스 `medication_doses_schedule_date_unique on (pet_id, schedule_id, dose_date)
    where schedule_id is not null` → schedule/날짜당 dose 1개 보장.
  - dose 병합: `findDoseForScheduleDate`, `mergeSavedDoseIntoList`, `buildMedicationDoseInsertPayload`
    (`medicationDoseRecords.ts`). DB 세부는 [DATABASE](../../engineering/DATABASE.md)로 흡수.
- **변경된 파일/영역:**
  - contexts: `care/domain/carePlan.ts`, `care/application/carePlanRecords.ts`,
    `medication/domain/medication.ts`, `medication/application/medicationDoseRecords.ts`,
    `medication/application/medicationScheduleRules.ts`.
  - presentation: `screens/ProfileCareDefaultsPanel.tsx`, `screens/todayMedicationAgenda.ts`,
    `notifications/medicationReminderNotifications.ts`, `screens/CareModeScreen.tsx`,
    `screens/CareMedicationPanel.tsx`, `screens/careMedicationPanelState.ts`,
    `screens/PetOnboardingScreen.tsx`, `shell/useShellCareDefaults.ts`, `PawBloomShell.tsx`,
    `liveUiState.ts`, `HomeScreen.tsx`, `HomeDashboardPanel.logic.ts`, `i18n/translations.ts`.
  - 검증: `scripts/verify-presentation-state.mjs`에 rules/agenda/reminder 테스트 등록 +
    `CareModeScreen`이 `CareSetupPanel` import/`SummaryCard` 렌더 시 실패하는 static guard.
    안전 문구는 `verify:ai-safety`로 확인.
- **남은 후속 항목:** dashboard pending 카운트는 저장된 dose가 아니라 agenda row(schedule-backed
  pending 포함) 기준으로 유지. Home/Today 요약은 saved dose가 아직 없어도 일관 표시.

---

## 3. Clinic Report Value Proof

- **완료일:** 2026-07-05 전 태스크 완료(원본 체크박스 전부 [x]). 대응 commit `8cca48a`.
- **목표:** 유료 기능 이전에 첫 수익화 가치를 명확히 — 보호자 기록을 진료실용, 안전한,
  기록 기반 vet briefing으로 만든다. 결제/PDF/share-token/AI prompt/백엔드 스키마 작업 없음.
- **핵심 결정 — 결정론적 report draft (`report/application/reportDraftRecords.ts`):**
  - draft summary 필드: timeline highlights, missing record prompts, vet questions,
    English preview, medication adherence count(completed/pending).
  - condition trend는 의학적 호전/악화 문구가 아니라 **score 이동 문구**로 매핑
    ("Improving/Declining" 대체). 모든 생성 문구는 관찰·기록 기반으로 유지.
  - 테스트: highlights, missing records, questions, adherence counts, English preview,
    빈 기록 동작 커버.
- **핵심 결정 — 390px 정적 오버플로 가드 (`scripts/verify-presentation-state.mjs`):**
  row 기반 clipping 패턴으로 회귀 시 실패. 대상:
  - Diary food meal 입력 필드 (`screens/DiaryDetailPanel.tsx`) 세로 스택.
  - Care quick medication dose 필드 (`screens/CareMedicationPanel.tsx`) 세로 스택.
  - Care setup medication name/time 기본값 (`screens/CareSetupPanel.tsx`) 세로 스택.
  기존 checklist notice 검증 항목은 보존.
- **변경된 파일/영역:**
  - report: `report/application/reportDraftRecords.{ts,test.ts}`.
  - presentation: `screens/ReportsScreen.tsx`(artifact-first, 전체 disclaimer, mock share 명시),
    `screens/CareModeScreen.tsx`(setup 위 vet report readiness 카드, 오늘 투약 우선 배치),
    `screens/CareMedicationPanel.tsx`, `screens/CareSetupPanel.tsx`, `screens/DiaryDetailPanel.tsx`,
    `screens/AuthScreen.tsx`(pre-signup 7일 vet report/family care log/safe summary 프리뷰),
    `screens/HomeScreen.tsx`(Today hero 대비 강화), `ui/SummaryCard.tsx`(관찰형 유지 + 전체 disclaimer),
    `sampleData.ts`(disclaimer 정합), `i18n/translations.ts`.
- **문서 결함 메모:** 원본 clinic-report plan의 File Structure가 SummaryCard 경로를
  `apps/mobile/src/presentation/components/SummaryCard.tsx`로 오기했으나, 실제 파일은
  **`apps/mobile/src/presentation/ui/SummaryCard.tsx`**다. 위 링크·본 기록은 실제 경로 기준.
- **남은 후속 항목:** confirmed/shared 상태는 실제 share token 도입 전까지 mock/preview로 명시
  유지. report/care copy는 진단·처방·"수의사 불필요" 암시 금지(AI safety gate 대상).

---

## 통합 검증 게이트

세 계획 공통으로 handoff 전 아래 통과 필요:
`npm run verify:presentation`, `npm run verify:i18n`, `npm run verify:supabase`,
`npm run verify:ai-safety`, `npm run typecheck`, `npm run verify`.
