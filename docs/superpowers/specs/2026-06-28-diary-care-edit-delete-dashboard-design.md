# Diary/Care Edit, Delete, and Dashboard Design

## Context

PawBloom stores two kinds of daily records:

- Diary records for everyday tracking: food, water, optional walk, stool, condition, photos, and memo.
- Care records for illness and medication tracking: condition name, medication name, dose, administered amount, medication status, reaction, and symptom notes.

The current app can create these records and show them in Today, Diary, Care Mode, and Reports. Users also need to correct or remove records after saving because time, food amount, water amount, stool count, medication amount, and medication status can be entered incorrectly.

## Product Decision

Use the existing input forms as edit forms.

When the user taps an existing diary record or care medication record, the app opens the same form with the saved values loaded. The primary action changes from create to update, and a destructive delete action becomes available. This keeps the product simple: users learn one recording UI and reuse it for corrections.

## Scope

### Included

- Edit saved diary records from the selected day or selected week list.
- Delete saved diary records after a confirmation prompt.
- Edit saved medication dose records from Care Mode.
- Delete saved medication dose records after a confirmation prompt.
- Keep Today checklist, Today timeline, Reports draft, and Care lists in sync after edits or deletes.
- Improve the Today main screen into a stronger dashboard for daily diary and care work.
- Support database mode and local preview mode.

### Excluded

- Photo replacement or individual photo deletion.
- Editing profile default routines from Diary.
- Editing care plan defaults from the medication record edit form.
- Full audit history or undo.
- Offline replay behavior beyond the current app contracts.

## Diary Edit/Delete UX

Diary records remain grouped under the selected date or selected week. Each record row becomes tappable.

Tapping a row:

1. Selects the record category.
2. Opens the detail panel.
3. Loads saved detail values into the form.
4. Loads memo and condition score when present.
5. Shows update and delete actions.

Editable fields:

- Category-specific detail values.
- Memo.
- Condition score for condition records.
- Record date.
- Record time.

Deletion:

- The app asks for confirmation before deleting.
- After deletion, the row disappears from the Diary list and Today timeline.
- Related checklist state recalculates from remaining records.
- Existing linked photos are not individually edited in this phase.

## Care Medication Edit/Delete UX

Care Mode changes the medication list behavior:

- Tapping the row body opens the medication edit form.
- A compact status control remains available for quick status changes.

The medication edit form loads:

- Condition or illness name.
- Medication name.
- Prescribed dose.
- Administered amount.
- Medication status.
- Scheduled or recorded time.
- Reaction, symptom, or owner note.

Deletion:

- The app asks for confirmation before deleting.
- After deletion, the record disappears from Care Mode.
- Today medication checklist and Reports draft recalculate from remaining medication doses.

## Main Dashboard UX

The Today screen should help the user answer three questions quickly:

1. What has been done today?
2. What still needs attention?
3. Is anything unusual enough to mention in a future report?

Recommended dashboard order:

1. Pet status hero
   - Pet photo, name, breed/age, and a simple today completion summary.
   - Example: "오늘 4/6 기록 완료" and "투약 1건 확인 필요".

2. Attention strip
   - Shows important signals before the full checklist.
   - Examples: low condition score, skipped or partial medication, no water record, stool concern.
   - Empty state: "오늘 주의 신호가 아직 없습니다."

3. Today plan checklist
   - Food, water, optional walk, stool, medication, and night note.
   - Uses the pet routine and care setup where available.
   - Items remain tappable for quick record creation.

4. Care summary
   - Shows medication count and whether any medication needs action.
   - Gives a direct path to Care Mode.

5. Recent timeline
   - Shows recent diary records.
   - Rows remain tappable so users can correct records from the dashboard later if needed.

6. Quick actions
   - Add diary.
   - Record medication.
   - View report.

## Data Flow

Diary update/delete belongs in `contexts/diary/application/diaryRecords.ts`.

- Add update and delete mutations.
- Reuse existing summary encode/decode helpers.
- Update TanStack Query caches for day, week/range, and today views.
- Invalidate `diary` queries after mutation completion.

Medication update/delete belongs in `contexts/medication/application/medicationDoseRecords.ts`.

- Add a full update mutation for medication dose content.
- Keep the existing quick status update mutation.
- Add a delete mutation.
- Update today medication cache optimistically where practical.
- Invalidate `medication_doses` queries after mutation completion.

The shell coordinates these mutations so the UI can remain presentation-focused.

## Error Handling

- Save failures keep the form values in place.
- Delete failures keep the record visible.
- The existing prominent save feedback pattern is reused for update and delete success.
- Delete uses a destructive confirmation prompt.
- If a record disappears because it was deleted elsewhere, the app exits edit mode and refreshes the list.

## Permissions

The existing Supabase policies allow:

- Diary update by owner/caregiver.
- Diary delete by owner.
- Medication dose update by owner/caregiver/pet sitter.
- Medication dose delete by owner.

The UI should surface failures as plain messages instead of assuming every collaborator can delete.

## Testing

Add focused tests for:

- Diary summary update encoding and decoded detail round trip.
- Diary delete cache removal.
- Medication full update encoding and decoded detail round trip.
- Medication delete cache removal.
- Edit form state reset after update/delete.
- Dashboard derived summary: completion count and attention signals.

Run:

- Mobile typecheck.
- `npm run verify`.

## Documentation Updates

Update `docs/exec-plans/active/0003-weekly-execution-checklist.md` with a new work item for diary/care edit-delete and Today dashboard improvements.
