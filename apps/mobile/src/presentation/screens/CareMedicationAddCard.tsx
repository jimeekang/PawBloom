import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ActiveCareSetup, CareSetupInput } from "../../contexts/care/domain/carePlan";
import { SecondaryButton, SegmentedControl, SurfaceCard } from "../../design-system/components";
import { colors, spacing, type } from "../../design-system/tokens";
import { t } from "../../i18n/translations";
import { QuickMedicationForm, type QuickMedicationSaveHandler } from "../../contexts/medication/ui/CareMedicationPanel";
import { ShortTermMedicationForm } from "../../contexts/care/ui/ShortTermMedicationForm";

type AddScope = "today" | "short" | "daily";

export function CareMedicationAddCard({
  petId,
  onAddDose,
  onSaveCareSetup,
  onOpenProfileCare,
  onSaved,
}: {
  petId: string;
  onAddDose: QuickMedicationSaveHandler;
  onSaveCareSetup: (input: CareSetupInput) => Promise<ActiveCareSetup>;
  onOpenProfileCare: () => void;
  onSaved: () => void;
}) {
  const [scope, setScope] = useState<AddScope>("today");

  return (
    <SurfaceCard>
      <View style={styles.card}>
        <SegmentedControl
          value={scope}
          onChange={setScope}
          items={[
            { label: t("ko", "care.addScope.today"), value: "today" },
            { label: t("ko", "care.addScope.short"), value: "short" },
            { label: t("ko", "care.addScope.daily"), value: "daily" },
          ]}
        />
        {scope === "today" ? <QuickMedicationForm onSave={onAddDose} /> : null}
        {scope === "short" ? <ShortTermMedicationForm key={petId} onSave={onSaveCareSetup} onSaved={onSaved} /> : null}
        {scope === "daily" ? (
          <View style={styles.dailyBox}>
            <Text style={styles.dailyHint}>{t("ko", "care.addDailyHint")}</Text>
            <SecondaryButton label={t("ko", "care.addDailyManage")} onPress={onOpenProfileCare} />
          </View>
        ) : null}
      </View>
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  dailyBox: { gap: spacing.md },
  dailyHint: { ...type.body, color: colors.textMuted },
});
