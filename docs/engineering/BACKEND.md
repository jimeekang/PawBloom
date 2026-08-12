---
owner_model: codex-high
domain: implementation
edit_policy: exclusive
---

# 백엔드 엔지니어링

Supabase Edge Functions는 서버에서만 처리해야 하는 workflow를 담당한다. 모바일 앱은 service role key나 OpenAI API key를 **절대 직접 사용하지 않는다** — 이런 secret은 서버 환경(Edge Function)에만 존재하고, 클라이언트는 인증된 요청만 보낸다.

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
