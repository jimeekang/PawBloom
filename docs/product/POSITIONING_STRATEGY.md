---
owner_model: claude-opus-4.8-extra
domain: planning
edit_policy: exclusive
---

# PawBloom 포지셔닝 및 기능 전략

상태: 브레인스토밍에서 승인된 방향 (2026-06-25). 최상위 전략 정본.
범위: 제품 포지셔닝, MVP 기능 초점, 공유/권한 모델, 종별 프로필, 수익화 방향, 제외 기능, 성공 기준.

> 이 문서는 `docs/superpowers/specs/2026-06-25-pawbloom-positioning-feature-strategy-design.md`에서 승격 이동한 살아있는 전략 문서다. 구현 세부(DDD 컨텍스트 매핑, 데이터 모델 refinement)는 아키텍처/데이터 문서로 이관했고, AI 안전 disclaimer 정본은 AI_SAFETY 문서를 링크한다. 시장 수치·경쟁사 참고는 분석 문서에 위임한다.

## 1. 제품 포지션

PawBloom는 일반적인 반려동물 다이어리 앱으로 포지셔닝하지 않는다.

> PawBloom는 가족이 함께 일상/케어 관찰 기록을 남기고, 그 기록을 안전한 병원용 briefing으로 정리해주는 앱이다.

주요 사용 상황:

- 평상시: 빠르게 기록하는 Today 기반 반려동물 케어 다이어리
- 질병/치료 기간: 구조화된 Care Mode 기록
- 병원 방문: 기록 기반 요약, 누락 기록 확인, 수의사 질문 제안, 공유 가능한 report

이 방향은 단순 pet diary, 일반 reminder, GPS 산책 tracker, pet sitter marketplace처럼 경쟁이 심한 레드오션(기본 diary/medication reminder/walk log, 일반 pet profile·photo timeline, community·ranking·challenge·marketplace)에서 PawBloom를 분리한다. 시장 판단 근거와 경쟁사 목록은 [../analysis/01-market-and-competitors.md](../analysis/01-market-and-competitors.md)에 위임한다.

**핵심 차별화 흐름(원본 정의, 방어력의 근거):**

> 가족 기록 -> 누락 증거 확인 -> 병원 방문 준비 -> 안전한 report 공유

이 흐름은 "또 다른 pet tracker"보다 방어력이 있다. 보호자와 가족이 병원 방문 전에 무슨 일이 있었는지 설명해야 하는 스트레스가 큰 순간을 해결하기 때문이다.

## 2. MVP 전략

MVP는 Care/Vet Report를 핵심 차별점으로 우선한다. 반려동물이 아프지 않을 때도 쓸모 있어야 하지만, 가장 강한 제품 가치는 구조화된 care 기록이 필요한 순간에 드러난다.

MVP 제품 축:

1. Today 기반 일상 기록
2. 가족 공동 care 기록
3. 질병·약·증상·치료 반응을 위한 Care Mode
4. 기록 요약·누락 기록·수의사 질문 제안을 위한 AI
5. 만료 link 기반 Vet Report 공유

MVP는 GPS, marketplace, community, insurance, 고급 다종 동물 지원으로 과확장하지 않는다.

## 3. 공유 / 권한 모델

MVP에는 가족 공동 기록과 병원 report 공유를 포함한다. Role check는 RLS에서 강제하고 UI에도 반영한다.

**Owner** — 반려동물 생성/수정/삭제, 가족·caregiver 초대·삭제, diary·care·medication·media·report 전체 관리, vet report 생성, 만료형 report share link 생성.

**Family / Caregiver** — 가능: 일상 기록 추가(식사·물·배변·컨디션·산책·메모·media), medication status 표시, 증상·care 관찰 기록 추가, membership에 따라 공유 pet history 조회. **불가**: 반려동물 삭제, owner 제거, billing/entitlement 상태 변경, Supabase service role 작업 접근.

**Vet Report Viewer** — 앱 계정 불필요. 만료형 link로 sanitized vet report payload만 열람. 원본 pet/diary/member/medication/media/profile table에는 접근 불가.

**MVP 제외**: 기간 제한 pet sitter 초대는 첫 MVP에서 제외. owner/family/vet-report-viewer 권한 모델이 안정된 뒤 추가한다.

## 4. 종별 프로필 전략

MVP 지원 범위 — 강아지(깊은 template), 고양이(깊은 template), 기타(기본 flexible template).

**강아지 template 관찰 항목**: 산책·활동, 식사·물, 대변·소변, 컨디션·에너지, 약, 증상 사진, 치료 반응.

**고양이 template 관찰 항목**: 음수량, 식욕, 화장실 사용, 구토, 대변/소변 변화, 컨디션·숨는 행동·에너지 변화, 약, 증상 사진.

**기타 동물 template**: 기본 profile field, 자유 daily note, condition record, medication record, photo record.

**V2 확장**: 토끼·새·파충류·소형 포유류·기타 특수 동물의 깊은 template 추가 검토. V2 종별 건강 문구는 출시 전 안전성 및 수의학적 표현 리뷰를 거친다.

## 5. 강아지 산책 기능 전략 (GPS 없는 건강 관찰 중심)

