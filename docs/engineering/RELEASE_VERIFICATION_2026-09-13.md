---
owner_role: codex
domain: release
edit_policy: exclusive
---

# 2026-09-13 출시 엔지니어링 검증

## 현재 결론

무료 v1의 주요 기록·보고서 흐름은 iOS Release 시뮬레이터에서 동작한다.
발견한 첫 반려동물 생성 차단과 계정 삭제 보안 문제는 수정·배포했다.
App Store 제출은 아직 준비되지 않았다. 브랜드·계정 연결·운영 이메일·지원 페이지와
TestFlight 실기기 검증이 남았다. 이 문서는 기술 검증 증거이며 최종 QA 승인서는 아니다.

## 검증 환경과 범위

- iPhone 17 Pro, iOS 26.5 Simulator, Release 구성, `com.pawbloom.app`.
- 연결된 Supabase: `xgvbtabedbocrebqilsh`. 재시작 후 로그인·DB·Storage·함수 응답 확인.
- 기존 사용자 데이터 대신 이번에 만든 가상 계정과 반려동물·기록을 사용했다.
- 서버 삭제 검증용 가상 계정·사진은 모두 정리했다.
- 시뮬레이터용 `qa913@pawbloom.test` 계정의 마지막 영구 삭제는 사용자 확인 대기 상태다.
- 이메일 인증이 완료된 가상 계정으로 로그인했으므로 실제 이메일 배송·인증을 통과했다는 의미는 아니다.

## 기능별 확인 결과

| 기능 | 구현·실행 확인 | 남은 확인 |
| --- | --- | --- |
| 로그인 | 원격 계정 로그인, 오류 안내, 세션 복원 | 실제 회원가입 이메일·비밀번호 복구 |
| 온보딩·프로필 | 첫 반려동물 등록, 이름·품종·몸무게, 홈 진입 | 네이티브 사진 선택·카메라 권한 |
| 오늘 | 식사 체크 저장, 완료 수 0/7→1/7, 타임라인 반영 | 약한 네트워크·일자 경계 |
| 다이어리 | 식사 급여량 50g/섭취량 45g 저장·조회 | 전체 카테고리의 실기기 회귀 |
| 사진 기록 | 실제 사용자 토큰으로 업로드·사진 저장 RPC 성공 | 사진 선택 UI·대용량·오프라인 |
| 투약 | 가상 약 이름·상태명·용량·투약량 저장, 케어 반영 | 반복 일정·부분 투약·실제 알림 |
| 기본 루틴 | 식사량·물·배변 횟수·산책 시간 저장, DB 값 확인 | 모든 기본값 변경·다이어리 연결 회귀 |
| 7일 보고서 | 서버 초안 생성·소유자 확정, 식사·투약 데이터 반영 | 외부 열람·만료·철회·공유 시트 실기기 |
| 언어·설정 | 영어→한국어 전환, 프로필 설정 진입 | 큰 글자·VoiceOver·작은 화면 |
| 보호자 | 기존 권한 유지·조회·제거 코드 보존 | 무료 v1에서 신규 초대 진입점 제외 |
| 계정 삭제 | 서버 실제 삭제·공유 사진 보존·중단 복구 성공, 확인 UI 표시 | 시뮬레이터 마지막 삭제 클릭, TestFlight 전체 흐름 |
| 오프라인 | SQLite/web 큐·계정 격리·삭제 경쟁 조건 테스트 통과 | 실제 네트워크 단절·복귀·강제종료 |

## 수정하고 검증한 출시 차단 문제

### 첫 반려동물 등록 실패

앱의 `INSERT ... RETURNING`이 `42501`로 실패했다. SELECT 정책이 생성 중인
소유자 멤버십만 확인하여 같은 명령 안에서 새 반려동물을 읽지 못하는 것이 원인이다.
SELECT 조건에 DB의 `owner_id = auth.uid()`를 추가하고 활성 멤버십 조건은 유지했다.
독립 보안 리뷰와 실제 역할별 SQL 검증 후 배포했다. 시뮬레이터 재시도도 성공했다.

검증: 첫 등록+RETURNING, 소유자 멤버십 생성, 무료 두 번째 반려동물 차단,
소유자 위조 차단, 보호자 읽기 허용·수정/삭제 차단, 다른 계정·만료 멤버·익명 읽기 차단.
재현 가능한 롤백 검사는 `supabase/tests/pet_owner_insert_returning.sql`에 있다.

### 계정 삭제의 서버·로컬 경계

- 공유 반려동물에 남아야 할 등록 사진은 서비스 소유 복사본으로 연결하고 원본 바이트는 Auth 삭제 전까지 보존한다.
- 삭제 준비 실패 시 원본 연결을 복구한다. Auth 삭제 뒤 파일 정리 실패는 성공한 계정 삭제와 구분해 `cleanup_pending`을 반환한다.
- DB 작업과 1분 주기 worker가 앱 종료 뒤 정리를 이어간다. 10분 작업 임대로 중복 요청·worker 간 동시 처리를 차단한다.
- worker는 전용 비밀값을 확인하고, 사용자 경로는 JWT를 함수 안에서 검증한다.
- 로컬 SQLite/web 큐에는 삭제 계정 표식을 남겨 재실행·다른 탭·진행 중 replay가 삭제 계정으로 다시 쓰지 못하게 한다.
- 서버 삭제 성공 즉시 React 상태와 계정 캐시를 닫고, 늦은 SDK 이벤트나 다른 계정 로그인과의 경쟁을 방어한다.

