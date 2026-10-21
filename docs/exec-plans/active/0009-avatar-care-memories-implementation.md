---
owner_role: codex
domain: implementation
edit_policy: exclusive
---

# 0009 아바타·실제 케어·공동 추억 구현 계획

- 작성: 2026-10-18. 사용자가 승인한 채팅 방향을 실행 가능한 문서로 반영한다.
- 상태: **M1 로컬 완료(원격 미적용), M3·M4 로직 완료, 화면 진행 중 (2026-10-21)**. 재개는 §13. 단계 상태는 [0003](0003-weekly-execution-checklist.md)만 갱신한다.
- 정본: [제품](../../product/PRODUCT_SPEC.md), [화면 UX](../../design/AVATAR_HOME_UX.md), [로드맵](0002-mvp-roadmap.md).
- 이 문서는 다음 구현의 진입점이다. 0007/0008/APP_FIX의 완료 이력과 남은 안전·출시 검증은 승계한다.
- 기존 소유 frontmatter(owner_role/domain/edit_policy)를 유지한다. 이번 요청은 해당 문서의 내용 갱신이며 라우팅 정책 변경이 아니다.

## 1. 확인한 기반과 구현 원칙

| 현재 기반 | 재사용·필요 변경 |
| --- | --- |
| `presentation/PawBloomShell.tsx`, `shell/useShellPetSelection.ts` | 현재 activePet 중심 조합. 다중 홈·명시적 petId 탐색과 아이 상세로 분리 |
| `presentation/ui/BottomNav.tsx` | today/diary/care/reports/settings 다섯 탭을 네 메뉴로 변경 |
| `contexts/pet/application/profilePhotoUrl.ts`, `contexts/identity/application/useAuthActions.ts` | 프로필·사진·pet 선택·생성 경로 재사용, 촬영 흐름은 실제 호출부 확인 후 연결 |
| `contexts/diary/**`, `routine/**`, `care/**`, `medication/**` | 기존 저장·수정·날짜·초안·투약 경계를 재사용, 전체 케어 조회 추가 |
| `contexts/media/application/mediaUpload.ts`, `mediaCleanup.ts` | 파일 검증·private upload·실패 정리 재사용, memory 자원 권한 추가 |
| `contexts/pet/application/petMembers.ts`, `manage-pet-members` | 기존 역할/초대 정책 유지, 복수 태그 원자 검증과 멤버 변경 동시성 보강 |
| `contexts/briefing/**`, `report/**`, `generate-ai-brief` | 현재 템플릿 요약·리포트 재배치. 새 LLM 도입은 범위 밖 |
| `contexts/sync/**`, `identity/application/*Account*` | 계정별 outbox·replay 장벽·삭제 보존. 새 초안/객체 수명주기까지 확장 |

위 경로는 `apps/mobile/src/` 기준이며 서버 함수는 `supabase/functions/` 기준이다.
실제 파일과 미커밋 작업을 다시 확인하고 기존 수정분을 보존한다. 과거 plans의 없는 `packages/backend` 경로를 전제로 만들지 않는다.
`avatar`, `memory` 두 context만 추가한다. 방/제스처/개인 배치는 presentation에 둔다.
UI는 타 context UI/application을 직접 끌어오지 않고 presentation 조합·application use case로 연결한다.
새 game engine·실시간 room 서버·범용 reward framework를 도입하지 않는다.

## 2. 목표 흐름과 경계

```text
사진 → avatar application → 인증/owner 검증 → 생성 job → 비공개 asset → 확인/적용
petId + 적용 asset → 우리 집(개인 배치) → 아이 요약/상세
                                    ├→ 기존 케어/diary/투약 → 기존 요약/report
                                    └→ memory 작성 → 태그/공개범위 검증 → 가족 추억
```

