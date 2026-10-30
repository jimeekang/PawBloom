---
owner_role: lead
domain: product-design
edit_policy: exclusive
---

# 캐릭터 생성·우리 집 UI v2 설계

- 기준: 2026-10-28 사용자 요청. [AVATAR_HOME_UX](AVATAR_HOME_UX.md)의 탐색·조작·안전 규칙은 그대로 유지하고,
  "사진과 생성" 절의 **v1 생성 방식**과 우리 집 시각 설계·캐릭터 모션을 이 문서가 정한다.
- 구현 계획: [0009](../exec-plans/active/0009-avatar-care-memories-implementation.md). 구현·이미지 산출은 codex 패킷이 맡는다.
- 문서 상태: 구현 전 목표 사양이다. 실제 화면 검증 결과는 [DESIGN_QA](DESIGN_QA.md)에 integrator가 기록한다.

## 1. 결정: 생김새 입력으로 캐릭터를 만든다

| 항목 | 결정 | 이유 |
| --- | --- | --- |
| v1 생성 방식 | 아이별 생김새(appearance)를 고르면 앱이 **파라메트릭 벡터 캐릭터**를 즉시 그린다 | 외부 생성 제공자 미선정·비용·사진 외부 전송 동의가 모두 없어도 동작한다. 오프라인·즉시·무료·반복 동작 일관 |
| 사진 기반 AI 생성 | 보류. 0009 M0/M2는 "이후 옵션"으로 남긴다 | 제공자·동의·비용이 확정되면 같은 appearance 모델을 초기값 추정에 재사용할 수 있다 |
| 렌더링 | `react-native-svg`(Expo 지원 버전)로 파츠를 그린다 | 현재 View 도형은 곡선·무늬·털을 표현할 수 없다 |
| 저장 | v1은 **계정·pet별 기기 로컬** 저장. `pets.appearance jsonb` 추가는 사용자 결정 대기 | 가족이 같은 캐릭터를 보려면 서버 저장이 필요하다. DB 변경은 강한 리뷰·원격 migration이 따르므로 이번 범위에서 뺀다 |
| 범위 | 고양이 전체 속성, 개는 기본 속성(털색·귀·주둥이), other는 기본 실루엣 | 요청은 고양이별 생김새다. 집에 섞여 보이는 개도 같은 화풍이어야 한다 |

## 2. 생김새(appearance) 모델

`contexts/avatar/domain/appearance.ts`에 zod 스키마로 둔다. 모든 값은 언어 중립 enum이며 표시 문구는 i18n이 맡는다.
`version: 1`을 넣어 이후 속성 추가 시 기본값 보정으로 복원한다.

| 속성 | 값 | 기본값 | 비고 |
| --- | --- | --- | --- |
| `species` | cat · dog · other | pet.species | pet이 원본. appearance에 중복 저장하지 않고 렌더 시 pet에서 받는다 |
| `coatColor` | white · cream · ginger · brown · gray · black · lilac · chocolate | 고양이 gray, 개 cream | 바탕 털색. 8색 팔레트는 토큰(`characterColors`)에 둔다 |
| `coatPattern` | solid · tabby · bicolor · calico · pointed · tabbyWhite | solid | 개는 solid · bicolor만 |
| `accentColor` | coatColor와 같은 집합 | 패턴별 자동(규칙 §2.1) | 무늬·포인트·2색의 둘째 색. 사용자가 바꿀 수 있다 |
| `eyeColor` | amber · green · blue · copper · odd | amber | odd = 왼쪽 blue, 오른쪽 amber |
| `earShape` | pointed · folded · curled(고양이) / pointed · floppy(개) | pointed / floppy | |
| `furLength` | short · long | short | long은 실루엣 확장과 볼 털 추가 |
| `build` | slim · regular · round | regular | 몸통 폭·볼 폭 비율 |
| `tail` | long · short · fluffy | long | 개 fluffy = 말린 꼬리 |
| `faceMark` | none · blaze · maskedEyes · whiteMuzzle | none | 흰 무늬 계열. calico/bicolor는 whiteMuzzle 기본 |
| `collar` | none · red · blue · yellow · green | none | 방울은 collar가 none이 아닐 때 항상 그린다 |

