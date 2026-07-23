---
owner_model: codex-high
domain: implementation
edit_policy: exclusive
---

# UI/UX 구현 감사 및 수정 계획

## 범위와 기준

- 감사일: 2026-07-16
- 작업 브랜치: `codex/ui-ux-full-audit`
- 실행 기준: Expo web, 390×844 모바일 뷰포트
- 점검 플로우: 로그인/회원가입 → Today → Diary → Care → Reports → Settings → Pet profile
- 시각 기준: `docs/design/pawbloom-app-design-draft-02.png`
- 제품 기준: `docs/product/PRODUCT_SPEC.md`, `docs/product/AI_SAFETY.md`
- 품질 기준: `docs/engineering/FRONTEND.md`, `docs/engineering/QUALITY.md`
- 실행 증거: `.gstack/qa-reports/screenshots/ui-ux-audit-2026-07-16/`

이 문서는 제품·디자인 의사결정을 새로 정의하지 않는다. 실행 화면과 소스 코드에서 확인된 구현 결함, 누락된 연결, 검증 순서를 기록한다. 제품/디자인 소유 문서는 읽기 기준으로만 사용한다.

## 현재 상태 요약

강점:

- 로그인, 회원가입 모드 전환, 필수값 검증이 동작한다.
- Today 체크리스트, Diary 구조화 기록, Care 투약, Reports 단계 흐름이 실제 코드와 연결돼 있다.
- 한국어/영어 번역 키가 완비돼 있고 설정 변경이 앱 전체에 적용된다.
- 390×844에서 핵심 화면이 깨지지 않고 렌더링되며 감사 중 콘솔 오류는 0건이었다.
- 실제 Reports 탭은 기록 요약, 보호자 확인, 공유 단계 계약을 가진다.

초기 건강 점수는 **75/100**이었다. 아래 UX-001~UX-012 구현과 추가 보안 수정 후 preview 브라우저 기준 핵심 플로우, 접근 가능한 이름/상태, 한국어·영어 전환, 콘솔 오류 0건을 확인했다. 실계정 인증 E2E와 네이티브 기기 QA는 별도 검증 한계에 기록한다.

## 발견 사항

| ID | 심각도 | 영역 | 확인된 문제 | 구현 목표 |
| --- | --- | --- | --- | --- |
| UX-001 | High | 로그인/i18n | 저장 언어가 없으면 항상 한국어로 시작하고 로그인 화면에 언어 전환이 없다. 호주 1차 시장 사용자는 로그인 전 복구할 수 없다. | 기기/브라우저 locale을 감지하고 미지원 locale은 영어로 폴백한다. 로그인 화면에 언어 선택을 제공한다. |
| UX-002 | High | Diary | 6주 월간 달력이 기본 펼침 상태라 첫 화면 대부분을 차지하고 실제 기록 입력을 아래로 밀어낸다. | 선택 날짜 요약을 기본으로 보여주고 월간 달력은 명시적으로 펼칠 때만 표시한다. |
| UX-003 | High | Care | 데이터 계층은 `partial` 투약을 지원하지만 오늘 투약 빠른 버튼은 완료/건너뜀만 제공한다. | 오늘 투약 카드에서 정량/일부/건너뜀을 직접 기록한다. |
| UX-004 | Medium | Care/Reports | Care 내부 `Care/Reports` 세그먼트와 하단 Reports 탭이 중복된다. 내부 화면은 실제 report workflow가 아닌 정적 요약이다. | Care는 투약과 케어 기록만 유지하고 CTA는 실제 Reports 탭으로 이동한다. |
| UX-005 | Medium | Settings | 로컬 미리보기에서도 로그아웃이 노출되고 Supabase/.env 개발 문구가 사용자 설정에 표시된다. | 미리보기에서는 계정 동작을 설명형 상태로 바꾸고 개발 환경 세부사항을 숨긴다. |
| UX-006 | Medium | Home | 헤더 알림 아이콘이 상호작용처럼 보이지만 동작하지 않는다. `onManagePets` prop도 사용되지 않는다. | 기능 없는 affordance를 제거하고 실제 가능한 펫 전환만 남긴다. |
| UX-007 | High | 접근성 | 체크리스트, 캘린더 날짜, 카테고리, 점수, 투약 상태, 프로필 선택 등에 role/label/state가 넓게 빠져 있다. | 핵심 Pressable에 이름, 역할, 선택/체크/비활성 상태를 제공한다. |
| UX-008 | Medium | 폼 | 로그인과 펫 프로필 입력은 placeholder 의존도가 높아 입력 후 필드 의미가 사라지고 스크린리더 이름도 불명확하다. | 지속적으로 보이는 필드 라벨과 `accessibilityLabel`을 추가한다. |
| UX-009 | Medium | 미리보기 | 영어 UI에서도 샘플 펫/다이어리/투약 데이터가 한국어로 남아 언어 전환이 불완전하게 보인다. | 미리보기 샘플 데이터를 현재 언어로 생성한다. 실제 사용자 입력은 변환하지 않는다. |
| UX-010 | High | Today | 완료된 체크리스트를 다시 탭하면 “이미 기록됨”만 표시하고 즉시 취소할 수 없다. 오탭 복구에 Diary 탐색과 삭제가 필요하다. | checklist-origin 기록은 Today에서 취소할 수 있게 하고, 상세 Diary 기록은 보호한다. |
| UX-011 | High | 공동 기록 | 제품 범위의 family/caregiver 초대·목록 관리 UI가 없다. 권한 enum/RLS만 존재한다. | 별도 DB/보안 작업으로 멤버 목록과 owner 초대 intent를 구현한다. |
| UX-012 | Medium | 구독 | entitlement 타입은 있지만 화면 잠금/설명 상태와 연결되지 않았다. | report 공유, 가족 수, 미디어 제한을 제품 승인된 정책에 연결한다. |