계정·pet ID가 원본이며 캐릭터 좌표/그림을 데이터 식별자로 사용하지 않는다.
케어 저장은 시작 시 petId/date/mutationId를 고정한다. 전환·재시도·늦은 응답이 다른 아이를 바꾸지 않는다.
공동 추억은 의료 source가 아니다. 기존 photo/memo는 source=`diary`로 표시하고 원래 편집기로 보낸다.

## 3. M0 — 기준선과 생성 자산 선행 검증

- 기존 `npm run verify`, 계정/삭제/offline/release diff와 기존 동작의 기준선을 남긴다.
- 대표 개·고양이 사진으로 한 스타일의 닮음·투명 배경·앵커·프레임 크기·idle/walk/sit/반응 일관성을 검증한다.
- 재생성 시 같은 아이로 인식되는지와 저사양 폰에서 여러 캐릭터를 조작하는지 실측한다.
- 생성 서비스는 아직 미선정이다. 최대 해상도/파일 크기/비용·재시도 한도/처리 시간/보관·학습·삭제 조건을 확정한다.
- 제공자 secret을 앱 번들에 넣지 않는다. 사진 외부 전송 전 고지·동의, 서버 secret, 동의/정책 버전을 설계한다.
- 오래 걸리는 작업은 영속 job + provider job ID/상태 조회로 복구한다. 응답 후 무제한 Edge background task에 의존하지 않는다.
- 제공자가 필요한 규격을 못 만들면 방식 재검토. 정적 샘플을 실제 사진 생성 성공으로 대체하지 않는다.
- 실제 API/SDK 사용 시 그 시점 공식 문서와 설치 버전을 확인한다. 현재 계획은 특정 제공자 API 계약이 아니다.

## 4. M1 — 데이터·원자 명령·권한

상세 제안은 [DATABASE](../../engineering/DATABASE.md)의 목표 모델을 따른다. 테이블/명령은 **신규 예정**이다.

| 예정 자원 | 책임 |
| --- | --- |
| `pet_avatar_jobs` | petId·요청자·idempotency·source·동의 버전·provider ID·처리 상태/오류 |
| `pet_avatars` | petId·jobId·스타일/manifest 버전·검증된 비공개 자산·적용 상태 |
| `memories` | 본문·발생일/시각·nullable 작성자·draft/published·client mutation·수정 버전 |
| `memory_pets` | memory↔pet 연결. 최소 하나, 중복 금지, 공개 범위 검증 단위 |
| `memory_media` | memory별 파일·순서·MIME·크기·mutation 소유권·삭제 상태 |

- 기존 diary/dose ID·유일성·원본 사진을 유지한다. 신규 migration은 additive이며 구버전 앱을 먼저 깨지 않는다.
- 생성/적용은 owner만, asset 조회는 기존 pet 열람 조건을 따른다. job 원문·provider 오류/secret은 일반 응답에서 제외한다.
- 새 추억은 모든 대상에서 owner/caregiver인 작성자만 만든다. 편집은 작성자 또는 모든 대상의 owner, 삭제도 같은 기준이다.
- 다른 caregiver의 작성물을 임의 수정하지 않는다. 삭제된 작성자는 표시만 익명화하고 승인된 공동 기여를 보존한다.
- 복수 태그 생성/변경 시 활성 owner/caregiver 사용자 집합이 같은지 서버에서 확인한다. 역할은 아이별로 재검사한다.
- published 조회는 **모든 태그 아이에 현재 권한이 있는 사람**만 허용한다. 집합이 달라져도 공통 권한자는 조회하고 일부 권한자는 차단한다.
- parent뿐 아니라 junction/media·Storage 서명 발급에도 같은 조건을 강제한다. vet viewer와 제한 sitter에 추억 권한을 추가하지 않는다.
- 추억 명령과 멤버 변경은 정렬된 pet 행을 같은 순서로 잠그고 잠금 후 권한을 재조회한다. 생성/변경 경쟁으로 검증을 우회하지 않는다.
- `prepare-memory`는 태그/권한/파일 예약과 draft를 원자 생성하고, 업로드 후 `publish-memory`가 존재·소유·한도를 재검사한다.
- draft는 작성자만 읽는다. 실패·재시도는 같은 mutation으로 복원하고 완성되지 않은 추억을 가족 feed에 노출하지 않는다.
- public table은 explicit GRANT·RLS·index·generated type·역할 테스트와 함께 추가한다. 클라이언트의 직접 junction 변경은 금지한다.
- private bucket `pet-avatars`와 `memory-media`를 사용한다. 기존 pet-media 정책을 새 공동 사진에 그대로 적용하지 않는다.
- UI 표시용 서명 URL을 DB에 저장하지 않는다. 원본 path나 provider 결과 URL을 무검증으로 신뢰하지 않는다.

