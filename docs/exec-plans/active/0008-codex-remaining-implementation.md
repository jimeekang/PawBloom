---
owner_model: codex-high
domain: implementation
edit_policy: exclusive
---

# 0008. 잔여 구현 인수인계 — Codex 실행 명세 (2026-07-28)

> **상태 (2026-08-12): Codex 구현·자동 검증·iOS Simulator 미리보기 및 원격 실계정 QA 완료.** 남은 항목은 물리 iPhone에서만 증명할 수 있는 알림·백그라운드·23:30 시간대 실측과 0007 소유 모델의 최종 QA 판단이다. 0007이 이 문서를 active 상대경로로 참조하므로 링크를 깨지 않기 위해 아직 archive로 이동하지 않는다. 0007의 상태·링크를 함께 정리할 때 두 계획을 archive한다.

- 배경: 0007 결함 정정(고유 93건) 중 25개 태스크가 구현·검증·푸시 완료됐다
  ([0007 계획](0007-defect-remediation-plan.md), 감사 근거
  [08 감사 리포트](../../analysis/08-uiux-defect-audit-2026-07-27.md)).
  이 문서는 남은 작업만을 Codex가 이 문서 하나로 독립 실행할 수 있게 파일 단위로 명세한다.
- 완료 표기 규칙(0007 승계): `[x]`는 코드 실검증 + `npm run verify` 통과 + 실기 확인 후에만.

## 0. 지금까지의 변경 요약 (컨텍스트)

- 브랜치 `claude/design-ui-ux-review-1fc70a`에 23커밋 (`2a5fe2a`..`5f0995e`), main 머지 완료.
- 시간대 RLS: `supabase/migrations/20260728100000_relax_record_dates_to_device_local.sql`이
  `Australia/Sydney` 하드코딩을 `app_private.matches_local_entry_date`(UTC −12..+14 창)로 교체.
  **2026-07-29 원격 DB 적용 확인** — 로컬·원격 migration list가 일치한다.
- 오프라인: QueryClient `networkMode: "always"` 고정(`verify:offline` 가드), 큐 적재 시점 날짜·시각 고정.
- 피드백: `NoticeBanner` tone 필수화(`NoticeTone = success|error|progress|info`), 원시 `error.message`
  노출 금지(`CodedError`+`errorNoticeText` 경유).
- 셸: 다이어리 탭 상시 마운트(초안 보존), 탭 전환 시 notice·스크롤 초기화, Android back 처리,
  자정 경과는 `useLocalDateKey` 훅으로 추적.
- 리포트: 클라이언트가 달력 7일 창(`fromDateKey`/`toDateKey`)을 전송, 엣지 함수는 창 필터+구버전 폴백.

## 1. 선행 — 배포 명령 (자격증명 필요, 로컬 터미널에서 실행)

2026-07-29 적용 완료. 아래 명령은 재현용이며 순서 무관, 구버전 클라이언트와 호환된다.

```bash
supabase link --project-ref xgvbtabedbocrebqilsh
supabase db push                                                            # 시간대 RLS 적용
supabase functions deploy generate-ai-brief --project-ref xgvbtabedbocrebqilsh    # 브리핑 KO/EN (0006 C7)
supabase functions deploy generate-vet-report --project-ref xgvbtabedbocrebqilsh  # 7일 창 통일 (0007 D5)
```

- 적용 후 확인: 기기 시간대를 서울로 두고 23:30에 다이어리·투약 저장 성공, EN 모드 브리핑이 영어로 생성,
  리포트 기간이 앱 표시와 일치. 완료되면 0007의 A1·D5를 `[x]`로 갱신한다.
- 원격 확인: `20260728100000` 로컬·원격 일치는 2026-07-29에 확인했다. 2026-08-12에는 배포 함수
  `generate-ai-brief` v7, `generate-vet-report` v4, `get-vet-report` v3,
  `get-vet-report-state` v1, `manage-pet-members` v3가 모두 ACTIVE임을 재확인했다.
- 원격 호출: 실계정 JWT로 KO/EN 브리핑과 7일 리포트 생성을 성공시켰고, 앱 표시 기간·언어·비진단
  고지를 확인했다. 물리 기기가 연결되지 않아 23:30 시간대 실측만 미완료다.

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

## 10. 실행 결과 (2026-07-29)

| 범위 | 구현·배포 결과 | 자동 검증 | 실기 |
| --- | --- | --- | --- |
| §1 배포 | DB migration 일치, 두 Edge Function ACTIVE | 원격 CLI 재조회 | 기기 시간대·EN 브리핑·리포트 창 미확인 |
| §2 프리뷰 | 중립 플랜 문구, 빈 설정 링크 대신 로그인 안내 (`a4e7111`) | `npm run verify` 통과 | 브라우저 미확인 |
| §3 피드백 | 인라인 오류가 있는 흐름의 셸 중복 억제 (`fb4ec8b`) | 동작 테스트·전체 verify 통과 | 미확인 |
| §4 정렬 | 홈 케어 요약을 케어 화면과 같은 시각 오름차순으로 정렬 (`d58f701`) | 순서 단언·전체 verify 통과 | 미확인 |
| §5 i18n | 미사용 키 0 가드, 언어 중립 저장·구기록 표시 폴백 (`1412183`, `13857e7`) | 593키·미사용 0, 전체 verify 통과 | 언어 전환 실기 미확인 |
| §6 흐름 | 재인증 기반 비밀번호 변경, 충돌별 펫·카테고리·날짜와 영구 삭제 경고 (`ac34d79`, `5cac818`) | 호출 순서·저장소 격리·UI 계약 테스트 통과 | 로그인 계정 실기 미확인 |
| §7 알림 | OFF 계정 전체 취소, ON 전 펫 복원 동작 테스트 (`dfb50fe`) | expo-notifications 목·변이 검증·전체 verify 통과 | 실제 알림 센터 미확인 |