원격 실행에서 Auth·profile·소유 반려동물·소유 Storage 제거, 공유 사진의 원본과 동일한 바이트·nullable creator·ownerless Storage 유지,
삭제 후 로그인 거부, 작업 임대 단일 승자, 잘못된 임대 해제·일반 사용자의 관리 RPC 차단을 확인했다.
준비 단계 중단 복구와 Auth 삭제 직후 중단된 작업의 세션 없는 정리도 각각 확인했다.
worker 최근 예약 요청 3회는 HTTP 200, timeout 없음, 대기 작업 0이었다.

### 감사 로그·릴리스 구성

- 감사 로그의 anon/authenticated INSERT를 제거했다. 원격 권한에서 둘 다 false, service_role INSERT true 확인.
- production 설정 누락 시 예제 앱으로 열리지 않고 설정 오류 화면으로 종료한다.
- EAS workflow를 모바일 앱 루트로 옮기고 `verify → iOS production build` 의존성을 강제했다. 자동 심사 제출은 하지 않는다.
- Expo SDK 호환 패치 버전으로 갱신하고 Pods를 동기화했다. 갱신 중 발생한 누락 헤더 오류는 해결했다.
- 비밀번호 복구 경로 `pawbloom://reset-password`를 로컬 Supabase redirect 목록에 추가했다. 호스팅 Auth 설정과의 일치 여부는 별도 확인이 필요하다.

## 무료 v1 범위 정리

- Today의 AI 브리핑 카드, Settings의 Plus/Family·베타·구매할 수 없는 플랜 안내를 제거했다.
- 신규 보호자 초대·Family 잠금 문구와 두 번째 소유 반려동물 추가 진입점을 제외했다.
- 기존 여러 프로필 조회·전환과 기존 공유 접근 관리, 서버 권한은 유지했다.
- 일상 기록·투약·기본 루틴·7일 병원 보고서를 유지했다.
- 가입 홍보 문구를 실제 무료 제공 기능에 맞췄다.

## 검증 결과와 한계

- `npm run verify` PASS: typecheck, architecture 355개 소스, i18n 591개 키/미사용 0,
  presentation 144개 테스트 파일, AI safety, secrets, Supabase 18개 테이블, offline, release, docs.
- 계정 삭제 Storage·로컬 경계·replay barrier·native/web outbox 실행 테스트 PASS.
- `git diff --check` PASS.
- 최신 iOS Release 빌드 PASS, 오류 0. 의존성/Hermes 관련 경고 33개는 남아 있다.
- 의존성 감사에는 19건(High 7, Moderate 12)이 남아 있다. 패키지 경로·실제 배포 영향의 개별 판단이 필요하다.
- Simulator 실행은 TestFlight 설치·서명·실기기 권한·백그라운드 알림 검증을 대신하지 않는다.
- 연결된 Supabase MCP의 전체 Security Advisor 조회는 권한 오류로 실행되지 않았다. 배포 관련 ACL·RLS는 CLI와 실제 역할 검사로 확인했다.

## 출시 전에 남은 순서

1. 기존 출시 문서에 기록된 동명 앱·`com.pawbloom.app`의 소유 여부를 확인하고 이름·bundle ID·scheme을 확정한다.
2. 실제 이메일 주소로 회원가입→이메일 인증→복구 링크→새 로그인→삭제를 확인한다. 운영 SMTP·발신 도메인과 호스팅 redirect 설정을 확인한다.
3. 공개 HTTPS Support/Privacy 페이지와 운영자 정보를 확정한다. 현재 Support는 mailto, Privacy는 GitHub 문서 링크다.
4. EAS 프로젝트·production 환경변수·Apple 서명·App Store Connect 앱을 연결한다. 현재 app.json에 owner/projectId 연결이 없다.
5. 실제 수집 데이터와 App Privacy 응답·native privacy manifest를 대조한다. 알림·오프라인·사진 권한을 실기기에서 통과시킨다.
6. 스토어 스크린샷·설명·심사 계정·Review Notes를 준비하고 TestFlight 결과와 제출 빌드를 고정한다.

Apple은 심사 시 완성된 메타데이터, 동작하는 백엔드, 계정 기반 기능에 대한 심사 접근을 요구한다.
[App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
계정을 만드는 앱은 앱 안에서 계정 삭제를 제공해야 한다.
[Offering account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/)

## 배포 이력

| 마이그레이션 | 내용 | 상태 |
| --- | --- | --- |
| 20260913042218 | 감사 로그 INSERT 제한 | 적용 확인 |
| 20260913044550 | 계정 삭제 Storage·복구 작업 | 적용 본문과 로컬 이력 일치 |
| 20260913053731 | 계정 삭제 작업 임대·복구 강화 | 적용·실행 검증 |
| 20260913055858 | 첫 반려동물 INSERT RETURNING | 적용·역할별 검증·Simulator 성공 |

`delete-account` Edge Function과 worker 비밀값·Vault 설정도 반영했다.
기존 사용자 수정 파일 `docs/engineering/RELEASE.md`는 보존했고, 커밋·push·App Store 제출은 수행하지 않았다.
