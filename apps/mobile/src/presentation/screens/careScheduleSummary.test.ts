import { CARE_SCHEDULE_PREVIEW_COUNT, partitionCareSchedules, schedulePeriodBadge } from "./careScheduleSummary";

if (schedulePeriodBadge({ endsOn: undefined }) !== null) throw new Error("open-ended schedules must not show a period badge");
if (schedulePeriodBadge({ endsOn: "2026-07-17" }) !== "~7/17까지") throw new Error("short-term schedules must show an until badge");
if (schedulePeriodBadge({ endsOn: "2026-11-03" }) !== "~11/3까지") throw new Error("badge must strip leading zeros");
if (schedulePeriodBadge({ endsOn: "invalid" }) !== null) throw new Error("malformed dates must not render a badge");

const schedules = ["a", "b", "c", "d", "e"];
const collapsed = partitionCareSchedules(schedules, false);
if (collapsed.visible.length !== CARE_SCHEDULE_PREVIEW_COUNT || collapsed.hiddenCount !== 2) throw new Error("collapsed list must preview 3 rows and count the rest");
const expanded = partitionCareSchedules(schedules, true);
if (expanded.visible.length !== 5 || expanded.hiddenCount !== 0) throw new Error("expanded list must show every row");
const few = partitionCareSchedules(["a", "b", "c"], false);
if (few.visible.length !== 3 || few.hiddenCount !== 0) throw new Error("lists at the preview limit must not show a more button");
