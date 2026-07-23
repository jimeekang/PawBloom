import { useEffect, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { NoticeBanner, PrimaryButton, SecondaryButton } from "../../design-system/components";
import { AppIcon } from "../../design-system/iconography";
import { colors, iconSize } from "../../design-system/tokens";
import { t } from "../../i18n/translations";
import { useAuth } from "../../contexts/identity/application/authContext";
import { usePetProfilePhotoUrl } from "../../contexts/pet/application/profilePhotoUrl";
import type { PetProfilePhotoInput } from "../../contexts/identity/application/authContextQueries";
import type { PetRoutine, PetRoutineInput } from "../../contexts/routine/domain/petRoutine";
import type { ActiveCareSetup, CareSetupInput } from "../../contexts/care/domain/carePlan";
import { LabeledDateField, LabeledTextField, PetSelector, PhotoPicker, SpeciesPill } from "./PetOnboardingHelpers";
import { RoutineSettingsPanel } from "../../contexts/routine/ui/RoutineSettingsPanel";
import { ProfileCareDefaultsPanel } from "../../contexts/care/ui/ProfileCareDefaultsPanel";
import { styles } from "./PetOnboardingScreen.styles";
import { can } from "../../shared-kernel/permissions";
import { useSubscriptionEntitlement } from "../../contexts/subscription/application/subscriptionEntitlement";
import { canCreatePet, entitlements } from "../../contexts/subscription/domain/entitlement";
import { countOwnedPets } from "../../contexts/pet/domain/pet";

const speciesOptions = ["dog", "cat", "other"] as const;

export function PetOnboardingScreen({ routine, onSaveRoutine, careSetup, onSaveCareSetup, onProfileSaved }: { routine?: PetRoutine; onSaveRoutine?: (routine: PetRoutineInput) => void | Promise<void>; careSetup?: ActiveCareSetup; onSaveCareSetup?: (input: CareSetupInput) => Promise<ActiveCareSetup>; onProfileSaved?: () => void } = {}) {
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
  const [species, setSpecies] = useState<(typeof speciesOptions)[number]>("dog");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBreed, setEditBreed] = useState("");
  const [editBirthdate, setEditBirthdate] = useState("");
  const [editWeightKg, setEditWeightKg] = useState("");
  const [editSpecies, setEditSpecies] = useState<(typeof speciesOptions)[number]>("dog");
  const [photo, setPhoto] = useState<PetProfilePhotoInput | undefined>();
  const [editPhoto, setEditPhoto] = useState<PetProfilePhotoInput | undefined>();
  const activePhoto = usePetProfilePhotoUrl(activePet?.id, user?.id ?? null);
  const hasPets = pets.length > 0;
  const shouldShowPetSelector = pets.length > 1 && !showCreateForm;
  const canManageActivePet = activePet ? can(activePet.role, "pet.update") && can(activePet.role, "pet.photo.update") && can(activePet.role, "pet.delete") : false;
  const canManageCareDefaults = activePet ? can(activePet.role, "routine.update") && can(activePet.role, "care.update") : false;
  const speciesLabel: Record<(typeof speciesOptions)[number], string> = {
    dog: t("ko", "pet.speciesDog"),
    cat: t("ko", "pet.speciesCat"),
    other: t("ko", "pet.speciesOther"),
  };

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
    if (!petCreationAllowed) return;
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

    Alert.alert(t("ko", "pet.deleteTitle"), `${activePet.name} ${t("ko", "pet.deleteCopy")}`, [
      { text: t("ko", "pet.deleteCancel"), style: "cancel" },
      { text: t("ko", "pet.deleteConfirm"), style: "destructive", onPress: () => void deletePet(activePet.id) },
    ]);
  };

  const pickPhoto = async (onPicked: (nextPhoto: PetProfilePhotoInput) => void) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t("ko", "pet.photoPermissionTitle"), t("ko", "pet.photoPermissionCopy"));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
      base64: true,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];
    onPicked({ uri: asset.uri, fileName: asset.fileName, mimeType: asset.mimeType, base64: asset.base64 });
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{t("ko", "pet.onboardingTitle")}</Text>
      <Text style={styles.copy}>{t("ko", "pet.onboardingCopy")}</Text>

      {!user ? <NoticeBanner text={t("ko", "pet.loginRequired")} icon="shield" /> : null}
      {entitlementLoading ? <NoticeBanner text={t("ko", "pet.planLoading")} icon="lock" /> : null}
      {entitlementFailed ? <NoticeBanner text={t("ko", "pet.planLoadFailed")} icon="close" tone="error" /> : null}
      {hasPets && !showCreateForm && petCreationAllowed ? <SecondaryButton label={t("ko", "pet.create")} icon="add" onPress={onAddAnother} /> : null}
      {hasPets && !showCreateForm && entitlement && !petCreationAllowed ? <NoticeBanner text={t("ko", "pet.planLimitReached").replace("{limit}", `${entitlement.maxPets}`)} icon="lock" /> : null}

      {shouldShowPetSelector ? <PetSelector pets={pets} activePetId={activePet?.id} onSelect={selectPet} /> : null}

      {activePet && !showCreateForm && canManageActivePet ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("ko", "pet.editTitle")}</Text>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t("ko", "pet.speciesLabel")}</Text>
            <View style={styles.row}>
              {speciesOptions.map((option) => (
                <SpeciesPill key={option} label={speciesLabel[option]} selected={editSpecies === option} onPress={() => setEditSpecies(option)} />
              ))}
            </View>
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t("ko", "pet.photoLabel")}</Text>
            <PhotoPicker
              imageUri={editPhoto?.uri ?? activePhoto.data ?? undefined}
              onPress={() => void pickPhoto(setEditPhoto)}
              label={t("ko", "pet.photoUpdate")}
            />
          </View>

          <LabeledTextField label={t("ko", "pet.nameLabel")} value={editName} onChangeText={setEditName} placeholder={t("ko", "pet.namePlaceholder")} />
          <LabeledTextField label={t("ko", "pet.breedLabel")} value={editBreed} onChangeText={setEditBreed} placeholder={t("ko", "pet.breedPlaceholder")} />
          <LabeledDateField label={t("ko", "pet.birthdateLabel")} value={editBirthdate} onChange={setEditBirthdate} placeholder={t("ko", "pet.birthdatePlaceholder")} clearLabel={t("ko", "pet.birthdateClear")} />
          <LabeledTextField
            label={t("ko", "pet.weightLabel")}
            value={editWeightKg}
            onChangeText={setEditWeightKg}
            placeholder={t("ko", "pet.weightPlaceholder")}
            keyboardType="decimal-pad"
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

      {showCreateForm && petCreationAllowed ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("ko", "pet.addTitle")}</Text>
          {!hasPets ? <Text style={styles.helpText}>{t("ko", "pet.empty")}</Text> : null}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t("ko", "pet.speciesLabel")}</Text>
            <View style={styles.row}>
              {speciesOptions.map((option) => (
                <SpeciesPill key={option} label={speciesLabel[option]} selected={species === option} onPress={() => setSpecies(option)} />
              ))}
            </View>
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t("ko", "pet.photoLabel")}</Text>
            <PhotoPicker imageUri={photo?.uri} onPress={() => void pickPhoto(setPhoto)} label={t("ko", "pet.photoAdd")} />
          </View>

          <LabeledTextField label={t("ko", "pet.nameLabel")} value={name} onChangeText={setName} placeholder={t("ko", "pet.namePlaceholder")} />
          <LabeledTextField label={t("ko", "pet.breedLabel")} value={breed} onChangeText={setBreed} placeholder={t("ko", "pet.breedPlaceholder")} />
          <LabeledDateField label={t("ko", "pet.birthdateLabel")} value={birthdate} onChange={setBirthdate} placeholder={t("ko", "pet.birthdatePlaceholder")} clearLabel={t("ko", "pet.birthdateClear")} />
          <LabeledTextField
            label={t("ko", "pet.weightLabel")}
            value={weightKg}
            onChangeText={setWeightKg}
            placeholder={t("ko", "pet.weightPlaceholder")}
            keyboardType="decimal-pad"
          />

          <PrimaryButton label={t("ko", "pet.create")} onPress={onCreate} disabled={loading} />
        </View>
      ) : null}

      {(error ?? authMessage) ? (
        <NoticeBanner text={t("ko", (error ?? authMessage)!)} icon={error ? "close" : "check"} />
      ) : null}

      {user ? <View style={styles.actionRow}><SecondaryButton label={t("ko", "auth.signOut")} onPress={signOut} disabled={loading} /></View> : null}

      {loading ? <Text style={styles.loadingText}>{t("ko", "auth.wait")}</Text> : null}
    </ScrollView>
  );
}
