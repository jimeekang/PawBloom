---
owner_model: claude-opus-4.8-extra
domain: planning
edit_policy: exclusive
---

# 케어 탭 약 추가 UX: Task 4

### Task 4: QuickMedicationForm 카드 언랩 + CareMedicationAddCard 생성

**Files:**
- Modify: `apps/mobile/src/contexts/medication/ui/CareMedicationPanel.tsx` (QuickMedicationForm의 SurfaceCard 래핑 제거)
- Modify: `apps/mobile/src/presentation/screens/CareModeScreen.tsx:145` (기존 호출부를 SurfaceCard로 감싸 시각 동일 유지)
- Create: `apps/mobile/src/presentation/screens/CareMedicationAddCard.tsx`
- Test: `apps/mobile/src/presentation/screens/CareMedicationAddCard.test.tsx`

**Interfaces:**
- Consumes: `QuickMedicationForm`, `QuickMedicationSaveHandler` (medication/ui), `ShortTermMedicationForm` (Task 3), `CareSetupInput`/`ActiveCareSetup` (care/domain).
- Produces (Task 6이 사용): `CareMedicationAddCard({ petId, onAddDose, onSaveCareSetup, onOpenProfileCare, onSaved })` — `petId: string`, `onAddDose: QuickMedicationSaveHandler`, `onSaveCareSetup: (input: CareSetupInput) => Promise<ActiveCareSetup>`, `onOpenProfileCare: () => void`, `onSaved: () => void`.
- QuickMedicationForm은 이 태스크부터 **SurfaceCard 없이** 렌더된다 (호출측 래핑 책임).

- [x] **Step 1: QuickMedicationForm 언랩**

`CareMedicationPanel.tsx`의 `QuickMedicationForm` return을 다음으로 변경 (기존 `<SurfaceCard><View style={styles.quickForm}>` → `<View style={styles.quickForm}>`, 닫는 태그도 대응):

변경 전:
```tsx
  return (
    <SurfaceCard>
      <View style={styles.quickForm}>
        ...
      </View>
    </SurfaceCard>
  );
```
변경 후:
```tsx
  return (
    <View style={styles.quickForm}>
      ...
    </View>
  );
```

같은 파일 import에서 `SurfaceCard` 제거 (이 파일에서 다른 사용처 없음):
```ts
import { NoticeBanner, PrimaryButton, SecondaryButton, SegmentedControl } from "../../../design-system/components";
```

- [x] **Step 2: 기존 호출부 시각 유지**

`CareModeScreen.tsx:145`를 SurfaceCard로 감싼다 (SurfaceCard는 이미 import되어 있음):

```tsx
      {temporaryFormOpen || editingDose ? (
        <SurfaceCard>
          <QuickMedicationForm onSave={onAddDose} editingDose={editingDose} onUpdate={onUpdateDose} onDelete={onDeleteDose} onCancelEdit={() => setEditingDoseId(null)} canDelete={canDeleteDose} />
        </SurfaceCard>
      ) : null}
```

- [x] **Step 3: 타입 레벨 테스트 작성**

`apps/mobile/src/presentation/screens/CareMedicationAddCard.test.tsx`:

```tsx
import type { ComponentProps } from "react";
import { CareMedicationAddCard } from "./CareMedicationAddCard";
import type { ActiveCareSetup } from "../../contexts/care/domain/carePlan";

const emptySetup: ActiveCareSetup = { conditions: [], plans: [], schedules: [] };
const props: ComponentProps<typeof CareMedicationAddCard> = {
  petId: "pet-1",
  onAddDose: async () => undefined,
  onSaveCareSetup: async () => emptySetup,
  onOpenProfileCare: () => undefined,
  onSaved: () => undefined,
};
void props;
```

- [x] **Step 4: 실패 확인**

Run: `node scripts/run-presentation-test.mjs apps/mobile/src/presentation/screens/CareMedicationAddCard.test.tsx`
Expected: FAIL — `Cannot find module './CareMedicationAddCard'`

- [x] **Step 5: 구현**

`apps/mobile/src/presentation/screens/CareMedicationAddCard.tsx`:

```tsx
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
```

`key={petId}`는 펫 전환 시 며칠간 폼 draft를 리셋하기 위한 remount 키다.

- [x] **Step 6: 통과 확인 + 전체 검증**

Run: `node scripts/run-presentation-test.mjs apps/mobile/src/presentation/screens/CareMedicationAddCard.test.tsx`
Expected: exit 0

Run: `npm run typecheck && npm run verify:presentation`
Expected: 모두 통과 (CareMedicationAddCard는 아직 어디서도 렌더되지 않음 — Task 6에서 배선)

- [x] **Step 7: Commit**

```bash
git add apps/mobile/src/contexts/medication/ui/CareMedicationPanel.tsx apps/mobile/src/presentation/screens/CareModeScreen.tsx apps/mobile/src/presentation/screens/CareMedicationAddCard.tsx apps/mobile/src/presentation/screens/CareMedicationAddCard.test.tsx
git commit -m "feat(care): add medication add card with scope branches"
```

---
