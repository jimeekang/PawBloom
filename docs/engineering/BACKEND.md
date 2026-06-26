# 백엔드 엔지니어링

Supabase Edge Functions는 서버에서만 처리해야 하는 workflow를 담당한다. 모바일 앱은 service role key나 OpenAI API key를 절대 직접 사용하지 않는다.

## Edge Functions

- `generate-ai-brief`: 최근 diary, care, medication 데이터를 기반으로 안전한 AI briefing을 생성한다.
- `generate-vet-report`: 병원용 sanitized report와 공유 token을 생성한다.
- `get-vet-report`: 공유 token으로 sanitized report만 읽는다.

## 규칙

- Service role key는 서버 환경에서만 사용한다.
- Service role 접근을 사용하기 전에 사용자 JWT를 검증한다.
- 권한 판단에 `user_metadata`를 신뢰하지 않는다.
- 반려동물 데이터를 읽기 전에 `pet_members` membership을 확인한다.
- 응답은 구조화된 JSON만 반환한다.
- 생성되는 모든 AI summary와 report에는 AI 안전 고지문을 포함한다.
- Edge Function request/response contract는 typed wrapper와 contract test로 보호한다.

## AI 출력 원칙

- AI는 기록 기반 요약만 제공한다.
- 진단, 처방, 약 용량 조정, 응급 여부 단정은 금지한다.
- 수의사에게 물어볼 질문은 제안할 수 있다.
- 누락된 기록과 반복된 관찰은 조심스러운 표현으로만 설명한다.
