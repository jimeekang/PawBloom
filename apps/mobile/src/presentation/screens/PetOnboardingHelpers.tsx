import { Image, Pressable, Text, View } from "react-native";
import { AppIcon } from "../../design-system/iconography";
import { colors, iconSize } from "../../design-system/tokens";
import { styles } from "./PetOnboardingScreen.styles";

type SpeciesPillProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

export function SpeciesPill({ label, selected, onPress }: SpeciesPillProps) {
  return (
    <Pressable style={[styles.speciesPill, selected && styles.speciesPillActive]} onPress={onPress}>
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
    <Pressable style={styles.photoPicker} onPress={onPress}>
      {imageUri ? <Image source={{ uri: imageUri }} style={styles.photoPreview} /> : <View style={styles.photoPlaceholder}><AppIcon name="pet" size={iconSize.lg} color={colors.orangeDeep} /></View>}
      <Text style={styles.photoPickerText}>{label}</Text>
    </Pressable>
  );
}
