---
owner_model: claude-opus-4.8-extra
domain: planning
edit_policy: exclusive
---

# Clinic Report Value Proof — 통합 완료 설계

status: completed

두 개의 완료 설계를 하나로 통합한다. 기준(base)은 clinic-report value-proof(2026-07-04)이며, 06-28 diary/care edit-delete & dashboard 설계의 살아있는 제품 결정을 흡수한다. 대시보드 빠른동작/모드버튼과 Care status cycle 관련 결정은 후속 설계(home-today-simplification, 07-04 defaults)가 대체했다.

AI 안전 disclaimer 전문은 [AI_SAFETY.md](../../AI_SAFETY.md) 참조. 상세 파일 경로/npm 명령/테스트 항목은 아카이브 completion-log로 이관한다.

---

## Plan 1 — Clinic Report Value Proof (base)

- **완료일**: 2026-07-04
- **목표**: PawBloom의 첫 수익화 순간을 강화한다. 보호자가 일상/케어를 기록하면, 임상에서 바로 쓸 수 있는(clinic-ready) 안전한 기록 기반 vet report 미리보기를 본다. 일반 반려 다이어리와 경쟁하지 않는다. 핵심 가치 제안: **가족/보호자 기록이 진료 전 안전한 vet-ready 브리핑이 된다.** 이 슬라이스는 실제 결제/PDF/가족 초대/오프라인/새 AI 프롬프트를 구현하지 않는다 — "왜 돈을 낼 가치가 있는지"를 기존 앱 경험으로 증명한다.

### 핵심 결정

가치를 네 지점에서 가시화한다: (1) 가입 전 = 계정 생성 이유, (2) Today = 따뜻한 pet-first 유지하되 care/report readiness 인지 용이, (3) Care = 오늘 투약·report readiness가 긴 설정 폼보다 먼저, (4) Reports = 카운트 대시보드가 아니라 임상 아티팩트처럼 읽힌다.

**결정론적 report draft 필수 필드** (`reportDraftRecords.ts` 소유):

- timeline highlights (타임라인 하이라이트)
- missing record prompts (누락 기록 프롬프트)
- vet questions (수의사 확인 질문)
- English clinic summary preview — non-diagnosis 문구 포함 필수
- medication adherence count (투약 순응 카운트)

**Reports 화면 섹션 순서** (이 순서를 반드시 보존):

1. 상태 알림: draft / confirmed / shared / empty
2. Report 제목 + 날짜 범위
3. 전체 안전 disclaimer
4. English clinic summary preview
5. Timeline highlights
6. Missing record prompts
7. Vet questions
8. Compact metrics / adherence summary
9. Before-sharing checklist
10. 단계 전환 primary action
11. shared 단계의 mock share link 상태 — expiry 문구 + 명확한 "preview/mock" 표현

지표(metrics)는 compact. 큰 반복 카드는 숫자만이 아니라 의미 있는 텍스트를 담을 때만 허용.

**Condition trend는 의학적 개선 판단을 피하고 점수 이동 문구로 표기**:

- "점수 상승"
- "점수 하락"
- "점수 유지"

**Auth**: 사용자 대면 value bullets — 7일 vet report 미리보기 / 가족 care log / 안전한 기록 기반 요약. 주요 카피에 Supabase·RLS 언급 금지(있다면 하단 신뢰/지원 카피로만).

**Today**: hero 이미지가 감정적 첫 신호로 유지되되, 390px에서 pet name/메타데이터가 이미지 위에서 읽혀야 함(강한 하단 scrim 또는 text backplate). 완료/대기 투약 카드는 hero 아래 유지. 마케팅 랜딩 섹션 추가 금지.

**Care는 유료 가치 중심** — 긴 설정 폼이 아니라 매일의 치료 workspace. 상단 순서: (1) Care/Report segmented control → (2) Vet report readiness card → (3) Today medication list → (4) Quick medication record → (5) Care plan defaults → (6) Condition score + 기록 기반 요약.

### 390px 오버플로 수정 지점 + presentation guard 대상

