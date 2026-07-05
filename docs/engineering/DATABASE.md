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
