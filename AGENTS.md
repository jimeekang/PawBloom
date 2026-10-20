---
owner_role: lead
domain: pm
edit_policy: exclusive
---

# PawBloom 에이전트 라우팅 계약

이 파일은 전체 설명서가 아니라 **라우팅 계약(routing contract)**이다. 세 가지를 규정한다.
(1) 어떤 역할이 어떤 작업을 맡는가, (2) 각 역할이 어떤 모델·effort로 실행되는가,
(3) 각 역할이 어떤 문서·코드 영역을 수정할 수 있는가.
작업자는 자기 역할과 현재 작업에 필요한 문서만 읽고 진행한다(토큰 효율 규칙, 아래 참조).

이전 2모델 배타 소유(`claude-opus-4.8-extra` / `codex-high`, frontmatter `owner_model`)는 2026-10-20 폐기되었다.
이제 **Claude 팀장 + Codex 실행 세션** 구조와 역할 ID 기반 소유(`owner_role`)를 쓴다.

## 단일 원천 (중복 금지)

| 내용 | 단일 원천 |
| --- | --- |
| 작업 흐름(계획 → 분배 → 실행 → 통합 확인 → 보고) | `/orchestration` 스킬 (`~/.claude/skills/orchestration/SKILL.md`) |
| Claude 역할별 행동 지침·모델·effort | `~/.claude/agents/{codex-coordinator,ui-implementer,integrator}.md` |
| Codex 역할별 행동 지침·모델·effort | `~/.codex/agents/{analyst,implementer,quick_edit,explorer,reviewer}.toml` |
| Codex 역할 선택·상향 규칙 | `~/.codex/AGENTS.md` §2 |
| PawBloom 역할·소유 범위·게이트 | 이 파일 |

아래 역할 표의 모델·effort는 위 설정 파일의 사람용 요약이다. 모델을 바꿀 때는 설정 파일과 이 표만 고친다.
다른 프로젝트 문서에는 모델명을 쓰지 않는다(문서 소유는 역할 ID로 표기).

## 조직도

```text
사용자
  │ 요구사항·작업 지시
  ▼
lead — Claude Code 메인 세션 (/orchestration)      전체 분석·계획·설계·작업 분배
  │ 작업 패킷 전달 ↔ 진행 상황·결과 반환
  ├─▶ coordinator — Claude 서브에이전트             Codex에 작업 전달, 진행 확인·추가 지시
  │       ▼
  │     Codex 실행 세션 (같은 폴더·worktree)
  │       ├─ analyst     구현 전 분석
  │       ├─ implementer 구현·테스트
  │       ├─ quick_edit  저위험 명확 수정
  │       ├─ explorer    읽기 전용 탐색
  │       └─ reviewer    비판적 리뷰·분석 결과 정리
  ├─▶ ui — Claude 서브에이전트                      UI/UX 직접 구현
  ▼
integrator — Claude 서브에이전트                    코드 검토·최종 통합 확인
  ▼
lead → 사용자 보고
```

## 역할 표

| 역할 ID | 실행 위치 | 모델 / effort | 맡는 일 |
| --- | --- | --- | --- |
| `lead` | Claude Code 메인 세션 (`/orchestration` 실행 턴) | Claude Fable 5.1 / high | 전체 분석·계획·설계, 작업 분배, 사용자 보고 |
| `coordinator` | Claude 서브에이전트 `codex-coordinator` | Claude Opus 5.5 / high | Codex 작업 전달, 진행 확인·추가 지시, 결과 회수 |
| `ui` | Claude 서브에이전트 `ui-implementer` | Claude Opus 5.5 / high | UI/UX 직접 구현과 실제 화면 검증 |
| `analyst` | Codex 서브에이전트 | GPT-6 Astra / xhigh | 요구사항·설계 대안·위험·테스트 전략 분석 |
| `implementer` | Codex 서브에이전트 | GPT-6.1 Sol / high | 확정 설계 구현, 테스트 작성·실행 |
| `quick_edit` | Codex 서브에이전트 | GPT-6 Luna / high | 범위·정답이 명확한 저위험 수정 |
| `explorer` | Codex 서브에이전트 | GPT-6.1 Sol / xhigh | 읽기 전용 코드 탐색·호출 경로·영향 범위 조사 |
| `reviewer` | Codex 서브에이전트 | GPT-6 Astra / xhigh | 구현 결과 비판적 리뷰, 분석 결과 정리 |
| `integrator` | Claude 서브에이전트 `integrator` | Claude Opus 5.5 / high | 통합 diff 코드 검토, 게이트 실행, 최종 승인 판정 |

