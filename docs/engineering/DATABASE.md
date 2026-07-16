---
owner_model: codex-high
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
- 사진 다이어리 수정은 `update_photo_diary_entry` RPC만 사용한다. RPC는 owner/caregiver 권한, 기존 기록 소속, Storage object 소유권, 해당 반려동물의 같은 로컬 날짜에 저장된 전체 사진과 신규 사진을 합친 5장 제한을 한 트랜잭션에서 검증하고 mutation-scoped `storage_path`로 재시도를 멱등 처리한다.
- `memo`와 `photo`는 같은 날짜에도 여러 `diary_entries` 행을 저장할 수 있다. 일일 유일성은 구조화 카테고리(`food`, `water`, `walk`, `stool`, `condition`)에만 적용한다.
- 현재 사진 한도는 플랜과 무관하게 반려동물별 로컬 날짜당 5장이다. 향후 유료 플랜은 무제한 사진을 지원할 예정이지만, entitlement 기반 한도 분기는 아직 구현하지 않으며 무료 5장 제한을 유지한다.
- Free/Plus/Family의 반려동물 한도는 사용자가 owner인 pet만 계산한다. caregiver/pet sitter로 공유받은 pet은 생성 한도에 포함하지 않는다.
- pet 생성은 RLS의 빠른 한도 검사와 owner별 advisory transaction lock trigger를 함께 사용해 동시 요청 우회를 막는다.
- `pets.owner_id`가 단일 owner 원본이다. owner membership은 이 값과 일치해야 하고 pet마다 하나만 존재한다.
- `profiles.email`은 초대 대상 식별에 쓰이는 Auth identity 속성이다. client insert/update를 허용하지 않고 `auth.users` trigger만 동기화한다.
- `pet_members`와 `subscription_entitlements` mutation은 authenticated client에 열지 않는다. caregiver 관리 Edge Function과 신뢰된 service role 경로만 변경할 수 있다.
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
