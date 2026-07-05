---
owner_model: claude-opus-4.8-extra
domain: pm
edit_policy: exclusive
---

# PawBloom 에이전트 라우팅 계약

이 파일은 전체 설명서가 아니라 **라우팅 계약(routing contract)**이다. 두 가지를 규정한다.
(1) 어떤 작업을 어느 모델이 소유하는가, (2) 각 모델이 어떤 문서·코드 영역을 수정할 수 있는가.
작업자는 자기 역할과 현재 작업에 필요한 문서만 읽고 진행한다(토큰 효율 규칙, 아래 참조).

이전의 `Codex 5.5 Extra High / High / spark` 3계층은 폐기되었다. 이제 **2모델 배타 소유** 모델을 쓴다.

## 라우팅 표 (routingTable)

두 모델이 도메인을 **배타적으로** 나눠 갖는다. 한 도메인은 정확히 한 모델이 소유하며, 교차 소유는 금지된다.
아래 domain 어휘는 `scripts/verify-docs.mjs`가 강제하는 값과 **글자 그대로 일치**한다(코드-문서 단일 진실원).

| owner_model | 담당 영역 | domain 어휘 (frontmatter `domain:` 허용값) |
| --- | --- | --- |
| `claude-opus-4.8-extra` | 계획, 기획, PM, 앱 디자인(비코드), QA, 분석 | `planning`, `product-design`, `qa`, `analysis`, `pm` |
| `codex-high` | 코딩, 코드리뷰, DB, 보안, git, 배포 (구현 전반) | `implementation`, `database`, `security`, `release`, `git` |

- `claude-opus-4.8-extra` = 무엇을·왜 만들지 결정한다. 제품 범위, 로드맵, 리서치/분석, 화면 흐름과 카피(코드 아님),
  QA 판단·최종 승인 기준을 소유한다.
- `codex-high` = 어떻게 만들지 실행한다. 프로덕션 코드, 코드리뷰, DB/마이그레이션/RLS, 보안·개인정보 로직,
  git 이력, 릴리스/배포 파이프라인을 소유한다.

### domain별 대응 (frontmatter → 소유 모델)

- `planning` / `product-design` / `qa` / `analysis` / `pm` → **claude-opus-4.8-extra**
- `implementation` / `database` / `security` / `release` / `git` → **codex-high**

`verify-docs.mjs`는 `owner_model`이 두 값 중 하나여야 하고, `domain`이 그 소유자의 도메인 집합에 속해야 하며,
`edit_policy`가 `exclusive`여야 함을 강제한다. 어긋나면 `npm run verify`가 실패한다.

## 에스컬레이션 정신

배타 소유가 도입되었어도, **리뷰 강도**는 작업 위험도에 따라 달라진다는 원칙은 그대로 유지된다.

- **좁고 되돌리기 쉬운 작업** (완료 기준이 명확하고, 런타임 동작에 영향이 적으며, 단일 하위 시스템에 국한):
  소유 모델이 가볍게 처리하고 넘긴다.
- **강한 리뷰가 필요한 작업**: 다음 중 하나라도 건드리면 소유 모델이 최대 강도로 검토하고, 배포 전 명시적 승인을 거친다.
  - 아키텍처, 데이터 모델
  - Auth, RLS
  - AI 안전
  - 개인정보(privacy)
  - 릴리스 흐름
- 문서나 코드 지침이 서로 충돌할 때, 여러 하위 시스템이 얽힐 때, 결과가 최종 승인을 요구할 때는 강한 리뷰 경로를 택한다.
- 릴리스에 중요한 작업은 여러 약한 리뷰보다 **한 명의 강한 리뷰어**를 선호한다.

## 토큰 효율 규칙

- **모든 에이전트가 모든 문서를 읽지 않는다.** 역할과 현재 작업에 필요한 문서만 읽는다.
- 필수 문서 인덱스(아래)에서 필요한 항목만 골라 연다.
- 구현/코드리뷰/DB/보안/배포 작업은 `codex-high`가, 계획/기획/분석/QA 작업은 `claude-opus-4.8-extra`가 소유하므로,
  자기 소유가 아닌 문서는 참고만 하고 수정하지 않는다.
- 릴리스에 중요한 작업은 한 명의 강한 리뷰어에게 집중시킨다.

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
- 분석/리서치 인덱스: `docs/analysis/README.md`
  (하위: `00-executive-summary`, `01-market-research`, `02-product-ux`, `03-engineering`,
  `04-business-monetization` — 시장/제품/엔지니어링/수익화 분석)
- 실행 계획(활성): `docs/exec-plans/active/**`
- 실행 계획(아카이브): `docs/exec-plans/archive/**` — 완료·폐기된 계획은 활성에서 이곳으로 이동한다.

## 역할별 수정 범위

각 역할은 아래 경로만 수정한다. 문서의 소유는 frontmatter `owner_model`이 결정하고, `verify:docs`가 강제한다.

- **계획·기획·PM (claude-opus-4.8-extra)**: `docs/product/**`, `docs/exec-plans/**`, 이 `AGENTS.md`
- **분석 (claude-opus-4.8-extra)**: `docs/analysis/**`
- **앱 디자인 비코드 (claude-opus-4.8-extra)**: `docs/design/**` (디자인 사양·카피, 코드 산출물 제외)
- **QA (claude-opus-4.8-extra)**: 최종 검증 판단·승인 기준, QA 관련 문서
- **아키텍처 문서 (codex-high 소유, claude-opus-4.8-extra 협의)**: `ARCHITECTURE.md`
- **코드 구현 (codex-high)**: `apps/mobile/**`, `supabase/functions/**`, `packages/backend/**`
- **DB (codex-high)**: `supabase/migrations/**`, `supabase/seed/**`, `docs/engineering/DATABASE.md`
- **보안·개인정보 (codex-high)**: 보안 문서, RLS 테스트, AI 안전 점검 로직
- **릴리스·배포 (codex-high)**: `scripts/**`, 릴리스 문서, EAS 설정, e2e 테스트
- **git (codex-high)**: 브랜치·커밋·머지 이력

## 검증 (게이트)

작업을 넘기기 전 반드시 **`npm run verify`**를 통과시킨다. 이 게이트는 아래를 순서대로 실행한다:
`typecheck` → `verify:architecture` → `verify:i18n` → `verify:presentation` → `verify:ai-safety` →
`verify:secrets` → `verify:supabase` → `verify:offline` → **`verify:docs`**.

**`verify:docs`(`scripts/verify-docs.mjs`)가 이 라우팅 계약을 코드로 강제한다:**

1. 추적되는 모든 `*.md`는 **300줄 이하**여야 한다(frontmatter 포함).
2. 모든 문서는 frontmatter로 단일 모델에 **배타 소유**된다:
   `owner_model` ∈ {`claude-opus-4.8-extra`, `codex-high`}, `domain`은 그 소유자의 도메인 집합에 속해야 하고,
   `edit_policy`는 `exclusive`여야 한다. 소유 모델 외에는 수정 금지.
3. `README.md`만 frontmatter가 면제된다(저장소 첫 화면이므로). 대신 소유는 이 `AGENTS.md` 라우팅 표로 선언된다.

이 세 규칙 중 하나라도 위반하면 `verify:docs`가 실패하고 전체 게이트가 막힌다.
따라서 이 문서의 라우팅 표와 `verify-docs.mjs`의 도메인 어휘는 항상 동일하게 유지해야 한다(단일 진실원).
