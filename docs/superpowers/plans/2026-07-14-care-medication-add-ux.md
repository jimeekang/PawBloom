---
owner_model: claude-opus-4.8-extra
domain: planning
edit_policy: exclusive
---

# 케어 탭 약 추가 UX (A안) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 케어 탭에서 중복 노출되던 케어 플랜 폼을 제거하고, 단일 "+ 약 추가" 진입점이 오늘만/며칠간/매일로 분기하는 UX로 재구성하며, 감사에서 나온 레이아웃 교정 10건을 반영한다.

**Architecture:** "오늘만"은 기존 `QuickMedicationForm`(medication/ui), "며칠간"은 신규 `ShortTermMedicationForm`(care/ui, 기존 케어 플랜 저장 파이프라인 재사용), 래퍼 `CareMedicationAddCard`는 presentation 레이어에서 두 컨텍스트를 조합한다. `CareSetupPanel`은 삭제하고 정적 가드를 새 구조에 맞게 갱신한다.

**Tech Stack:** React Native (Expo), TypeScript, 자체 디자인 시스템 토큰, throw-스타일 프레젠테이션 테스트 (`scripts/verify-presentation-state.mjs`가 수집·실행).

**Spec:** `docs/superpowers/specs/2026-07-14-care-medication-add-ux-design.md`

## Global Constraints

- `t()` 호출은 코드베이스 관례대로 항상 리터럴 `"ko"`를 첫 인자로 쓴다 (첫 인자는 사실상 무시되는 죽은 인자지만 관례를 따른다).
- 모든 i18n 키는 en/ko 두 블록에 모두 있어야 한다 — `npm run verify:i18n`이 패리티를 검사한다.
- **입력 필드는 세로 스택 유지** (390px 클리핑 가드). 짧은 고정 라벨 버튼(먹였어요/못 먹였어요)만 row 허용. 가드: `scripts/verify-presentation-state.mjs`.
- DDD import 규칙 (`npm run verify:architecture`): 컨텍스트 간 import 금지 (application→application, ui의 type-only domain import만 예외). 컨텍스트 조합은 presentation에서. presentation은 context infrastructure를 import할 수 없다.
- 테스트는 jest가 아니라 **throw-스타일 일반 TS 파일** (`*.test.ts`/`*.test.tsx`). 단일 실행: `node scripts/run-presentation-test.mjs <repo-relative-path>`. 전체: `npm run verify:presentation`.
- `docs/design/DESIGN_QA.md`는 `edit_policy: exclusive` (다른 모델 소유) — **절대 수정하지 않는다.**
- 타입체크: `npm run typecheck`. 커밋은 태스크마다.
- 모든 경로는 리포 루트(`/Users/jimee/Desktop/Project/PawBloom/.claude/worktrees/mobile-design-system-7b4895`) 기준.

---

## 분할 실행 문서

- [Task 1–2: i18n 및 단기 복용약 로직](./2026-07-14-care-medication-add-ux-task-01-02.md)
- [Task 3: 단기 복용약 폼](./2026-07-14-care-medication-add-ux-task-03.md)
- [Task 4: 약 추가 카드](./2026-07-14-care-medication-add-ux-task-04.md)
- [Task 5 및 Task 6 준비](./2026-07-14-care-medication-add-ux-task-05-06-setup.md)
- [Task 6: 케어 화면 재구성](./2026-07-14-care-medication-add-ux-task-06-screen.md)
- [Task 6 마무리 및 Task 7](./2026-07-14-care-medication-add-ux-task-06-finish-07.md)
- [Task 8–9: 프로필 교정 및 최종 검증](./2026-07-14-care-medication-add-ux-task-08-09.md)
