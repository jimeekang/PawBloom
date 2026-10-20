---
owner_role: codex
domain: database
edit_policy: exclusive
---

# 데이터베이스 엔지니어링

Supabase는 Australia-first 출시를 위해 `ap-southeast-2` Sydney region에 둔다.

## 규칙

- 모든 public table에는 명시적인 `GRANT` 문이 있어야 한다.
- 모든 public table에는 RLS를 활성화한다.
- RLS policy는 authentication과 ownership 또는 membership predicate를 함께 사용한다.
- 권한 대상은 `TO authenticated`를 사용한다. deprecated된 `auth.role()` 기반 검사는 사용하지 않는다.
- Storage bucket은 private으로 유지한다.
- Storage policy는 object path에서 pet membership을 검증해야 한다.
- 다이어리 `entry_date`와 투약 `dose_date`는 기기 로컬 달력이 정한 값이 권위다. 서버는 Sydney 날짜를 다시 유도하지 않고 `app_private.matches_local_entry_date`로 timestamp와 날짜가 실제 UTC offset 범위(UTC−12~UTC+14)에서 가능한 조합인지만 검증한다.
- 사진 다이어리 수정은 `update_photo_diary_entry` RPC만 사용한다. RPC는 owner/caregiver 권한, 기존 기록 소속, Storage object 소유권, 해당 반려동물의 같은 로컬 날짜에 저장된 전체 사진과 신규 사진을 합친 5장 제한을 한 트랜잭션에서 검증하고 mutation-scoped `storage_path`로 재시도를 멱등 처리한다.
- `memo`와 `photo`는 같은 날짜에도 여러 `diary_entries` 행을 저장할 수 있다. 일일 유일성은 구조화 카테고리(`food`, `water`, `walk`, `stool`, `condition`)에만 적용한다.
- 현재 사진 한도는 플랜과 무관하게 반려동물별 로컬 날짜당 5장이다. 향후 유료 플랜은 무제한 사진을 지원할 예정이지만, entitlement 기반 한도 분기는 아직 구현하지 않으며 무료 5장 제한을 유지한다.
- Free/Plus/Family의 반려동물 한도는 사용자가 owner인 pet만 계산한다. caregiver/pet sitter로 공유받은 pet은 생성 한도에 포함하지 않는다.
- pet 생성은 RLS의 빠른 한도 검사와 owner별 advisory transaction lock trigger를 함께 사용해 동시 요청 우회를 막는다.
- `pets.owner_id`가 단일 owner 원본이다. owner membership은 이 값과 일치해야 하고 pet마다 하나만 존재한다.
- `profiles.email`은 초대 대상 식별에 쓰이는 Auth identity 속성이다. client insert/update를 허용하지 않고 `auth.users` trigger만 동기화한다.
- `pet_members`와 `subscription_entitlements` mutation은 authenticated client에 열지 않는다. caregiver 관리 Edge Function과 신뢰된 service role 경로만 변경할 수 있다.
- 계정 삭제 시 사용자가 소유한 pet은 하위 데이터와 함께 삭제한다. 다른 owner의 pet에 기여한 행은 보존하고 nullable `created_by` FK의 `ON DELETE SET NULL`로 작성자 연결만 제거한다.
- View는 `security_invoker`를 사용하거나 노출 schema 밖에 둔다.
- Mobile app에는 Supabase publishable key만 포함한다.
- `service_role`은 Edge Function 서버 환경에서만 사용한다.

## 앱 역할

- `owner`: 반려동물 전체 관리, 멤버 관리, 리포트 생성
- `caregiver`: care, medication, diary 데이터 기록과 조회
- `pet_sitter`: 활성 초대 기간 동안 오늘 기록만 추가
- `vet_report_viewer`: Edge Function을 통해 sanitized report만 읽음

## 접근 제어 방향

- 반려동물 기준 데이터는 `pet_members`를 통해 접근 권한을 확인한다.
- 기본 루틴 데이터는 `pet_routines`처럼 pet 단위로 하나의 현재 기준값을 저장하고, 과거 일별 기록은 `diary_entries`에 별도로 보존한다. 산책은 루틴 JSON 안의 사용 여부로 관리해 강아지가 아닌 동물도 필요할 때만 켤 수 있게 한다.
- care plan과 medication schedule은 설정 데이터이며, 프로필 화면에서 관리한다. 여러 병명/상태와 여러 약을 같은 반려동물에 연결할 수 있어야 한다. 약 일정은 시작일, 종료일, 반복 간격, 로컬 복용 시간을 저장한다.
- 하루 여러 번 먹는 약은 `medication_schedules`에 시간별 행을 여러 개 저장한다. 예를 들어 하루 2번이면 같은 medication에 대해 08:00 일정과 20:00 일정을 따로 저장한다.
- 2일에 한 번 같은 반복 일정은 투약 시작일과 `recurrence_interval_days`로 계산한다. Care 화면과 알림은 `(오늘 - 시작일) % recurrence_interval_days = 0`인 날짜에만 해당 일정을 표시한다.
- 실제 투약 여부와 반응은 `medication_doses`에 일별 기록으로 남긴다. 예정 투약은 화면에 표시하기 위해 먼저 저장하지 않고, 사용자가 투약함/건너뜀/부분 투약을 선택할 때 오늘 날짜의 dose를 생성하거나 수정한다.
- 스케줄 기반 일별 투약 기록은 같은 `schedule_id`와 같은 로컬 날짜에 1개만 존재해야 한다. 앱 레벨 병합과 데이터베이스 unique guard를 함께 사용해 중복 저장을 막는다.
- 가족/보호자는 owner 권한 없이 기록을 추가할 수 있지만 반려동물 삭제나 멤버 삭제는 할 수 없다.
- 병원 리포트 viewer는 원본 table에 직접 접근하지 않는다.
- 공유 link는 만료, 취소 상태, sanitized payload version을 관리해야 한다.

