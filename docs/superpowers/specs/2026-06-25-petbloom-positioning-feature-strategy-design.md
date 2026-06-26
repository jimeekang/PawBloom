# PetBloom 포지셔닝 및 기능 전략 설계

날짜: 2026-06-25
상태: 브레인스토밍에서 승인된 방향
범위: 제품 포지셔닝, MVP 기능 초점, 제외 기능, V2 후보

## 1. 제품 포지션

PetBloom는 일반적인 반려동물 다이어리 앱으로 포지셔닝하지 않는다.

제품 포지션은 다음과 같다.

> PetBloom는 가족이 함께 일상/케어 관찰 기록을 남기고, 그 기록을 안전한 병원용 briefing으로 정리해주는 앱이다.

주요 사용 상황:

- 평상시: 빠르게 기록하는 Today 기반 반려동물 케어 다이어리
- 질병/치료 기간: 구조화된 Care Mode 기록
- 병원 방문: 기록 기반 요약, 누락 기록 확인, 수의사 질문 제안, 공유 가능한 report

이 방향은 단순 pet diary, 일반 reminder, GPS 산책 tracker, pet sitter marketplace처럼 경쟁이 심한 영역에서 PetBloom를 분리한다.

## 2. 시장 판단

넓은 반려동물 앱 시장은 이미 경쟁이 심하다.

주요 기존 카테고리:

- Daily care와 reminder 앱: 식사, 약, 미용, 접종, routine 기록
- 가족 반려동물 care log: 여러 사람이 같은 반려동물 활동을 기록
- 강아지 산책 앱: GPS route tracking, 실시간 산책 위치, walker marketplace, 사진 update
- 병원 연결 앱: 예약 요청, refill, medical records, reminder, 병원 communication
- AI 또는 수의사 도구: medical history 요약, 수의사 workflow 지원

레드오션 영역:

- 기본 diary
- 기본 medication reminder
- 기본 walk log
- 일반 pet profile과 photo timeline
- Community, ranking, challenge, marketplace

PetBloom의 차별화는 아래 연결 흐름이다.

> 가족 기록 -> 누락 증거 확인 -> 병원 방문 준비 -> 안전한 report 공유

이 흐름은 "또 다른 pet tracker"보다 방어력이 있다. 보호자와 가족이 병원 방문 전에 무슨 일이 있었는지 설명해야 하는 스트레스가 큰 순간을 해결하기 때문이다.

## 3. MVP 전략

MVP는 Care/Vet Report를 핵심 차별점으로 우선한다.

반려동물이 아프지 않을 때도 쓸모 있어야 하지만, 가장 강한 제품 가치는 구조화된 care 기록이 필요한 순간에 드러난다.

MVP 제품 축:

1. Today 기반 일상 기록
2. 가족 공동 care 기록
3. 질병, 약, 증상, 치료 반응을 위한 Care Mode
4. 기록 요약, 누락 기록, 수의사 질문 제안을 위한 AI
5. 만료 link 기반 Vet Report 공유

MVP는 GPS, marketplace, community, insurance, 고급 다종 동물 지원으로 과확장하지 않는다.

## 4. 공유 모델

MVP에는 가족 공동 기록과 병원 report 공유를 포함한다.

### Owner

Owner가 할 수 있는 일:

- 반려동물 생성, 수정, 삭제
- 가족/caregiver 초대 또는 삭제
- diary, care, medication, media, report 전체 관리
- vet report 생성
- 만료형 report share link 생성

### Family/Caregiver

가족과 caregiver가 할 수 있는 일:

- 일상 기록 추가
- 식사, 물, 배변, 컨디션, 산책, 메모, media 기록
- medication status 표시
- 증상과 care 관찰 기록 추가
- membership에 따라 공유 pet history 조회

가족과 caregiver가 할 수 없는 일:

- 반려동물 삭제
- owner 제거
- billing 또는 entitlement 상태 변경
- Supabase service role 작업 접근

### Vet Report Viewer

Vet report viewer:

- 앱 계정이 없어도 된다.
- 만료형 link로 sanitized vet report payload만 본다.
- 원본 pet, diary, member, medication, media, profile table에는 접근할 수 없다.

### MVP 제외

기간 제한 pet sitter 초대는 첫 MVP 기능에서 제외한다. owner/family/vet-report-viewer 권한 모델이 안정된 뒤 추가한다.

## 5. 동물 프로필 전략

MVP 지원 범위:

