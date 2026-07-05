# Care Profile Defaults Simplification Design

Date: 2026-07-04
Status: planning draft from user request
Scope: mobile care UX, profile care defaults, medication schedule/dose flow, product/engineering documentation

## Goal

Make Care simple enough for a non-technical caregiver to answer one daily question: "Did I give the scheduled medicine today?"

The profile becomes the place to save long-running care defaults: illness or condition names, medication names, prescribed amount labels, treatment period, repeat interval, and scheduled times. The Care tab becomes the daily execution surface: scheduled medication check, temporary medication add, reminders, and report navigation.

## Problem

The current Care page exposes too many jobs at the same level:

- report readiness
- today's medication list
- quick medication form
- care plan default setup
- condition score
- AI/report summary
- report button

This makes the page feel like a configuration form instead of a daily care tool. It also blends three different data meanings:

- profile-level defaults that should persist across days
- today's actual medication outcome
- diary-based condition information

The user expectation is simpler:

1. Set up illness and medication defaults from the pet profile.
2. Let Care automatically show scheduled medicines for today.
3. In Care, check only whether each scheduled medicine was given.
4. If a one-time medicine is needed, manually add it for today only.
5. Read condition score from Diary rather than asking again in Care.

## Product Direction

PawBloom should keep its monetizable value around reliable care history and vet-ready reporting, not around complex data entry.

The product roles are:

- Profile: long-running setup for the selected pet.
- Diary: daily life and condition source of truth.
- Care: today medication execution.
- Reports: clinic-ready summary and sharing.

This creates a clearer paid-value path:

- Free/core: today checklist and simple medication check.
- Plus/Family direction: longer medication history, multiple conditions/medications, family accountability, vet report sharing, report retention, and caregiver coordination.

Actual subscription implementation remains outside this slice.

## UX Design

### Pet Profile

Profile should show care defaults below the basic pet profile and routine defaults.

Recommended order:

1. Pet basic information.
2. Basic routine.
3. Care defaults.

Care defaults should support:

- multiple illness or condition names
- multiple medicines
- medicine linked to a condition when relevant
- medicine without a condition when the user does not want to categorize it
- dosage label as text, not medical advice
- treatment start date and optional end date
- repeat interval such as every day or every 2 days
- one or more daily local times per medicine

For a medicine taken several times per day, the UI should group the times under one medicine, but storage should keep one schedule row per time. For example, one medicine at 08:00 and 20:00 becomes two schedule rows linked to the same medication.

The profile copy should make the data meaning clear:

- "매일 보여줄 약 일정"
- "병명/상태 추가"
- "약 추가"
- "투약 기간"
- "반복 간격"
- "복용 시간 추가"
- "이 내용은 기본 일정입니다. 오늘 실제 투약 여부는 Care에서 체크해요."

### Care Tab

Care should start with today's medication check, not setup.

Recommended order:

1. Summary line: "오늘 예정된 약 2개 중 1개 확인"
2. Scheduled medication list.
3. Temporary medication add button.
4. Compact schedule summary with a link back to profile settings.
5. Small Diary condition reference.
6. Report CTA.

Each scheduled medication row should show:

- time
- medication name
- dosage label when present
- linked condition when present
- schedule pattern when useful, such as "2일에 한 번"
- current status text
- direct action buttons

Primary actions:

- "먹였어요"
- "못 먹였어요"

Secondary/edit actions:

- "수정"
- "일부만 먹였어요" inside edit/add details, not as a top-level default action

The current status cycle behavior is too implicit. Users should set a status directly instead of tapping one circle repeatedly and hoping it lands on the right state.

### Temporary Medication

Temporary medication should be collapsed by default.

Button:

- "임시 투약 추가"

Helper copy:

- "오늘만 먹인 약이 있을 때만 추가하세요. 매일 먹는 약은 프로필의 약 일정에서 관리해요."

Required fields:

- medicine name
- time
- status

Optional fields:

- illness/condition
- dosage label
- amount given today
- reaction/note

Temporary medication records must not create or edit profile defaults unless the user explicitly chooses a separate "일정에 추가" flow in a later feature.

### Condition Score

Care should not ask for condition score input.

Condition score belongs to Diary's condition category. Care may show a small reference such as:

- "오늘 컨디션은 Diary에서 기록해요."
- "최근 컨디션: 3/5"

The report readiness calculation may read the latest Diary condition score, but Care should not become a duplicate condition entry screen.

## Schedule And Reminder Rules

PawBloom should support practical caregiver schedules without implementing complex prescriptions.

Supported schedule fields:

