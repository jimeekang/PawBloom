import { Pressable, Text, View } from "react-native";
import type { DiaryCategory } from "../domain/diaryEntry";
import { categoryVisuals } from "../../../design-system/categoryVisuals";
import { AppIcon } from "../../../design-system/iconography";
import { iconSize } from "../../../design-system/tokens";
import { t } from "../../../i18n/translations";
import { styles } from "./DiaryEntryScreen.styles";

export function DiaryCategoryPicker({
  categories,
  selected,
  disabled,
  onSelect,
}: {
  categories: DiaryCategory[];
  selected: DiaryCategory;
  disabled: boolean;
  onSelect: (category: DiaryCategory) => void;
}) {
  return (
    <View style={styles.categoryGrid}>
      {categories.map((key) => {
        const item = categoryVisuals[key];
        const active = selected === key;
        return (
          <Pressable
            key={key}
            accessibilityRole="radio"
            accessibilityLabel={t("ko", item.labelKey)}
            accessibilityState={{ checked: active, disabled }}
            aria-checked={active}
            disabled={disabled}
            style={[styles.categoryTile, active && styles.categoryTileActive]}
            onPress={() => onSelect(key)}
          >
            <AppIcon name={item.icon} size={iconSize.xl} color={item.color} />
            <Text style={styles.categoryLabel}>{t("ko", item.labelKey)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
