import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { NoticeBanner, PrimaryButton, SecondaryButton } from "../../design-system/components";
import { AppIcon } from "../../design-system/iconography";
import { colors, iconSize, layout, radius, spacing, type } from "../../design-system/tokens";
import { t } from "../../i18n/translations";
import { useAuth } from "../../contexts/identity/application/authContext";

const speciesOptions = ["dog", "cat", "other"] as const;

export function PetOnboardingScreen() {
  const { pets, activePet, selectPet, createPet, error, authMessage, loading, signOut } = useAuth();

  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [species, setSpecies] = useState<(typeof speciesOptions)[number]>("dog");

  const onCreate = async () => {
    await createPet({
      name,
      species,
      breed,
      birthdate,
      weightKg: Number.parseFloat(weightKg),
    });

    setName("");
    setBreed("");
    setBirthdate("");
    setWeightKg("");
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>반려동물 계정 설정</Text>
      <Text style={styles.copy}>현재 계정으로 관리할 반려동물을 등록해 주세요.</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>반려동물 선택</Text>
        {pets.length === 0 ? <Text style={styles.helpText}>등록된 반려동물이 없습니다.</Text> : null}
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

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>새 반려동물 추가</Text>
        <View style={styles.row}>{speciesOptions.map((option) => <SpeciesPill key={option} value={option} selected={species === option} onPress={() => setSpecies(option)} />)}</View>

        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="펫 이름" placeholderTextColor={colors.textMuted} />
        <TextInput style={styles.input} value={breed} onChangeText={setBreed} placeholder="품종" placeholderTextColor={colors.textMuted} />
        <TextInput
          style={styles.input}
          value={birthdate}
          onChangeText={setBirthdate}
          placeholder="생년월일 (YYYY-MM-DD, 선택)"
          placeholderTextColor={colors.textMuted}
          keyboardType="numbers-and-punctuation"
        />
        <TextInput
          style={styles.input}
          value={weightKg}
          onChangeText={setWeightKg}
          placeholder="몸무게(kg, 선택)"
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
        />

        <PrimaryButton label={t("en", "pet.create")} onPress={onCreate} />
      </View>

      {(error ?? authMessage) ? (
        <NoticeBanner text={error || authMessage || ""} icon={error ? "close" : "check"} />
      ) : null}

      <View style={styles.actionRow}>
        <SecondaryButton label={t("en", "auth.signOut")} onPress={signOut} />
      </View>

      {loading ? <Text style={styles.loadingText}>처리 중...</Text> : null}
    </ScrollView>
  );
}

function SpeciesPill({ value, selected, onPress }: { value: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.speciesPill, selected && styles.speciesPillActive]} onPress={onPress}>
      <Text style={[styles.speciesText, selected && styles.speciesTextActive]}>{value}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.appBackground,
  },
  scrollContent: {
    padding: layout.screenPadding,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  title: {
    ...type.heroTitle,
    color: colors.text,
  },
  copy: {
    ...type.body,
    color: colors.text,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    ...type.sectionTitle,
  },
  helpText: {
    ...type.caption,
    color: colors.textMuted,
  },
  petRow: {
    minHeight: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  petRowActive: {
    borderColor: colors.orangeDeep,
    backgroundColor: colors.surfacePeach,
  },
  petTextWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  petName: {
    ...type.bodyStrong,
    color: colors.text,
  },
  petMeta: {
    ...type.caption,
    color: colors.textMuted,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  speciesPill: {
    minHeight: 34,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  speciesPillActive: {
    borderColor: colors.orangeDeep,
    backgroundColor: colors.surfacePeach,
  },
  speciesText: {
    ...type.caption,
    color: colors.textMuted,
  },
  speciesTextActive: {
    color: colors.orangeDeep,
    fontWeight: "600",
  },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.text,
  },
  actionRow: {
    marginTop: spacing.xs,
  },
  loadingText: {
    ...type.caption,
    color: colors.orangeDeep,
    textAlign: "center",
  },
});
