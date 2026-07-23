import { Image, Pressable, Text, TextInput, View, type TextInputProps } from "react-native";
import { AppIcon } from "../../design-system/iconography";
import { colors, iconSize } from "../../design-system/tokens";
import { DatePickerField } from "../../design-system/DatePickerField";
import type { PetProfile } from "../../contexts/pet/domain/pet";
import { t } from "../../i18n/translations";
import { styles } from "./PetOnboardingScreen.styles";

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
      {imageUri ? <Image source={{ uri: imageUri }} style={styles.photoPreview} /> : <View style={styles.photoPlaceholder}><AppIcon name="pet" size={iconSize.lg} color={colors.orangeDeep} /></View>}
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
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{t("ko", "pet.selectTitle")}</Text>
      {pets.map((pet) => (
        <Pressable
          key={pet.id}
          accessibilityRole="radio"
          accessibilityLabel={`${pet.name}, ${pet.breed || "-"}, ${pet.ageLabel}, ${pet.weightKg ? `${pet.weightKg}kg` : "-"}`}
          accessibilityState={{ checked: pet.id === activePetId }}
          aria-checked={pet.id === activePetId}
          style={[styles.petRow, pet.id === activePetId && styles.petRowActive]}
          onPress={() => onSelect(pet.id)}
        >
          <View style={styles.petTextWrap}>
            <Text style={styles.petName}>{pet.name}</Text>
            <Text style={styles.petMeta}>
              {pet.breed || "-"} · {pet.ageLabel} · {pet.weightKg ? `${pet.weightKg}kg` : "-"}
            </Text>
          </View>
          <AppIcon name="check" size={iconSize.sm} color={pet.id === activePetId ? colors.orangeDeep : colors.textMuted} />
        </Pressable>
      ))}
    </View>
  );
}

type LabeledTextFieldProps = Pick<TextInputProps, "value" | "onChangeText" | "placeholder" | "keyboardType"> & {
  label: string;
};

export function LabeledTextField({ label, value, onChangeText, placeholder, keyboardType }: LabeledTextFieldProps) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
      />
    </View>
  );
}

export function LabeledDateField({
  label,
  value,
  onChange,
  placeholder,
  clearLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  clearLabel: string;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <DatePickerField
        accessibilityLabel={label}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        allowClear
        clearLabel={clearLabel}
      />
    </View>
  );
}
