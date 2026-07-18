import * as ImagePicker from "expo-image-picker";
import { Alert, Image, Pressable, Text, TextInput, View } from "react-native";
import type { PetProfilePhotoInput } from "../../contexts/identity/application/authContextQueries";
import { FieldLabel } from "../../design-system/components";
import { DatePickerField } from "../../design-system/DatePickerField";
import { AppIcon } from "../../design-system/iconography";
import { colors, iconSize } from "../../design-system/tokens";
import { t } from "../../i18n/translations";
import { styles } from "./PetOnboardingScreen.styles";

export const speciesOptions = ["dog", "cat", "other"] as const;
export type PetSpeciesOption = (typeof speciesOptions)[number];

type SpeciesPillProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

export function SpeciesPill({ label, selected, onPress }: SpeciesPillProps) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} style={[styles.speciesPill, selected && styles.speciesPillActive]} onPress={onPress}>
      <Text style={[styles.speciesText, selected && styles.speciesTextActive]}>{label}</Text>
    </Pressable>
  );
}

type PhotoPickerProps = {
  imageUri?: string;
  label: string;
  onPress: () => void;
};

export function PhotoPicker({ imageUri, label, onPress }: PhotoPickerProps) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} style={styles.photoPicker} onPress={onPress}>
      {imageUri ? <Image source={{ uri: imageUri }} style={styles.photoPreview} accessibilityIgnoresInvertColors /> : <View style={styles.photoPlaceholder}><AppIcon name="pet" size={iconSize.lg} color={colors.orangeDeep} /></View>}
      <Text style={styles.photoPickerText}>{label}</Text>
    </Pressable>
  );
}

export async function pickPetProfilePhoto(onPicked: (nextPhoto: PetProfilePhotoInput) => void) {
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
}

export function PetProfileFormFields({
  speciesLabel,
  species,
  onSpeciesChange,
  photoUri,
  photoLabel,
  onPickPhoto,
  name,
  onNameChange,
  breed,
  onBreedChange,
  birthdate,
  onBirthdateChange,
  weightKg,
  onWeightChange,
}: {
  speciesLabel: Record<PetSpeciesOption, string>;
  species: PetSpeciesOption;
  onSpeciesChange: (species: PetSpeciesOption) => void;
  photoUri?: string;
  photoLabel: string;
  onPickPhoto: () => void;
  name: string;
  onNameChange: (value: string) => void;
  breed: string;
  onBreedChange: (value: string) => void;
  birthdate: string;
  onBirthdateChange: (value: string) => void;
  weightKg: string;
  onWeightChange: (value: string) => void;
}) {
  return (
    <>
      <View style={styles.row}>
        {speciesOptions.map((option) => (
          <SpeciesPill key={option} label={speciesLabel[option]} selected={species === option} onPress={() => onSpeciesChange(option)} />
        ))}
      </View>
      <PhotoPicker imageUri={photoUri} onPress={onPickPhoto} label={photoLabel} />

      <FieldLabel label={t("ko", "pet.namePlaceholder")} />
      <TextInput style={styles.input} accessibilityLabel={t("ko", "pet.namePlaceholder")} value={name} onChangeText={onNameChange} placeholder={t("ko", "pet.namePlaceholder")} placeholderTextColor={colors.textMuted} />
      <FieldLabel label={t("ko", "pet.breedPlaceholder")} />
      <TextInput style={styles.input} accessibilityLabel={t("ko", "pet.breedPlaceholder")} value={breed} onChangeText={onBreedChange} placeholder={t("ko", "pet.breedPlaceholder")} placeholderTextColor={colors.textMuted} />
      <FieldLabel label={t("ko", "pet.birthdatePlaceholder")} />
      <DatePickerField value={birthdate} onChange={onBirthdateChange} placeholder={t("ko", "pet.birthdatePlaceholder")} allowClear clearLabel={t("ko", "pet.birthdateClear")} />
      <FieldLabel label={t("ko", "pet.weightPlaceholder")} />
      <TextInput
        style={styles.input}
        accessibilityLabel={t("ko", "pet.weightPlaceholder")}
        value={weightKg}
        onChangeText={onWeightChange}
        placeholder={t("ko", "pet.weightPlaceholder")}
        placeholderTextColor={colors.textMuted}
        keyboardType="decimal-pad"
      />
    </>
  );
}
