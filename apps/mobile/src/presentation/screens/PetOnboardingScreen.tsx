import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { DangerButton, NoticeBanner, PrimaryButton, SecondaryButton, SurfaceCard } from "../../design-system/components";
import { AppIcon } from "../../design-system/iconography";
import { colors, iconSize } from "../../design-system/tokens";
import { t, type TranslationKey } from "../../i18n/translations";
import { useAuth } from "../../contexts/identity/application/authContext";
import { usePetProfilePhotoUrl } from "../../contexts/pet/application/profilePhotoUrl";
import type { PetProfilePhotoInput } from "../../contexts/identity/application/authContextQueries";
import type { PetRoutine, PetRoutineInput } from "../../contexts/routine/domain/petRoutine";
import type { ActiveCareSetup, CareSetupInput } from "../../contexts/care/domain/carePlan";
import { getSpeciesLabels, PetProfileFormFields, PetSelector, pickPetProfilePhoto, type PetSpeciesOption } from "./PetOnboardingHelpers";
import { parsePetWeightInput } from "./petWeightInput";
import { confirmDestructiveAction } from "../../design-system/confirmAction";
import { confirmAndSignOut } from "../../contexts/identity/ui/signOutConfirm";
import { RoutineSettingsPanel } from "../../contexts/routine/ui/RoutineSettingsPanel";
import { ProfileCareDefaultsPanel } from "../../contexts/care/ui/ProfileCareDefaultsPanel";
import { styles } from "./PetOnboardingScreen.styles";
import { can } from "../../shared-kernel/permissions";
import { useSubscriptionEntitlement } from "../../contexts/subscription/application/subscriptionEntitlement";
import { canCreatePet, entitlements } from "../../contexts/subscription/domain/entitlement";
import { countOwnedPets } from "../../contexts/pet/domain/pet";

