import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { NoticeBanner, PrimaryButton, SecondaryButton } from "../../design-system/components";
import { AppIcon } from "../../design-system/iconography";
import { colors, iconSize } from "../../design-system/tokens";
import { t } from "../../i18n/translations";
import { useAuth } from "../../contexts/identity/application/authContext";
import { usePetProfilePhotoUrl } from "../../contexts/pet/application/profilePhotoUrl";
import type { PetProfilePhotoInput } from "../../contexts/identity/application/authContextQueries";
import type { PetRoutine, PetRoutineInput } from "../../contexts/routine/domain/petRoutine";
import type { ActiveCareSetup, CareSetupInput } from "../../contexts/care/domain/carePlan";
import { PetProfileFormFields, pickPetProfilePhoto, speciesOptions, type PetSpeciesOption } from "./PetOnboardingHelpers";
import { confirmDestructiveAction } from "../../design-system/confirmAction";
import { confirmAndSignOut } from "../../contexts/identity/ui/signOutConfirm";
import { RoutineSettingsPanel } from "../../contexts/routine/ui/RoutineSettingsPanel";
import { ProfileCareDefaultsPanel } from "../../contexts/care/ui/ProfileCareDefaultsPanel";
import { styles } from "./PetOnboardingScreen.styles";
import { can } from "../../shared-kernel/permissions";