### 2.1 자동 보조색 규칙

- tabby: accent = coatColor보다 한 단계 짙은 색(white→cream, cream→ginger, ginger→brown, gray→black, 그 외 chocolate).
- bicolor · tabbyWhite · calico: 흰 부분은 항상 white다. 고양이 bicolor·tabbyWhite는 **두 색만** 쓴다(coatColor + white).
  세 번째 색 패치를 그리지 않으며 accent 선택은 무시한다. calico만 세 색(white + ginger + black 고정)이다.
  개 bicolor는 white 바탕에 accent 귀·눈 주변 패치 1개를 허용하되 눈을 가리지 않는다.
- pointed: 몸 cream, 포인트(귀·얼굴·발·꼬리)는 accent(기본 chocolate), 눈은 blue 기본.
- 사용자가 accent를 직접 바꾸면 자동 규칙을 덮어쓰고 `accentColor`에 저장한다.

### 2.2 생성 도우미

- `randomAppearance(species, seed)`: 랜덤 버튼. 같은 seed는 같은 결과(테스트 가능).
- `presetAppearances(species)`: 빌더 첫 화면의 추천 6종(치즈 태비, 턱시도, 삼색, 샴, 회색 숏헤어, 흰 장모).
- `normalizeAppearance(unknown)`: 저장값 복원. 알 수 없는 값은 기본값으로 바꾸고 실패로 만들지 않는다.
- 기본 캐릭터(생김새 미설정)는 종별 기본값으로 그린다. 빈 이미지·빈 슬롯을 보이지 않는다.

## 3. 캐릭터 시각 규칙

- 화풍: 둥근 2등신(머리 폭 1, 몸 높이 0.9), 외곽선 없음, 2톤 음영(바탕색 + 15% 어두운 그림자 1겹), 볼 블러시.
  기존 방 색(`sceneColors`)과 같은 따뜻한 채도. 눈은 큰 아몬드형(고양이) · 둥근형(개), 흰 하이라이트 1점.
- 공통 앵커: 캔버스 하단 중앙이 **발바닥 기준점**이다. 방 배치·그림자·이름표는 이 점을 기준으로 한다.
  캔버스 비율은 `defaultCharacterCanvas(size, withBody)`를 유지해 기존 슬롯 계산을 깨지 않는다.
- 파츠 레이어 순서(뒤→앞): tail → body → backEar → head → earInner → faceMark/pattern → eyes → nose/mouth → whiskers → collar → frontPaws.
  각 레이어는 `Animated.View`로 감싼 독립 `Svg`다(§5 리그). SVG 속성 자체를 애니메이션하지 않는다.
- 머리만 쓰는 곳(아바타 40px, 목록 칩)은 head 레이어 묶음만 그린다. 몸 포함본은 집·요약창·빌더 프리뷰에 쓴다.
- 표정은 연출이며 건강·기분 판정이 아니다. 기록이 없어도 슬픈 표정·야윈 몸을 그리지 않는다([AI 안전](../product/AI_SAFETY.md)).
- 색은 `design-system/tokens.ts`에 `characterColors`(털 8색·눈 5색·목걸이 4색·코·하이라이트)로 추가하고 화면 코드에 hex를 두지 않는다.
- 순수 기하 모듈(`catCharacterGeometry.ts`, `dogCharacterGeometry.ts`)은 appearance → path 데이터만 만든다.
  RN 렌더러와 정적 SVG 문자열 렌더러(이미지 시트용)가 같은 기하를 쓴다.

## 4. 캐릭터 만들기 흐름

### 4.1 진입점

