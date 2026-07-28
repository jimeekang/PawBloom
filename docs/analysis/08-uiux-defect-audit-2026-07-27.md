---
owner_model: claude-opus-4.8-extra
domain: analysis
edit_policy: exclusive
---

# 08. 오류·모순 전수 감사 (2026-07-27)

- 계기: 0006 전 Phase가 `[x]`로 마감된 뒤 iOS 시뮬레이터 실기 검토에서 계획이 "완료"라고 주장한 항목의 반례가 나왔다. 실기 8건을 출발점으로 코드 전수 재감사를 수행했다.
- 방법: 8개 축(피드백 톤 / i18n 대칭 / 비동기 상태 / 프리뷰 모드 / 집계·정렬·날짜 / 화면 전환·상태 잔존 / 디자인시스템·a11y / 계획-현실 대조) 병렬 정독 → 119건 보고 → 축별 적대적 검증(반박 우선) → **기각 20건** → 누락 비평가가 10건 추가 발굴.
- 판정: **확정 109건, 중복 병합 후 고유 93건 (P1 6 + P2 33 + P3 54)**. 전 건 file:line 근거 확인.
- 기준: `docs/analysis/07-uiux-full-audit-2026-07-23.md`, `docs/exec-plans/active/0006-uiux-alignment-plan.md`, `docs/product/PRODUCT_SPEC.md`.
- 실행 계획: [0007-defect-remediation-plan.md](../exec-plans/active/0007-defect-remediation-plan.md)

## 1. P1 — 출시 블로커 (6건)

| # | 결함 | 근거 |
| --- | --- | --- |
| 1 | **한국 사용자는 매일 밤 마지막 1~2시간 동안 기록을 저장할 수 없다.** 다이어리 insert RLS가 `timezone('Australia/Sydney', occurred_at)::date = entry_date`를 강제한다. 클라이언트는 `entry_date`를 기기 로컬 날짜로, `occurred_at`을 로컬 벽시계 시각으로 보낸다. 서울 23:30(7월) → 시드니 기준 익일 00:30 → 날짜 불일치 → insert 거부. 겨울(AEDT)에는 22:00부터 막힌다. 실패는 일반 저장 오류로만 표시된다 | enforce_one_structured_diary_per_day.sql:44, atomic_photo_diary_save.sql:38·46, append_photo_diary_media.sql:52 |
| 2 | **투약 기록도 같은 이유로 야간 저장 불가.** `dose_date` 가드와 pet_sitter 정책이 동일하게 시드니 기준 날짜를 유도 | restrict_pet_sitter_records_to_today.sql:3·17·35·39·52, medication_dose_schedule_date_guard.sql:7 |
| 3 | **오프라인에서 저장이 영구 정지되고 오프라인 큐가 비어 있다.** `syncStatus`가 onlineManager를 NetInfo에 연결하는데 QueryClient는 React Query 기본값(`networkMode: "online"`)을 쓴다. 오프라인이면 mutation이 pause되고, 아웃박스 적재(`enqueueOfflineMutation`)는 `mutationFn` **안에** 있어 실행되지 않는다. `mutateAsync`가 영원히 pending → 저장 버튼이 '저장 중'에 고착 | App.tsx:23, diaryRecords.ts:131-165, syncStatus.ts:12 |
| 4 | **오프라인 쿼리가 '기록 없음'으로 위장된다.** paused 쿼리는 `isLoading`도 `isError`도 아니어서 모든 화면이 빈 상태로 렌더하고, 체크리스트 중복 기록 가드가 풀린다 | useDiaryEntriesController.ts:63 |
| 5 | **인앱 개인정보처리방침 링크가 "호스팅 금지"라고 명시된 초안을 가리킨다.** 문서 상단 주석은 `Do not host with the placeholders still in place`이고 본문에 `[EFFECTIVE_DATE]`·`[SUPPORT_EMAIL]`·`[SUPABASE_REGION]`이 그대로 남아 있다. 0006 A1은 이 작업을 `[x]`로 마감했다 | config.ts:9, PRIVACY_POLICY.md:18 |
| 6 | **정책 문서의 YAML 프런트매터가 GitHub에서 표로 렌더된다.** 심사자·이용자가 `owner_model` 등 내부 메타데이터를 먼저 본다 | PRIVACY_POLICY.md:1-5 |

