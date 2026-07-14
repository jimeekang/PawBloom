---
owner_model: claude-opus-4.8-extra
domain: planning
edit_policy: exclusive
---

# 케어 탭 약 추가 UX: Task 3

### Task 3: ShortTermMedicationForm 컴포넌트

**Files:**
- Create: `apps/mobile/src/contexts/care/ui/ShortTermMedicationForm.tsx`
- Test: `apps/mobile/src/contexts/care/ui/ShortTermMedicationForm.test.tsx`

**Interfaces:**
- Consumes: Task 2의 로직 함수들, `DatePickerField`/`TimePickerField`/`PrimaryButton` (design-system), `getLocalDateKey` (shared-kernel).
- Produces (Task 4가 사용): `ShortTermMedicationForm({ onSave, onSaved }: { onSave: (input: CareSetupInput) => Promise<ActiveCareSetup>; onSaved?: () => void })` — SurfaceCard 래핑 없음(호출측이 카드 안에 배치).

**레이아웃 주의:** 입력 필드는 전부 세로 스택. `timeRow`(시간 피커 + 44px 삭제 버튼)만 row — `ProfileCareDefaultsPanel`에서 이미 승인된 패턴과 동일. `panel` 스타일에 `flexDirection: "row"`를 절대 넣지 않는다 (Task 6에서 이 파일에 정적 가드가 걸린다). 에러 텍스트는 `colors.danger` (교정 #6 — coral 금지).

- [x] **Step 1: 타입 레벨 테스트 작성**

`apps/mobile/src/contexts/care/ui/ShortTermMedicationForm.test.tsx`:

```tsx
import type { ComponentProps } from "react";
import { ShortTermMedicationForm } from "./ShortTermMedicationForm";
import type { ActiveCareSetup } from "../domain/carePlan";

const emptySetup: ActiveCareSetup = { conditions: [], plans: [], schedules: [] };
const props: ComponentProps<typeof ShortTermMedicationForm> = {
  onSave: async () => emptySetup,
  onSaved: () => undefined,
};
const withoutOnSaved: ComponentProps<typeof ShortTermMedicationForm> = {
  onSave: async () => emptySetup,
};
void props;
void withoutOnSaved;
```

- [x] **Step 2: 실패 확인**

Run: `node scripts/run-presentation-test.mjs apps/mobile/src/contexts/care/ui/ShortTermMedicationForm.test.tsx`
Expected: FAIL — `Cannot find module './ShortTermMedicationForm'`

- [x] **Step 3: 구현**

`apps/mobile/src/contexts/care/ui/ShortTermMedicationForm.tsx`:

```tsx
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { ActiveCareSetup, CareSetupInput } from "../domain/carePlan";
import { PrimaryButton } from "../../../design-system/components";
import { colors, layout, radius, spacing, type } from "../../../design-system/tokens";
import { t } from "../../../i18n/translations";
import { DatePickerField } from "../../../design-system/DatePickerField";
import { TimePickerField } from "../../../design-system/TimePickerField";
import { getLocalDateKey } from "../../../shared-kernel/date";
import { buildShortTermCareSetupInput, createShortTermMedicationDraft, shortTermDraftErrorKey } from "./shortTermMedicationForm";

export function ShortTermMedicationForm({ onSave, onSaved }: { onSave: (input: CareSetupInput) => Promise<ActiveCareSetup>; onSaved?: () => void }) {
  const [draft, setDraft] = useState(() => createShortTermMedicationDraft(getLocalDateKey()));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  async function save() {
    if (savingRef.current) return;
    const errorKey = shortTermDraftErrorKey(draft);
    if (errorKey) {
      setError(t("ko", errorKey));
      return;
    }
    savingRef.current = true;
    setIsSaving(true);
    setError(null);
    try {
      await onSave(buildShortTermCareSetupInput(draft));
      setDraft(createShortTermMedicationDraft(getLocalDateKey()));
      onSaved?.();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t("ko", "care.setupSaveFailed"));
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{t("ko", "care.shortTermTitle")}</Text>
      <TextInput style={styles.input} value={draft.conditionName} onChangeText={(value) => setDraft((current) => ({ ...current, conditionName: value.slice(0, 80) }))} placeholder={t("ko", "care.conditionPlaceholder")} placeholderTextColor={colors.textSoft} />
      <TextInput style={styles.input} value={draft.medicationName} onChangeText={(value) => setDraft((current) => ({ ...current, medicationName: value.slice(0, 80) }))} placeholder={t("ko", "care.medicationPlaceholder")} placeholderTextColor={colors.textSoft} />
      <TextInput style={styles.input} value={draft.dosageLabel} onChangeText={(value) => setDraft((current) => ({ ...current, dosageLabel: value.slice(0, 80) }))} placeholder={t("ko", "care.dosagePlaceholder")} placeholderTextColor={colors.textSoft} />
      {draft.times.map((time, index) => (
        <View key={index} style={styles.timeRow}>
          <View style={styles.timeField}>
            <TimePickerField value={time} onChange={(nextTime) => setDraft((current) => ({ ...current, times: current.times.map((item, itemIndex) => (itemIndex === index ? nextTime : item)) }))} />
          </View>
          {draft.times.length > 1 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("ko", "care.removeTimeA11y")}
              style={styles.removeTimeButton}
              onPress={isSaving ? undefined : () => setDraft((current) => ({ ...current, times: current.times.filter((_, itemIndex) => itemIndex !== index) }))}
            >
              <Text style={styles.removeTimeText}>×</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
      <Pressable accessibilityRole="button" style={styles.addTimeButton} onPress={isSaving ? undefined : () => setDraft((current) => ({ ...current, times: [...current.times, "20:00"] }))}>
        <Text style={styles.addTimeText}>{t("ko", "pet.careDefaultsTimeAdd")}</Text>
      </Pressable>
      <Text style={styles.label}>{t("ko", "care.setupPeriod")}</Text>
      <DatePickerField value={draft.startsOn} onChange={(startsOn) => setDraft((current) => ({ ...current, startsOn }))} placeholder={t("ko", "care.setupStartDate")} />
      <DatePickerField value={draft.endsOn} onChange={(endsOn) => setDraft((current) => ({ ...current, endsOn }))} placeholder={t("ko", "care.shortTermEndDate")} />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <PrimaryButton label={t("ko", "care.shortTermSave")} icon="medication" onPress={isSaving ? undefined : () => void save()} disabled={isSaving} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing.md },
  title: { ...type.sectionTitle },
  label: { ...type.caption, color: colors.textMuted },
  input: { ...type.body, minHeight: layout.inputHeight, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  timeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  timeField: { flex: 1 },
  removeTimeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  removeTimeText: { ...type.sectionTitle, color: colors.textMuted },
  addTimeButton: { minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  addTimeText: { ...type.bodyStrong, color: colors.orangeDeep },
  errorText: { ...type.caption, color: colors.danger },
});
```

- [x] **Step 4: 통과 확인 + 타입체크**

Run: `node scripts/run-presentation-test.mjs apps/mobile/src/contexts/care/ui/ShortTermMedicationForm.test.tsx`
Expected: exit 0

Run: `npm run typecheck`
Expected: 에러 없음

- [x] **Step 5: Commit**

```bash
git add apps/mobile/src/contexts/care/ui/ShortTermMedicationForm.tsx apps/mobile/src/contexts/care/ui/ShortTermMedicationForm.test.tsx
git commit -m "feat(care): add short-term medication form component"
```

---
