import { CodedError } from "../shared-kernel/appError";
import { errorNoticeText } from "./errorNotice";

if (errorNoticeText(new CodedError("diary.photoLimitNotice"), "diary.saveFailed") !== "하루 사진은 최대 5장까지 저장할 수 있습니다.") {
  throw new Error("a coded error must render its own localized copy");
}

if (errorNoticeText(new CodedError("not.a.real.key"), "diary.saveFailed") !== "다이어리 기록을 저장하지 못했습니다. 입력한 내용은 유지됩니다.") {
  throw new Error("an unknown code must fall back to the operation copy instead of rendering the code");
}

const raw = errorNoticeText(new Error('duplicate key value violates unique constraint "diary_entries_pkey"'), "diary.saveFailed");
if (raw.includes("duplicate key") || raw !== "다이어리 기록을 저장하지 못했습니다. 입력한 내용은 유지됩니다.") {
  throw new Error("raw technical messages must never surface to the user");
}

const coded = new CodedError("diary.updateFailed", "raw postgres detail");
if (coded.message !== "raw postgres detail") {
  throw new Error("the raw detail must stay on the error object for logging");
}
if (errorNoticeText(coded, "diary.saveFailed").includes("raw postgres")) {
  throw new Error("the raw detail must not leak through the notice text");
}