| 위치 | 동작 |
| --- | --- |
| 새 아이 등록(온보딩) | 이름·종류 저장 직후 "캐릭터 만들기" 단계. 건너뛰면 기본 캐릭터로 집에 들어간다 |
| 아이 상세 › 프로필 | "캐릭터 수정" 버튼 |
| 우리 집 요약창 | 캐릭터 옆 작은 "수정" 텍스트 버튼(owner만) |
| 0마리 빈 상태 | 기본 고양이·개 실루엣 2개 + "첫 아이 등록" |

### 4.2 빌더 화면(AppearanceBuilder)

```text
[←] 루나의 캐릭터                         [랜덤 🎲]
┌─────────────────────────────────────────┐
│          (라이브 프리뷰, 몸 포함, 바닥 그림자)   │  ← 속성이 바뀌면 즉시 반영, 탭하면 §5 탭 반응
│          루나 · 코리안 숏헤어                   │
└─────────────────────────────────────────┘
추천   털색   무늬   눈   귀·털   몸·꼬리   얼굴·목걸이    ← 가로 스크롤 탭(세그먼트)
┌ 선택 그룹의 칩/스와치 ─────────────────────┐
│ ● ● ● ● ● ● ● ●  (색 스와치 + 색 이름 텍스트) │
└─────────────────────────────────────────┘
[ 완료 ]   기본으로 되돌리기
```

- 프리뷰는 화면 상단 고정, 속성 영역만 스크롤한다. 작은 폰(360×640)에서도 프리뷰·탭·완료가 한 화면에 든다.
- 색 스와치는 색 이름을 텍스트로 함께 쓴다(색만으로 구분 금지). 선택 상태는 테두리+체크 아이콘.
- 모든 칩은 `accessibilityRole="button"`과 `accessibilityState.selected`, 접근성 이름 "털색, 회색, 선택됨"을 갖는다.
- 완료 시 0.6초 "생성 연출"(§5 reveal) 후 돌아간다. 동작 줄이기 설정이면 연출 없이 즉시 돌아간다.
- 저장 실패는 로컬 저장 특성상 드물지만 발생하면 이전 생김새를 유지하고 오류 배너를 보인다.
- 온보딩에서는 "건너뛰기"를 제공하고, 건너뛴 아이는 기본 캐릭터로 표시한다. 루틴·치료 입력을 선행 숙제로 요구하지 않는다.

## 5. 모션 계획 (lead 소유)

### 5.1 리그

- 캐릭터는 레이어별 `Animated.View`(tail · body · head 묶음 · eyes · frontPaws)로 구성한다. 변환은 translate · scale · rotate만 쓴다.
- 회전 기준점: tail은 꼬리 뿌리, ear는 귀 뿌리. SVG 안에서 기준점을 캔버스 원점에 맞춰 그리고 바깥 View의 `transformOrigin` 대신 translate 보정을 쓴다.
- 드라이버: native에서는 `useNativeDriver: true`, web은 false(기존 `nativeDriver` 패턴 유지). 프레임마다 React state·query를 갱신하지 않는다.
- 아이별 seed(`hashSeed(pet.id)`)로 지연·주기를 흩어 여러 아이가 동시에 움직이지 않게 한다.

### 5.2 모션 카탈로그

