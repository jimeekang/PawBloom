---
owner_model: codex-high
domain: implementation
edit_policy: exclusive
---

# 0008. 잔여 구현 인수인계 — Codex 실행 명세 (2026-07-28)

- 배경: 0007 결함 정정(고유 93건) 중 25개 태스크가 구현·검증·푸시 완료됐다
  ([0007 계획](0007-defect-remediation-plan.md), 감사 근거
  [08 감사 리포트](../../analysis/08-uiux-defect-audit-2026-07-27.md)).
  이 문서는 남은 작업만을 Codex가 이 문서 하나로 독립 실행할 수 있게 파일 단위로 명세한다.
- 완료 표기 규칙(0007 승계): `[x]`는 코드 실검증 + `npm run verify` 통과 + 실기 확인 후에만.

## 0. 지금까지의 변경 요약 (컨텍스트)

- 브랜치 `claude/design-ui-ux-review-1fc70a`에 23커밋 (`2a5fe2a`..`5f0995e`), main 머지 완료.
- 시간대 RLS: `supabase/migrations/20260728100000_relax_record_dates_to_device_local.sql`이
  `Australia/Sydney` 하드코딩을 `app_private.matches_local_entry_date`(UTC −12..+14 창)로 교체.
  **아직 DB에 미적용** — §1 배포 명령 참조.
- 오프라인: QueryClient `networkMode: "always"` 고정(`verify:offline` 가드), 큐 적재 시점 날짜·시각 고정.
- 피드백: `NoticeBanner` tone 필수화(`NoticeTone = success|error|progress|info`), 원시 `error.message`
  노출 금지(`CodedError`+`errorNoticeText` 경유).
- 셸: 다이어리 탭 상시 마운트(초안 보존), 탭 전환 시 notice·스크롤 초기화, Android back 처리,
  자정 경과는 `useLocalDateKey` 훅으로 추적.
- 리포트: 클라이언트가 달력 7일 창(`fromDateKey`/`toDateKey`)을 전송, 엣지 함수는 창 필터+구버전 폴백.

## 1. 선행 — 배포 명령 (자격증명 필요, 로컬 터미널에서 실행)

코드는 전부 커밋돼 있고 적용만 남았다. 순서 무관, 구버전 클라이언트와 호환.

```bash
supabase link --project-ref xgvbtabedbocrebqilsh
supabase db push                                                            # 시간대 RLS 적용
supabase functions deploy generate-ai-brief --project-ref xgvbtabedbocrebqilsh    # 브리핑 KO/EN (0006 C7)
supabase functions deploy generate-vet-report --project-ref xgvbtabedbocrebqilsh  # 7일 창 통일 (0007 D5)
```

- 적용 후 확인: 기기 시간대를 서울로 두고 23:30에 다이어리·투약 저장 성공, EN 모드 브리핑이 영어로 생성,
  리포트 기간이 앱 표시와 일치. 완료되면 0007의 A1·D5를 `[x]`로 갱신한다.

## 2. E2 잔여 — 프리뷰 정합

### 2a. 프리뷰 '현재 플랜 Plus' 단정 표기

- 증상: 계정 없는 프리뷰 사용자에게 '현재 플랜 Plus'를 단정 표기하고, 바로 아래 'Family 필요' 잠금이 병립.
- 파일: `apps/mobile/src/contexts/subscription/application/subscriptionEntitlement.ts`(프리뷰 기본 플랜),
  `apps/mobile/src/presentation/screens/SettingsHubScreen.tsx`(플랜 카드 렌더),
  `apps/mobile/src/i18n/translations.ts`(`settings.plan.*` 계열, 신규 키는 EN/KO 대칭).
- 방법: 프리뷰 모드에서는 플랜명을 단정하지 말고 "미리보기 모드 — 로그인하면 플랜이 표시됩니다" 류의
  중립 문구로 대체(신규 키). 실계정 경로는 변경 금지.
- 수용 기준: 프리뷰에서 'Plus' 문자열 미노출, 로그인 상태 표기는 기존과 동일, `verify:i18n` 통과.

### 2b. 프리뷰 루틴·케어 패널 접근 경로 복구

