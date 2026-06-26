import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { NoticeBanner, PrimaryButton, SecondaryButton } from "../../design-system/components";
import { AppIcon } from "../../design-system/iconography";
import { colors, iconSize } from "../../design-system/tokens";
import { t } from "../../i18n/translations";
import { useAuth } from "../../contexts/identity/application/authContext";
import { styles } from "./PetOnboardingScreen.styles";

const speciesOptions = ["dog", "cat", "other"] as const;

export function PetOnboardingScreen() {
  const { pets, activePet, selectPet, createPet, updatePet, error, authMessage, loading, signOut } = useAuth();

  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [species, setSpecies] = useState<(typeof speciesOptions)[number]>("dog");
  const [editName, setEditName] = useState("");
  const [editBreed, setEditBreed] = useState("");
  const [editBirthdate, setEditBirthdate] = useState("");
  const [editWeightKg, setEditWeightKg] = useState("");
  const [editSpecies, setEditSpecies] = useState<(typeof speciesOptions)[number]>("dog");

  useEffect(() => {
    if (!activePet) {
      return;
    }

    setEditName(activePet.name);
    setEditBreed(activePet.breed);
    setEditBirthdate(activePet.birthdate);
    setEditWeightKg(activePet.weightKg ? String(activePet.weightKg) : "");
    setEditSpecies(activePet.species);
  }, [activePet]);

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

  const onUpdate = async () => {
    if (!activePet) {
      return;
    }

    await updatePet({
      id: activePet.id,
      name: editName,
      species: editSpecies,
      breed: editBreed,
      birthdate: editBirthdate,
      weightKg: Number.parseFloat(editWeightKg),
    });
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{t("ko", "pet.onboardingTitle")}</Text>
      <Text style={styles.copy}>{t("ko", "pet.onboardingCopy")}</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t("ko", "pet.selectTitle")}</Text>
        {pets.length === 0 ? <Text style={styles.helpText}>{t("ko", "pet.empty")}</Text> : null}
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

      {activePet ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("ko", "pet.editTitle")}</Text>
          <View style={styles.row}>
            {speciesOptions.map((option) => (
              <SpeciesPill key={option} value={option} selected={editSpecies === option} onPress={() => setEditSpecies(option)} />
            ))}
          </View>

          <TextInput style={styles.input} value={editName} onChangeText={setEditName} placeholder={t("ko", "pet.namePlaceholder")} placeholderTextColor={colors.textMuted} />
          <TextInput style={styles.input} value={editBreed} onChangeText={setEditBreed} placeholder={t("ko", "pet.breedPlaceholder")} placeholderTextColor={colors.textMuted} />
          <TextInput
            style={styles.input}
            value={editBirthdate}
            onChangeText={setEditBirthdate}
            placeholder={t("ko", "pet.birthdatePlaceholder")}
            placeholderTextColor={colors.textMuted}
            keyboardType="numbers-and-punctuation"
          />
          <TextInput
            style={styles.input}
            value={editWeightKg}
            onChangeText={setEditWeightKg}
            placeholder={t("ko", "pet.weightPlaceholder")}
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
          />

          <PrimaryButton label={t("ko", "pet.update")} onPress={onUpdate} />
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t("ko", "pet.addTitle")}</Text>
        <View style={styles.row}>{speciesOptions.map((option) => <SpeciesPill key={option} value={option} selected={species === option} onPress={() => setSpecies(option)} />)}</View>

        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder={t("ko", "pet.namePlaceholder")} placeholderTextColor={colors.textMuted} />
        <TextInput style={styles.input} value={breed} onChangeText={setBreed} placeholder={t("ko", "pet.breedPlaceholder")} placeholderTextColor={colors.textMuted} />
        <TextInput
          style={styles.input}
          value={birthdate}
          onChangeText={setBirthdate}
          placeholder={t("ko", "pet.birthdatePlaceholder")}
          placeholderTextColor={colors.textMuted}
          keyboardType="numbers-and-punctuation"
        />
        <TextInput
          style={styles.input}
          value={weightKg}
          onChangeText={setWeightKg}
          placeholder={t("ko", "pet.weightPlaceholder")}
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
        />

        <PrimaryButton label={t("ko", "pet.create")} onPress={onCreate} />
      </View>

      {(error ?? authMessage) ? (
        <NoticeBanner text={error || authMessage || ""} icon={error ? "close" : "check"} />
      ) : null}

      <View style={styles.actionRow}>
        <SecondaryButton label={t("ko", "auth.signOut")} onPress={signOut} />
      </View>

      {loading ? <Text style={styles.loadingText}>{t("ko", "auth.wait")}</Text> : null}
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
