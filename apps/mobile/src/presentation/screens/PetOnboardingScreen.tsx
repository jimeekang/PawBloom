import { useEffect, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { NoticeBanner, PrimaryButton, SecondaryButton } from "../../design-system/components";
import { AppIcon } from "../../design-system/iconography";
import { colors, iconSize } from "../../design-system/tokens";
import { t } from "../../i18n/translations";
import { useAuth } from "../../contexts/identity/application/authContext";
import { usePetProfilePhotoUrl } from "../../contexts/pet/application/profilePhotoUrl";
import type { PetProfilePhotoInput } from "../../contexts/identity/application/authContextQueries";
import type { PetRoutine, PetRoutineInput } from "../../contexts/routine/domain/petRoutine";
import type { ActiveCareSetup, CareSetupInput } from "../../contexts/care/domain/carePlan";
import { SpeciesPill, PhotoPicker } from "./PetOnboardingHelpers";
import { RoutineSettingsPanel } from "../../contexts/routine/ui/RoutineSettingsPanel";
import { ProfileCareDefaultsPanel } from "../../contexts/care/ui/ProfileCareDefaultsPanel";
import { DatePickerField } from "../../design-system/DatePickerField";
import { styles } from "./PetOnboardingScreen.styles";

const speciesOptions = ["dog", "cat", "other"] as const;

export function PetOnboardingScreen({ routine, onSaveRoutine, careSetup, onSaveCareSetup, onProfileSaved }: { routine?: PetRoutine; onSaveRoutine?: (routine: PetRoutineInput) => void | Promise<void>; careSetup?: ActiveCareSetup; onSaveCareSetup?: (input: CareSetupInput) => Promise<ActiveCareSetup>; onProfileSaved?: () => void } = {}) {
  const { pets, activePet, selectPet, createPet, updatePet, deletePet, error, authMessage, loading, signOut } = useAuth();

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
  const activePhoto = usePetProfilePhotoUrl(activePet?.id);
  const hasPets = pets.length > 0;
  const shouldShowPetSelector = pets.length > 1 && !showCreateForm;
  const speciesLabel: Record<(typeof speciesOptions)[number], string> = {
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
    if (!activePet) {
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
    if (!activePet) {
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

      {activePet && !showCreateForm ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("ko", "pet.editTitle")}</Text>
          <View style={styles.row}>
            {speciesOptions.map((option) => (
              <SpeciesPill key={option} label={speciesLabel[option]} selected={editSpecies === option} onPress={() => setEditSpecies(option)} />
            ))}
          </View>
          <PhotoPicker
            imageUri={editPhoto?.uri ?? activePhoto.data ?? undefined}
            onPress={() => void pickPhoto(setEditPhoto)}
            label={t("ko", "pet.photoUpdate")}
          />

          <TextInput style={styles.input} value={editName} onChangeText={setEditName} placeholder={t("ko", "pet.namePlaceholder")} placeholderTextColor={colors.textMuted} />
          <TextInput style={styles.input} value={editBreed} onChangeText={setEditBreed} placeholder={t("ko", "pet.breedPlaceholder")} placeholderTextColor={colors.textMuted} />
          <DatePickerField value={editBirthdate} onChange={setEditBirthdate} placeholder={t("ko", "pet.birthdatePlaceholder")} allowClear clearLabel={t("ko", "pet.birthdateClear")} />
          <TextInput
            style={styles.input}
            value={editWeightKg}
            onChangeText={setEditWeightKg}
            placeholder={t("ko", "pet.weightPlaceholder")}
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
          />

          <PrimaryButton label={t("ko", "pet.update")} onPress={onUpdate} disabled={loading} />
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: loading }} disabled={loading} style={styles.dangerButton} onPress={onDelete}>
            <AppIcon name="close" size={iconSize.sm} color={colors.coral} />
            <Text style={styles.dangerButtonText}>{t("ko", "pet.delete")}</Text>
          </Pressable>
        </View>
      ) : null}

      {activePet && !showCreateForm && routine && onSaveRoutine ? <RoutineSettingsPanel routine={routine} onSave={onSaveRoutine} /> : null}
      {activePet && !showCreateForm && careSetup && onSaveCareSetup ? <ProfileCareDefaultsPanel petId={activePet.id} setup={careSetup} onSave={onSaveCareSetup} /> : null}

      {showCreateForm ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("ko", "pet.addTitle")}</Text>
          {!hasPets ? <Text style={styles.helpText}>{t("ko", "pet.empty")}</Text> : null}
          <View style={styles.row}>
            {speciesOptions.map((option) => (
              <SpeciesPill key={option} label={speciesLabel[option]} selected={species === option} onPress={() => setSpecies(option)} />
            ))}
          </View>
          <PhotoPicker imageUri={photo?.uri} onPress={() => void pickPhoto(setPhoto)} label={t("ko", "pet.photoAdd")} />

          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder={t("ko", "pet.namePlaceholder")} placeholderTextColor={colors.textMuted} />
          <TextInput style={styles.input} value={breed} onChangeText={setBreed} placeholder={t("ko", "pet.breedPlaceholder")} placeholderTextColor={colors.textMuted} />
          <DatePickerField value={birthdate} onChange={setBirthdate} placeholder={t("ko", "pet.birthdatePlaceholder")} allowClear clearLabel={t("ko", "pet.birthdateClear")} />
          <TextInput
            style={styles.input}
            value={weightKg}
            onChangeText={setWeightKg}
            placeholder={t("ko", "pet.weightPlaceholder")}
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
          />

          <PrimaryButton label={t("ko", "pet.create")} onPress={onCreate} disabled={loading} />
        </View>
      ) : null}

      {(error ?? authMessage) ? (
        <NoticeBanner text={t("ko", (error ?? authMessage)!)} icon={error ? "close" : "check"} />
      ) : null}

      <View style={styles.actionRow}>
        <SecondaryButton label={t("ko", "auth.signOut")} onPress={signOut} disabled={loading} />
      </View>

      {loading ? <Text style={styles.loadingText}>{t("ko", "auth.wait")}</Text> : null}
    </ScrollView>
  );
}
