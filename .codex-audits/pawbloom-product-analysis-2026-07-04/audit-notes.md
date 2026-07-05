# PawBloom Product Analysis Notes

Date: 2026-07-04

Scope:
- Auth, Today, Diary, Care, Reports screens
- Repository product documents, architecture documents, frontend/backend/database rules
- Current implementation state in `apps/mobile`, Supabase migrations, and Edge Functions

Evidence:
- `00-auth.png`: configured build login screen
- `00-signup.png`: configured build signup screen
- `01-today-viewport.png`: local preview Today screen
- `02-diary.png`: Diary date/category screen
- `03-diary-form.png`: Diary form lower area
- `04-care-top.png`: Care top area
- `04-care.png`: Care form lower area
- `05-reports.png`: Reports draft top area
- `06-reports-actions.png`: Reports action area

## Step Findings

1. Auth screen
   - Health: weak for conversion.
   - Strength: clearly communicates that records are sensitive and synced securely.
   - Risk: users must create an account before seeing the product value; copy focuses on Supabase/RLS rather than user benefit.
   - Recommendation: add a short value preview before account creation: "7-day vet report", "family care log", "safe record-based summary".

2. Today screen
   - Health: good emotional entry, moderate UX risk.
   - Strength: pet hero, completion count, medication count, checklist, and timeline are understandable.
   - Risk: hero text overlaps the pet image and some Korean/English text is hard to read.
   - Recommendation: add stronger hero scrim or move pet metadata below the image; make the care/report CTA visible when care records exist.

3. Diary screen
   - Health: useful but too heavy for daily repeated entry.
   - Strength: date selection, category tiles, selected date records, edit flow.
   - Risk: the monthly calendar dominates the first screen, delaying the main daily logging action.
   - Recommendation: default to compact Today/This week controls; expand the full month only when the user asks.

4. Diary form
   - Health: has a serious mobile layout issue.
   - Strength: category-specific structured fields match the product strategy.
   - Risk: two-column food input fields overflow to the right on a 390px mobile viewport.
   - Recommendation: stack paired inputs vertically or use a responsive one-column layout on narrow screens.

5. Care screen
   - Health: strategically important, but form-heavy.
   - Strength: care defaults and quick dose records are the right primitives for a vet-report product.
   - Risk: key paid value, report generation, sits below a long setup/input flow.
   - Recommendation: split into "Today medication", "Active care plan", and "Vet report readiness" sections; show report readiness near the top.

6. Care form
   - Health: serious mobile layout issue.
   - Strength: captures medication name, condition, prescribed amount, administered amount, status, and reaction note.
   - Risk: paired dose fields overflow right on mobile, similar to Diary.
   - Recommendation: fix responsive field layout before beta testing.

7. Reports screen
   - Health: promising but not yet monetizable.
   - Strength: safety disclaimer is clear; confirm-before-share flow is good.
   - Risk: current report is mostly counts and does not yet feel like a clinic-ready artifact.
   - Recommendation: add timeline highlights, missing data list, vet questions, English summary preview, share link state, and export/share proof.

8. Reports action area
   - Health: decent flow skeleton.
   - Strength: "confirm draft" and "add more records" map to a safe sharing process.
   - Risk: no visible share URL, expiry, recipient view, PDF/export, or locked paid upgrade moment.
   - Recommendation: make confirmed/shared states concrete and show what the vet will see.

## Evidence Limits

- Screenshots were captured from Expo web preview, not native iOS/Android builds.
- Authenticated Supabase flows were reviewed from code and documents, not by creating a real account.
- No live user analytics, retention, CAC, conversion, or willingness-to-pay data was available.
- Market analysis is directional and source-backed, but not a replacement for paid user discovery.
