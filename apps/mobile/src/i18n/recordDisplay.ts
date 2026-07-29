import { isDefaultMedicationName } from "../shared-kernel/recordSentinels";
import { t } from "./translations";

export function localizedMedicationName(value: string | null | undefined) {
  return isDefaultMedicationName(value) ? t("care.quickMedicationName") : value?.trim() ?? "";
}
