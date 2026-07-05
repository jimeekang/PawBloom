---
owner_model: codex-high
domain: implementation
edit_policy: exclusive
---

# 백엔드 엔지니어링

Supabase Edge Functions는 서버에서만 처리해야 하는 workflow를 담당한다. 모바일 앱은 service role key나 OpenAI API key를 **절대 직접 사용하지 않는다** — 이런 secret은 서버 환경(Edge Function)에만 존재하고, 클라이언트는 인증된 요청만 보낸다.

## Edge Functions

각 함수는 단일 책임을 가지며, 응답은 항상 구조화된 JSON만 반환한다.

### `generate-ai-brief`

- **책임**: 최근 diary, care, medication 데이터를 읽어 안전한 요약(brief)을 생성한다.
- **현재 구현 사실**: 이 함수는 **결정론적(deterministic) 템플릿 요약**이다. 즉 입력 기록을 정해진 템플릿에 채워 요약 문자열을 만들 뿐이며, **현재 LLM 호출은 0건**이다. ("AI briefing 생성"이라는 표현은 실제 동작과 다르므로 사용하지 않는다.)
- 향후 LLM을 도입하더라도 출력은 [AI 안전 정책](../product/AI_SAFETY.md)의 허용/금지/고지 규칙을 그대로 따라야 한다.

### `generate-vet-report`

- **책임**: 병원용으로 sanitized(민감 정보 제거)된 report와 공유 token을 생성한다.
- 생성된 report에는 AI 안전 고지문(→ [AI 안전 정책](../product/AI_SAFETY.md))을 포함한다.

### `get-vet-report`

- **책임**: 공유 token을 받아 해당 sanitized report **만** 읽어 반환한다.
- 원본 반려동물 데이터 전체가 아니라, 이미 sanitized된 report 결과만 노출한다.

## 서버측 인가 계약 (Authorization Contract)

모든 Edge Function은 아래 계약을 지킨다. 이 항목들은 보안 경계를 정의하므로 임의로 완화하지 않는다.

- **Service role key는 서버 환경에서만 사용한다.** 클라이언트 번들에는 절대 포함하지 않는다.
- **Service role 접근을 사용하기 전에 사용자 JWT를 검증한다.** 검증되지 않은 요청은 어떤 데이터도 읽지 않는다.
- **권한 판단에 `user_metadata`를 신뢰하지 않는다.** `user_metadata`는 클라이언트가 변경할 수 있으므로 인가 결정의 근거로 쓰지 않는다.
- **반려동물 데이터를 읽기 전에 `pet_members` membership을 확인한다.** 요청 사용자가 해당 pet의 멤버인지 서버에서 조회해 확인한 뒤에만 접근을 허용한다.
- **응답은 구조화된 JSON만 반환한다.** 자유 텍스트나 비정형 payload를 그대로 흘려보내지 않는다.
- **생성되는 모든 AI summary와 report에는 AI 안전 고지문을 포함한다.** (고지 문구 원문은 [AI 안전 정책](../product/AI_SAFETY.md) 참조.)

## Request/Response Contract 보호

- Edge Function의 request/response contract는 **typed wrapper**와 **contract test**로 보호한다.
- typed wrapper는 입출력 shape를 코드 레벨에서 강제하고, contract test는 함수와 클라이언트 사이의 계약이 깨지면 CI에서 실패하게 만든다.

## AI 출력 원칙

AI(또는 템플릿) 출력의 허용·금지 범위, 필수 고지 문구, 표현 원칙은 [AI 안전 정책](../product/AI_SAFETY.md)에 단일 원본으로 정의되어 있다. 백엔드는 그 규칙을 준수한다. (중복 서술을 두지 않는다.)
