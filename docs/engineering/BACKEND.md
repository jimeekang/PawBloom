---
owner_role: codex
domain: implementation
edit_policy: exclusive
---

# 백엔드 엔지니어링

Supabase Edge Functions는 서버에서만 처리해야 하는 workflow를 담당한다. 모바일 앱은 service role key나 Claude(Anthropic) API key를 **절대 직접 사용하지 않는다** — 이런 secret은 서버 환경(Edge Function)에만 존재하고, 클라이언트는 인증된 요청만 보낸다.

## Edge Functions

각 함수는 단일 책임을 가진다. 인증된 앱 API는 구조화된 JSON을 반환하고, 공개 병원 리포트 링크는 플랫폼이 지원하는 읽기 전용 텍스트 문서를 기본으로 반환한다.

### `generate-ai-brief`

- **책임**: 최근 diary, care, medication 데이터를 읽어 안전한 요약(brief)을 생성한다.
- **현재 구현 사실**: 이 함수는 **결정론적(deterministic) 템플릿 요약**이다. 즉 입력 기록을 정해진 템플릿에 채워 요약 문자열을 만들 뿐이며, **현재 LLM 호출은 0건**이다. ("AI briefing 생성"이라는 표현은 실제 동작과 다르므로 사용하지 않는다.)
- 향후 LLM을 도입하더라도 출력은 [AI 안전 정책](../product/AI_SAFETY.md)의 허용/금지/고지 규칙을 그대로 따라야 한다.

### `generate-vet-report`

- **책임**: 병원용으로 sanitized(민감 정보 제거)된 report 초안을 생성한다.
- 초안 생성 단계에서는 공유 token을 만들지 않는다. 보호자가 초안을 확인한 뒤에만 별도 상태 함수가 만료 token을 발급한다.
- 생성된 report에는 AI 안전 고지문(→ [AI 안전 정책](../product/AI_SAFETY.md))을 포함한다.

### `get-vet-report-state`

- **책임**: 보호자 전용 report 상태 조회, 확인 후 공유 token 발급, 활성 token 폐기를 담당한다.
- token 발급·교체·폐기는 서비스 전용 원자 RPC를 사용하며 응답은 `Cache-Control: no-store`로 반환한다.

### `get-vet-report`

- **책임**: 공유 token을 받아 해당 sanitized report **만** 읽어 반환한다.
- 원본 반려동물 데이터 전체가 아니라, 이미 sanitized된 report 결과만 노출한다.
- 브라우저 요청에는 정돈된 안전한 텍스트 문서를 기본 반환하고, 앱의 명시적 검증 요청(`format=json`)에만 계약 검증된 JSON을 반환한다. Supabase Edge Function은 HTML 응답을 plain text로 강제하므로 HTML 태그를 반환하지 않는다.
- 만료되거나 폐기된 token, 아직 공유 상태가 아닌 report는 거부하며 모든 응답을 캐시 금지한다.

### `manage-pet-members`

- **책임**: owner가 반려동물 구성원을 조회하고 caregiver를 초대·제거하는 명령을 처리한다.
- 호출자 JWT와 `pets.owner_id`를 모두 확인한다. 초대는 활성 Family entitlement가 있을 때만 허용하고, owner membership은 제거할 수 없다.
- 초대 대상 이메일 조회와 Auth 초대는 service role을 가진 함수 내부에서만 수행한다. 성공한 초대·제거는 `audit_events`에 남긴다.

### `delete-account`

- **책임**: 인앱 계정 삭제 요청을 처리한다. 호출자 JWT를 확인한 뒤 사용자가 소유한 모든 pet의 `pet-media` 객체를 재귀 삭제하고 Auth user를 삭제한다.
- 사용자가 소유한 pet과 하위 데이터는 cascade 삭제한다. 다른 owner의 pet에 남긴 기록은 유지하되 `created_by`가 `ON DELETE SET NULL`로 익명화된다.
- 앱은 성공 후 해당 계정의 로컬 식사·투약 알림을 취소하고 세션을 종료한다.

## 서버측 인가 계약 (Authorization Contract)

인증된 앱 함수와 공개 report viewer는 아래 계약을 지킨다. 이 항목들은 보안 경계를 정의하므로 임의로 완화하지 않는다.