- `startsOn`: the first local date the medicine may appear
- `endsOn`: optional last local date
- `recurrenceIntervalDays`: positive integer; `1` means every day, `2` means every other day
- `localTime`: one local time per schedule row

The rule for whether a schedule appears on a local date:

1. The date is on or after `startsOn`.
2. The date is on or before `endsOn` when `endsOn` exists.
3. The number of days from `startsOn` to the date is divisible by `recurrenceIntervalDays`.

Example:

- Start date: 2026-07-04
- Repeat: every 2 days
- Time: 08:00
- Care shows the medicine on 2026-07-04, 2026-07-06, 2026-07-08, and so on.

Medication reminders should use local device notifications through Expo Notifications. They are local reminders, not server push notifications. When the user creates, edits, or deletes a care default, the app should cancel the old reminders for that pet's medication schedules and schedule the next applicable reminders from the active schedule rules.

Reminder copy must be neutral:

- allowed: "잉꼬 약 먹일 시간이에요: 항생제"
- disallowed: diagnosis, dose adjustment advice, emergency certainty

## Data And Architecture

The UI location moves, but domain ownership does not:

- `care` owns illness/condition and care plan concepts.
- `medication` owns medication schedule and daily dose concepts.
- `pet` owns pet profile details.
- `diary` owns condition score and daily condition detail.

The profile screen may compose `pet`, `routine`, `care`, and `medication` use cases. It should not move care fields into the `pet` table.

Existing tables already support the desired model:

- `conditions`
- `care_plans`
- `medications`
- `medication_schedules`
- `medication_doses`

The implementation should extend the app model so `ActiveCareSetup` can render multiple conditions and multiple schedules. The current single `conditionName` and `planTitle` fields may remain as compatibility summaries, but the UI should use arrays for new care defaults.

`medication_schedules` already has `starts_on`, `ends_on`, and `local_time`. Add `recurrence_interval_days integer not null default 1` with a positive-value check. Use multiple rows for multiple daily times rather than storing an array of times in one row.

## Dose Creation Policy

Scheduled medicines should appear in Care without immediately creating `medication_doses` rows.

The screen should build a "today medication agenda" by merging:

1. active medication schedules for the selected pet that apply to the selected local date
2. existing medication doses for the selected date

Rules:

- If a schedule has no dose today, show it as "아직 확인 전" from the schedule data.
- If a schedule already has a dose today, show the saved dose status.
- When the user taps "먹였어요" or "못 먹였어요", create or update one dose for that schedule and date.
- If the user changes the status again, update the existing dose.
- A temporary medication has no schedule and is saved as a one-time dose.
- Schedules that do not apply to the selected date should not appear in Care and should not produce reminders for that date.

To prevent duplicate saves, schedule-based daily doses need both app-level merge logic and a database guard. The recommended database guard is a `dose_date date` column plus a unique index on `(pet_id, schedule_id, dose_date)` where `schedule_id is not null`.

## Safety Requirements

The app must not imply medical judgment.

Allowed:

- record that a medicine was given
- record that a medicine was not given
- record user-entered dosage labels
- show a vet report based on records

Disallowed:

- dose recommendation
- diagnosis
- emergency certainty
- statements that a vet is unnecessary
- automatic advice to change medication

## Non-Goals

This slice does not implement:

- medication inventory or refills
- prescription image parsing
- AI diagnosis or dose advice
- remote/server push notifications
- complex tapering medication schedules
- real subscription/paywall changes
- vet appointment booking

## Acceptance Criteria

- Profile has a care defaults section for multiple conditions and medicines.
- Profile care defaults include treatment period, repeat interval, and one or more daily times.
- Care no longer shows the long care setup form as part of the primary daily flow.
- Care's first viewport is focused on today's scheduled medication check.
- A medicine set to every 2 days appears only on dates calculated from its start date.
- Local medication reminders are scheduled only for dates and times that match the schedule rules.
- Scheduled medicines appear from saved profile defaults without creating duplicate daily records.
- Tapping a scheduled medication action creates or updates exactly one dose for that schedule and date.
- Temporary medication can be added for today only.
- Condition score remains a Diary input and is only referenced in Care.
- Report generation still uses diary entries and medication dose records.
- User-facing copy avoids diagnosis, prescription advice, and emergency certainty.
- `npm run verify` passes after implementation.

## Self-Review

- No unspecified requirements remain.
- Scope is one coherent mobile care simplification slice.
- Data ownership stays in care/medication rather than moving clinical data into the pet profile table.
- Duplicate prevention is explicit at app and database levels.
- UX wording is caregiver-facing and avoids medical advice.
