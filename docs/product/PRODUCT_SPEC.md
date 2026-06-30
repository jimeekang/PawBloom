# PawBloom 제품 명세

PawBloom는 이중 언어 반려동물 다이어리와 케어 기록 앱이다. 평소에는 보호자가 일상 기록을 빠르게 남기도록 돕고, 반려동물이 아플 때는 케어 섹션에 병명과 투약 정보를 추가해 다이어리 기록과 함께 병원용 briefing을 만든다.

## 주요 시장

- 1차 시장: Australia
- 2차 시장: Korea
- 첫 출시 언어: English, Korean

## 제품 포지셔닝

PawBloom는 단순 기록 앱이 아니라 가족이 함께 남긴 일상/케어 기록을 병원용 briefing으로 정리해주는 앱이다.

핵심 흐름:

1. 가족이 함께 Today 기록을 남긴다.
2. 케어 섹션에서 병명, care plan, 투약 일정을 관리한다.
3. 기본 루틴과 care plan 대비 오늘 달라진 점은 다이어리 카테고리별 기록과 투약 기록으로 남긴다.
4. AI가 최근 기록을 요약하고 누락 기록을 알려준다.
5. 사용자가 확인한 뒤 병원용 report를 공유한다.

## MVP

- 계정 필수 onboarding
- 다중 반려동물
- 강아지/고양이 중심 프로필과 기타 동물 기본 템플릿
- 일상 diary 기록: 식사, 물, 선택형 산책, 배변, 컨디션, 사진, 메모
- 반려동물 프로필의 기본 루틴: 식사 목표량, 물 목표량, 선택형 산책 시간, 평소 배변/컨디션 기준값
- 건강 관찰형 강아지 산책 기록. 고양이/기타 동물은 산책 기록을 기본으로 숨기고 프로필에서 켤 수 있다.
- 질병/상태 또는 care plan 등록 후 케어 섹션에서 투약 기록
- 약 일정과 투약 상태 기록
- 기본 루틴은 Diary 오늘 기록에, care plan은 오늘 투약 기록에 불러오고, 사용자는 오늘 실제 값만 수정
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
