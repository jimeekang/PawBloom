# 품질 게이트

작업을 넘기기 전에 아래 명령을 실행한다.

```bash
npm run verify
```

Windows PowerShell에서는 필요하면 `npm.cmd`를 사용한다.

```powershell
npm.cmd run verify
```

## 필수 점검

- TypeScript typecheck
- Architecture boundary check
- i18n key parity
- AI safety wording check
- Supabase RLS/GRANT check
- Offline outbox contract check

## 리뷰 루프

1. 역할이 소유한 directory 안에서 구현한다.
2. 가장 작은 관련 검증을 먼저 실행한다.
3. 전체 검증을 실행한다.
4. 동작이 바뀌면 문서를 업데이트한다.
5. 제품, 법률, 의료, 릴리스 승인 결정만 escalate한다.

## Merge 기준

- `npm.cmd run verify`가 통과한다.
- Supabase 변경은 RLS, explicit GRANT, generated DB type, role matrix review를 포함한다.
- Edge Function 변경은 request/response contract와 AI safety wording check를 포함한다.
- Mobile UI 변경은 사용자 문구를 `apps/mobile/src/i18n/translations.ts`에 둔다.
- Cross-context 동작은 application use case나 domain event를 통해 연결한다.
