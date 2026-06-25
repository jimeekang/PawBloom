# PetPaw Positioning And Feature Strategy Design

Date: 2026-06-25
Status: Approved direction from brainstorming
Scope: Product positioning, MVP feature focus, exclusions, and V2 candidates

## 1. Product Position

PetPaw is not positioned as a generic pet diary app.

The product position is:

> PetPaw helps families record daily and care-related pet observations together, then turns those records into a safe, vet-ready briefing.

The main use case is:

- Normal days: a fast Today-based pet care diary.
- Sick or treatment days: structured Care Mode records.
- Vet visit: record-based summary, missing record review, suggested vet questions, and a shareable report.

This keeps PetPaw away from the most crowded part of the market: simple pet diaries, generic reminders, GPS walk trackers, and pet sitter marketplaces.

## 2. Market Read

The broad pet app market is crowded.

Common existing categories:

- Daily care and reminder apps: food, medication, grooming, vaccination, and routine records.
- Family pet care logs: multiple people recording the same pet's activities.
- Dog walking apps: GPS route tracking, live walk visibility, walker marketplaces, and photo updates.
- Vet-connected apps: appointment requests, refills, records, reminders, and clinic communication.
- AI or vet tools: medical history summarization and vet workflow support.

The red-ocean area is:

- Basic diary.
- Basic medication reminder.
- Basic walk log.
- Generic pet profile and photo timeline.
- Community, rankings, challenges, and marketplace features.

PetPaw's wedge is the connected flow:

> Family record -> missing evidence check -> vet visit preparation -> safe report sharing.

That flow is more defensible than "another pet tracker" because it solves a high-stress moment: owners and families trying to explain what happened before a vet visit.

## 3. MVP Strategy

MVP should prioritize Care/Vet Report as the core differentiator.

MVP must feel useful even before a pet is sick, but the strongest product promise appears when the pet needs structured care.

The MVP product pillars are:

1. Today-based daily recording.
2. Family shared care records.
3. Care Mode for illness, medication, symptoms, and treatment response.
4. AI-assisted record summary, missing records, and vet question suggestions.
5. Vet Report sharing by expiring link.

The MVP should avoid overexpanding into GPS, marketplace, community, insurance, and advanced species coverage.

## 4. Sharing Model

MVP includes family shared records and vet report sharing.

### Owner

The owner can:

- Create, edit, and delete pets.
- Invite or remove family/caregivers.
- Manage all diary, care, medication, media, and report records.
- Generate vet reports.
- Create expiring report share links.

### Family/Caregiver

Family and caregivers can:

- Add daily records.
- Add food, water, stool, condition, walk, memo, and media records.
- Mark medication status.
- Add symptom and care observations.
- View shared pet history according to membership.

Family/caregiver cannot:

- Delete the pet.
- Remove the owner.
- Change billing or entitlement state.
- Access Supabase service-role operations.

### Vet Report Viewer

Vet report viewers:

- Do not need an app account.
- Access only the sanitized vet report payload through an expiring link.
- Cannot access raw pet, diary, member, medication, media, or profile tables.

### Excluded From MVP

Pet sitter time-limited invitations are excluded from the first MVP feature set. They can be added after the owner/family/vet-report-viewer permission model is stable.

## 5. Animal Profile Strategy

MVP supports:

- Dog: deep template.
- Cat: deep template.
- Other: basic flexible template.

### Dog Template

Dog records should emphasize:

- Walk and activity.
- Food and water.
- Stool and urine.
- Condition and energy.
- Medication.
- Symptom photos.
- Treatment response.

### Cat Template

Cat records should emphasize:

- Water intake.
- Appetite.
- Litter box use.
- Vomiting.
- Stool/urine changes.
- Condition and hiding/energy changes.
- Medication.
- Symptom photos.

### Other Animal Template

Other animals use:

- Basic profile fields.
- Flexible daily notes.
- Condition records.
- Medication records.
- Photo records.

### V2 Expansion

Version 2 can add deeper templates for:

- Rabbit.
- Bird.
- Reptile.
- Small mammals.
- Other exotics.

V2 species-specific health wording must go through safety and veterinary-language review before release.

## 6. Dog Walk Feature Strategy

MVP walk tracking is health-observation focused, not GPS-route focused.

MVP dog walk records include:

- Start/end time or total walk duration.
- Approximate distance.
- Stool and urine observed during walk.
- Limping.
- Coughing.
- Breathing concern.
- Faster-than-usual fatigue.
- Appetite or water change after walk.
- Photo.
- Memo.

The report should include these records under a walk/activity observation section.

AI can say:

- "Walk records show repeated fatigue notes after evening walks."
- "There are no walk observations for the last two days."
- "Ask your veterinarian whether these repeated walk observations are relevant."

AI must not say:

- "This is arthritis."
- "This is an emergency."
- "No vet visit is needed."
- "Change medication dosage."

### V2 Walk Candidates

Version 2 can consider:

- GPS route tracking.
- Live family walk status.
- Route history.
- Route comparison.
- Weekly activity goals.
- Background location behavior.

These require location-permission copy, battery-use review, privacy review, and platform policy review.

## 7. Screen Structure

The app should use a Today-first information architecture.

### Primary Home: Today

Today should show:

- Active pet selector.
- Care Mode status if active.
- Today's medication and care checklist.
- Quick daily logging actions.
- Walk/food/water/stool/condition shortcuts.
- Recent timeline.
- AI summary card when records exist.

