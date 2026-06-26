# 0001 에이전트 우선 MVP 부트스트랩

## 목표

초기 리포지터리 하네스, Expo 앱 shell, Supabase schema, Edge Function skeleton, 검증 script를 만든다.

## 작업

- 리포지터리 안에서 바로 읽을 수 있는 문서 map을 추가한다.
- 역할별 수정 범위와 품질 gate를 추가한다.
- DDD 구조를 따르는 Expo MVP shell을 구현한다.
- GRANT와 RLS가 포함된 Supabase migration을 추가한다.
- AI briefing과 vet report를 위한 안전한 Edge Function stub을 추가한다.
- 검증 script를 추가하고 실행한다.

## 완료 기준

- `AGENTS.md`가 역할과 문서 진입점을 설명한다.
- `ARCHITECTURE.md`가 DDD 구조와 import 규칙을 설명한다.
- `apps/mobile`에 Expo 앱 구조가 있다.
- `supabase/migrations`에 초기 schema가 있다.
- `supabase/functions`에 AI/report 관련 skeleton이 있다.
- `npm.cmd run verify`가 통과한다.