export function PetOnboardingScreen({ routine, onSaveRoutine, careSetup, onSaveCareSetup, onProfileSaved }: { routine?: PetRoutine; onSaveRoutine?: (routine: PetRoutineInput) => void | Promise<void>; careSetup?: ActiveCareSetup; onSaveCareSetup?: (input: CareSetupInput) => Promise<ActiveCareSetup>; onProfileSaved?: () => void } = {}) {
  const { user, pets, activePet, selectPet, createPet, updatePet, deletePet, error, authMessage, loading, signOut } = useAuth();

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
  const [photo, setPhoto] = useState<PetProfilePhotoInput | undefined>();
  const [editPhoto, setEditPhoto] = useState<PetProfilePhotoInput | undefined>();
  const activePhoto = usePetProfilePhotoUrl(activePet?.id, user?.id ?? null);
  const hasPets = pets.length > 0;
  const shouldShowPetSelector = pets.length > 1 && !showCreateForm;
  const canManageActivePet = activePet ? can(activePet.role, "pet.update") && can(activePet.role, "pet.photo.update") && can(activePet.role, "pet.delete") : false;
  const canManageCareDefaults = activePet ? can(activePet.role, "routine.update") && can(activePet.role, "care.update") : false;
  const speciesLabel: Record<PetSpeciesOption, string> = {
    dog: t("ko", "pet.speciesDog"),
    cat: t("ko", "pet.speciesCat"),
    other: t("ko", "pet.speciesOther"),
  };

  useEffect(() => {
    setShowCreateForm(pets.length === 0);
  }, [pets.length]);

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
    const createError = await createPet({
      name,
      species,
      breed,
      birthdate,
      weightKg: Number.parseFloat(weightKg),
      profilePhoto: photo,
    });

    if (createError) {
      return;
    }

    resetCreateForm();
    setShowCreateForm(false);
    onProfileSaved?.();
  };

  const resetCreateForm = () => {
    setName("");
    setBreed("");
    setBirthdate("");
    setWeightKg("");
    setSpecies("dog");
    setPhoto(undefined);
  };

  const onAddAnother = () => {
    resetCreateForm();
    setShowCreateForm(true);
  };

  const onUpdate = async () => {
    if (!activePet || !canManageActivePet) {
      return;
    }

    const updateError = await updatePet({
      id: activePet.id,
      name: editName,
      species: editSpecies,
      breed: editBreed,
      birthdate: editBirthdate,
      weightKg: Number.parseFloat(editWeightKg),
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
        title: t("ko", "pet.deleteTitle"),
        message: `${activePet.name} ${t("ko", "pet.deleteCopy")}`,
        cancelText: t("ko", "pet.deleteCancel"),
        confirmText: t("ko", "pet.deleteConfirm"),
      },
      () => {
        void deletePet(activePet.id);
        return true;
      },
    );
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{t("ko", "pet.onboardingTitle")}</Text>
      <Text style={styles.copy}>{t("ko", "pet.onboardingCopy")}</Text>

      {hasPets && !showCreateForm ? <SecondaryButton label={t("ko", "pet.create")} icon="add" onPress={onAddAnother} /> : null}

      {shouldShowPetSelector ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("ko", "pet.selectTitle")}</Text>
          {pets.map((pet) => (
            <Pressable key={pet.id} style={[styles.petRow, pet.id === activePet?.id && styles.petRowActive]} onPress={() => selectPet(pet.id)}>
              <View style={styles.petTextWrap}>
                <Text style={styles.petName}>{pet.name}</Text>
                <Text style={styles.petMeta}>
                  {pet.breed || "-"} · {pet.ageLabel} · {pet.weightKg ? `${pet.weightKg}kg` : "-"}
                </Text>
              </View>
              <AppIcon name="check" size={iconSize.sm} color={pet.id === activePet?.id ? colors.orangeDeep : colors.textMuted} />
            </Pressable>
          ))}
        </View>
      ) : null}

      {activePet && !showCreateForm && canManageActivePet ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("ko", "pet.editTitle")}</Text>
          <PetProfileFormFields
            speciesLabel={speciesLabel}
            species={editSpecies}
            onSpeciesChange={setEditSpecies}
            photoUri={editPhoto?.uri ?? activePhoto.data ?? undefined}
            photoLabel={t("ko", "pet.photoUpdate")}
            onPickPhoto={() => void pickPetProfilePhoto(setEditPhoto)}
            name={editName}
            onNameChange={setEditName}
            breed={editBreed}
            onBreedChange={setEditBreed}
            birthdate={editBirthdate}
            onBirthdateChange={setEditBirthdate}
            weightKg={editWeightKg}
            onWeightChange={setEditWeightKg}
          />

          <PrimaryButton label={t("ko", "pet.update")} onPress={onUpdate} disabled={loading} />
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: loading }} disabled={loading} style={styles.dangerButton} onPress={onDelete}>
            <AppIcon name="close" size={iconSize.sm} color={colors.danger} />
            <Text style={styles.dangerButtonText}>{t("ko", "pet.delete")}</Text>
          </Pressable>
        </View>
      ) : null}

      {activePet && !showCreateForm && !canManageActivePet ? <NoticeBanner text={t("ko", "permission.petOwnerOnly")} icon="shield" /> : null}

      {activePet && !showCreateForm && canManageCareDefaults && routine && onSaveRoutine ? <RoutineSettingsPanel routine={routine} onSave={onSaveRoutine} /> : null}
      {activePet && !showCreateForm && canManageCareDefaults && careSetup && onSaveCareSetup ? <ProfileCareDefaultsPanel petId={activePet.id} setup={careSetup} onSave={onSaveCareSetup} /> : null}
      {activePet && !showCreateForm && !canManageCareDefaults ? <NoticeBanner text={t("ko", "permission.careTeamOnly")} icon="shield" /> : null}

      {showCreateForm ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("ko", "pet.addTitle")}</Text>
          {!hasPets ? <Text style={styles.helpText}>{t("ko", "pet.empty")}</Text> : null}
          <PetProfileFormFields
            speciesLabel={speciesLabel}
            species={species}
            onSpeciesChange={setSpecies}
            photoUri={photo?.uri}
            photoLabel={t("ko", "pet.photoAdd")}
            onPickPhoto={() => void pickPetProfilePhoto(setPhoto)}
            name={name}
            onNameChange={setName}
            breed={breed}
            onBreedChange={setBreed}
            birthdate={birthdate}
            onBirthdateChange={setBirthdate}
            weightKg={weightKg}
            onWeightChange={setWeightKg}
          />

          <PrimaryButton label={t("ko", "pet.create")} onPress={onCreate} disabled={loading} />
        </View>
      ) : null}

      {(error ?? authMessage) ? (
        <NoticeBanner text={t("ko", (error ?? authMessage)!)} icon={error ? "close" : "check"} tone={error ? "error" : "success"} />
      ) : null}

      <View style={styles.actionRow}>
        <SecondaryButton label={t("ko", "auth.signOut")} onPress={() => void confirmAndSignOut(signOut)} disabled={loading} />
      </View>

      {loading ? <Text style={styles.loadingText}>{t("ko", "auth.wait")}</Text> : null}
    </ScrollView>
  );
}
