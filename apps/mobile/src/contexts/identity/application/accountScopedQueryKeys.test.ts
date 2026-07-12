import { carePlanKeys } from "../../care/application/carePlanRecords";
import { diaryKeys } from "../../diary/application/diaryRecords";
import { medicationDoseKeys } from "../../medication/application/medicationDoseRecords";
import { medicationScheduleKeys } from "../../medication/application/medicationScheduleRecords";
import { petProfilePhotoKey } from "../../pet/application/profilePhotoUrl";
import { vetReportStateKey } from "../../report/application/reportQueryKeys";
import { petRoutineKeys } from "../../routine/application/petRoutineRecords";

const ownerId = "owner-a";
const sitterId = "sitter-b";
const petId = "shared-pet";
const keyPairs = [
  [carePlanKeys.active(petId, ownerId), carePlanKeys.active(petId, sitterId)],
  [diaryKeys.date(petId, "2026-07-12", ownerId), diaryKeys.date(petId, "2026-07-12", sitterId)],
  [medicationDoseKeys.today(petId, "2026-07-12", ownerId), medicationDoseKeys.today(petId, "2026-07-12", sitterId)],
  [medicationScheduleKeys.byPet(petId, ownerId), medicationScheduleKeys.byPet(petId, sitterId)],
  [petRoutineKeys.detail(petId, "dog", ownerId), petRoutineKeys.detail(petId, "dog", sitterId)],
  [petProfilePhotoKey(petId, ownerId), petProfilePhotoKey(petId, sitterId)],
  [vetReportStateKey(petId, ownerId), vetReportStateKey(petId, sitterId)],
];

for (const [ownerKey, sitterKey] of keyPairs) {
  if (JSON.stringify(ownerKey) === JSON.stringify(sitterKey)) {
    throw new Error(`account-scoped query keys must differ for a shared pet: ${JSON.stringify(ownerKey)}`);
  }
}
