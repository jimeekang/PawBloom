---
owner_model: claude-opus-4.8-extra
domain: planning
edit_policy: exclusive
---

# 케어 탭 약 추가 UX: Task 5 및 Task 6 준비

### Task 5: CareModeScreen 레이아웃 교정 (감사 #1, #2, #3 + 인라인 편집)

**Files:**
- Modify: `apps/mobile/src/presentation/screens/CareModeScreen.tsx`

**Interfaces:**
- Consumes: Task 1의 `care.editShort` 키, Task 4의 언랩된 QuickMedicationForm.
- Produces: 편집 폼이 해당 아젠다 행 바로 아래 인라인 렌더됨. 하단 토글 폼은 추가 전용이 됨 (Task 6에서 AddCard로 대체).

- [x] **Step 1: 상태 버튼을 가로 배치로 (교정 #1)**

styles 변경:

```ts
  actionButtons: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  givenButton: { flex: 1, minHeight: 40, borderRadius: radius.md, backgroundColor: colors.mintDeep, alignItems: "center", justifyContent: "center" },
  skipButton: { flex: 1, minHeight: 40, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
```

주의: 이 두 개는 짧은 고정 라벨 **버튼**이라 390px 세로 스택 가드 대상이 아니다. 입력 필드는 건드리지 않는다.

- [x] **Step 2: 헤더 카운트의 가짜 링크 어포던스 제거 (교정 #3)**

`linkText` 스타일을 두 용도로 분리한다. 섹션 헤더의 카운트는 muted 캡션으로:

```tsx
        <Text style={styles.countText}>{t("ko", "care.todayMedicationProgress")} {pendingCount}</Text>
```

styles에 추가:
```ts
  countText: { ...type.caption, color: colors.textMuted },
```

- [x] **Step 3: 행 편집 트리거 교정 (교정 #2)**

`MedicationAgendaRow`의 편집 Pressable을:

```tsx
      {onEdit ? (
        <Pressable accessibilityRole="button" onPress={onEdit} style={styles.editButton}>
          <Text style={styles.editText}>{t("ko", "care.editShort")}</Text>
        </Pressable>
      ) : null}
```

styles 변경/추가 (`linkText` 스타일은 삭제):
```ts
  editButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.md },
  editText: { ...type.caption, color: colors.orangeDeep },
```

- [x] **Step 4: 편집 폼을 행 아래 인라인으로 이동**

`CarePanel`의 medList 렌더를 다음으로 교체:

```tsx
      <View style={styles.medList}>
        {agendaRows.length === 0 ? <Text style={styles.emptyText}>{t("ko", "care.noMedicationToday")}</Text> : null}
        {agendaRows.map((row) => {
          const rowKey = `${row.scheduleId ?? row.doseId}-${row.doseDate}-${row.scheduledTime}`;
          const isEditingRow = Boolean(editingDose && row.doseId === editingDose.id);
          return (
            <View key={rowKey} style={styles.medListItem}>
              <MedicationAgendaRow row={row} onEdit={row.doseId ? () => setEditingDoseId(row.doseId ?? null) : undefined} onStatusChange={(status) => onAgendaStatusChange?.(row, status)} />
              {isEditingRow ? (
                <SurfaceCard>
                  <QuickMedicationForm onSave={onAddDose} editingDose={editingDose} onUpdate={onUpdateDose} onDelete={onDeleteDose} onCancelEdit={() => setEditingDoseId(null)} canDelete={canDeleteDose} />
                </SurfaceCard>
              ) : null}
            </View>
          );
        })}
      </View>
```

하단 토글 폼은 추가 전용으로 축소 (editingDose 관련 prop 제거):

```tsx
      <SecondaryButton label={t("ko", "care.temporaryAdd")} icon="add" onPress={() => setTemporaryFormOpen((current) => !current)} />
      {temporaryFormOpen ? (
        <SurfaceCard>
          <QuickMedicationForm onSave={onAddDose} />
        </SurfaceCard>
      ) : null}
```

styles에 추가:
```ts
  medListItem: { gap: spacing.sm },
```

- [x] **Step 5: 검증**

Run: `npm run typecheck && npm run verify:presentation`
Expected: 모두 통과

- [x] **Step 6: Commit**

```bash
git add apps/mobile/src/presentation/screens/CareModeScreen.tsx
git commit -m "fix(care): row action buttons, real edit affordance, inline dose editing"
```

---

### Task 6: 케어 탭 재구성 — AddCard 배선, 약 일정 카드, CareSetupPanel 제거, 가드 갱신

**Files:**
- Create: `apps/mobile/src/presentation/screens/careScheduleSummary.ts`
- Test: `apps/mobile/src/presentation/screens/careScheduleSummary.test.ts`
- Modify: `apps/mobile/src/presentation/screens/CareModeScreen.tsx` (전면 재구성)
- Modify: `apps/mobile/src/presentation/PawBloomShell.tsx:244` (`onOpenProfileCare` 배선)
- Modify: `scripts/verify-presentation-state.mjs` (CareSetupPanel 조항 2건 교체)
- Delete: `apps/mobile/src/contexts/care/ui/CareSetupPanel.tsx`

**Interfaces:**
- Consumes: Task 4의 `CareMedicationAddCard`, Task 1 키들.
- Produces:
  - `schedulePeriodBadge(schedule: Pick<CareMedicationSchedule, "endsOn">): string | null` — 예: `"~7/17까지"`, endsOn 없으면 null
  - `CARE_SCHEDULE_PREVIEW_COUNT = 3`
  - `partitionCareSchedules<S>(schedules: S[], expanded: boolean): { visible: S[]; hiddenCount: number }`
  - `CareModeScreen`의 props에서 `onUseSchedule` 타입이 `(schedule: CareMedicationSchedule) => void`로 직접 선언되고, `onOpenProfileCare: () => void`가 **추가**됨 (required)

**중요:** 가드 스크립트가 (a) `CareModeScreen`에 `"CareSetupPanel"` 문자열 포함을 강제하고 (b) `CareSetupPanel.tsx` 파일을 `readFileSync`로 읽는다. 따라서 **화면 재구성·파일 삭제·가드 갱신은 반드시 이 태스크의 단일 커밋**으로 묶는다. `docs/design/DESIGN_QA.md`는 이 가드의 줄 번호를 참조하지만 exclusive 문서이므로 수정하지 않는다 (커밋 메시지에 명시).

- [x] **Step 1: 스케줄 요약 로직 테스트 작성**

`apps/mobile/src/presentation/screens/careScheduleSummary.test.ts`:

```ts
import { CARE_SCHEDULE_PREVIEW_COUNT, partitionCareSchedules, schedulePeriodBadge } from "./careScheduleSummary";

if (schedulePeriodBadge({ endsOn: undefined }) !== null) throw new Error("open-ended schedules must not show a period badge");
if (schedulePeriodBadge({ endsOn: "2026-07-17" }) !== "~7/17까지") throw new Error("short-term schedules must show an until badge");
if (schedulePeriodBadge({ endsOn: "2026-11-03" }) !== "~11/3까지") throw new Error("badge must strip leading zeros");
if (schedulePeriodBadge({ endsOn: "invalid" }) !== null) throw new Error("malformed dates must not render a badge");

const schedules = ["a", "b", "c", "d", "e"];
const collapsed = partitionCareSchedules(schedules, false);
if (collapsed.visible.length !== CARE_SCHEDULE_PREVIEW_COUNT || collapsed.hiddenCount !== 2) throw new Error("collapsed list must preview 3 rows and count the rest");
const expanded = partitionCareSchedules(schedules, true);
if (expanded.visible.length !== 5 || expanded.hiddenCount !== 0) throw new Error("expanded list must show every row");
const few = partitionCareSchedules(["a", "b", "c"], false);
if (few.visible.length !== 3 || few.hiddenCount !== 0) throw new Error("lists at the preview limit must not show a more button");
```

- [x] **Step 2: 실패 확인**

Run: `node scripts/run-presentation-test.mjs apps/mobile/src/presentation/screens/careScheduleSummary.test.ts`
Expected: FAIL — `Cannot find module './careScheduleSummary'`

- [x] **Step 3: 로직 구현**

`apps/mobile/src/presentation/screens/careScheduleSummary.ts`:

```ts
import type { CareMedicationSchedule } from "../../contexts/care/domain/carePlan";
import { t } from "../../i18n/translations";

export const CARE_SCHEDULE_PREVIEW_COUNT = 3;

export function schedulePeriodBadge(schedule: Pick<CareMedicationSchedule, "endsOn">): string | null {
  if (!schedule.endsOn) return null;
  const match = schedule.endsOn.match(/^\d{4}-(\d{2})-(\d{2})/);
  if (!match) return null;
  return t("ko", "care.scheduleUntil").replace("{date}", `${Number(match[1])}/${Number(match[2])}`);
}

export function partitionCareSchedules<S>(schedules: S[], expanded: boolean): { visible: S[]; hiddenCount: number } {
  if (expanded || schedules.length <= CARE_SCHEDULE_PREVIEW_COUNT) return { visible: schedules, hiddenCount: 0 };
  return {
    visible: schedules.slice(0, CARE_SCHEDULE_PREVIEW_COUNT),
    hiddenCount: schedules.length - CARE_SCHEDULE_PREVIEW_COUNT,
  };
}
```

Run: `node scripts/run-presentation-test.mjs apps/mobile/src/presentation/screens/careScheduleSummary.test.ts`
Expected: exit 0