## 구현 순서

각 항목은 타깃 테스트와 실행 화면 재검증이 통과해야 다음 항목으로 이동한다.

### 1. 첫 진입 언어와 인증 폼

- locale 감지 순수 함수와 회귀 테스트 추가
- 저장값 우선, 미저장 시 기기 locale, 미지원 시 영어 순서 적용
- 로그인/회원가입 상단에 한국어/English 선택 추가
- 이메일/비밀번호/비밀번호 확인에 지속 라벨과 접근성 이름 추가
- 검증: 언어 preference 테스트, auth 화면 한국어/영어 캡처, 빈 값 검증

### 2. Diary 작업 우선순위

- 기본 접힘 날짜 카드, 월간 달력 펼침/접힘 상태 추가
- 선택 날짜, 이전/다음 월, 날짜 셀, 일/주 필터 접근성 보강
- 카테고리와 컨디션 점수에 선택 상태와 라벨 추가
- 검증: 달력 순수 로직 테스트, 첫 화면에서 카테고리 영역 노출, 날짜 선택 유지

### 3. Care 정확성과 Reports 단일 진입점

- Care 내부 report 세그먼트와 정적 report panel 제거
- 오늘 투약 카드에 `partial` 빠른 동작 추가
- 상태 버튼의 선택 상태와 설명, 일정 행의 접근성 이름 추가
- 실제 Reports 탭 이동 CTA 유지
- 검증: status 회귀 테스트, Care 캡처, 실제 Reports 탭 이동

### 4. Settings/Home 정합성

- 미리보기 계정의 로그아웃 숨김
- 개발 환경 문구를 사용자용 저장/동기화 상태로 교체
- 동작 없는 bell과 사용하지 않는 prop 제거
- 설정·프로필 진입 동작 재검증

### 5. 공통 접근성과 폼

- 버튼/세그먼트 공통 label 전달 계약 보강
- Home 체크리스트와 타임라인, Diary 목록, Care, Pet profile에 role/label/state 추가
- 펫 생성/수정 폼에 보이는 라벨 추가
- 웹 DOM 기준 이름/역할 확인 후 네이티브 스크린리더는 별도 기기 QA로 남김

### 6. 미리보기 데이터와 Today 오탭 복구

- 언어별 샘플 펫/Diary/투약 팩토리 적용
- checklist-origin 로컬/원격 기록만 안전하게 취소
- 투약 일정은 기존 상태를 보존할 수 있는 경우에만 되돌림
- 상세 Diary 기록과 사용자가 직접 만든 투약 기록은 Today에서 삭제하지 않음

### 7. 별도 기능 슬라이스

- family/caregiver migration, 권한 회수, JWT Edge Function, Settings 관리 UI 구현
- Free/Plus/Family 반려동물 수와 Family 초대 잠금, beta report/photo 정책 연결
- entitlement 조회 중 잘못된 Free 잠금이 보이지 않도록 loading/error 상태 분리
- client가 profile email을 위조해 초대 대상을 선점할 수 없도록 Auth 원본 동기화 적용

## 구현 결과

