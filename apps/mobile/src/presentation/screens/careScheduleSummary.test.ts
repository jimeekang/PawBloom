import { setRuntimeLanguage } from "../../i18n/translations";
import { CARE_SCHEDULE_PREVIEW_COUNT, partitionCareSchedules, schedulePeriodBadge } from "./careScheduleSummary";

if (schedulePeriodBadge({ endsOn: undefined }) !== null) throw new Error("open-ended schedules must not show a period badge");
// Locale-formatted end date (0007 E1): the old bare "M/D" read as day/month
// to EN users. The template follows the runtime language; the language
// argument formats the date itself.
if (schedulePeriodBadge({ endsOn: "2026-07-17" }, "ko") !== "~2026년 7월 17일까지") throw new Error("short-term schedules must show a Korean-formatted until badge");
setRuntimeLanguage("en");
if (schedulePeriodBadge({ endsOn: "2026-11-03" }, "en") !== "until Nov 3, 2026") throw new Error("EN badges must use an unambiguous month name");
setRuntimeLanguage(null);
if (schedulePeriodBadge({ endsOn: "invalid" }) !== null) throw new Error("malformed dates must not render a badge");

const schedules = ["a", "b", "c", "d", "e"];
const collapsed = partitionCareSchedules(schedules, false);
if (collapsed.visible.length !== CARE_SCHEDULE_PREVIEW_COUNT || collapsed.hiddenCount !== 2) throw new Error("collapsed list must preview 3 rows and count the rest");
const expanded = partitionCareSchedules(schedules, true);
if (expanded.visible.length !== 5 || expanded.hiddenCount !== 0) throw new Error("expanded list must show every row");
const few = partitionCareSchedules(["a", "b", "c"], false);
if (few.visible.length !== 3 || few.hiddenCount !== 0) throw new Error("lists at the preview limit must not show a more button");