- **Diary food**: meal별로 stack — meal label / provided grams / eaten grams (가로 clip 금지). `DiaryDetailPanel.tsx` 소유.
- **Care dose**: dose 필드 stack — prescribed/default amount / given today. `CareMedicationPanel.tsx` 소유.
- **Care setup**: medication name과 time picker를 clip 대신 stack. `CareSetupPanel.tsx` 소유.
- `scripts/verify-presentation-state.mjs`가 위 row 기반 오버플로 패턴을 정적으로 guard하며, 기존 checklist notice 테스트 항목을 보존한다.

**안전 문구 규칙**: report·care·AI-summary 표면은 전체 non-diagnosis disclaimer 상시 노출(전문은 AI_SAFETY.md). 관찰형 유지 — 허용: "기록상", "기록되지 않았습니다", "수의사에게 확인할 질문". 금지: 진단, 처방, 용량 변경 조언, "병원에 갈 필요 없음", 응급/질병 확신. 투약 카피는 prescribed/default·given-today를 기록할 수 있으나 용량 변경을 제안해서는 안 됨.

### 변경된 파일/영역

- `apps/mobile/src/contexts/report/application/reportDraftRecords.ts` — 결정론적 report summary 로직 소유.
- `apps/mobile/src/presentation/screens/ReportsScreen.tsx` — report 아티팩트 섹션 렌더.
- `apps/mobile/src/presentation/screens/CareModeScreen.tsx` — backend 변경 없이 report readiness 렌더.
- `DiaryDetailPanel.tsx` / `CareMedicationPanel.tsx` / `CareSetupPanel.tsx` — 모바일 폼 레이아웃 수정.
- `apps/mobile/src/i18n/translations.ts` — 모든 노출 카피.
- `scripts/verify-presentation-state.mjs` — 정적 presentation 회귀 guard.
- `PawBloomShell.tsx` 편집은 navigation/props 필요 시에만(무관한 dirty checklist-notice 변경 존재).

### 남은 후속 항목 (deferred)

실제 AI 생성 프롬프트 변경, 실제 share-token viewer 통합, PDF export, RevenueCat/StoreKit/Play Billing 등 실제 구독 결제, 가족/보호자 초대 전달, 오프라인 outbox 영속/replay, 네이티브 iOS/Android preview 빌드 생성. 이 항목들은 이 슬라이스에서 조용히 구현되어서는 안 됨.

---

## Plan 2 — Diary/Care Edit·Delete & Dashboard (흡수)

- **완료일**: 2026-06-28
- **목표**: 저장 후 기록 수정·삭제를 가능하게 한다. 시간·사료량·물량·변 횟수·투약량·투약 상태는 잘못 입력될 수 있으므로 보호자가 저장 뒤 정정/제거할 수 있어야 한다. Today를 일상 diary/care 작업용 대시보드로 강화한다. DB 모드와 로컬 preview 모드 모두 지원.

### 핵심 결정 (살아있음)

**"one recording UI" — 입력 폼 = 편집 폼 재사용 (원본 결정, 유효)**. 기존 diary 기록 또는 care 투약 기록을 탭하면 저장값이 로드된 동일 폼이 열린다. primary action이 create → update로 바뀌고 파괴적 delete 액션이 활성화된다. 사용자는 하나의 기록 UI만 배워 정정에 재사용한다.

- **Diary edit/delete**: 선택 날짜/주 목록의 각 기록 row가 탭 가능. 탭 시 카테고리 선택 → 상세 패널 열기 → 저장 상세값 로드 → memo·condition score 로드 → update/delete 노출. 편집 필드: 카테고리별 상세값, memo, condition 기록의 condition score, 기록 날짜, 기록 시간. 삭제는 확인 프롬프트 후 → row가 Diary 목록·Today 타임라인에서 사라지고 checklist가 남은 기록으로 재계산. 연결 사진은 이 단계에서 개별 편집 안 함.
- **Care medication edit/delete**: row 본문 탭 = 투약 편집 폼(condition/illness 명, medication 명, prescribed dose, administered amount, medication status, scheduled/recorded time, reaction/symptom/owner note 로드). compact status control은 빠른 상태 변경용으로 유지. 삭제는 확인 후 → Care Mode에서 사라지고 Today 투약 checklist·Reports draft가 남은 dose로 재계산.