## 5. M2 — 사진 생성·교체

예정: `contexts/avatar/{domain,application,infrastructure,ui}/`, `generate-pet-avatar` 요청/상태·적용 계약.

- `PetOnboardingScreen.tsx`, 기존 프로필 사진 선택 경로에서 기존/신규 pet 모두 진입한다.
- 입력 크기·MIME·이미지 decode·pet 소유·저장 위치·재시도 한도는 서버 검증한다.
- job 상태는 queued/processing/ready/failed/cancelled로 구분하고 조회로 앱 재시작을 복구한다.
- 같은 mutation 중복 호출은 추가 생성 비용을 만들지 않는다. 제공자 요청의 idempotency/불명확한 timeout도 처리한다.
- 준비된 결과를 확인해야 적용된다. 원자 적용으로 한 pet의 현재 캐릭터는 하나이고 이전 적용본은 새 성공 전까지 유지한다.
- 다른 pet/계정의 늦은 결과를 적용하지 않는다. pet/계정 삭제 후 callback·poll 결과가 데이터를 재생성하지 못하게 한다.
- manifest·이미지 크기·프레임·내용을 검증하고 외부 URL 수집은 신뢰된 제공자 주소·리다이렉트·파일 한도로 제한한다.
- 실패하면 기존/기본 캐릭터·기록 기능을 유지하고 provider 원문 대신 EN/KO 오류 코드를 표시한다.

## 6. M3 — 네 메뉴·우리 집·아이 상세

기존 수정: `PawBloomShell.tsx`, `ui/BottomNav.tsx`, `shell/ShellHeaders.tsx`, `shell/useShellPetSelection.ts`, `shell/useAndroidBackNavigation.ts`.
예정 화면: `screens/HouseScreen.tsx`, `PetDetailScreen.tsx`; 공간/선택/배치는 `presentation/house/`로 분리한다.

- route는 네 main tab과 선택 petId/detail section을 명시한다. 순환 선택만으로 대상 진입을 구현하지 않는다.
- 캐릭터 탭→요약창→케어/추억/프로필, 기록+는 대상 선택 또는 현재 pet 확인을 거친다.
- 긴 누름 이후 드래그와 배경 가로 탐색을 구분한다. 드래그 동안 배회 정지, 종료 탭 억제, 경계 clamp·안전 위치 복구.
- 기본 배치는 결정론적으로 만들고 저장은 userId/petId/기기·레이아웃 버전별 정규화 좌표로 한다. 서버 동기화는 없다.
- 0/1/3/6마리와 그 이상을 확인한다. 6마리는 성능 검증 표본이며 새 등록 한도가 아니다.
- 이름·터치 영역·목록 대안, 큰 글자·접근성 이름·focus 복귀·Android back를 함께 구현한다.
- 모션은 화면이 보일 때만 실행하고 프레임마다 전체 React state/query를 갱신하지 않는다.
- 정지 설정·OS reduce motion·background에서 배회를 멈춘다. 고정 상태에서도 정보와 기록은 완전하다.
- 기존 diary draft·정렬·날짜·사진 편집 동작을 새 navigation에서도 보존한다.

## 7. M4 — 전체 케어·알림·브리핑

