---
owner_role: lead
domain: product-design
edit_policy: exclusive
---

# 캐릭터 v3 — 픽셀 그리드 파라메트릭 설계

- 기준: 2026-10-30 사용자 요청. `docs/design/character-v3/reference/`의 생성 시트(픽셀 고양이 4장 + 프롬프트)를
  **화풍·포즈·동작의 정본**으로 삼아 캐릭터를 다시 만든다. v2([CHARACTER_DESIGN](CHARACTER_DESIGN.md))의 생김새 모델·빌더·저장·
  모션 게이트·화면 배치는 유지하고, **그리는 방식과 모션 방식**을 이 문서가 바꾼다. 충돌하면 이 문서가 우선한다.
- 사용자 결정: 렌더는 픽셀 그리드 파라메트릭, 동작 범위는 시트 전체, v2는 커밋(`61bb319`) 후 그 위에서 진행.
- 구현은 codex 패킷, 화면 마감·캡처 확인은 ui 패킷, 판정은 integrator. 결과 기록은 [DESIGN_QA](DESIGN_QA.md).

## 1. 화풍 규칙 (시트에서 읽은 것)

| 항목 | 규칙 |
| --- | --- |
| 논리 해상도 | 프레임 **48×48 논리 픽셀**. 캐릭터는 약 36~44px 폭, 발바닥 기준선은 44행. 바닥 그림자는 그리지 않는다(방이 그린다) |
| 확대 | 정수 배율 우선(2×=96, 3×=144). 비정수일 때도 `shape-rendering="crispEdges"`로 블러 없이 그린다 |
| 외곽선 | 1논리픽셀, 진한 자두색(토큰 `characterColors.pixelOutline`). 모든 실루엣과 파츠 경계에 쓴다 |
| 음영 | 평면 2~3단: 바탕·바탕 그림자(15% 어둡게)·하이라이트 없음. 그라디언트·안티앨리어싱 금지 |
| 눈 | 크고 둥근 눈: 외곽 1px, 홍채(eyeColor), 동공 진한색, 하이라이트 민트 1px + 흰 1px |
| 흰 부위 | 주둥이·가슴 bib·네 발 양말은 패턴과 무관하게 항상 흰색(`white`) |
| 귀 안쪽 | 코럴 핑크(`pixelEarInner`), 코 핑크(`nose`), 발바닥 핑크(`pixelPaw`) |
| 금지 | 소프트 엣지, 텍스처, 외곽 halo, 색 번짐, 그림자 드롭, 글자·장식 |

색은 `design-system/tokens.ts`의 `characterColors`에 슬롯 이름으로 둔다. 화면·데이터 파일에 hex를 두지 않는다.

## 2. 프레임 데이터 모델

`contexts/avatar/domain/pixelFrames.ts`(생성 산출물 `pixelFrames.generated.ts` + 수작업 보정 `pixelFrames.overrides.ts`).

```ts
type PixelFrame = { pose: PixelPose; index: number; width: 48; height: 48; rows: readonly string[] /* 48개, 각 48자 */ };
```

문자 = 팔레트 슬롯. `.` 투명 · `o` 외곽선 · `b` 바탕 · `s` 바탕 그림자 · `t` 무늬(accent) · `w` 흰 부위 · `W` 흰 그림자 ·
`e` 귀 안쪽 · `i` 홍채 · `k` 동공/눈 외곽 · `h` 하이라이트 · `n` 코 · `p` 발바닥 · `m` 입/수염선.
패턴·표식·목걸이는 **마스크 레이어**로 분리한다: `PixelMask = { pose, index, rows }`에서 `x` = 적용 픽셀.