- 증상: 프리뷰에서 루틴·케어 기본값 패널이 렌더되지 않아 유도 링크가 빈 화면으로 떨어진다.
- 파일: `apps/mobile/src/presentation/PawBloomShell.tsx`(패널 게이팅),
  `apps/mobile/src/contexts/routine/ui/RoutineSettingsPanel.tsx`,
  `apps/mobile/src/contexts/care/ui/ProfileCareDefaultsPanel.tsx`.
- 방법: 프리뷰에서는 패널을 읽기 전용 샘플로 렌더하거나, 유도 링크 자체를 "계정 필요" 안내로 대체.
  둘 중 링크가 빈 화면으로 이어지지 않는 쪽을 택한다.
- 수용 기준: 프리뷰에서 해당 링크를 눌러도 빈 화면이 나오지 않는다.

## 3. E3 — 피드백 중복 단일화

- 증상: 다이어리·투약 저장 실패가 셸 배너와 화면 인라인에 이중 표시, 펫 로드 실패 문구가 제목·배너로
  반복, identity 오류가 설정 '계정' 카드로 새어 나감 (감사 §79).
- 파일: `apps/mobile/src/presentation/shell/saveFeedback.ts`(셸 배너 발원),
  `apps/mobile/src/contexts/diary/ui/DiaryEntryScreen.tsx`,
  `apps/mobile/src/contexts/medication/ui/CareMedicationPanel.tsx`,
  `apps/mobile/src/contexts/routine/ui/useRoutineDefaults.ts`,
  `apps/mobile/src/contexts/care/ui/useCareSetupState.ts`,
  `apps/mobile/src/presentation/screens/SettingsHubScreen.tsx`(identity 오류 누출).
- 방법: 원칙은 "화면에 인라인 오류가 있으면 셸 배너를 올리지 않는다". 인라인이 없는 흐름(체크리스트 등)만
  셸 배너 유지. `saveFeedback.ts`에 발원 화면 인라인 여부를 함께 전달해 분기한다.
- 수용 기준: 같은 실패가 두 곳에 동시에 뜨는 조합 0건, `saveFeedback.test.ts` 갱신
  (문자열 고정이 아니라 "단일 표출" 계약을 단언).

## 4. E4 잔여 — 홈 케어 요약 순서

- 증상: 홈 케어 요약 항목 순서가 케어 화면과 반대 (감사 §80).
- 파일: `apps/mobile/src/presentation/screens/HomeDashboardPanel.logic.ts`(요약 구성),
  기준은 `apps/mobile/src/presentation/screens/CareModeScreen.tsx`의 일정 정렬(`local_time` 오름차순).
- 수용 기준: 두 화면의 항목 순서가 동일, `HomeDashboardPanel.logic.test.ts`에 순서 단언 추가.

## 5. E6 잔여 — i18n

### 5a. 죽은 키 실측 정리

- 방법: `scripts/verify-i18n.mjs`를 확장해 `apps/mobile/src`에서 `t("<key>")` 미사용 키를 실측 검출
  (동적 키 조합 — `care.status.*`, `settings.plan.*` 등 — 은 접두사 화이트리스트로 예외 처리).
  검출된 죽은 키를 EN/KO 쌍으로 삭제. **주의**: `diary.savedForDate`는 죽은 키가 아니라
  "써야 할 자리에 안 쓰인" 키다 — 삭제하지 말고 `DiaryEntryScreen.tsx`의 과거 날짜 저장 안내가
  이 키를 쓰도록 연결한다 (감사 §68).
- 수용 기준: verify가 미사용 키 0건을 보증, 과거 날짜 저장 시 "오늘 타임라인" 오안내가 사라진다.

### 5b. DB 저장 문장의 언어 고정 설계

- 증상: 빈 메모·사진 다이어리의 한국어 기본 요약이 DB에 저장돼 EN 모드·병원 리포트에 그대로 노출
  (`apps/mobile/src/contexts/diary/application/diarySummary.ts:18`). 체크리스트·빠른 투약도
  번역된 문장을 저장해 언어 전환 시 과거 기록만 이전 언어로 남는다 (감사 §67·§82).
- 파일: `diarySummary.ts`, `apps/mobile/src/presentation/shell/checklistActions.ts`,
  `apps/mobile/src/contexts/medication/ui/CareMedicationPanel.tsx`(빠른 투약 메모),
  렌더 측 `apps/mobile/src/contexts/diary/application/diaryOfflineReplay.ts`·리포트 포매터.