기존 `routine/care/medication/diary/briefing/report` use case와 `HomeDashboardPanel.logic.ts` 정렬 계약을 재사용한다.
예정 `screens/TodayCareScreen.tsx`가 다중 pet 조회를 조합한다. 기존 activePet hook을 반복 전환해 데이터를 모으지 않는다.

- user+pet별 cache와 전체 목록 invalidation을 연결한다. 일부 아이 로드 실패를 전원 0건으로 표시하지 않는다.
- routine/예정 schedule/실제 dose를 구분하고 동일 schedule/date의 중복 완료·정렬·시간대 규칙을 유지한다.
- 알림 응답 handler는 `localNotificationBootstrap.ts`의 표시 설정과 분리해 shell에서 연결한다.
- cold start·로그인 대기·권한 회수·삭제 일정은 안전하게 처리하고 재사용 ID로 다른 아이를 열지 않는다.
- 기록 이동은 완료 처리와 분리한다. 현재 템플릿 브리핑과 확인/공유/폐기 리포트는 선택 pet의 기존 경로를 사용한다.
- 약·돌봄 숫자와 캐릭터 반응/추억 수를 분리한다. 누락·건너뜀·부분 복용을 성공으로 바꾸지 않는다.

## 8. M5 — 가족 공동 추억·초안·기존 자료

예정: `contexts/memory/{domain,application,infrastructure,ui}/`, `screens/MemoriesScreen.tsx`.

- 사진 또는 비어 있지 않은 메모, 발생일/시각, 작성자, 태그, 공개 범위를 입력·검증한다.
- 전체는 memoryId로 한 번, 아이별은 junction으로 필터한다. joined row 수로 추억/사진 수를 중복 집계하지 않는다.
- 최초 한도는 기존 기준인 **아이별 로컬 날짜당 사진 5장**을 유지한다. legacy photo와 published memory 사진을 합산한다.
- 복수 태그 사진은 각 아이 한도에 각각 계산한다. 태그/날짜 변경·동시 업로드도 원자 한도 검사를 거친다.
- 기존 photo RPC와 새 publish 명령이 같은 pet/date 잠금·한도 계산을 사용하게 확장해 두 경로 우회를 막는다.
- 기존 photo/memo는 read adapter로 합쳐 표시하고 원래 편집기로 연결한다. 자동 복사·의료 집계 확대를 하지 않는다.
- 메모·선택 사진은 userId별 초안에 저장한다. 임시 picker URI를 그대로 믿지 않고 계정별 앱 보관 파일로 복사한다.
- 온라인 재시도는 사용자 행동으로 실행한다. background photo outbox는 추가하지 않고 기존 care outbox contract를 유지한다.
- 부분 업로드·취소 시 미참조 파일만 정리한다. 실패 초안·시각·태그·mutation은 보존하고 로그아웃 시 노출/재생을 차단한다.
- 오프라인 편집 충돌은 revision으로 감지한다. 오래된 화면이 다른 가족 수정분을 조용히 덮어쓰지 않게 한다.

## 9. 삭제·권한 회수·점진 전환

- 새 기능은 데이터 추가 → 서버 계약 → 클라이언트 순서로 준비하고 서비스 실패 시 기존 케어를 유지한다.
- pet 삭제: 해당 avatar/job 종료·객체 정리. 포함된 복수 태그 추억은 전체를 비공개 처리 후 삭제한다. 태그만 떼어 공개 범위를 넓히지 않는다.
- 복수 태그 중 다른 owner의 아이가 있으면 삭제 전 공동 추억 영향도 확인을 보여준다. 기존 타인 소유 pet 자체는 삭제하지 않는다.
- 계정 삭제: 소유 pet을 위 규칙으로 처리하고 다른 owner pet의 단독 기여는 created_by 익명화로 보존한다.
- 기존 삭제 durable worker/Storage 정리를 확장한다. DB 행을 먼저 지워 객체 경로를 잃지 않도록 삭제 대상을 영속 기록한다.
- job callback·지연 응답은 삭제 상태와 현재 owner를 재검사한다. cleanup은 멱등·재시도 가능해야 한다.
- 멤버 권한 회수 시 query·초안/캐시·로컬 asset을 정리한다. 이미 발급한 signed URL의 잔여 수명은 즉시 취소와 다르다.
- 새 민감 사진 URL은 짧은 TTL로 설계하고 실제 제한을 고지한다. 기존 파일/링크를 공개 bucket으로 전환하지 않는다.
- rollback은 기존 앱 경로 복구가 우선이다. 실제 생성된 추억/asset 데이터·job을 DROP하지 않는다.