- **Service role key는 서버 환경에서만 사용한다.** 클라이언트 번들에는 절대 포함하지 않는다.
- **인증된 함수는 service role 접근 전에 사용자 JWT를 검증한다.** 공개 `get-vet-report`만 예외이며, 이 함수는 만료·폐기 상태를 확인한 share token으로 sanitized report 한 건만 읽는다.
- **권한 판단에 `user_metadata`를 신뢰하지 않는다.** `user_metadata`는 클라이언트가 변경할 수 있으므로 인가 결정의 근거로 쓰지 않는다.
- **반려동물 데이터를 읽기 전에 `pet_members` membership을 확인한다.** 요청 사용자가 해당 pet의 멤버인지 서버에서 조회해 확인한 뒤에만 접근을 허용한다.
- **owner 전용 명령은 membership role만 믿지 않는다.** 구성원 관리처럼 소유권이 필요한 명령은 `pets.owner_id`가 호출자와 같은지 확인한다.
- **인증된 앱 API 응답은 구조화된 JSON만 반환한다.** 공개 텍스트 문서는 동일한 정규화 report payload에서만 렌더링한다.
- **생성되는 모든 AI summary와 report에는 AI 안전 고지문을 포함한다.** (고지 문구 원문은 [AI 안전 정책](../product/AI_SAFETY.md) 참조.)

## Request/Response Contract 보호

- 앱의 Edge Function 호출은 각 context의 application 경계에 둔다. presentation에서 provider를 직접 호출하지 않는다.
- 응답 데이터는 `unknown`으로 받은 뒤 runtime parser로 검증한다. 여러 필드를 받는 함수는 request parser·response parser·contract test를 함께 둔다.
- `delete-account`처럼 body가 없고 성공 여부만 필요한 명령은 응답 payload를 앱 상태로 사용하지 않고 HTTP 성공/실패만 처리한다.

## AI 출력 원칙

AI(또는 템플릿) 출력의 허용·금지 범위, 필수 고지 문구, 표현 원칙은 [AI 안전 정책](../product/AI_SAFETY.md)에 단일 원본으로 정의되어 있다. 백엔드는 그 규칙을 준수한다. (중복 서술을 두지 않는다.)

## 아바타 생성·공동 추억 계약

아바타 생성은 로컬 구현 계약이며 원격 배포 여부와 구분한다. 공동 추억의 목표 범위는
[0009](../exec-plans/active/0009-avatar-care-memories-implementation.md)를 따른다.

### 아바타 요청·상태·적용

- `generate-pet-avatar`는 JWT·현재 owner·job requester·동의 버전·사진 크기/MIME/매직바이트와 사용자별 최근 24시간 롤링 10회 한도를 검증한다.
- 소유권은 만료 처리보다 먼저 확인한다. queued 사진이 5 MiB를 넘으면 claim에서 한도를 소비하지 않고 실패하며, ready 재호출도 추가 한도를 소비하지 않는다.
- 앱은 `prepare_pet_avatar_job` → private `pet-avatars` 업로드 → 함수 동기 호출을 수행한다. `ready` job 재호출은 기존 결과를 돌려준다.
- 서버만 Claude(Anthropic) API의 `claude-sonnet-5-5`를 호출한다. Edge 의존성은 SDK `1.3.0`·zod `4.6.7`로 고정한다. 사진에서 외형 옵션을 고르는 창작 처리이며 건강·감정·통증·나이·품종을 판정하지 않는다.
- `messages.create`에 structured output format을 전달하고 응답의 stop_reason을 JSON/schema 파싱보다 먼저 확인한다. refusal은 재시도하지 않고 다른 제공자 실패는 시도당 60초·최대 2회로 제한한다. 사용하지 않는 rationale은 요청·저장에서 제외한다.
- 응답의 appearance enum은 앱 계약과 검증 스크립트로 동기화한다. 결과는 `parametric-v3` manifest로 저장하며 이미지 결과 파일은 만들지 않는다.
- 사진·프롬프트는 DB에 저장하지 않는다. 제공자 기록은 model·stop_reason·usage·request_id만 남기고 생성 완료 후 소스 사진 객체를 삭제한다. 비밀·provider 원문·사진은 응답/로그로 내보내지 않는다.
- 서버는 제공자 전송 직전에 JPEG APP1·APP3–13·APP15·COM, PNG tEXt·zTXt·iTXt·eXIf, WebP EXIF·XMP 메타데이터를 제거한다. JPEG APP2(ICC_PROFILE)·APP14(Adobe), PNG iCCP·sRGB·gAMA·cHRM, WebP ICCP 색 정보는 보존하며 VP8X ICC flag를 실제 ICCP 존재와 맞춘다. EXIF orientation은 제거하고 별도 회전 보정은 하지 않는다. 정리 로그에는 실제 제거된 종류·개수·바이트 수만 남긴다. 색 정보·픽셀 payload 보존, 멱등성과 malformed 거부를 단위 테스트로 확인한다.
- 결과 적용은 사용자 확인 뒤 `apply_pet_avatar` owner 전용 원자 명령으로 수행한다. 적용 전 기존 캐릭터를 유지하며, 앱은 미적용 최신 24시간 결과를 복구한다.
- `CLAUDE_API_KEY`는 서버 전용이다. 원격 환경은 Supabase Dashboard → Edge Functions → Secrets에서 등록한다. 로컬은 `supabase functions serve generate-pet-avatar --env-file <서버-비밀-파일-경로>`로 전달하며 JWT 검증을 유지한다. 비밀 파일은 출력·복사하거나 저장소에 추가하지 않는다.