- 방법: DB에는 언어 중립 식별자(빈 문자열 또는 `category` 기반 센티널)만 저장하고, 표시 시점에
  현재 언어로 렌더한다. 기존 저장분은 마이그레이션 대신 렌더 폴백(`isDefaultDiarySummary` 패턴이
  이미 있다 — D1 참조)으로 흡수한다. **주의**: application 레이어는 i18n import 금지(아키텍처 가드) —
  번역은 ui/presentation에서만.
- 수용 기준: 새 기록은 언어 전환 후에도 현재 언어로 표시, 기존 기록도 폴백으로 현재 언어 렌더,
  `verify:architecture` 통과.

## 6. E7 잔여 — 흐름

### 6a. 인앱 비밀번호 변경 진입점

- 파일: `apps/mobile/src/presentation/screens/SettingsHubScreen.tsx`(계정 카드에 진입점 추가),
  `apps/mobile/src/contexts/identity/application/authContextState.ts`(변경 로직),
  참고 구현 `apps/mobile/src/contexts/identity/ui/PasswordRecoveryScreen.tsx`·`PasswordField.tsx`.
- 방법: 로그인 상태에서 `supabase.auth.updateUser({ password })` 경로. 현재 비밀번호 재확인이 필요하면
  재로그인 검증 후 갱신. 실패는 `authErrorMessages.ts` 경유로 노출.
- 수용 기준: 설정 → 계정에서 비밀번호 변경 성공/실패 피드백 확인, 기존 재설정(이메일) 흐름은 그대로.

### 6b. 오프라인 충돌 배너 — 대상 특정·삭제 경고

- 증상: 충돌 배너가 어떤 기록이 충돌했는지 특정하지 못하는데 유일한 버튼이 영구 삭제다 (감사 §83).
- 파일: `apps/mobile/src/contexts/sync/ui/OfflineConflictNotice.tsx`,
  `apps/mobile/src/contexts/sync/ui/useOfflineConflictCount.ts`,
  `apps/mobile/src/contexts/sync/application/offlineReplayQueue.ts`(충돌 항목 메타데이터 노출).
- 방법: 큐 항목의 펫·카테고리·기록 날짜를 배너에 표기하고, 삭제 버튼에 확인 단계
  (`confirmDestructiveAction` 패턴 재사용)를 추가한다.
- 수용 기준: 배너만 보고 어떤 기록인지 식별 가능, 실수 1탭 영구 삭제 불가.

## 7. F1 잔여 — 투약 알림 토글 테스트 동작 검증화

- 파일: `apps/mobile/src/presentation/shell/NotificationFlow.regression-1.test.ts`(현재 문자열 존재만 검사),
  대상 코드 `apps/mobile/src/presentation/shell/useMedicationReminderToggle.ts`·
  `medicationReminderRestore.ts`.
- 방법: expo-notifications를 목킹해 "off → 계정 전체 취소 호출, on → 스케줄 보유 전 펫 재예약"을
  호출 인자 수준으로 단언한다. `scripts/run-presentation-test.mjs` 러너 규약을 따른다.
- 수용 기준: 복원 로직을 일부러 활성 펫만 돌게 바꾸면 테스트가 실패한다(변이 검증).

## 8. 선택 후속 (0007 범위 외)

- 개인정보처리방침 전용 호스팅(GitHub Pages) 이전 — 현재는 저장소 게시본으로 충족.
- Dynamic Type 대응·FieldLabel 혼재 정리 (E5 잔여 명시분).
- 실메일로 비밀번호 재설정 루프 1회 실측 (A3 후속).

## 9. 검증 절차 (모든 태스크 공통)

- `npm run verify`는 **파이프 금지** — `npm run verify > /tmp/verify.log 2>&1; echo $?`로 exit 코드를
  직접 확인한다 (`| tail`은 실패를 가린 전례가 있다).
- 가드: 파일 260줄(초과 시 모듈 분리), 컨텍스트 간 ui→타 컨텍스트 application/ui import 금지,
  i18n EN/KO 대칭, `NoticeBanner` tone 필수, QueryClient `networkMode: "always"` 유지, md 300줄.
- 커밋은 태스크 단위, 완료 시 이 문서와 0007의 해당 항목을 갱신한다.