## 10. M6 — 검증·성능·출시 증거

| 경로 | 대표 실패 | 필요한 증거 |
| --- | --- | --- |
| 생성 | 중복 비용·timeout·삭제 후 결과·무효 manifest | contract/job 동작 테스트 + 실제 제공자 왕복 |
| 공간 | 드래그 탭 오인·겹침·경계 이탈·과한 render | 제스처/배치 테스트 + 여러 아이 기기 실측 |
| 저장 | A→B 전환·중복 dose·초안 덮어쓰기 | 기존 회귀 + 지연 응답/대상 고정 동작 테스트 |
| 추억 | 일부 권한·동시 초대·한도 우회·중복 집계 | DB/Storage 직접 접근·원자 명령·역할 matrix |
| 삭제 | orphan·타 pet 삭제·job 재생성·계정 간 초안 | 기존 삭제/replay 회귀 + 멱등 cleanup 테스트 |
| 알림 | cold start·로그아웃·삭제된 pet·잘못된 일정 | route 동작 테스트 + 물리 기기 수신/진입 |

기존 runner: `node scripts/run-presentation-test.mjs <test-path>`, `npm --prefix apps/mobile run typecheck`, `npm run verify`.
DB/Storage 테스트는 별도 로컬 환경에서 실행하고 기존 verify에 실제로 연결했는지 확인한다. 정적 문자열 검사는 역할 검증의 대체가 아니다.
`verify:architecture/i18n/presentation/ai-safety/secrets/supabase/offline/release/docs`를 유지하며 새 파일의 경로 가드를 함께 갱신한다.
실행 화면은 KO/EN·좁은 폰·큰 글자·해당 태블릿 폭·빈/로딩/오류·움직임 줄이기·VoiceOver/TalkBack을 확인한다.
프레임·입력 반응·메모리·앱 비활성 중단을 측정한다. 숫자 목표는 M0 기기 기준선에 근거해 정한다.
실계정 owner/caregiver/비구성원·물리 기기 알림/시간대·계정 삭제는 자동 gate와 구분해 기록한다.

## 11. 범위 밖·결정 의존성

- 3D·실시간 room·미니게임·재화·랭킹·교배·꾸미기·성격 AI·신규 결제·새 LLM·사진 background queue는 제외한다.
- 생성 제공자/규격/비용·동의/보관 조건은 M0, 다중 아이/Family 체험 정책은 공개 베타 전 결정한다.
- 미정 정책을 이유로 서버 권한을 우회하거나 잠금만 숨기지 않는다. 승인된 베타 entitlement로 검증할 수 있다.
- 브랜드/식별자·지원 URL·계정 생명주기·스토어 자산·개인정보 고지는 기존 출시 backlog에서 승계한다.
- 이 문서 갱신은 계정·키 발급·외부 사진 전송·유료 서비스 결제·원격 적용·배포·게시 승인이 아니다.
- 같은 파일을 여러 작업자가 동시에 수정하지 않는다. 위임/병렬 작업은 사용자·적용 지침이 허용할 때만 한다.

## 12. 문서 갱신 검증 (2026-10-18)

- 이번 변경은 제품/계획/설계/엔지니어링 Markdown에 한정했다. 기존 미커밋 앱·서버·릴리스 작업은 보존했다.
- `npm run verify` 통과: typecheck, architecture, i18n, presentation 144개 파일, 안전/secret/DB/offline/release/docs.
- 신규 미추적 문서는 verify:docs의 추적 파일 대상 밖이므로 같은 frontmatter·300줄 제한과 로컬 링크를 별도 검사했다.
- 생성 서비스·신규 DB/서버/화면은 미구현이다. 이 결과를 M0~M6 기능 완료·기기 QA·원격 적용으로 해석하지 않는다.