## 2. P2 — 동작·데이터 결함 (33건)

**저장·알림 무결성**

- 반려동물 삭제 시 그 펫의 예약 알림이 취소되지 않아 삭제된 펫 이름으로 계속 울린다 (authPetMutations.ts:146).
- 투약 알림 토글을 껐다 켜면 **활성 펫 알림만** 복구되고 나머지 펫 알림은 사라진다 (PawBloomShell.tsx:87).
- 루틴 로드 전/실패 상태의 기본값으로 식사 알림 재예약이 돌아 사용자의 예약 알림이 조용히 취소된다 (reminderScheduling.ts:76).
- 루틴 쿼리 실패·로딩이 종별 기본값으로 위장되어, 그대로 저장하면 실제 루틴을 기본값으로 덮어쓴다 (useRoutineDefaults.ts:24).
- 약 용량(`dosageLabel`)이 서버에서만 필수 — 비우면 두 케어 폼 모두 원인 불명 '저장 실패'로 영구 차단 (shortTermMedicationDraft.ts:33).
- 오프라인 체크리스트 기록의 `entry_date`가 큐 적재 시점이 아니라 재전송 시점으로 다시 계산된다 (diaryOfflineReplay.ts:22).
- 케어 아젠다 상태 버튼에 진행 중 잠금이 없어 연타 시 저장에 성공한 기록에 '저장 실패'가 뜬다 (CareModeScreen.tsx:188).
- "오늘 기록으로 불러오기"가 스케줄의 복용 시각을 버리고 현재 시각으로 투약을 생성한다 (carePlanRecords.ts:21).
- 다이어리 달력에 미래 날짜 제한이 없어 미래 기록이 그대로 저장된다 (DiaryCalendar.tsx:72).
- 투약 편집 폼이 열린 상태에서 같은 행의 상태 버튼을 누르면 입력값이 조용히 초기화된다 (CareMedicationPanel.tsx:51).
- 작성 중이던 다이어리 초안(메모·사진·상세)이 탭 전환만으로 경고 없이 사라진다 (PawBloomShell.tsx:240).

**실패를 성공·빈 상태로 위장**

- `NoticeBanner`의 기본 tone이 `success`라, 톤을 명시하지 않은 모든 호출부가 실패·거부를 초록 체크로 렌더한다. 보고된 톤 결함 6건의 공통 뿌리 (feedback.tsx:25).
- 케어 플랜·루틴 저장 실패가 성공 톤 배너로 표시된다 (useCareSetupState.ts:46, useRoutineDefaults.ts:41).
- 체크리스트 거부·권한 차단 9종이 전부 성공 톤 (useTodayChecklistController.ts:62·151·155·159·176·182·186·190·201).
- 체크리스트 원격 실패 시 Supabase 영문 원문 또는 i18n 키 문자열이 그대로 배너에 노출된다. `appError`는 raw 메시지를 "로그 전용"으로 규정하고 `errorNoticeText`가 존재하는데 이 경로만 우회 (useTodayChecklistController.ts:56·78·84·94).
- 프로필 사진 업로드 실패인데 '저장 완료' 성공 토스트가 함께 뜬다 (PetOnboardingScreen.tsx:125).
- 홈 히어로 카운터가 로딩·실패 중에도 `0/7`·'확인할 투약 0'을 확정 수치처럼 표시한다 (HomeScreen.tsx:65).
- 케어 로드 실패·로딩 중에도 약 일정 카드와 준비도 카드가 '등록된 것 없음 / 0·3'을 단정한다 (CareModeScreen.tsx:123).
- 리포트 상단 카드가 소스 쿼리 로딩·실패 중에도 '기록을 추가하세요'를 단정한다 (ReportsScreen.tsx:68).
- 전역 notice 배너가 탭을 옮겨도 지워지지 않아 무관한 화면에 이전 오류가 남는다 (PawBloomShell.tsx:238).

**집계·표시 모순**