## 아바타·공동 추억 목표 모델 (2026-10-18, 미적용)

구현 정본은 [0009](../exec-plans/active/0009-avatar-care-memories-implementation.md)다.
이하는 신규 migration 설계이며 현재 테이블/정책이 존재한다고 뜻하지 않는다.

| 예정 테이블 | 필수 데이터·무결성 |
| --- | --- |
| `pet_avatar_jobs` | pet_id, requester_id, client_mutation_id, source path, consent/policy version, provider job ID, status·오류·시각; 요청자+mutation unique |
| `pet_avatars` | pet_id, job_id, style/manifest version, private asset metadata·적용 상태; pet당 적용본 최대 하나 |
| `memories` | nullable created_by, 내용, 발생 로컬 날짜/시각, draft/published, revision, client mutation; 최초 요청자 기준 멱등 key는 익명화 후에도 유지 |
| `memory_pets` | memory_id+pet_id unique, published에는 최소 한 태그; 직접 client 변경 금지 |
| `memory_media` | memory_id, object path, MIME·크기·순서·mutation; path unique·미참조 정리 상태 |

기존 pets/diary/medication/media ID와 데이터는 유지한다. 강제 복제·일괄 삭제·기존 clinical source 변환을 하지 않는다.
신규 public table은 explicit GRANT·RLS, join/filter index, generated DB type, 역할 matrix 테스트를 함께 추가한다.
관계 역방향 index도 검토한다. `pet_id→memory_id`, `memory_id→pet_id` 조회와 권한 검사가 전체 scan이 되지 않게 한다.

### 원자 쓰기와 조회 인가

- 아바타 생성·적용은 `pets.owner_id` 확인을 포함한다. 일반 클라이언트는 job 완료·asset 검증 상태를 조작하지 못한다.
- 새 추억 생성자는 모든 태그 pet의 현재 owner/caregiver여야 한다.
- 복수 태그 생성/변경 시 **활성 owner/caregiver 사용자 집합의 완전 일치**를 확인한다. UI 검사는 보조다.
- 멤버 변경·추억 명령은 같은 pet을 정렬 순서로 잠그고, 잠금 획득 후 membership을 재조회한다.
- `prepare-memory` 원자 명령으로 draft·태그·파일 예약을 생성한다. draft는 작성자에게만 보인다.
- `publish-memory`는 모든 권한·객체·한도를 다시 확인하고 하나의 트랜잭션으로 공개 상태를 전환한다.
- published 조회는 모든 태그 pet에 현재 owner/caregiver 접근이 있어야 한다. 일부 pet 접근만으로 본문·태그·사진을 읽지 못한다.
- 편집/삭제는 작성자이면서 모든 pet 접근권이 있거나, 모든 대상 pet의 owner인 경우다. revision 충돌을 감지한다.
- parent SELECT 외에 junction/media 직접 조회·변경·Storage도 보호한다. 반복 RLS 참조가 재귀하지 않게 private helper/명령을 설계한다.
- helper는 최소 권한과 고정 search_path를 사용하고 무분별한 public SECURITY DEFINER/EXECUTE를 추가하지 않는다.
- vet_report_viewer·기존 기간 제한 sitter에 새 전체 추억 권한을 부여하지 않는다.

### 사진 한도·Storage

- 기존 아이별 로컬 날짜당 5장 한도를 legacy diary photo와 published memory photo의 합으로 적용한다.
- 복수 태그 사진은 각 pet에 한 번씩 계산한다. 태그/날짜 변경·동시 업로드·재시도에도 같은 검사를 한다.
- legacy 사진의 생성/추가/수정 RPC·trigger와 새 publish가 공통 pet/date 잠금·계수를 사용하도록 갱신한다.
- draft 파일 예약·보관에도 M0에서 정한 크기/개수/기간 예산을 적용해 unpublished 경로의 무제한 적재를 막는다.
- 신규 private bucket: `pet-avatars`, `memory-media`. 기존 `pet-media`의 단일 pet 정책을 공동 사진에 재사용하지 않는다.
- 예시 path는 avatar=`petId/jobId/assetId`, memory=`memoryId/mutationId/assetId`다. path만 믿지 않고 DB 관계·권한을 검사한다.
- 서명 URL/provider URL은 영구 식별자가 아니다. 저장은 검증된 bucket/path이며 서명 발급 때 현재 권한을 확인한다.
- 이미 발급한 URL의 TTL 잔여는 즉시 회수가 아니다. 새 사진은 짧은 TTL과 캐시 정리를 설계·검증한다.

### 삭제·호환성

- pet 삭제 시 해당 avatar/job을 종료하고 그 pet이 포함된 추억 전체를 삭제 대상으로 처리한다.
- 공동 추억의 pet FK를 단순 cascade해 태그만 줄이지 않는다. 삭제 전 영향 안내와 전체 객체 정리가 필요하다.
- 계정 삭제는 소유 pet 삭제를 따르고 타 owner pet에 남긴 단독 기여는 작성자를 익명화한다.
- 삭제 대상 객체 경로를 durable cleanup에 먼저 기록하고 DB/Storage 실패를 재시도한다. callback이 삭제한 데이터를 복원하지 못하게 한다.
- 기존 열람 경로·날짜·유일성·report source와 구버전 앱은 additive 전환으로 보존한다. rollback 때 신규 데이터를 DROP하지 않는다.

공식 기준: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[Storage 접근 제어](https://supabase.com/docs/guides/storage/security/access-control).
구체적인 SQL·SDK는 구현 시점 문서/설치 버전과 실제 역할 테스트로 다시 확인한다.