### Care Mode Emphasis

When Care Mode is active:

- Medication and symptom tracking move higher on Today.
- Care response records are visually emphasized.
- Vet Report CTA becomes more prominent.
- AI summary stays explicitly record-based and non-diagnostic.

### Reports

Reports should support:

- 3-day and 7-day record summary.
- Missing record review.
- Suggested vet questions.
- English vet-ready report from Korean or English input.
- User confirmation before sharing.
- Expiring sanitized share link.

## 8. AI Scope

MVP AI scope is:

- Record-based 3-day/7-day summaries.
- Missing records.
- Cautious pattern highlights.
- Suggested questions to ask a veterinarian.
- English vet report generation from Korean or English records.

AI output must always be framed as a record summary.

Required English copy:

> This is a record-based summary, not a diagnosis. Contact a veterinarian for medical decisions.

Required Korean copy:

> 이 내용은 진단이 아니라 기록 기반 요약입니다. 의학적 판단은 수의사에게 문의하세요.

Forbidden AI behavior:

- Diagnosis.
- Prescription.
- Medication dosage advice.
- Emergency certainty.
- Saying a vet visit is unnecessary.
- Claiming a condition is safe or unsafe without a veterinarian.

## 9. Monetization And Entitlements

MVP includes entitlement structure and locked UI states, but no real payment integration.

### Free

Free can include:

- One pet.
- Basic daily records.
- Recent 7-day summary.
- Basic Care Mode records.

### Plus

Plus candidate features:

- Multiple pets.
- Longer history.
- Advanced report exports.
- PDF export.
- More AI summaries per period.

### Family

Family candidate features:

- Family/caregiver invitations.
- Shared record ownership.
- Role management.
- More report share links.

During MVP testing, locked states should communicate future packaging without blocking core validation too aggressively.

Real IAP, RevenueCat, StoreKit, or Play Billing integration is deferred until after beta feedback.

## 10. DDD And Architecture Implications

The selected strategy maps to existing bounded contexts:

- `identity`: account, language, profile.
- `pet`: pet profile and species template.
- `diary`: daily food, water, stool, condition, walk, and memo records.
- `care`: Care Mode, condition, treatment response.
- `medication`: schedules and dose status.
- `briefing`: AI summary, missing records, vet questions.
- `report`: vet report, confirmation, share link.
- `media`: symptom photos and diary media.
- `subscription`: Free/Plus/Family entitlement gates.
- `sync`: offline outbox and idempotent replay.

Rules:

- Contexts cannot mutate each other directly.
- Cross-context behavior should use application use cases or domain events.
- Supabase row shapes are parsed at infrastructure boundaries.
- Role checks must be enforced in RLS and reflected in UI.
- Vet report sharing must return sanitized report data only.

## 11. Data Model Implications

The current core tables remain appropriate:

- `profiles`
- `pets`
- `pet_members`
- `conditions`
- `care_plans`
- `medications`
- `medication_schedules`
- `medication_doses`
- `diary_entries`
- `measurements`
- `media_assets`
- `ai_briefs`
- `vet_reports`
- `report_share_tokens`
- `subscription_entitlements`
- `sync_outbox`
- `audit_events`

Recommended additions or refinements for implementation planning:

- Diary entry type should support `walk_observation`.
- Walk observation payload should store structured fields, not only free text.
- Species profile should store a `species_template` value for dog, cat, and other.
- Vet report generation should store source record IDs for auditability.
- Report share token should store expiry, revoked state, and sanitized payload version.

## 12. What To Exclude

Exclude from MVP:

- Pet sitter marketplace.
- Dog walker marketplace.
- Community feed.
- Ranking, challenges, or points economy.
- Insurance comparison.
- Hospital search or appointment booking.
- AI diagnosis.
- Emergency triage.
- Medication dosage recommendation.
- Full GPS walk tracking.
- Deep templates for every species.
- Real subscription payment.

These exclusions protect the MVP from becoming a broad pet platform before the core care/reporting loop is proven.

## 13. Success Criteria

The feature strategy is successful when:

- A user can open Today and quickly record care observations.
- A family member can contribute to the same pet record without owner-level authority.
- A dog owner can record health-relevant walk observations without GPS.
- A cat owner can record appetite, water, litter, vomiting, and condition changes.
- Care Mode makes medication and symptom response easier to record.
- AI summarizes records, identifies missing entries, and suggests vet questions without diagnosis.
- A vet can open a link and see only the sanitized report.
- The MVP does not require marketplace, insurance, community, or payment systems to prove value.

## 14. References Reviewed

- PetDesk: https://petdesk.com/download-app-for-pet-health
- TtokTtok Jipsa: https://ttokttok.co/
- Tails dog walk tracking: https://trytails.com/gps-dog-tracking/
- Wag dog walking marketplace: https://wagwalking.com/
- PetLog App Store listing: https://apps.apple.com/fr/app/petlog-%EB%B0%98%EB%A0%A4%EB%8F%99%EB%AC%BC-%EA%B1%B4%EA%B0%95-%EA%B8%B0%EB%A1%9D/id6760936087
- WalkyPet launch coverage: https://zdnet.co.kr/view/?no=20260521111604
- CoVet AI vet tools overview: https://co.vet/post/ai-vet-tools/