export function PetOnboardingScreen({ mode = "onboarding", routine, onSaveRoutine, careSetup, onSaveCareSetup, onProfileSaved, medicationRemindersEnabled, onToggleMedicationReminders }: { mode?: "onboarding" | "manage"; routine?: PetRoutine; onSaveRoutine?: (routine: PetRoutineInput) => void | Promise<void>; careSetup?: ActiveCareSetup; onSaveCareSetup?: (input: CareSetupInput) => Promise<ActiveCareSetup>; onProfileSaved?: () => void; medicationRemindersEnabled?: boolean; onToggleMedicationReminders?: (enabled: boolean) => void } = {}) {
  const { configured, user, pets, activePet, selectPet, createPet, updatePet, deletePet, error, authMessage, loading, signOut } = useAuth();
  const entitlementQuery = useSubscriptionEntitlement(user?.id ?? null, configured && Boolean(user));
  const entitlement = entitlementQuery.data ?? (configured ? null : entitlements.plus);
  const entitlementLoading = Boolean(user && configured && entitlementQuery.isLoading);
  const entitlementFailed = Boolean(user && configured && entitlementQuery.isError);
  const ownedPetCount = countOwnedPets(pets);
  const petCreationAllowed = Boolean(user && entitlement && canCreatePet(entitlement, ownedPetCount));

  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [species, setSpecies] = useState<PetSpeciesOption>("dog");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBreed, setEditBreed] = useState("");
  const [editBirthdate, setEditBirthdate] = useState("");
  const [editWeightKg, setEditWeightKg] = useState("");
  const [editSpecies, setEditSpecies] = useState<PetSpeciesOption>("dog");
  const [formErrorKey, setFormErrorKey] = useState<TranslationKey | null>(null);
  const [photo, setPhoto] = useState<PetProfilePhotoInput | undefined>();
  const [editPhoto, setEditPhoto] = useState<PetProfilePhotoInput | undefined>();
  const activePhoto = usePetProfilePhotoUrl(activePet?.id, user?.id ?? null);
  const hasPets = pets.length > 0;
  const shouldShowPetSelector = pets.length > 1 && !showCreateForm;
  const canManageActivePet = activePet ? can(activePet.role, "pet.update") && can(activePet.role, "pet.photo.update") && can(activePet.role, "pet.delete") : false;
  const canManageCareDefaults = activePet ? can(activePet.role, "routine.update") && can(activePet.role, "care.update") : false;
  const speciesLabel = getSpeciesLabels();

  useEffect(() => {
    setShowCreateForm(Boolean(user) && pets.length === 0);
  }, [pets.length, user]);

  useEffect(() => {
    if (!activePet) {
      return;
    }

    setEditName(activePet.name);
    setEditBreed(activePet.breed);
    setEditBirthdate(activePet.birthdate);
    setEditWeightKg(activePet.weightKg ? String(activePet.weightKg) : "");
    setEditSpecies(activePet.species);
    setEditPhoto(undefined);
  }, [activePet]);

  const onCreate = async () => {
    if (!petCreationAllowed) return;
    setFormErrorKey(null);
    const weight = parsePetWeightInput(weightKg);
    if (!weight.ok) {
      setFormErrorKey("pet.weightInvalid");
      return;
    }
    const createError = await createPet({
      name,
      species,
      breed,
      birthdate,
      weightKg: weight.value,
      profilePhoto: photo,
    });

    if (createError) {
      return;
    }

    resetCreateForm();
    setShowCreateForm(false);
    onProfileSaved?.();
  };

  const resetCreateForm = () => { setName(""); setBreed(""); setBirthdate(""); setWeightKg(""); setSpecies("dog"); setPhoto(undefined); };

  const onAddAnother = () => {
    if (!petCreationAllowed) return;
    resetCreateForm();
    setShowCreateForm(true);
  };

  const onUpdate = async () => {
    if (!activePet || !canManageActivePet) {
      return;
    }

    setFormErrorKey(null);
    const weight = parsePetWeightInput(editWeightKg);
    if (!weight.ok) {
      setFormErrorKey("pet.weightInvalid");
      return;
    }
    const updateError = await updatePet({
      id: activePet.id,
      name: editName,
      species: editSpecies,
      breed: editBreed,
      birthdate: editBirthdate,
      weightKg: weight.value,
      profilePhoto: editPhoto,
    });
    if (!updateError) onProfileSaved?.();
  };

  const onDelete = () => {
    if (!activePet || !canManageActivePet) {
      return;
    }

    void confirmDestructiveAction(
      {
        title: t("pet.deleteTitle"),
        message: `${activePet.name} ${t("pet.deleteCopy")}`,
        cancelText: t("pet.deleteCancel"),
        confirmText: t("pet.deleteConfirm"),
      },
      () => {
        void deletePet(activePet.id);
        return true;
      },
    );
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{t(mode === "manage" ? "pet.manageTitle" : "pet.onboardingTitle")}</Text>
      <Text style={styles.copy}>{t(mode === "manage" ? "pet.manageCopy" : "pet.onboardingCopy")}</Text>

      {!user ? <NoticeBanner text={t("pet.loginRequired")} icon="shield" tone="info" /> : null}
      {entitlementLoading ? <NoticeBanner text={t("pet.planLoading")} icon="lock" tone="progress" /> : null}
      {entitlementFailed ? <NoticeBanner text={t("pet.planLoadFailed")} icon="close" tone="error" /> : null}
      {entitlementFailed ? <SecondaryButton label={t("diary.listRetry")} onPress={() => void entitlementQuery.refetch()} /> : null}
      {hasPets && !showCreateForm && petCreationAllowed ? <SecondaryButton label={t("pet.create")} icon="add" onPress={onAddAnother} /> : null}
      {hasPets && !showCreateForm && entitlement && !petCreationAllowed ? <NoticeBanner text={t("pet.planLimitReached").replace("{limit}", `${entitlement.maxPets}`)} icon="lock" tone="info" /> : null}

      {shouldShowPetSelector ? <PetSelector pets={pets} activePetId={activePet?.id} onSelect={selectPet} /> : null}

      {activePet && !showCreateForm && canManageActivePet ? (
        <SurfaceCard>
        <View style={styles.cardBody}>
          <Text style={styles.sectionTitle}>{t("pet.editTitle")}</Text>
          <PetProfileFormFields
            speciesFieldLabel={t("pet.speciesLabel")}
            speciesLabel={speciesLabel}
            species={editSpecies}
            onSpeciesChange={setEditSpecies}
            photoFieldLabel={t("pet.photoLabel")}
            photoUri={editPhoto?.uri ?? activePhoto.data ?? undefined}
            photoLabel={t("pet.photoUpdate")}
            onPickPhoto={() => void pickPetProfilePhoto(setEditPhoto)}
            nameLabel={t("pet.nameLabel")}
            name={editName}
            onNameChange={setEditName}
            breedLabel={t("pet.breedLabel")}
            breed={editBreed}
            onBreedChange={setEditBreed}
            birthdateLabel={t("pet.birthdateLabel")}
            birthdate={editBirthdate}
            onBirthdateChange={setEditBirthdate}
            weightLabel={t("pet.weightLabel")}
            weightKg={editWeightKg}
            onWeightChange={setEditWeightKg}
          />

          <PrimaryButton label={t("pet.update")} onPress={onUpdate} disabled={loading} />
          {activePhoto.isLoading && !editPhoto ? <Text style={styles.helpText}>{t("pet.photoLoading")}</Text> : null}
          {activePhoto.isError ? <Text style={styles.helpText}>{t("pet.photoLoadFailed")}</Text> : null}
          <DangerButton label={t("pet.delete")} icon="close" onPress={onDelete} disabled={loading} />
        </View>
        </SurfaceCard>
      ) : null}

      {activePet && !showCreateForm && !canManageActivePet ? <NoticeBanner text={t("permission.petOwnerOnly")} icon="shield" tone="info" /> : null}

      {activePet && !showCreateForm && canManageCareDefaults && routine && onSaveRoutine ? <RoutineSettingsPanel routine={routine} onSave={onSaveRoutine} /> : null}
      {activePet && !showCreateForm && canManageCareDefaults && careSetup && onSaveCareSetup ? <ProfileCareDefaultsPanel petId={activePet.id} setup={careSetup} onSave={onSaveCareSetup} medicationRemindersEnabled={medicationRemindersEnabled} onToggleMedicationReminders={onToggleMedicationReminders} /> : null}
      {activePet && !showCreateForm && !canManageCareDefaults ? <NoticeBanner text={t("permission.careTeamOnly")} icon="shield" tone="info" /> : null}

      {showCreateForm && petCreationAllowed ? (
        <SurfaceCard>
        <View style={styles.cardBody}>
          <Text style={styles.sectionTitle}>{t("pet.addTitle")}</Text>
          {!hasPets ? <Text style={styles.helpText}>{t("pet.empty")}</Text> : null}
          <PetProfileFormFields
            speciesFieldLabel={t("pet.speciesLabel")}
            speciesLabel={speciesLabel}
            species={species}
            onSpeciesChange={setSpecies}
            photoFieldLabel={t("pet.photoLabel")}
            photoUri={photo?.uri}
            photoLabel={t("pet.photoAdd")}
            onPickPhoto={() => void pickPetProfilePhoto(setPhoto)}
            nameLabel={t("pet.nameLabel")}
            name={name}
            onNameChange={setName}
            breedLabel={t("pet.breedLabel")}
            breed={breed}
            onBreedChange={setBreed}
            birthdateLabel={t("pet.birthdateLabel")}
            birthdate={birthdate}
            onBirthdateChange={setBirthdate}
            weightLabel={t("pet.weightLabel")}
            weightKg={weightKg}
            onWeightChange={setWeightKg}
          />

          <PrimaryButton label={t("pet.create")} onPress={onCreate} disabled={loading} />
          {hasPets ? <SecondaryButton label={t("pet.createCancel")} onPress={() => { resetCreateForm(); setFormErrorKey(null); setShowCreateForm(false); }} disabled={loading} /> : null}
        </View>
        </SurfaceCard>
      ) : null}

      {formErrorKey ? <NoticeBanner text={t(formErrorKey)} icon="close" tone="error" /> : null}
      {(error ?? authMessage) ? (
        <NoticeBanner
          text={t((error ?? authMessage)!)}
          icon={error ? "close" : authMessage === "pet.photoPartial" ? "close" : "check"}
          tone={error ? "error" : authMessage === "pet.photoPartial" ? "error" : "success"}
        />
      ) : null}

      {user ? (
        <View style={styles.actionRow}>
          <SecondaryButton label={t("auth.signOut")} onPress={() => void confirmAndSignOut(signOut)} disabled={loading} />
        </View>
      ) : null}

      {loading ? <Text style={styles.loadingText}>{t("auth.wait")}</Text> : null}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}
