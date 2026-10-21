import type { PetRoutine, PetRoutineInput } from "../../contexts/routine/domain/petRoutine";
import type { ActiveCareSetup, CareSetupInput } from "../../contexts/care/domain/carePlan";

export type PetOnboardingScreenProps = {
  /** Explicit profile target; inaccessible IDs never fall back to another pet. */
  petId?: string;
  /** Dedicated creation route without the current pet's editing controls. */
  createOnly?: boolean;
  /** Called only after successful creation so a dedicated route can return to house. */
  onCreated?: () => void;
  /** Called after cancelling creation; the shell must leave its dedicated creation route. */
  onCancelCreate?: () => void;
  mode?: "onboarding" | "manage";
  routine?: PetRoutine;
  onSaveRoutine?: (routine: PetRoutineInput) => void | Promise<void>;
  careSetup?: ActiveCareSetup;
  onSaveCareSetup?: (input: CareSetupInput) => Promise<ActiveCareSetup>;
  onProfileSaved?: () => void;
  medicationRemindersEnabled?: boolean;
  onToggleMedicationReminders?: (enabled: boolean) => void;
};