- Codex 메인 스레드는 역할 분배만 하며 모델은 `~/.codex/config.toml` 기본값을 따른다.
- `/orchestration` 턴이 끝난 뒤 이어지는 메인 세션 턴(에이전트 완료 알림 처리 등)은 세션 기본 모델로 실행된다.
- 지정 모델을 쓸 수 없으면 조용히 대체하지 않고 lead가 사용자에게 알린다.

## 문서 소유 (owner_role)

모든 추적 문서는 frontmatter로 **단일 역할에 배타 소유**된다. 아래 domain 어휘는
`scripts/verify-docs.mjs`가 강제하는 값과 **글자 그대로 일치**한다(코드-문서 단일 진실원).

| owner_role | 소유 주체 | domain 허용값 |
| --- | --- | --- |
| `lead` | 팀장 (Claude Fable 5.1) | `planning`, `product-design`, `analysis`, `pm` |
| `integrator` | 통합 검토 (Claude Opus 5.5) | `qa` |
| `codex` | Codex 실행 세션 전체 | `implementation`, `database`, `security`, `release`, `git` |

- `coordinator`·`ui`와 Codex 개별 역할은 문서를 소유하지 않는다. Codex 쪽 문서는 세션 전체(`codex`)가 소유한다.
- `README.md`와 `docs/product/PRIVACY_POLICY.md`는 frontmatter가 면제되며(공개 문서) 소유는 `lead`다.

## 역할별 수정 범위

문서의 소유는 frontmatter `owner_role`이 결정하고 `verify:docs`가 강제한다. 코드 경로는 아래 표를 따른다.

- **lead**: `docs/product/**`, `docs/analysis/**`, `docs/design/**`(DESIGN_QA 제외), `docs/superpowers/**`,
  lead 소유 `docs/exec-plans/**`, 이 `AGENTS.md`, `README.md`. 코드는 직접 고치지 않고 패킷으로 분배한다.
- **coordinator**: 저장소 파일을 수정하지 않는다. 작업 지시서·실행 로그는 세션 scratchpad에 둔다.
- **ui**: 화면·컴포넌트·스타일·레이아웃·카피 표현 —
  `apps/mobile/src/presentation/screens/**`, `apps/mobile/src/presentation/ui/**`,
  `apps/mobile/src/contexts/*/ui/**`, `apps/mobile/src/design-system/**`, `*.styles.ts`,
  `apps/mobile/src/i18n/translations.ts`의 문구.
  위 경로라도 Auth·권한·데이터 저장·동기화 로직을 바꾸는 변경은 codex가 맡는다.
- **integrator**: `docs/design/DESIGN_QA.md`, 최종 검증 판단·승인 기준. 결함은 직접 고치지 않고 소유 역할로 돌려보낸다.
- **codex**: 그 밖의 `apps/mobile/**`(domain·application·infrastructure·shell 로직, 테스트), `supabase/**`
  (functions·migrations·tests·config), `scripts/**`, `docs/engineering/**`, codex 소유 `docs/exec-plans/**`,
  `ARCHITECTURE.md`(lead 협의), EAS 설정, git 이력(브랜치·커밋·머지).

## 실행 규칙

- Claude와 Codex는 **같은 프로젝트 폴더·worktree**에서 실행한다. 별도 worktree를 만들지 않는다.
- 같은 파일을 동시에 고치지 않는다. lead가 패킷마다 파일 소유를 나누고, 겹치면 codex → ui 순으로 순차 실행한다.
  `translations.ts`처럼 양쪽이 건드리는 공유 파일은 항상 순차로 처리한다.
- 커밋·푸시·배포는 사용자가 요청한 경우에만, integrator 승인 후 codex(git 소유)가 실행한다.
- 미검증 항목을 완료(`[x]`)로 표기하지 않는다. 실행하지 못한 검증은 그대로 보고한다.

## 에스컬레이션 정신

리뷰 강도는 작업 위험도에 따라 달라진다.