## 13. 진행 현황과 재개 (2026-10-21)

`/orchestration`으로 실행했다. 실행 범위는 M1+M3+M4이며 M2(생성)는 제공자 미정이라 보류했다.
P1(DB)과 P2(셸·로직)는 Codex에서 구현한 뒤 reviewer의 필수 수정 0건으로 끝났고, P3(UI)는 진행 중에 멈췄다.

| 패킷 | 결과 | 남은 일 |
| --- | --- | --- |
| P1 DB | migration `20261020090000_avatar_memories_atomic_contract.sql`, `supabase/tests/*`, `npm run test:db`, delete-account cleanup 확장 | 원격 적용, 실계정 역할 확인 |
| P2 셸·로직 | 네 탭 route(`presentation/navigation`), 전 아이 케어, 저장 대상 고정, 배치·제스처·모션 로직, 알림 라우팅 | 실기기 Android back·알림 cold start |
| P3 화면 | 우리 집 렌더 컴포넌트(`presentation/house/*.tsx`), 토큰·아이콘, 화면 일부 스타일 | 요약창, 화면 완성, 웹/기기 화면 확인 |

- 검증 결과: `npm run verify` 통과(i18n 646키, presentation 168파일, supabase 23 tables, docs 52). 로컬 `npm run test:db` 통과.
- 실시하지 않은 것: integrator 통합 검토, 실제 화면 확인, iOS/Android 실기기 확인, 원격 migration 적용과 함수 배포.
- 배포 순서: migration을 원격에 먼저 적용한 뒤 `delete-account`를 배포한다. 새 함수가 v2 RPC와 `list_pending_resource_cleanup_v1`을 호출하기 때문이다.
- 결정 대기:
  - 임시 한도(`app_private.memory_limits`): 추억당 사진 5장, 파일 10MiB, JPEG/PNG/WebP, 미공개 draft 10개, 예약 24시간
  - 아이 상세에서 back을 누르면 항상 우리 집으로 간다
  - 알림 식별에 최대 1.5초를 대기한다
  - `test:db`를 품질 게이트에 연결할지
- 잠금 설계: 일상 쓰기는 shared gate → 정렬된 pet `FOR UPDATE` → member `FOR SHARE` 순서다. 계정 삭제와 식별자 컬럼 UPDATE만 exclusive gate를 쓴다. integrator가 이 설계를 재검토해야 한다.
- M5 클라이언트 계약: RPC는 `prepare_memory`·`publish_memory`·`update_memory`·`delete_memory`·`prepare_pet_avatar_job`·`apply_pet_avatar`이며 모두 jsonb를 반환한다.
  새 5개 테이블은 client SELECT만 허용한다. `pet_avatar_jobs`는 `select *`를 쓰지 않는다. 추억 집계는 memoryId 기준으로 한다.

### 새 worktree에서 재개

```bash
git worktree add ../PawBloom-avatar-ui -b avatar-ui main
cd ../PawBloom-avatar-ui && npm --prefix apps/mobile install
export PATH="$HOME/.docker/bin:$PATH" DOCKER_HOST="unix://$HOME/.docker/run/docker.sock"
supabase start && npm run test:db && npm run verify
```

재개는 P3(UI) 완성부터 한다. 진입점은 `presentation/screens/{HouseScreen,TodayCareScreen,MemoriesScreen,PetDetailScreen}.tsx`이고,
props 계약은 각 파일의 export 타입·JSDoc을 따른다. 그다음 integrator 통합 검토 → 실기기 확인 → M5 순으로 진행한다.
같은 Supabase project_id를 쓰므로 다른 worktree의 로컬 스택은 먼저 `supabase stop`으로 멈춘다.
