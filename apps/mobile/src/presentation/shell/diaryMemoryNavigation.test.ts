import { canOpenDiaryMemory } from "./diaryMemoryNavigation";
import type { DiaryEntry } from "../../contexts/diary/domain/diaryEntry";
import type { PetProfile } from "../../contexts/pet/domain/pet";
import type { PetDetailRoute } from "../navigation/appRoute";
const entry: DiaryEntry = { id: "entry-b", petId: "b", category: "memo", origin: "diary", entryDate: "2026-10-19", occurredAt: "12:00", summary: "B" };
const pet = { id: "b", role: "owner" } as PetProfile;
const route: PetDetailRoute = { kind: "pet", petId: "b", section: "care", destination: { view: "diary", entryId: entry.id, dateKey: entry.entryDate } };
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
assert(canOpenDiaryMemory(entry, route, [pet]), "explicit B edit opens B's original entry");
assert(!canOpenDiaryMemory(entry, { ...route, petId: "a" }, [pet]), "delayed B entry cannot reach A");
assert(!canOpenDiaryMemory(entry, route, []), "removed access cancels pending edit");
assert(!canOpenDiaryMemory(entry, route, [{ ...pet, role: "pet_sitter" }]), "revoked update permission cancels pending edit");
assert(!canOpenDiaryMemory(entry, { kind: "main", tab: "house" }, [pet]), "navigation cancels delayed edit");
assert(!canOpenDiaryMemory(entry, { ...route, section: "profile" }, [pet]), "section change cancels delayed edit");
assert(!canOpenDiaryMemory({ ...entry, origin: "checklist" }, route, [pet]), "checklist source must not enter editor");
assert(!canOpenDiaryMemory(entry, { ...route, destination: { view: "diary", entryId: "other" } }, [pet]), "replaced pending entry does not apply");
