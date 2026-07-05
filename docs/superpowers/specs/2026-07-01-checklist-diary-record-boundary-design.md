# Checklist and Diary Record Boundary Design

## Summary

PawBloom needs a clear boundary between the Today checklist and Diary category records. The Today checklist is a fast completion flow. Diary category records are detailed daily records used for review, reports, and AI summaries.

The current issue happens because checklist-created items can be treated like normal Diary records. When a user taps a checklist-created timeline item, the app can open a Diary edit flow and create or update category data as if it were a detailed Diary entry. That makes the same category appear as different kinds of data without a clear rule.

## Product Rule

- Today checklist answers: "Did we cover this today?"
- Diary category record answers: "What exactly happened for this category today?"
- Medication stays outside Diary category records and belongs to Care/medication data.
- Reports can use both Diary and Care data, but detailed Diary records should carry more meaning than checklist completion events.

## Record Types

Diary-like timeline entries should have an explicit origin:

- `diary`: created from the Diary screen or by editing a detailed Diary category record.
- `checklist`: created from the Today checklist as a quick completion event.

Existing records without a stored origin should be treated as `diary` for backwards compatibility.

## Category Save Rules

Structured Diary categories are daily snapshots:

- `food`
- `water`
- `walk`
- `stool`
- `condition`

For these categories, the default behavior is one detailed `diary` record per pet/date/category. Saving the same structured category for the same date should update or reopen the existing detailed record instead of silently creating another detailed record.

Event-style Diary categories can remain appendable:

- `memo`
- `photo`

These can have multiple records per day because they represent separate notes or photo moments.

Checklist completions are also one per pet/date/checklist key. If a detailed Diary record already exists for the same structured category and date, the checklist should appear complete and pressing it should not create a second checklist event.

## Timeline Click Rules

Timeline tap behavior should follow the record origin:

- `diary` origin: open the Diary edit screen with the matching category form.
- `checklist` origin: do not open the detailed Diary edit screen. The app can either show a short notice or open a future lightweight checklist edit sheet.
- `medication`: open or focus the Care medication record flow, not Diary.

For the first implementation, checklist-origin timeline taps should show a short notice and stay on Today. This avoids mixing quick completion records with detailed category edits.

## Data Model Direction

Use a small source/origin field instead of creating a separate checklist table in this pass.

Recommended name:

- Database column: `record_origin`
- App type: `DiaryRecordOrigin = "diary" | "checklist"`

Reasons:

- Minimal schema change.
- Keeps today's timeline rendering simple.
- Preserves report aggregation paths.
- Lets future work split checklist completions into a dedicated table if needed.

## Backwards Compatibility

- Existing database rows default to `record_origin = "diary"`.
- Existing mock/sample entries default to `origin: "diary"`.
- Checklist-created entries from this implementation onward use `origin: "checklist"`.
- If an older checklist-like record has no origin, the app cannot safely infer it and should treat it as `diary`.

## Testing Requirements

- Checklist-created records must carry `origin: "checklist"`.
- Diary-created records must carry `origin: "diary"`.
- Home timeline tap on `origin: "diary"` must open Diary edit.
- Home timeline tap on `origin: "checklist"` must not open Diary edit.
- Structured Diary save should avoid creating a second detailed record for the same pet/date/category.
- Memo/photo can still create multiple records.
- Checklist completion should be true if either a checklist event or a structured Diary record exists for that category today.
