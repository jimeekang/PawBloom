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
- care plan과 medication schedule은 설정 데이터이며, 실제 투약 여부와 반응은 `medication_doses`에 일별 기록으로 남긴다.
- 가족/보호자는 owner 권한 없이 기록을 추가할 수 있지만 반려동물 삭제나 멤버 삭제는 할 수 없다.
- 병원 리포트 viewer는 원본 table에 직접 접근하지 않는다.
- 공유 link는 만료, 취소 상태, sanitized payload version을 관리해야 한다.