| 이름 | 트리거 | 파츠·값 | 시간 | 게이트 |
| --- | --- | --- | --- | --- |
| breathe | idle 상시 | body scaleY 1↔1.02, head translateY 0↔1px | 2.4s 왕복, inOut | motion |
| blink | 2.4–4.0s 간격(seed), 12%는 두 번 깜빡임 | eyes scaleY 1→0.1→1 | 70ms / 120ms | motion |
| tailSway | idle 상시 | tail rotate −6°↔+6° | 1.8s 왕복 | motion |
| earTwitch | 6–12s 간격(seed) | 한쪽 ear rotate ±8° | 120ms 왕복 | motion |
| wander | 0.6–1.5s 뒤 시작, 기존 루프 유지 | 전체 translateX ±16px, 이동 방향으로 scaleX ±1(좌우 반전), 이동 중 translateY 2px 바운스 0.3s | 2.2s/2.8s/1.8s 구간 | motion ∧ ¬paused |
| sit | 4.2–6.8s 간격 | body scaleY 0.92 + translateY 4%, frontPaws 안쪽으로 translate | 380ms 들어가 1.7s 유지 420ms 복귀 | motion ∧ ¬paused |
| lift | 긴 누름 성공 | 전체 scale 1.08, translateY −10, 그림자 scale 0.8·opacity 0.6, tailSway 2배 속도 | spring(friction 6, tension 120) | 항상 |
| tapReact | 짧은 탭(요약창 열기 직전) | 전체 scaleY 0.9→1.05→1, blush opacity 0.55→0.9→0.55 | 320ms | 항상(동작 줄이기면 opacity만) |
| saveReact | 실제 기록 저장 성공 후 1회 | translateY −8 점프 + 눈 레이어를 "웃는 눈" 호(arc)로 교체 | 200ms 점프, 1.2s 유지 | 항상(동작 줄이기면 눈만 1.2s) |
| reveal | 빌더 완료 | scale 0.8→1.04→1, opacity 0→1, 바닥 그림자 함께 | 600ms | 동작 줄이기면 생략 |

### 5.3 규칙

- `motion` 게이트 = 화면 표시 중 ∧ 앱 active ∧ 사용자 정지 토글 off ∧ OS 동작 줄이기 off(`useHouseMotionEnabled` 재사용).
  `paused` = 드래그 중 ∨ 요약창/기록 대상 선택 중 ∨ 겹침 목록 열림.
- 동작 줄이기에서는 지속 루프(breathe·blink·tailSway·earTwitch·wander·sit)를 모두 끄고 정지 포즈로 둔다. 단발 반응은 opacity만 쓴다.
- 비활성 화면·백그라운드에서는 루프를 stop하고 값을 초기화한다(기존 effect cleanup 패턴).
- 성능 예산: 아이 6마리 동시 idle에서 web 60fps, JS 스레드 commit 0/s(루프는 Animated가 돈다). 레이어 수는 아이당 ≤6.
- 금지: 기록 누락·투약 상태로 표정·자세를 바꾸는 모션, 무한 반복 파티클, 소리.
- 검증: 모션 토글 on/off, 동작 줄이기 에뮬레이션(web `prefers-reduced-motion`), 드래그 중 wander 정지, 탭 반응 후 요약창 포커스, 6마리 commit 측정.

## 6. 화면 재설계

공통 방향: 캐릭터가 주인공이다. 기존 token(크림 배경·주황 CTA·둥근 카드)을 유지하고 새 hex를 화면에 두지 않는다.

| 화면 | 바꾸는 것 |
| --- | --- |
| 우리 집 | 방 높이 유지하되 머리 크기 56→68px. 배경에 창(낮 빛)·러그·바닥 라인으로 깊이. 상단 바: 제목·아이 추가·기록+. 방 아래 "가까운 케어" 카드(다음 1–2건, 아이 머리 아바타 + 시간), 도구 토글(정지·자리 고정)은 카드 아래 작은 칩 행. 아이 목록은 머리 아바타 칩 가로 스크롤 |
| 0마리 | 실루엣 2개와 짧은 설명, "첫 아이 등록" 주 버튼 |
| 아이 요약창 | 상단 캐릭터 몸 포함 120px + 이름·품종·나이, "캐릭터 수정"(owner). 오늘 기록·다음 일정·최근 추억 3칸은 유지 |
| 아이 상세 › 프로필 | 사진 대신 캐릭터 머리 아바타를 기본으로, 실제 사진은 보조 카드. "캐릭터 수정" 버튼 |
| 온보딩 | 이름·종류·(사진 선택) 저장 → 캐릭터 만들기 단계(§4.2) → 집 |
| 오늘 케어·추억·목록 칩 | `PetAvatar`가 사진 없을 때 종별 기본 도형 대신 appearance 머리를 그린다. 사진이 있으면 사진 우선(기존 규칙 유지) |

