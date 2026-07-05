# Clinic Report Value Proof Design

Date: 2026-07-04
Status: approved for implementation by user request
Scope: mobile UI, deterministic report draft, safety copy, presentation verification

## Goal

Strengthen PawBloom's first monetizable product moment: a caregiver records daily/care details and sees a clinic-ready, safe, record-based vet report preview.

This slice does not implement real payments, PDF export, family invite delivery, offline replay, or a new AI prompt. It proves that the existing app experience can communicate why a user would pay before those heavier systems are added.

## Product Direction

PawBloom should not compete as a generic pet diary. The primary value proposition is:

> Family/caregiver records become a safe, vet-ready briefing before a clinic visit.

The implementation should make this value visible in four places:

1. Before signup: the user sees why an account is worth creating.
2. Today: the pet-first daily view stays warm, but care/report readiness is easier to notice.
3. Care: today's medication and report readiness come before long configuration forms.
4. Reports: the screen reads like a clinic artifact, not only a count dashboard.

## Implementation Slice

### Included

- Auth value preview for vet reports, family care logs, and safe record-based summaries.
- Mobile layout fixes for Diary and Care form overflow at 390px width.
- Stronger Today hero readability.
- Care report readiness card above long forms.
- Deterministic report draft fields:
  - timeline highlights
  - missing record prompts
  - vet questions
  - English clinic summary preview
  - medication adherence count
- Reports UI that shows a concrete draft, confirmed, and mock-shared state while clearly labeling mock share behavior.
- Safety copy cleanup so report and care summary surfaces keep the full non-diagnosis disclaimer.
- Presentation verification guards for the known overflow regressions.

### Deferred

- Real AI generation prompt changes.
- Real share-token viewer integration in the mobile UI.
- PDF export.
- RevenueCat, StoreKit, Play Billing, or actual subscription purchase.
- Family/caregiver invite delivery.
- Offline outbox persistence/replay.
- Native iOS/Android preview build generation.

## UX Design

### Auth

The auth screen must still explain that care records are sensitive, but the first value copy should be user-facing rather than infrastructure-facing.

Required value bullets:

- 7-day vet report preview
- Family care log
- Safe record-based summary

The screen should not mention Supabase or RLS in primary copy. That belongs in lower trust/support copy if shown at all.

### Today

The hero image remains the emotional first signal. The pet name and metadata must be readable over the image on a 390px viewport.

Implementation direction:

- Use a stronger bottom scrim or text backplate.
- Keep completion and pending medication cards below the hero.
- Do not add a marketing landing section.

### Diary

The full month calendar currently dominates the first viewport. The implementation should reduce repeated-entry friction.

Direction:

- Keep the existing full calendar available.
- Add a compact date summary/header above it or make the calendar less visually dominant.
- Category tiles and first detail fields should be visible sooner.
- Food fields must stack per meal on narrow mobile:
  - meal label
  - provided grams
  - eaten grams

### Care

Care is the paid-value center. It should feel like a daily treatment workspace, not a long setup form.

Top order:

1. Care/Report segmented control
2. Vet report readiness card
3. Today medication list
4. Quick medication record
5. Care plan defaults
6. Condition score and record-based summary

The quick medication form must stack dose fields at 390px:

- prescribed/default amount
- given today

Care setup should stack medication name and time picker rather than clipping.

### Reports

Reports should lead with the report artifact.

Required sections:

- State notice: draft, confirmed, shared, or empty.
- Report title and date range.
- Full safety disclaimer.
- English clinic summary preview.
- Timeline highlights.
- Missing record prompts.
- Vet questions.
- Compact metrics/adherence summary.
- Before-sharing checklist.
- Primary action for stage transition.
- Mock share link state for shared stage with expiry copy and clear "preview/mock" language.

Metrics should be compact. Large repeated cards are only acceptable when they carry meaningful text, not just a number.

## Safety Requirements

All report and AI-summary surfaces must show the full required disclaimer:

English:

```text
This is a record-based summary, not a diagnosis. Contact a veterinarian for medical decisions.
```

Korean:

```text
이 내용은 진단이 아니라 기록 기반 요약입니다. 의학적 판단은 수의사에게 문의하세요.
```

Report and care copy must stay observational:

- allowed: "기록상", "기록되지 않았습니다", "수의사에게 확인할 질문"
- disallowed: diagnosis, prescription, dose-change advice, "병원에 갈 필요 없음", emergency certainty, disease certainty

Condition trend wording should avoid medical improvement judgment. Use score movement wording:

- "점수 상승"
- "점수 하락"
- "점수 유지"

Medication copy may record prescribed/default amount and given-today amount. It must not suggest changing medication dose.

## Architecture

Use the existing frontend architecture:

- `apps/mobile/src/contexts/report/application/reportDraftRecords.ts` owns deterministic report summary logic.
- `apps/mobile/src/presentation/screens/ReportsScreen.tsx` renders report artifact sections.
- `apps/mobile/src/presentation/screens/CareModeScreen.tsx` renders report readiness without needing backend changes.
- `apps/mobile/src/presentation/screens/DiaryDetailPanel.tsx`, `CareMedicationPanel.tsx`, and `CareSetupPanel.tsx` own mobile form layout fixes.
- `apps/mobile/src/i18n/translations.ts` owns all visible copy.
- `scripts/verify-presentation-state.mjs` owns static presentation regression guards.

Avoid editing `PawBloomShell.tsx` unless required for navigation or props. It already has unrelated dirty checklist-notice changes.

## Testing And Verification

Add or update focused tests:

- `apps/mobile/src/contexts/report/application/reportDraftRecords.test.ts`
  - missing record prompts
  - timeline highlights
  - vet questions
  - English summary preview includes non-diagnosis wording
  - condition trend uses score movement wording
- `scripts/verify-presentation-state.mjs`
  - guards against known row-based overflow patterns in Diary and Care forms
  - preserves existing checklist notice test entry

Required commands before handoff:

```bash
npm run verify:presentation
npm run verify:i18n
npm run verify:ai-safety
npm run typecheck
npm run verify
```

## Acceptance Criteria

- Signup screen shows vet report, family log, and safe summary value before form submission.
- Today hero text is readable on captured 390px viewport.
- Diary food inputs do not clip horizontally at 390px.
- Care dose/setup inputs do not clip horizontally at 390px.
- Care first viewport prioritizes report readiness and today medication over setup.
- Reports first viewport shows the clinic artifact, full disclaimer, English preview, and primary action.
- Reports include timeline highlights, missing records, vet questions, and compact adherence/metric information.
- Confirmed/shared states are concrete and clearly labeled as mock/preview until real share tokens are connected.
- No new copy violates AI safety policy.
- `npm run verify` passes.

## Self-Review

- No placeholders remain.
- Scope is intentionally limited to mobile presentation and deterministic report summary logic.
- Deferred items are explicit and should not be silently implemented in this slice.
- Safety language uses the exact required disclaimers.
- Implementation avoids overwriting existing dirty checklist work.
