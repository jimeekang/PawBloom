import * as ImagePicker from "expo-image-picker";
import { Alert, Image, Pressable, Text, TextInput, View } from "react-native";
import type { PetProfilePhotoInput } from "../../contexts/identity/application/authContextQueries";
import { formatPetMetaLine, type PetProfile } from "../../contexts/pet/domain/pet";
import { FieldLabel } from "../../design-system/components";
import { DatePickerField } from "../../design-system/DatePickerField";
import { AppIcon } from "../../design-system/iconography";
import { colors, iconSize } from "../../design-system/tokens";
import { useLanguage } from "../../i18n/languageContext";
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
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      style={[styles.speciesPill, selected && styles.speciesPillActive]}
      onPress={onPress}
    >
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
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={styles.photoPreview} accessibilityIgnoresInvertColors />
      ) : (
        <View style={styles.photoPlaceholder}>
          <AppIcon name="pet" size={iconSize.lg} color={colors.orangeDeep} />
        </View>
      )}
      <Text style={styles.photoPickerText}>{label}</Text>
    </Pressable>
  );
}

export function PetSelector({
  pets,
  activePetId,
  onSelect,
}: {
  pets: PetProfile[];
  activePetId?: string;
  onSelect: (petId: string) => void;
}) {
  const { language } = useLanguage();

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{t("ko", "pet.selectTitle")}</Text>
      {pets.map((pet) => {
        const meta = [formatPetMetaLine(pet, language), pet.weightKg ? `${pet.weightKg}kg` : "-"].filter(Boolean).join(" · ");
        return (
          <Pressable
            key={pet.id}
            accessibilityRole="radio"
            accessibilityLabel={`${pet.name}, ${meta}`}
            accessibilityState={{ checked: pet.id === activePetId }}
            aria-checked={pet.id === activePetId}
            style={[styles.petRow, pet.id === activePetId && styles.petRowActive]}
            onPress={() => onSelect(pet.id)}
          >
            <View style={styles.petTextWrap}>
              <Text style={styles.petName}>{pet.name}</Text>
              <Text style={styles.petMeta}>{meta}</Text>
            </View>
            <AppIcon name="check" size={iconSize.sm} color={pet.id === activePetId ? colors.orangeDeep : colors.textMuted} />
          </Pressable>
        );
      })}
    </View>
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

  if (result.canceled || !result.assets[0]) return;

  const asset = result.assets[0];
  onPicked({ uri: asset.uri, fileName: asset.fileName, mimeType: asset.mimeType, base64: asset.base64 });
}

type PetProfileFormFieldsProps = {
  speciesFieldLabel: string;
  speciesLabel: Record<PetSpeciesOption, string>;
  species: PetSpeciesOption;
  onSpeciesChange: (species: PetSpeciesOption) => void;
  photoFieldLabel: string;
  photoUri?: string;
  photoLabel: string;
  onPickPhoto: () => void;
  nameLabel: string;
  name: string;
  onNameChange: (value: string) => void;
  breedLabel: string;
  breed: string;
  onBreedChange: (value: string) => void;
  birthdateLabel: string;
  birthdate: string;
  onBirthdateChange: (value: string) => void;
  weightLabel: string;
  weightKg: string;
  onWeightChange: (value: string) => void;
};

export function PetProfileFormFields({
  speciesFieldLabel,
  speciesLabel,
  species,
  onSpeciesChange,
  photoFieldLabel,
  photoUri,
  photoLabel,
  onPickPhoto,
  nameLabel,
  name,
  onNameChange,
  breedLabel,
  breed,
  onBreedChange,
  birthdateLabel,
  birthdate,
  onBirthdateChange,
  weightLabel,
  weightKg,
  onWeightChange,
}: PetProfileFormFieldsProps) {
  return (
    <>
      <View style={styles.fieldGroup}>
        <FieldLabel label={speciesFieldLabel} />
        <View style={styles.row}>
          {speciesOptions.map((option) => (
            <SpeciesPill key={option} label={speciesLabel[option]} selected={species === option} onPress={() => onSpeciesChange(option)} />
          ))}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <FieldLabel label={photoFieldLabel} />
        <PhotoPicker imageUri={photoUri} onPress={onPickPhoto} label={photoLabel} />
      </View>

      <View style={styles.fieldGroup}>
        <FieldLabel label={nameLabel} />
        <TextInput accessibilityLabel={nameLabel} style={styles.input} value={name} onChangeText={onNameChange} placeholder={t("ko", "pet.namePlaceholder")} placeholderTextColor={colors.textMuted} />
      </View>
      <View style={styles.fieldGroup}>
        <FieldLabel label={breedLabel} />
        <TextInput accessibilityLabel={breedLabel} style={styles.input} value={breed} onChangeText={onBreedChange} placeholder={t("ko", "pet.breedPlaceholder")} placeholderTextColor={colors.textMuted} />
      </View>
      <View style={styles.fieldGroup}>
        <FieldLabel label={birthdateLabel} />
        <DatePickerField accessibilityLabel={birthdateLabel} value={birthdate} onChange={onBirthdateChange} placeholder={t("ko", "pet.birthdatePlaceholder")} allowClear clearLabel={t("ko", "pet.birthdateClear")} />
      </View>
      <View style={styles.fieldGroup}>
        <FieldLabel label={weightLabel} />
        <TextInput
          accessibilityLabel={weightLabel}
          style={styles.input}
          value={weightKg}
          onChangeText={onWeightChange}
          placeholder={t("ko", "pet.weightPlaceholder")}
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
        />
      </View>
    </>
  );
}