| 범위 | 결과 |
| --- | --- |
| UX-001 | 미저장 locale 감지, 영어 폴백, 인증 전 언어 선택, 인증 폼 라벨 구현 |
| UX-002 | Diary 달력 기본 접힘, 날짜 disclosure 상태와 웹 `aria-expanded` 구현 |
| UX-003 | Care에서 정량/일부/건너뜀 직접 기록 및 상태 노출 |
| UX-004 | Care 내부 중복 Reports 화면 제거, 실제 Reports 탭 CTA 유지 |
| UX-005 | preview 로그아웃과 개발 환경 문구 제거, 사용자용 데이터 상태 표시 |
| UX-006 | 동작 없는 Home 알림 affordance 제거, preview의 2개 sample pet 전환 연결 |
| UX-007/008 | 핵심 버튼·선택·입력·뒤로 가기에 이름, role, state, 지속 라벨 적용 |
| UX-009 | 한국어/영어 sample pet, Diary, medication 데이터 팩토리 적용 |
| UX-010 | checklist-origin 기록만 Today에서 안전하게 취소하고 상세 기록 보호 |
| UX-011 | owner 전용 caregiver 목록/초대/제거 UI와 JWT Edge Function 배포 |
| UX-012 | Free 1, Plus 5, Family 10 pet 제한과 Family 초대 잠금, beta 정책 표시 |

추가 보안 수정:

- `pet_members`와 `subscription_entitlements`의 authenticated mutation 권한을 회수했다.
- pet 생성 제한을 UI와 DB RLS 양쪽에서 강제한다.
- 플랜의 pet 수는 owner 역할만 계산하며 caregiver/pet sitter로 공유받은 pet은 제외한다.
- owner별 advisory transaction lock으로 동시 pet 생성 요청도 플랜 한도를 우회하지 못하게 한다.
- `pets.owner_id`를 단일 소유자 원본으로 고정하고 legacy 보조 owner role을 caregiver로 정규화한다.
- `profiles.email` client insert/update를 차단하고 `auth.users` insert/email update trigger로만 동기화한다.
- 기존 auth user의 profile/Free entitlement를 backfill했다.
- caregiver invite는 server-side admin API에서만 실행하며 owner·Family plan을 확인한다.

원격 적용:

- `20260716112929_secure_family_memberships_and_entitlements.sql`
- `20260716114749_protect_profile_identity.sql`
- `20260716121500_serialize_pet_entitlement_limits.sql`
- `20260716123000_enforce_canonical_pet_owner_membership.sql`
- `manage-pet-members` Edge Function: version 3, `ACTIVE`, `verify_jwt=true`
- 원격 table stats: `profiles=9`, `subscription_entitlements=9`
- 원격 index stats에서 `profiles_email_lower_unique_idx` 확인
- 원격 `db lint --level error`: schema error 0건

## 최종 검증

- `npm run typecheck`
- `npm run verify:architecture`
- `npm run verify:i18n` — 545 keys
- `npm run verify:presentation`
- `npm run verify:supabase`
- targeted entitlement, member security, Diary, Pet profile 접근성 회귀 테스트
- owner pet count와 DB plan-limit 오류 복구 회귀 테스트
- 390×844 Chrome preview: Today, sample pet 전환, Diary, Care, Reports, Settings, Pet profile, 영어 전환
- 모든 검사 화면의 unnamed button/tab/radio 0건
- 브라우저 exception/log error 0건
- 최종 캡처: `44-final-today-ko.png` ~ `51-final-today-en.png`

## 완료 기준

- [x] 한국어와 영어 모두 로그인 전 전환 가능
- [x] Diary 첫 화면에서 접힌 달력 아래 기록 카테고리가 보임
- [x] Care에서 정량/일부/건너뜀을 직접 기록 가능
- [x] report workflow 진입점이 하단 Reports 탭 하나로 정리됨
- [x] 미리보기 설정에 로그아웃과 `.env` 문구가 노출되지 않음
- [x] 핵심 상호작용이 접근 가능한 이름과 상태를 가짐
- [x] 수정 항목 회귀 테스트와 390×844 preview 재캡처 통과
- [x] preview 브라우저 콘솔 오류 0건
- [ ] 실계정 owner/caregiver 교차 역할 E2E
- [ ] 실제 iOS/Android 권한·키보드·VoiceOver/TalkBack QA
- [x] 최종 `npm run verify` 통과

## 증거 한계

- 웹 모바일 뷰포트로 시각·상호작용·콘솔을 확인했다.
- 실제 iOS/Android 키보드, 알림 권한, 카메라/앨범 권한, VoiceOver/TalkBack은 이 감사만으로 보장하지 않는다.
- 원격 마이그레이션 기록, 함수 ACTIVE/JWT 상태, table/index stats는 확인했다.
- 기존 Chrome의 `localhost:8083`에는 로그인 세션이 없어 실계정 UI E2E를 실행하지 못했다.
- 저장된 테스트 자격증명이나 service-role key 사용은 별도 명시적 승인이 필요하므로 사용하지 않았다.
- 실제 owner/caregiver 교차 역할과 report share는 로그인된 테스트 세션에서 최종 E2E가 필요하다.