- 강아지: 깊은 template
- 고양이: 깊은 template
- 기타: 기본 flexible template

### 강아지 template

강아지 기록은 아래를 강조한다.

- 산책과 활동
- 식사와 물
- 대변과 소변
- 컨디션과 에너지
- 약
- 증상 사진
- 치료 반응

### 고양이 template

고양이 기록은 아래를 강조한다.

- 음수량
- 식욕
- 화장실 사용
- 구토
- 대변/소변 변화
- 컨디션, 숨는 행동, 에너지 변화
- 약
- 증상 사진

### 기타 동물 template

기타 동물은 아래를 사용한다.

- 기본 profile field
- 자유 daily note
- condition record
- medication record
- photo record

### V2 확장

Version 2에서는 아래 동물의 깊은 template을 추가할 수 있다.

- 토끼
- 새
- 파충류
- 소형 포유류
- 기타 특수 동물

V2의 종별 건강 문구는 출시 전에 안전성 및 수의학적 표현 리뷰를 거친다.

## 6. 강아지 산책 기능 전략

MVP 산책 기록은 GPS route 중심이 아니라 건강 관찰 중심이다.

MVP 강아지 산책 기록 항목:

- 시작/종료 시간 또는 총 산책 시간
- 대략 거리
- 산책 중 대변/소변 여부
- 절뚝임
- 기침
- 호흡 이상
- 평소보다 빠른 피로
- 산책 후 식욕 또는 음수 변화
- 사진
- 메모

Report에는 이 기록을 walk/activity observation section으로 포함한다.

AI가 말할 수 있는 표현:

- "저녁 산책 후 피로 기록이 반복되어 있습니다."
- "최근 이틀 동안 산책 관찰 기록이 없습니다."
- "이 반복 관찰이 진료에 의미가 있는지 수의사에게 질문해보세요."

AI가 말하면 안 되는 표현:

- "관절염입니다."
- "응급입니다."
- "병원에 갈 필요가 없습니다."
- "약 용량을 바꾸세요."

### V2 산책 후보

Version 2에서 검토할 수 있는 기능:

- GPS route tracking
- 가족 실시간 산책 상태 공유
- Route history
- Route comparison
- 주간 활동 목표
- Background location 동작

이 기능들은 location permission 문구, battery 사용 검토, privacy review, platform policy review가 필요하다.

## 7. 화면 구조

앱은 Today-first information architecture를 사용한다.

### Primary Home: Today

Today 화면에는 아래가 보여야 한다.

- 활성 pet selector
- Care Mode가 켜져 있을 때 상태 표시
- 오늘의 medication/care checklist
- 빠른 daily logging action
- 산책/식사/물/배변/컨디션 shortcut
- 최근 timeline
- 기록이 있을 때 AI summary card

### Care Mode 강조

Care Mode가 활성화되면:

- Medication과 symptom tracking을 Today 상단으로 올린다.
- Care response record를 시각적으로 강조한다.
- Vet Report CTA를 더 잘 보이게 한다.
- AI summary는 기록 기반이며 진단이 아니라는 점을 명확히 유지한다.

### Reports

Reports는 아래를 지원한다.

- 3일/7일 기록 요약
- 누락 기록 검토
- 수의사 질문 제안
- 한국어 또는 영어 입력 기록을 기반으로 영어 병원용 report 생성
- 공유 전 사용자 확인
- 만료형 sanitized share link

## 8. AI 범위

MVP AI 범위:

- 기록 기반 3일/7일 요약
- 누락 기록 표시
- 조심스러운 pattern highlight
- 수의사에게 물어볼 질문 제안
- 한국어 또는 영어 기록 기반 영어 vet report 생성

AI output은 항상 기록 요약으로 표현한다.

필수 영문 출력 문구:

> This is a record-based summary, not a diagnosis. Contact a veterinarian for medical decisions.

필수 한국어 출력 문구:

> 이 내용은 진단이 아니라 기록 기반 요약입니다. 의학적 판단은 수의사에게 문의하세요.

금지되는 AI 동작:

- 진단
- 처방
- 약 용량 조언
- 응급 여부 단정
- 병원 방문이 필요 없다는 표현
- 수의사 판단 없이 상태가 안전하거나 위험하다고 단정

## 9. 수익화와 Entitlement

MVP에는 entitlement 구조와 잠금 UI 상태를 포함하지만, 실제 결제 연동은 하지 않는다.

### Free

Free 후보:

- 반려동물 1마리
- 기본 daily record
- 최근 7일 summary
- 기본 Care Mode record

### Plus

Plus 후보:

- 여러 반려동물
- 더 긴 history
- 고급 report export
- PDF export
- 기간별 AI summary 횟수 증가

### Family

Family 후보:

- 가족/caregiver 초대
- 공동 기록 ownership
- Role management
- Report share link 수 증가

MVP 테스트 기간에는 locked state가 향후 package를 설명하되, 핵심 가치 검증을 과하게 막지 않도록 한다.

실제 IAP, RevenueCat, StoreKit, Play Billing 연동은 beta feedback 이후로 미룬다.

## 10. DDD와 아키텍처 영향

선택된 전략은 기존 bounded context에 매핑된다.

- `identity`: 계정, 언어, profile
- `pet`: pet profile과 species template
- `diary`: daily food, water, stool, condition, walk, memo record
- `care`: Care Mode, condition, treatment response
- `medication`: schedule과 dose status
- `briefing`: AI summary, missing record, vet question
- `report`: vet report, confirmation, share link
- `media`: symptom photo와 diary media
- `subscription`: Free/Plus/Family entitlement gate
- `sync`: offline outbox와 idempotent replay

규칙:

- Context는 서로를 직접 mutate하지 않는다.
- Cross-context 동작은 application use case나 domain event를 사용한다.
- Supabase row shape은 infrastructure boundary에서 parsing한다.
- Role check는 RLS에서 강제하고 UI에도 반영한다.
- Vet report sharing은 sanitized report data만 반환한다.

## 11. 데이터 모델 영향

현재 core table은 적절하다.

- `profiles`
- `pets`
- `pet_members`
- `conditions`
- `care_plans`
- `medications`
- `medication_schedules`
- `medication_doses`
- `diary_entries`
- `measurements`
- `media_assets`
- `ai_briefs`
- `vet_reports`
- `report_share_tokens`
- `subscription_entitlements`
- `sync_outbox`
- `audit_events`

구현 계획에서 반영할 refinement:

- Diary entry type은 `walk_observation`을 지원해야 한다.
- Walk observation payload는 free text만이 아니라 structured field로 저장한다.
- Species profile은 dog, cat, other용 `species_template` 값을 저장한다.
- Vet report generation은 auditability를 위해 source record ID를 저장한다.
- Report share token은 expiry, revoked state, sanitized payload version을 저장한다.

## 12. 제외할 기능

MVP에서 제외한다.

- Pet sitter marketplace
- Dog walker marketplace
- Community feed
- Ranking, challenge, points economy
- Insurance comparison
- Hospital search 또는 appointment booking
- AI diagnosis
- Emergency triage
- Medication dosage recommendation
- Full GPS walk tracking
- 모든 종에 대한 깊은 template
- 실제 subscription payment

이 제외 항목은 core care/reporting loop가 검증되기 전에 PetBloom가 넓은 pet platform으로 퍼지는 것을 막기 위한 결정이다.

## 13. 성공 기준

기능 전략의 성공 기준:

- 사용자가 Today를 열고 care observation을 빠르게 기록한다.
- 가족 구성원이 owner 권한 없이 같은 pet record에 기여한다.
- 강아지 보호자가 GPS 없이 건강 관련 산책 관찰을 기록한다.
- 고양이 보호자가 식욕, 물, 화장실, 구토, 컨디션 변화를 기록한다.
- Care Mode가 약과 증상 반응 기록을 쉽게 만든다.
- AI가 진단 없이 기록 요약, 누락 기록, 수의사 질문을 제공한다.
- 수의사는 link를 열어 sanitized report만 본다.
- MVP는 marketplace, insurance, community, payment system 없이도 가치를 검증한다.

## 14. 검토한 참고 자료

- PetDesk: https://petdesk.com/download-app-for-pet-health
- 똑똑집사: https://ttokttok.co/
- Tails dog walk tracking: https://trytails.com/gps-dog-tracking/
- Wag dog walking marketplace: https://wagwalking.com/
- PetLog App Store listing: https://apps.apple.com/fr/app/petlog-%EB%B0%98%EB%A0%A4%EB%8F%99%EB%AC%BC-%EA%B1%B4%EA%B0%95-%EA%B8%B0%EB%A1%9D/id6760936087
- WalkyPet launch coverage: https://zdnet.co.kr/view/?no=20260521111604
- CoVet AI vet tools overview: https://co.vet/post/ai-vet-tools/