| 레이어 | 적용 | 데이터 출처 |
| --- | --- | --- |
| 기본 프레임 | 모든 포즈·프레임 | 갈색 태비 시트 추적. `t`가 줄무늬 |
| `solid` | `t`→`b` 치환 | 규칙 |
| `tabby` | 기본 프레임 그대로 | 추적 |
| `bicolor`·`tabbyWhite` | 흰 마스크(배·얼굴 아래·다리 위쪽) 적용, 세 번째 색 없음(v2 §2.1 유지) | 턱시도 행(coat-variants) 추적 + 포즈별 수작업 |
| `calico` | 패치 마스크 2종(ginger·black 고정) | 삼색 행 추적(front/side/back/action) → 나머지 포즈는 가장 가까운 방향의 마스크 재사용 |
| `pointed` | 몸 cream, 포인트 마스크(귀·얼굴 중앙·발·꼬리)=accent | 수작업 |
| `faceMark` blaze·maskedEyes·whiteMuzzle | 정면 프레임(sit·blink·wave·walkFront)에만 흰 마스크 | 수작업 |
| `collar` | 정면·측면 프레임 목 1~2행 + 방울 2×2 | 수작업 |
| `earShape` folded·curled | 귀 상단 3~4행 대체 패치(정면·측면) | 수작업 |
| `tail` short·fluffy | sit·측면 프레임 꼬리 대체 패치 | 수작업 |

`furLength`·`build`는 스키마에 남기되 v3 빌더 탭에서 **숨긴다**(렌더 차이를 만들 수 없는 옵션을 보여 주지 않는다).
개(`dog`)는 고양이 프레임을 바탕으로 귀(floppy)·주둥이·말린 꼬리를 바꾼 **최소 세트**(sit·blink·walkSide·sleep)만 수작업으로 만들고,
없는 포즈는 sit로 대체한다. `other`는 둥근 실루엣 1프레임. 개 전용 시트가 생기면 같은 파이프라인으로 교체한다.

## 3. 포즈·클립 (시트 전체)

| 클립 | 프레임 | 출처 시트(행) | 용도 |
| --- | --- | --- | --- |
| `sit` | 1 | actions v2 행1 1열 | 기본 정지 포즈, 머리 아바타·칩·동작 줄이기 |
| `blink` | 4 | actions v2 행1 | idle: seed 간격(2.4~4.0s)으로 1회 재생 |
| `wave` | 4 | actions v2 행2 | 짧은 탭 반응(v2 tapReact 대체) |
| `sleep` | 4 | actions v2 행3 | 기기 로컬 22:00~06:00 idle, 또는 요약창 "자는 중" 표시 없이 그냥 포즈만. 건강·기분 판정 아님 |
| `stretch` | 4 | actions v2 행4 | 실제 기록 저장 성공 반응(v2 saveReact 대체) |
| `walkRight` | 4 | walk v2 행1 | 배회 이동(오른쪽). 왼쪽은 **mirror**(scaleX −1) — 행2는 참고만 |
| `walkFront` | 4 | walk v2 행3 | 빌더 프리뷰·요약창 등장 연출 |
| `walkBack` | 4 | walk v2 행4 | 빌더 프리뷰(뒤돌기). 집에서는 미사용 |
| `run` | 1(+mirror) | angles v1 "RUN" | 긴 누름 성공(lift) 중 들린 포즈 |
| `jump` | 1 | angles v1 "JUMP" | 빌더 완료 reveal, 등록 직후 집 입장 |

- 클립 재생은 **프레임 적층 + opacity 스텝**으로 한다: 클립의 프레임들을 같은 자리에 겹쳐 그리고, Animated.Value 하나를
  0→N으로 돌리며 프레임 i의 opacity를 `[i, i+1) → 1, 그 외 0`으로 interpolate(native driver). **프레임마다 setState·query 갱신 금지**(v2 §5.3 유지).
  클립 전환(idle→walk)만 state 변경이다.
- 속도: walk 8fps, blink 10fps(70/120ms 감 유지), wave·stretch 6fps, sleep 2fps.
- 게이트·규칙은 v2 §5.3 그대로(motion 게이트·paused·동작 줄이기·백그라운드 정지·금지 사항). 동작 줄이기에서는 `sit` 1프레임 고정,
  탭·저장 반응은 opacity만.
- 성능 예산: 프레임은 슬롯별 **`<Path>` 1개**(가로 run을 `M x y h n v1 h-n z`로 합침)로 그려 프레임당 path ≤ 14개. 6마리 idle에서 web 60fps.

## 4. 추적 파이프라인 (`scripts/trace-pixel-sheet.mjs`)