- **좁고 되돌리기 쉬운 작업** (완료 기준이 명확하고, 런타임 동작에 영향이 적으며, 단일 하위 시스템에 국한):
  quick_edit 또는 implementer가 처리하고 integrator가 가볍게 확인한다.
- **강한 리뷰가 필요한 작업**: 다음 중 하나라도 건드리면 Codex reviewer의 비판적 리뷰를 필수로 거치고,
  integrator가 최대 강도로 검토하며, 배포 전 사용자의 명시적 승인을 받는다.
  - 아키텍처, 데이터 모델
  - Auth, RLS
  - AI 안전
  - 개인정보(privacy)
  - 릴리스 흐름
- 문서나 코드 지침이 서로 충돌할 때, 여러 하위 시스템이 얽힐 때, 결과가 최종 승인을 요구할 때는 강한 리뷰 경로를 택한다.
- 릴리스에 중요한 작업은 여러 약한 리뷰보다 **한 명의 강한 리뷰어**(integrator)에 집중시킨다.

## 토큰 효율 규칙

- **모든 에이전트가 모든 문서를 읽지 않는다.** 역할과 현재 작업에 필요한 문서만 읽는다.
- 필수 문서 인덱스(아래)에서 필요한 항목만 골라 연다. lead는 패킷에 읽을 문서를 지정해 넘긴다.
- 자기 소유가 아닌 문서는 참고만 하고 수정하지 않는다.
- 필요한 역할만 호출한다. 작은 작업에 모든 Codex 역할을 돌리지 않는다.

## 필수 문서 인덱스

작업에 필요한 것만 연다.

- 제품 범위: `docs/product/PRODUCT_SPEC.md`
- AI 안전: `docs/product/AI_SAFETY.md`
- 아키텍처: `ARCHITECTURE.md`
- 프론트엔드 규칙: `docs/engineering/FRONTEND.md`
- 백엔드 규칙: `docs/engineering/BACKEND.md`
- 데이터베이스 규칙: `docs/engineering/DATABASE.md`
- 품질 게이트: `docs/engineering/QUALITY.md`
- 릴리스 흐름: `docs/engineering/RELEASE.md`
- 디자인 QA: `docs/design/DESIGN_QA.md`
- 분석/리서치 인덱스: `docs/analysis/README.md`
  (하위: `00-executive-summary`, `01-market-research`, `02-product-ux`, `03-engineering`,
  `04-business-monetization` — 시장/제품/엔지니어링/수익화 분석)
- 실행 계획(활성): `docs/exec-plans/active/**`
- 실행 계획(아카이브): `docs/exec-plans/archive/**` — 완료·폐기된 계획은 활성에서 이곳으로 이동한다.

## 검증 (게이트)

작업을 넘기기 전 반드시 **`npm run verify`**를 통과시킨다. 이 게이트는 아래를 순서대로 실행한다:
`typecheck` → `verify:architecture` → `verify:i18n` → `verify:presentation` → `verify:ai-safety` →
`verify:secrets` → `verify:supabase` → `verify:offline` → `verify:release` → **`verify:docs`**.

**`verify:docs`(`scripts/verify-docs.mjs`)가 이 라우팅 계약을 코드로 강제한다:**

1. 추적되는 모든 `*.md`는 **300줄 이하**여야 한다(frontmatter 포함).
2. 모든 문서는 frontmatter로 단일 역할에 **배타 소유**된다:
   `owner_role` ∈ {`lead`, `integrator`, `codex`}, `domain`은 그 역할의 도메인 집합에 속해야 하고,
   `edit_policy`는 `exclusive`여야 한다. 소유 역할 외에는 수정 금지.
3. `README.md`와 `docs/product/PRIVACY_POLICY.md`만 frontmatter가 면제된다. 소유는 위 문서 소유 표로 선언한다.

이 세 규칙 중 하나라도 위반하면 `verify:docs`가 실패하고 전체 게이트가 막힌다.
`verify:docs`는 git이 추적하는 파일만 검사하므로, 새 문서는 추가(`git add`) 전에 frontmatter를 직접 확인한다.
이 문서의 소유 표와 `verify-docs.mjs`의 도메인 어휘는 항상 동일하게 유지해야 한다(단일 진실원).
