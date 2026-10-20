---
owner_role: codex
domain: implementation
edit_policy: exclusive
---

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
- i18n key parity + 미사용 key 0건
- Presentation state/회귀 동작 test
- AI safety wording check
- Secret hard-code check
- Supabase RLS/GRANT check
- Offline outbox 실행 모드·계정 격리·충돌 contract check
- Docs governance check (`verify:docs` — md 300줄 제한 + owner_role 배타 소유 frontmatter)

## 리뷰 루프

1. 역할이 소유한 directory 안에서 구현한다.
2. 가장 작은 관련 검증을 먼저 실행한다.
3. 전체 검증을 실행한다.
4. 동작이 바뀌면 문서를 업데이트한다.
5. 제품, 법률, 의료, 릴리스 승인 결정만 escalate한다.

`npm run verify`는 정적·자동화 게이트다. 실제 iOS/Android 알림 센터, 권한, 키보드, VoiceOver/TalkBack, 기기 시간대와 실계정 owner/caregiver 교차 역할은 development build/TestFlight의 별도 실기 QA로 확인한다.

## Merge 기준

- `npm.cmd run verify`가 통과한다.
- Supabase 변경은 RLS, explicit GRANT, generated DB type, role matrix review를 포함한다.
- Edge Function 변경은 request/response contract와 AI safety wording check를 포함한다.
- Mobile UI 변경은 사용자 문구를 `apps/mobile/src/i18n/translations.ts`에 둔다.
- Cross-context 동작은 application use case나 domain event를 통해 연결한다.

## 아바타 첫 버전 검증 계획 (2026-10-18, 미실행)

단계별 항목은 [0003](../exec-plans/active/0003-weekly-execution-checklist.md),
파일·실패별 항목은 [0009](../exec-plans/active/0009-avatar-care-memories-implementation.md)를 따른다.
검증 계획 작성은 통과·출시 승인과 구분한다.

| 범위 | 필수 동작 증거 |
| --- | --- |
| 아바타 | 실제 사진 생성·닮음·동작 일관성, 중복 비용/timeout/재시도·삭제 후 결과 차단 |
| 공간 | 탭/드래그/가로 탐색·경계·겹침·목록 대안, 0/1/3/6마리·그 이상 |
| 케어 | 정확한 pet/date 저장, 늦은 응답·초안·offline, 전 아이 일정·투약 상태·알림 대상 |
| 추억 | 전체 한 번·아이별 연결, legacy 편집, 작성자·공유 범위·복수 태그·한도·revision |
| 권한 | 일부 pet 권한·직접 junction/media 접근·동시 멤버 변경·회수·타 계정·sitter/viewer 차단 |
| 삭제 | 새 bucket/job·미참조 파일·계정별 초안, 공동 추억 전체 삭제·익명화·멱등 cleanup |
| 실행 화면 | KO/EN·긴 이름·좁은 폰·큰 글자·해당 태블릿 폭·빈/로딩/실패·키보드 |
| 접근성/모션 | VoiceOver/TalkBack·닫기 focus·Android back·reduce motion·background 정지 |

- 기존 runner `node scripts/run-presentation-test.mjs <test-path>`를 재사용하고 실제 동작/인자를 검증한다.
- DB/Storage 역할 테스트는 직접 허용/거부를 확인한다. migration 문자열 검사만으로 대체하지 않는다.
- 신규 기능의 tests를 해당 verify script에 연결하고 파일명/문자열에 고정된 기존 가드도 새 동작 계약으로 맞춘다.
- 현재 package.json의 전체 verify에는 `verify:release`도 포함된다. typecheck부터 docs까지 실행·exit code를 확인한다.
- `verify:release`는 release 설정 검증이며 원격 배포 완료 증거가 아니다.
- 생성은 fixture/parser 테스트와 실제 제공자 왕복을 구분한다. 미구성 제공자를 mock 성공으로 완료 처리하지 않는다.
- iOS/Android development build에서 조작하고 물리 기기 알림·백그라운드·시간대는 별도 실측한다.
- 여러 아이 모션·드래그의 프레임·입력 반응·메모리·비활성 중단을 M0 기준선과 비교한다.
- Auth/삭제/offline 관련 기존 미커밋 회귀를 유지한다. 코드 구현 후 확인하지 못한 항목은 미완료로 남긴다.
