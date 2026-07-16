import { Pressable, Text, View } from "react-native";
import { t } from "../../../i18n/translations";
import { styles } from "./DiaryEntryScreen.styles";

export function DiaryConditionScore({ value, onChange }: { value: 1 | 2 | 3 | 4 | 5; onChange: (value: 1 | 2 | 3 | 4 | 5) => void }) {
  return (
    <>
      <Text style={styles.sectionTitle}>{t("ko", "diary.conditionScore")}</Text>
      <View style={styles.scorePicker}>
        {[1, 2, 3, 4, 5].map((score) => (
          <Pressable
            key={score}
            accessibilityRole="radio"
            accessibilityLabel={`${t("ko", "diary.conditionScore")} ${score}`}
            accessibilityState={{ checked: value === score }}
            aria-checked={value === score}
            style={[styles.scoreButton, value === score && styles.scoreButtonActive]}
            onPress={() => onChange(score as 1 | 2 | 3 | 4 | 5)}
          >
            <Text style={[styles.scoreText, value === score && styles.scoreTextActive]}>{score}</Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}
