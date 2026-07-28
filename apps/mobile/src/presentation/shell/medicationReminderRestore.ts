import type { CareMedicationSchedule } from "../../contexts/care/domain/carePlan";
import { fetchActiveCareSchedulesForPet } from "../../contexts/care/application/carePlanRecords";
import { refreshMedicationReminders } from "./reminderScheduling";

// Turning the medication-reminder toggle off cancels the whole account, so
// turning it back on must restore every pet that has schedules — restoring
// only the active pet silently dropped the other pets' reminders until each
// was next opened.
export async function restoreMedicationRemindersForPets({ userId, pets, activePetId, activePetSchedules }: {
  userId: string;
  pets: { id: string; name: string }[];
  activePetId: string;
  activePetSchedules: CareMedicationSchedule[];
}): Promise<"scheduled" | "denied"> {
  const uniquePets = pets.filter((pet, index, all) => all.findIndex((other) => other.id === pet.id) === index);
  let anyDenied = false;
  for (const pet of uniquePets) {
    const schedules = pet.id === activePetId ? activePetSchedules : await fetchActiveCareSchedulesForPet(pet.id);
    if (schedules.length === 0) continue;
    const scheduled = await refreshMedicationReminders({ userId, petId: pet.id, petName: pet.name, schedules, requestPermission: !anyDenied });
    if (!scheduled) anyDenied = true;
  }
  return anyDenied ? "denied" : "scheduled";
}