- 사진이 있는 아이도 집에서는 캐릭터를 쓴다. 사진은 요약창·프로필의 보조 정보다(기존 "사진 원형" 집 표시는 제거).
- KO/EN, 긴 이름(12자), 큰 글자, 360px 폭에서 깨지지 않는다. 겹친 아이 목록·접근성 이름·focus 복귀 규칙은 AVATAR_HOME_UX §공간과 조작을 따른다.

## 7. 이미지 산출물

구현과 함께 아래 이미지를 만든다. 저장은 run dir `images/`이며 선별본은 lead가 `docs/design/character-v2/`로 옮긴다.

| 파일 | 내용 |
| --- | --- |
| `sheet-cats.png` | 추천 6종 + 랜덤 6종 = 고양이 12마리 격자(몸 포함, 이름표 없음) |
| `sheet-dogs.png` | 개 기본 6종 |
| `sheet-poses.png` | 한 고양이의 idle · blink · sit · lift · saveReact(웃는 눈) 정지 프레임 5개 |
| `house-{ko,en}-{1,3,6}.png` | 우리 집, 아이 수별 (390×844) |
| `house-empty-ko.png` | 0마리 |
| `builder-{ko,en}-{preset,color,pattern,eyes,done}.png` | 빌더 단계별 |
| `summary-ko.png`, `detail-profile-ko.png`, `onboarding-character-ko.png`, `today-care-ko.png` | 나머지 화면 |

시트는 순수 기하 → 정적 SVG → PNG(headless Chrome)로 만들고, 화면은 web preview를 headless Chrome으로 캡처한다.

## 8. 구현 패킷 경계

담당: codex 한 패킷(사용자 지정). 수정 허용:
`apps/mobile/src/contexts/avatar/**`(신규), `presentation/house/**`, `presentation/screens/{HouseScreen,PetDetailScreen,PetOnboardingScreen,PetOnboardingHelpers}*`,
`presentation/PawBloomShell.tsx`·`presentation/navigation/**`·`presentation/shell/{AppearanceRoute.tsx,appearanceOnboarding.ts}`(빌더 route·온보딩 연결, 2026-10-28 integrator 검토 후 수용), `contexts/pet/ui/samplePets.ts`(미리보기 샘플 4마리),
`design-system/tokens.ts`(characterColors), `i18n/translations.ts`, `apps/mobile/package.json`+lock(`react-native-svg`), `scripts/render-character-sheet.mjs`(신규), 관련 테스트.
금지: `supabase/**`, `docs/**`, `AGENTS.md`, `contexts/*/infrastructure` 중 avatar 외, 계정·Auth·동기화 로직.
검증: `npm run verify`, 새 domain·presentation 테스트, §5.3 검증, §7 이미지. 커밋·푸시·배포 금지.

## 9. 남은 결정

- `pets.appearance jsonb` 서버 저장(가족 공유)과 migration 시점.
- 사진 기반 AI 생성 재개 여부와 제공자. 재개 시 appearance 추정으로 빌더 초기값을 채우는 방식.
- 개·other 속성 확장 범위, 계절 목걸이 등 꾸미기 요소(첫 버전은 상점 없음).
- 실기기 iOS/Android 모션 성능과 동작 줄이기 실측.
- 계정 삭제 시 기기 로컬 생김새 삭제. 키가 계정별이라 다른 계정에 보이지 않고 민감 정보가 아니어서 v1은 남긴다.
  계정 삭제 흐름(identity)을 바꾸는 일이라 서버 저장 결정과 함께 정한다.
- web 모션이 react-native-web 내부 API에 의존한다. RNW 버전 고정 여부를 정한다.