**Today attention strip 신호 목록 (유효)** — Today는 세 질문에 빠르게 답해야 함: 오늘 무엇을 했나 / 무엇이 주의 필요한가 / report에 언급할 만큼 이상한 게 있나. attention strip은 전체 checklist 앞에서 중요 신호 표시:

- 낮은 condition score
- skipped 또는 partial medication
- no water record
- stool concern (변 우려)
- empty state: "오늘 주의 신호가 아직 없습니다."

**편집/삭제 권한 매트릭스 (Supabase 정책, 유효)** — UI는 실패를 평문 메시지로 노출하고 모든 협업자가 삭제 가능하다고 가정하지 않음:

- Diary update: owner/caregiver
- **Diary delete: owner**
- Medication dose update: owner/caregiver/pet sitter
- **Medication dose delete: owner**

**에러 처리 (유효)**: save 실패 시 폼 값 유지, delete 실패 시 기록 유지, 기존 prominent save feedback 패턴을 update/delete 성공에 재사용, delete는 파괴적 확인 프롬프트, 다른 곳에서 삭제되어 사라진 기록은 edit 모드 종료 후 목록 갱신.

### 후속 설계가 대체한 결정 (deprecated)

06-28 대시보드의 다음 요소는 **후속 설계(home-today-simplification, 07-04 defaults)가 대체**했으므로 이 문서에서 규범으로 채택하지 않는다:

- 대시보드 **quick actions**(add diary / record medication / view report 버튼 묶음).
- **모드 버튼** 및 대시보드 상단의 명시적 mode navigation.
- **Care status cycle** (row의 순환형 상태 토글 흐름).

이들은 07-04 defaults 및 home-today 단순화 결정으로 재정의되었다. 나머지 대시보드 순서(pet status hero → attention strip → today plan checklist → care summary → recent timeline)의 정보 신호는 유효하되, 상호작용 진입점은 후속 설계를 따른다.

### 변경된 파일/영역

- `apps/mobile/src/contexts/diary/application/diaryRecords.ts` — diary update/delete mutation, 기존 summary encode/decode 재사용, day·week/range·today 캐시 갱신, mutation 후 `diary` 쿼리 invalidate.
- `apps/mobile/src/contexts/medication/application/medicationDoseRecords.ts` — 투약 dose 전체 update mutation(기존 quick status mutation 유지), delete mutation, today 투약 캐시 낙관적 갱신, `medication_doses` 쿼리 invalidate.
- shell이 mutation을 조율해 UI는 presentation-focused 유지.

### 남은 후속 항목 (excluded)

사진 교체/개별 사진 삭제, Diary에서 프로필 기본 루틴 편집, 투약 편집 폼에서 care plan defaults 편집, 전체 audit history/undo, 현행 앱 계약을 넘는 오프라인 replay. 문서 갱신: `docs/exec-plans/active/0003-weekly-execution-checklist.md`에 diary/care edit-delete + Today 대시보드 개선 작업 항목 추가.

---

## Acceptance Criteria (통합)

- 가입 화면이 폼 제출 전 vet report / family log / safe summary 가치를 노출.
- Today hero 텍스트가 캡처된 390px viewport에서 가독.
- Diary food 입력이 390px에서 가로 clip 없음.
- Care dose/setup 입력이 390px에서 가로 clip 없음.
- Care 첫 viewport가 report readiness와 today medication을 setup보다 우선.
- Reports 첫 viewport가 임상 아티팩트·전체 disclaimer·English preview·primary action을 표시.
- Reports가 timeline highlights·missing records·vet questions·compact adherence/metric을 포함.
- confirmed/shared 상태는 real share token 연결 전까지 구체적이되 mock/preview로 명확 표기.
- 새 카피가 AI 안전 정책을 위반하지 않음.
- 저장 기록의 edit/delete가 동작하고, 편집/삭제 후 Today checklist·timeline·Reports draft·Care 목록이 동기 유지.
- `npm run verify` 통과. (전체 검증/테스트 명령·항목은 completion-log 참조.)