- 홈 체크리스트 투약 타일이 '기록됨'인 동안 히어로는 '확인할 투약 N'을 함께 보여준다 (todayChecklist.ts:16).
- "확인"이 화면마다 다른 것을 센다: 홈·케어는 **미기록 수**, 리포트는 **문제 표시 기록 수** (translations.ts, reportDraftRecords.ts:110).
- 생성된 리포트 타임라인이 초안과 달리 UTC 원본 ISO를 잘라 써서 같은 기록의 날짜·시각이 생성 전후로 바뀐다 (reportArtifactSnapshot.ts:80).
- "최근 7일" 창이 클라이언트(로컬 달력 7일·`entry_date`)와 엣지 함수(롤링 168시간·`occurred_at`)로 서로 다르다 (generate-vet-report/index.ts:26).
- 3/7/14일 브리핑 버튼이 '오늘' 기록 유무로만 잠겨, 어제까지 기록한 사용자가 브리핑을 만들 수 없다 (HomeScreen.tsx:126).
- 오늘 적용되지 않는 약 일정도 '오늘 기록으로 불러오기' 버튼과 함께 노출된다 (CareModeScreen.tsx:78).
- AI 브리핑 결과·실패 배너가 펫을 전환해도 이전 펫 것으로 남는다(실계정 포함) (AiBriefCard.tsx:28·62).
- 프리뷰 케어 플랜 로컬 상태가 펫 단위로 분리되지 않아 다른 펫의 투약 일정이 보인다 (useCareSetupState.ts:22).

**i18n·표기**

- 빈 메모·사진 다이어리는 언어와 무관하게 **한국어 기본 요약이 DB에 저장**되어 EN 모드와 병원 리포트에 그대로 노출된다 (diarySummary.ts:18).
- 과거 날짜에 저장해도 "오늘 타임라인에 표시됩니다"라고 안내한다. 정확한 문구 키 `diary.savedForDate`는 죽은 채 방치 (DiaryEntryScreen.tsx:148).
- EN에서 상태 라벨 `Not given yet`과 액션 버튼 `Not given`이 같은 행에 붙어 오기록을 유발한다 (translations.ts:32).
- 다이어리 카테고리 타일이 비활성일 때 시각 표시가 전혀 없다 (DiaryCategoryPicker.tsx:33).
- 루틴 패널 인라인 오류만 `colors.coral`(대비 2.57:1) — 인접 패널은 `colors.danger` (RoutineSettingsPanel.tsx:111).

## 3. P3 — 경미 (54건, 요지)

| 영역 | 항목 |
| --- | --- |
| 시간·날짜 | `selectedDiaryDate`·리포트 7일 창이 마운트 시점 고정(자정 경과 시 어긋남), 오프라인 재전송 기록 시각이 00:00으로 저장, 반려동물 나이가 UTC 파싱으로 UTC- 지역에서 하루 오차, 미래 생일 입력 제한 없음, 종료일 배지가 로케일 무시 M/D |
| 프리뷰 모드 | '이 기기에 저장됩니다' 안내가 거짓(메모리 상태), 계정 없는 사용자에게 '현재 플랜 Plus' 단정 + 바로 아래 'Family 필요' 병립, 샘플 고양이 '루나'의 species가 dog라 산책 항목 노출, 루틴·케어 패널이 프리뷰에서 미렌더되어 유도 링크가 빈 화면, 프리뷰 투약 목록에 날짜 조건 없음, 케어기버 '계정 필요' 안내가 도달 불가 |
| 피드백 중복 | 다이어리·투약 저장 실패 배너가 셸과 화면에 이중 표시, 펫 로드 실패 문구가 제목·배너로 반복, identity 오류가 설정 '계정' 카드로 새어 나감, 리포트 진행 중 배너가 완료 뜻의 check 아이콘 |
| 정렬·순서 | 다이어리 목록에 클라이언트 정렬 없음(프리뷰 오름차순 ↔ DB 내림차순), 홈 케어 요약 순서가 케어 화면과 반대, 프리뷰 리포트 타임라인 역전 |
| 디자인시스템·a11y | 달력 날짜 셀·SectionHeader 액션(34pt)·'새 약 추가'(39pt) 44pt 미달, `textSoft` 대비 3.06:1 AA 미달, `adjustsFontSizeToFit`가 Dynamic Type 무력화, `paw` 글리프가 logo·walk 겸용, shield 아이콘 과부하, 사진 썸네일 반경 불일치, FieldLabel 미적용 잔존 |
| i18n | 죽은 키 14~16쌍 잔존, EN 삭제 확인 문구 소유격 누락, 케어 기본값 힌트 KO/EN 설명 범위 불일치, 체크리스트·빠른 투약이 번역된 문장을 DB에 저장(언어 전환 시 과거 기록만 이전 언어) |
| 흐름 | 안드로이드 하드웨어 뒤로 가기 미처리, 케어 탭 '병원 리포트 생성'이 이동만 함, 인앱 비밀번호 변경 진입점 부재, 편집 중 날짜 변경 시 저장 대상 불명, 오프라인 충돌 배너가 대상 기록을 특정 못 하는데 유일한 버튼은 영구 삭제 |
| 테스트 | 투약 알림 토글 회귀 테스트가 소스 문자열 존재만 검사, 타임라인 정렬 테스트가 깨진 순서를 정답으로 고정, `verify:offline`이 통합 경로를 검사하지 않아 P1 3·4를 통과시킴 |

