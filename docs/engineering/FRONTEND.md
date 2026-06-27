# 프론트엔드 엔지니어링

모바일 앱은 `apps/mobile` 아래에 둔다.

## 규칙

- Expo SDK 56 API와 versioned Expo documentation을 사용한다.
- TypeScript strict mode를 유지한다.
- Supabase read/mutation에는 TanStack Query를 사용한다.
- Supabase Auth session 저장에는 Expo SecureStore를 사용한다.
- Offline outbox에는 Expo SQLite를 사용한다.
- 사용자에게 보이는 모든 문구는 `src/i18n/translations.ts`에 둔다.
- Supabase secret은 앱에 hard-code하지 않는다.
- Edge Function은 typed request/response wrapper 없이 호출하지 않는다.

## UI 원칙

- 첫 화면은 landing page가 아니라 바로 사용할 수 있는 Today workflow다.
- Care 화면은 차분하고 직접적으로 만든다.
- AI가 의료 판단자인 것처럼 보이는 표현을 피한다.
- 모바일 interaction은 엄지손가락으로 누르기 쉬워야 한다.
- 반복 기록은 기본 루틴 또는 care plan에서 불러오고, 입력 화면에서는 오늘 값만 빠르게 수정하게 한다.
- 기본 루틴은 반려동물 프로필 관리 화면에서 설정한다. Diary 화면은 기본값을 읽기만 하고 루틴 설정 UI를 직접 보여주지 않는다.
- 기본값을 불러온 경우에도 사용자가 오늘만 수정할지, 기본 설정을 다시 저장할지 명확하게 구분한다.
- Diary는 일상 기록에 집중한다. 질병/상태, 약, 용량, 투약 여부, 증상, 반응은 Care Mode에서만 입력한다.
- 전역 디자인 token, icon, spacing, typography, layout rule을 우선 사용한다.
- 화면별 임의 스타일 추가는 피하고, 필요한 스타일은 design system에 먼저 반영한다.

## MVP 화면 방향

- Today: 오늘의 기록, 투약, 산책, 컨디션 check list
- Diary: 식사, 물, 선택형 산책, 배변, 컨디션, 사진, 메모 입력
- Care Mode: 질병/상태, 약 일정, 투약 상태, 반응 기록
- Reports: 3일/7일 요약, 누락 기록, 수의사 질문, 공유 link
- Pet selector: 여러 반려동물 중 활성 pet 선택
- Routine setup: 반려동물 프로필 안에서 기본 식사량, 물, 선택형 산책, 배변, 컨디션 기준값 설정
- Care setup: 상태/진단명, care plan, 약 이름, 용량, 복용 시간 설정