- 2026-07-29 당시 최종 `npm run verify`: 통과 (333 source files, 131 presentation tests,
  593 i18n keys, 18 public tables, 49 markdown files).
- 웹 실기를 위해 Expo 웹 번들까지 성공했으나 gstack headless Chromium이 세 차례 `exit 137`로 종료되어
  브라우저 검증은 완료하지 못했다. 이 문서의 `[x]` 완료 규칙에 따라 실기 항목을 완료로 과대 표기하지 않는다.
- `0007-defect-remediation-plan.md`는 `claude-opus-4.8-extra` 배타 소유이므로 Codex가 수정하지 않았다.
  소유 모델이 기기 실측 후 A1·D5·E2·E3·E4·E6·E7·F1 상태를 갱신해야 한다.

## 11. iOS Simulator 미리보기 실측 (2026-08-12)

- 환경: Xcode native Debug build, iPhone 17 Pro / iOS 26.5, Supabase 환경변수를 끈 로컬 미리보기.
- 화면: Today·Diary·Care·Reports·Settings의 주요 동작, KO/EN 전환, 반려동물 전환,
  다이어리 날짜·주간 보기·구조화 식사 저장/편집, 체크리스트 기록/취소, 투약 상태 변경,
  프리뷰 계정 필요 안내를 확인했다.
- 수정: Mochi 기록 편집 중 Luna로 전환할 때 편집 초안이 다른 반려동물에 남던 상태 누수를 차단하고,
  다이어리 notice가 문자열 대신 번역 key를 보관하도록 바꿔 언어 전환 시 즉시 재번역되게 했다.
- 수정: 사진이 없는 Luna와 실계정 반려동물이 Mochi의 개 사진을 공유하지 않도록, Mochi 전용 bundled
  image와 species별 중립 hero placeholder를 분리했다.
- 회귀 검증: Mochi 편집 → Luna 전환 후 빈 Luna 초안과 현재 언어 notice를 확인했고, Luna hero가 고양이
  placeholder로 표시되는 것을 화면·접근성 snapshot으로 확인했다.
- 네이티브 정리: Git 제외 대상 `apps/mobile/ios/`를 현재 Expo 설정으로 재생성하고 Pods를 동기화했다.
  재빌드는 diagnostic 0건으로 성공했고, 잘못된 SplashScreen image runtime 경고가 사라졌다.
- 최종 `npm run verify`: 통과 (336 source files, 133 presentation tests, 593 i18n keys,
  18 public tables, 48 markdown files).
- 남은 실기: 실제 기기의 알림 센터·백그라운드 수신과 23:30 기기 시간대 저장은 Simulator로
  증명할 수 없다. 이 항목과 최종 완료 판단은 0007 소유 모델의 QA 대상이다.

## 12. iOS Simulator 원격 실계정 QA (2026-08-12)

- 환경: iPhone 17 Pro / iOS 26.5 Debug 앱을 실제 호스팅 Supabase 프로젝트에 연결했다. 연결된 물리
  iPhone은 없었고, EAS CLI·배포 토큰도 구성되지 않아 TestFlight/실기기 빌드는 수행하지 않았다.
- owner 앱 흐름: 임시 계정으로 로그인해 원격 반려동물·사진·다이어리·투약·리포트를 불러왔고,
  정량 투약 완료 저장을 확인했다. 비밀번호 변경은 잘못된 현재 비밀번호 실패와 올바른 현재 비밀번호
  성공을 모두 확인했으며, 변경된 비밀번호로 다시 로그인했다.
- AI/리포트: 배포된 `generate-ai-brief`를 KO/EN 각각 실계정 JWT로 호출해 언어와 비진단 고지를
  확인했다. `generate-vet-report`가 생성한 7일 리포트의 다이어리·투약 집계, 앱 표시 기간,
  KO/EN 미리보기를 확인했다.
- caregiver 권한: 활성 caregiver 멤버십으로 원격 읽기와 다이어리 생성을 성공시켰다. 반려동물
  owner 전용 수정, 다이어리 삭제, 리포트 생성은 RLS/RPC/Edge Function 경계에서 모두 거부됐다.
- 원격 상태: 함수 5개의 ACTIVE 버전을 확인했다. 당일 migration 재조회는 pooler timeout과 DNS
  실패로 완료하지 못했지만, 기존 원격 migration 일치 기록과 실제 테이블·RLS·함수 호출을 검증했다.
- 정리: 테스트가 만든 owner/caregiver 계정, 데이터, 리포트, Storage 객체를 삭제하고 잔존 계정·펫이
  없음을 재확인했다. 기존 Simulator 사용자 데이터는 수정하지 않았지만 세션은 로그아웃 상태다.