### 미완료 소스 사진 정리와 운영 조건

- migration `20261031111909_avatar_global_source_cleanup.sql`의 전역 sweep은 기존 매분 cron `pawbloom-account-deletion-cleanup`의 실행 경로를 재사용한다. 새 스케줄러·비밀은 추가하지 않는다.
- queued는 소스 생성 후 1시간, processing은 소스 생성 후 1시간이면서 admitted 시작 시각(없으면 updated_at) 이후 10분이 지난 경우 만료한다. sweep은 분당 최대 100건을 처리하고 같은 durable cleanup worker가 계정 삭제 loop 전에 resource drain을 우선 실행한다.
- 미완료 사진의 2시간 내 삭제는 기존 cron·worker URL/secret·함수 배포가 정상이고 Storage가 가용하며 추가 queue 대기가 48분 미만인 조건에서의 운영 목표다. backlog가 없을 때 약 72분은 설계 모델이며 전체 자동 삭제의 실측 시간이 아니다. 무제한 backlog·설정 누락·장애에서는 2시간을 보장하지 않는다.
- 로컬은 Vault의 worker URL/secret이 미설정이어서 cron의 자동 HTTP 실행을 검증하지 못했다. 전역 DB sweep → 기존 worker의 수동 실제 Storage drain 연결은 소스 사진 3개와 기존 backlog 800건을 포함한 803건 ACK·queue 0건으로 확인했다. 원격 운영에서는 기존 worker 설정·배포·가용성을 별도로 확인한다.

### 개별 검증 증거

- 실제 SDK·가짜 fetch의 텍스트 refusal 테스트는 호출 1회로 거부를 반환했다. 관련 TypeScript 테스트 5개는 skip 0건으로 통과했다.
- 실제 PNG 호출은 3,764ms·confidence 0.82, EXIF JPEG 호출은 2,105ms·confidence 0.85이며 각각 입력 1,497/출력 117토큰이었다. 양쪽 모두 request_id·provider_raw 4개 키만 저장하고 DB 적용·소스 0건·rationale 미저장을 확인했다.
- 실제 JPEG는 APP1 2개 180바이트·APP13 1개 58바이트를 제거해 22,302→22,064바이트로 전송했다. PNG/WebP metadata 제거·픽셀 payload 보존·malformed 검증도 통과했다. 이 개별 경로 증거와 전체 게이트·reviewer/integrator 최종 판정·원격 출시 판단은 최종 보고에서 구분한다.

### 공동 추억 명령

- `prepare-memory` / `publish-memory` / 수정·삭제 RPC는 모든 pet 권한·태그·작성자·revision을 검증한다.
- 준비 단계는 draft·태그·허용 파일을 예약한다. published 전에는 작성자만 조회한다.
- 생성/태그 변경 시 같은 활성 owner/caregiver 사용자 집합인지 검증한다. 일부 아이만 접근 가능한 요청은 전체 거부한다.
- 모든 태그 아이에 현재 owner/caregiver 권한이 있는 사람만 published 본문·태그·media를 조회한다.
- 멤버 변경과 추억 명령은 같은 pet 행을 정렬 순으로 잠그고 잠금 후 재검사해 경쟁을 막는다.
- publish는 실제 업로드·object 소유·파일 한도·참조를 확인한다. legacy photo와 새 memory가 같은 한도 검사를 사용한다.
- 클라이언트가 `created_by`, 공개 범위, Storage 소유권을 임의 지정해 권한을 확장하지 못하게 한다.
- 동일 mutation 중복은 기존 결과를 반환한다. 일부 업로드 실패는 unpublished draft로 남기고 미참조 객체만 정리한다.

### 삭제·기존 함수 회귀

- `delete-account`의 기존 durable cleanup에 새 bucket/job/초안 수명주기를 연결한다. 객체 경로는 행 삭제 전에 영속화한다.
- pet 삭제는 해당 job/asset과 그 pet을 포함한 공동 추억 전체를 삭제 대상으로 삼는다. 태그만 떼어 공개 범위를 넓히지 않는다.
- 타인 pet의 단독 기여는 기존 nullable 작성자 익명화 원칙을 유지하고 타인 pet 자체는 삭제하지 않는다.
- 삭제 중 callback·poll·publish가 데이터를 복원하지 못하게 tombstone/삭제 상태를 재검사한다.
- `manage-pet-members`의 기존 Family gate는 정책 확정 전 유지한다. UI만 열어 서버 gate를 우회하지 않는다.
- `generate-ai-brief`/report는 기존 아이별 clinical source를 유지한다. 공동 추억·avatar·연출 문구를 자동 입력으로 넣지 않는다.
- 새 함수·RPC에는 parser·계약·역할·실패 테스트를 추가한다. 원격 배포 전 RLS/개인정보 강한 리뷰와 승인이 필요하다.