## 4. 0006 계획 주장 vs 코드 현실

`[x]` 표기와 코드가 어긋난 항목 — 표기를 믿고 재검증을 생략하면 재발한다.

| 항목 | 주장 | 현실 |
| --- | --- | --- |
| A1 정책 링크 | 완료 | 링크는 있으나 대상이 "호스팅 금지" 초안 (P1 5·6) |
| D1 NoticeBanner 톤 | "오류 tone 미전달 화면 일괄 정리" | DiaryEntryScreen은 `tone="error"`를 **하드코딩**해 버그가 반대로 뒤집힘(성공·안내까지 빨강). 케어·루틴·체크리스트는 손대지 않음 |
| C1 에러 키화 | 완료 | 같은 문장 안에서 대상 파일을 나열하고 ※주석으로 제외 — 자기모순. 빈 메모 한국어 요약은 "빈 메모 가드에서 해소 예정"이라 미뤘으나 어느 태스크에도 없음 |
| C2 투약 fallback 키화 | "fallback 의약명 '투약'도 키화" | 한국어 리터럴 6곳 잔존 |
| D5 FieldLabel | 완료 | 같은 폼 안에 FieldLabel과 로컬 label 스타일 혼재 |
| F2 죽은 i18n 키 | 완료 | 14~16쌍 잔존. 그중 `diary.savedForDate`는 **써야 할 자리에 안 쓰여** P2를 만듦 |
| F4 exec-plans 정합화 | 완료 | 0002 '미구현' 목록이 구현된 기능을 나열, 0003 내부 모순(헤더 '잔여' ↔ 본문 '완료'), 0005 D2~D5는 `[ ]`인데 0006 A1이 같은 작업을 `[x]` |
| 0006 완료 기준 | — | DESIGN_QA 회귀 항목 이관·07 재감사 모두 미이행인데 전 Phase 마감 |

07 감사 자체의 오판도 1건 확인했다: `authContextQueries`의 한국어 에러를 '사용자 배너 원문 노출'로 판정했으나 실제로는 `petMutationError`가 코드→키로 매핑한다 (07:74).

## 5. 이번 세션에서 이미 수정한 것

- P1 3·4 — QueryClient에 `networkMode: "always"` (쿼리·뮤테이션), `verify:offline`에 회귀 가드 추가 (`2a5fe2a`).
- P2 톤 3종 — `onNotice` 시그니처에 tone 추가, 체크리스트 원시 오류를 `errorNoticeText`로 경유, 거부 9종 톤 교정 (`5e580d0`).
- P2 리포트 한국어 혼입 — 타임라인이 언어 중립 detail을 싣고 셸이 다이어리 포매터를 주입 (`db889b5`).

## 6. 다음 단계

우선순위·태스크 분해·수용 기준은 [0007-defect-remediation-plan.md](../exec-plans/active/0007-defect-remediation-plan.md)에서 관리한다. **P1 1·2(시간대 RLS)는 스키마·보안 변경이라 사용자 승인 후 마이그레이션한다.**