MVP 산책 기록은 GPS route 중심이 아니라 건강 관찰 중심이다.

**MVP 강아지 산책 기록 항목**:

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

Report에는 이 기록을 walk/activity observation section으로 포함한다. AI가 산책 관찰에 대해 할 수 있는/없는 표현의 정본은 [AI_SAFETY.md](../engineering/AI_SAFETY.md)를 따른다(예: "저녁 산책 후 피로 기록이 반복되어 있습니다" 는 허용, 진단·응급 단정·용량 변경은 금지).

**V2 산책 후보**: GPS route tracking, 가족 실시간 산책 상태 공유, route history, route comparison, 주간 활동 목표, background location. 모두 location permission 문구, battery 사용 검토, privacy review, platform policy review가 필요하다.

## 6. 화면 구조

앱은 Today-first information architecture를 사용한다.

**Primary Home: Today** — 활성 pet selector, Care Mode 상태 표시, 오늘의 medication/care checklist, 빠른 daily logging action(산책·식사·물·배변·컨디션 shortcut), 최근 timeline, 기록이 있을 때 AI summary card.

**Care Mode 강조** — 활성화 시 medication·symptom tracking을 Today 상단으로 올리고, care response record를 시각적으로 강조하며, Vet Report CTA를 더 잘 보이게 하고, AI summary가 기록 기반이며 진단이 아님을 명확히 유지한다.

**Reports** — 3일/7일 기록 요약, 누락 기록 검토, 수의사 질문 제안, 한국어 또는 영어 입력 기록 기반의 영어 병원용 report 생성, 공유 전 사용자 확인, 만료형 sanitized share link.

## 7. AI 범위

MVP AI 범위: 기록 기반 3일/7일 요약, 누락 기록 표시, 조심스러운 pattern highlight, 수의사에게 물어볼 질문 제안, 한국어 또는 영어 기록 기반 영어 vet report 생성. AI output은 항상 기록 요약으로 표현한다.

필수 disclaimer 문구(영/한), 금지되는 AI 동작(진단·처방·용량 조언·응급 단정 등)의 정본은 중복을 피하기 위해 [AI_SAFETY.md](../engineering/AI_SAFETY.md)에 정의한다.

## 8. 수익화 티어 방향 (Free / Plus / Family)

MVP에는 entitlement 구조와 잠금(locked) UI 상태를 포함하지만, 실제 결제 연동은 하지 않는다.

**Free** — 반려동물 1마리, 기본 daily record, 최근 7일 summary, 기본 Care Mode record.

**Plus** — 여러 반려동물, 더 긴 history, 고급 report export, PDF export, 기간별 AI summary 횟수 증가.

**Family** — 가족·caregiver 초대, 공동 기록 ownership, role management, report share link 수 증가.

MVP 테스트 기간에는 locked state가 향후 package를 설명하되 핵심 가치 검증을 과하게 막지 않도록 한다. 실제 IAP, RevenueCat, StoreKit, Play Billing 연동은 beta feedback 이후로 미룬다.

## 9. 제외할 기능

MVP에서 제외: Pet sitter marketplace, Dog walker marketplace, Community feed, Ranking·challenge·points economy, Insurance comparison, Hospital search·appointment booking, AI diagnosis, Emergency triage, Medication dosage recommendation, Full GPS walk tracking, 모든 종에 대한 깊은 template, 실제 subscription payment.

이 제외는 core care/reporting loop가 검증되기 전에 PawBloom가 넓은 pet platform으로 퍼지는 것을 막기 위한 결정이다.

## 10. 성공 기준

- 사용자가 Today를 열고 care observation을 빠르게 기록한다.
- 가족 구성원이 owner 권한 없이 같은 pet record에 기여한다.
- 강아지 보호자가 GPS 없이 건강 관련 산책 관찰을 기록한다.
- 고양이 보호자가 식욕·물·화장실·구토·컨디션 변화를 기록한다.
- Care Mode가 약과 증상 반응 기록을 쉽게 만든다.
- AI가 진단 없이 기록 요약·누락 기록·수의사 질문을 제공한다.
- 수의사는 link를 열어 sanitized report만 본다.
- MVP는 marketplace·insurance·community·payment system 없이도 가치를 검증한다.

## 11. 이관된 상세 (링크)

- **DDD 컨텍스트 매핑 및 규칙** (identity/pet/diary/care/medication/briefing/report/media/subscription/sync 및 cross-context·RLS·sanitization 규칙): [../../ARCHITECTURE.md](../../ARCHITECTURE.md)
- **데이터 모델 및 refinement** (core table 목록, `walk_observation` diary type, structured walk payload, `species_template` 값, vet report source record ID, share token expiry/revoked/sanitized payload version): [../engineering/DATABASE.md](../engineering/DATABASE.md)
- **AI 안전 disclaimer 및 금지 동작 정본**: [../engineering/AI_SAFETY.md](../engineering/AI_SAFETY.md)
- **시장 판단 수치 및 경쟁사 참고 URL**: [../analysis/01-market-and-competitors.md](../analysis/01-market-and-competitors.md)
