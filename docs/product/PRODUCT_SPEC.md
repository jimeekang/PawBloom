# PetBloom 제품 명세

PetBloom는 이중 언어 반려동물 다이어리와 케어 기록 앱이다. 평소에는 보호자가 일상 기록을 빠르게 남기도록 돕고, 반려동물이 아플 때는 Care Mode로 전환해 병원에 가져갈 수 있는 기록 기반 briefing을 만든다.

## 주요 시장

- 1차 시장: Australia
- 2차 시장: Korea
- 첫 출시 언어: English, Korean

## 제품 포지셔닝

PetBloom는 단순 기록 앱이 아니라 가족이 함께 남긴 일상/케어 기록을 병원용 briefing으로 정리해주는 앱이다.

핵심 흐름:

1. 가족이 함께 Today 기록을 남긴다.
2. Care Mode에서 투약, 증상, 반응을 구조화해 기록한다.
3. AI가 최근 기록을 요약하고 누락 기록을 알려준다.
4. 사용자가 확인한 뒤 병원용 report를 공유한다.

## MVP

- 계정 필수 onboarding
- 다중 반려동물
- 강아지/고양이 중심 프로필과 기타 동물 기본 템플릿
- 일상 diary 기록: 식사, 물, 산책, 배변, 컨디션, 사진, 메모
- 건강 관찰형 강아지 산책 기록
- 질병/상태 또는 care plan 등록 후 Care Mode 전환
- 약 일정과 투약 상태 기록
- Today checklist와 날짜별 timeline
- 최근 기록 기반 AI briefing
- 누락 기록 표시와 수의사 질문 제안
- 영어 병원 summary와 share token을 포함한 vet report
- 가족/caregiver 공동 기록
- 앱 가입 없이 열 수 있는 만료형 vet report link
- Offline outbox와 sync replay
- Free/Plus/Family 권한 구조와 잠금 UI

## MVP 제외

- AI 진단
- 처방 또는 약 용량 추천
- 응급 여부 판단
- 실시간 수의사 상담
- 보험 연동
- 병원 예약/검색 연동
- Marketplace/community
- GPS 산책 tracking
- Pet sitter marketplace
- 실제 구독 결제 연동

## 성공 기준

- 사용자가 계정을 만들고 반려동물을 생성한다.
- 사용자가 diary/care 정보를 기록하고 안전한 요약을 생성한다.
- 가족/caregiver가 owner가 아니어도 같은 반려동물 기록에 참여한다.
- Vet report viewer는 sanitized report data만 본다.
- 앱은 EAS를 통해 iOS와 Android로 build할 수 있다.