- 의존성 추가 없음: `apps/mobile/node_modules/pngjs`를 `createRequire`로 읽는다(기존 `run-presentation-test.mjs` 패턴).
- 입력: 시트 PNG, 격자(4×4), 셀별 포즈 이름. 투명 시트(walk v2·actions v2)는 alpha bbox로 자르고,
  크림 배경 시트(angles v1·coat-variants v1)는 배경색 키잉 + 라벨 영역(셀 하단 14%) 제외 후 자른다.
- 셀 → 48×48: 긴 변을 44px로 맞춰 최근접 샘플링, 발바닥을 44행에 정렬, 가로 중앙 정렬. 같은 클립의 4프레임은 **같은 배율·기준선**을 쓴다
  (가장 큰 bbox 기준) — 프레임 사이에서 크기가 튀지 않게 한다.
- 픽셀 분류: 셀의 색을 참조 팔레트(honey·caramel·ivory·coral·plum·dark·mint·pink)와 최근접 거리로 슬롯에 매핑. 다수결로 1논리픽셀 결정.
- 출력: `pixelFrames.generated.ts`와 검수용 `docs/design/character-v3/trace-<sheet>.png`(48×48을 4배 확대한 격자 미리보기).
- 수작업 보정은 `pixelFrames.overrides.ts`에서 포즈·프레임 단위로 행을 덮어쓴다. 생성 파일은 직접 편집하지 않는다(재실행 가능).
- 품질 기준(테스트로 고정): 모든 프레임 48×48, 허용 문자만, 외곽선이 닫힘(바탕 픽셀이 투명과 직접 맞닿지 않음), 발바닥 기준선 44±1,
  같은 클립의 프레임 간 bbox 폭·높이 차이 ≤ 3px, 눈 슬롯이 정면·측면 프레임에 존재, walkBack에 눈·코·입 없음.

## 5. 화면·빌더 반영

- `CharacterSvg`의 공개 props(`species, appearance, size, withBody, motion, pose`)는 유지하고 내부를 픽셀 렌더러로 바꾼다.
  `pose` 값은 §3 클립 이름으로 확장한다. 머리 아바타(`withBody=false`)는 `sit` 프레임의 머리 영역(눈 도장 아래 주둥이·턱까지, 약 상단 31행)을 잘라 그린다. 귀 끝과 턱이 원형 프레임 안에 들어와야 한다(2026-10-31 조정: 큰 눈 도장 적용 후 26행은 눈 바로 아래에서 얼굴이 끊김).
- 빌더: 프리뷰는 `blink` idle. 탭 행에서 `furLength`·`build` 제거. 프리뷰 아래 작은 포즈 칩(앉기·걷기·자기·기지개)으로 동작 확인 가능.
- 우리 집: 배치·드래그·요약창·이름 칩·가까운 케어는 그대로. 캐릭터 크기 2× (96px) 기본, 좁은 폰은 1.5×.
- 시트 산출(`scripts/render-character-sheet.mjs` 확장): `docs/design/character-v3/sheet-cats.png`(추천 6 + 랜덤 6),
  `sheet-dogs.png`(개 최소 세트), `sheet-clips.png`(고양이 전 클립 프레임), `house-ko-4.png`, `builder-ko.png`, `summary-ko.png`.

## 6. 수용 기준

- `npm run verify` 통과. §4 품질 테스트·팔레트 매핑 테스트·클립 opacity 스텝 테스트·동작 줄이기 테스트 통과.
- 추천 6종이 시트의 ginger·tuxedo·calico·silver 느낌으로 식별된다(색만 다른 같은 고양이가 아니어야 한다).
- 웹 프리뷰 390×844에서 4마리 idle·배회·탭·저장 반응을 실제로 확인하고 스크린샷을 남긴다. 픽셀 경계가 번지지 않는다.
- 기존 아이의 저장된 v2 생김새가 그대로 로드된다(스키마 `version: 1` 유지).

## 7. 남은 결정

- 개 전용 픽셀 시트 생성 여부와 시점. 생성 전까지 개는 최소 세트다.
- `walkFront`·`walkBack`을 집에서 쓸지(현재는 빌더 프리뷰만).
- 계절 목걸이·소품 등 꾸미기(첫 버전 없음), `pets.appearance` 서버 저장(v2 §9 승계).
