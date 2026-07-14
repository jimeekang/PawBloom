---
owner_model: claude-opus-4.8-extra
domain: planning
edit_policy: exclusive
---

# 케어 탭 약 추가 UX: Task 6 마무리 및 Task 7

- [x] **Step 5: PawBloomShell 배선**

`apps/mobile/src/presentation/PawBloomShell.tsx:244`의 `<CareModeScreen ...>` 호출에 prop 추가:

```tsx
onOpenProfileCare={() => setShowPetSettings(true)}
```

(`setShowPetSettings`는 같은 컴포넌트의 기존 state setter — SettingsScreen의 `onOpenPetProfiles`가 이미 동일하게 사용.)

- [x] **Step 6: 가드 스크립트 갱신**

`scripts/verify-presentation-state.mjs`에서 두 블록을 교체.

(a) CareSetupPanel 포함 강제 조항:

변경 전:
```js
if (!careModeScreen.includes("CareSetupPanel")) {
  throw new Error("care screen must include care plan creation UI in the primary care flow");
}
```
변경 후:
```js
if (!careModeScreen.includes("CareMedicationAddCard")) {
  throw new Error("care screen must include the add-medication entry point in the primary care flow");
}

const careMedicationAddCard = readFileSync(join(root, "apps/mobile/src/presentation/screens/CareMedicationAddCard.tsx"), "utf8");
if (!careMedicationAddCard.includes("ShortTermMedicationForm")) {
  throw new Error("add-medication card must keep care plan creation (short-term course) reachable from the care flow");
}
```

(b) CareSetupPanel 세로 스택 가드 (파일 삭제로 readFileSync가 crash하므로 반드시 교체):

변경 전:
```js
const careSetupPanel = readFileSync(join(root, "apps/mobile/src/contexts/care/ui/CareSetupPanel.tsx"), "utf8");
if (/\n\s*row:\s*{\s*flexDirection:\s*"row"/s.test(careSetupPanel) || /\n\s*timePicker:\s*{\s*width:\s*112/s.test(careSetupPanel)) {
  throw new Error("care setup medication and time fields must remain stacked to avoid narrow mobile clipping");
}
```
변경 후:
```js
const shortTermMedicationForm = readFileSync(join(root, "apps/mobile/src/contexts/care/ui/ShortTermMedicationForm.tsx"), "utf8");
if (/\n\s*panel:\s*{[^}]*flexDirection:\s*"row"/s.test(shortTermMedicationForm)) {
  throw new Error("short-term medication fields must remain stacked to avoid narrow mobile clipping");
}
```

- [x] **Step 7: CareSetupPanel 삭제 + 잔여 참조 확인**

```bash
git rm apps/mobile/src/contexts/care/ui/CareSetupPanel.tsx
grep -rn "CareSetupPanel" apps/mobile/src scripts
```
Expected: grep 결과 없음 (있으면 해당 참조를 이 태스크에서 정리)

- [x] **Step 8: 전체 검증**

Run: `npm run typecheck && npm run verify:presentation && npm run verify:architecture && npm run verify:i18n`
Expected: 모두 통과

- [x] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(care): single add-medication entry point replaces duplicated care plan form

verify-presentation-state guard updated: care plan creation requirement now
points at CareMedicationAddCard/ShortTermMedicationForm. DESIGN_QA.md (exclusive)
references old guard line numbers; owner model to reconcile."
```

---

### Task 7: MedicationRow 제거 + inputStack rename (교정 #8, #9)

**Files:**
- Modify: `apps/mobile/src/contexts/medication/ui/CareMedicationPanel.tsx`
- Modify: `apps/mobile/src/contexts/medication/ui/CareMedicationPanel.test.tsx`
- Modify: `scripts/verify-presentation-state.mjs` (inputGrid 정규식 → inputStack)

**Interfaces:**
- Produces: `CareMedicationPanel.tsx`는 `QuickMedicationForm`(+타입들)만 export. `MedicationRow`와 `statusVisual`은 삭제됨.

- [x] **Step 1: MedicationRow 컴포넌트 삭제**

`CareMedicationPanel.tsx`에서 제거:
- `MedicationRow` 함수 전체 (export function MedicationRow ... 끝까지)
- `statusVisual` 함수 전체
- styles에서: `medRow`, `medEditTarget`, `medAccent`, `medBody`, `medTitle`, `medDetail`, `medMeta`, `medTime`, `doneCircle`, `doneCircleActive`
- import에서 이제 미사용이 된 것 제거: `AppIcon` (iconography), `iconSize` (tokens)

유지: `QuickMedicationForm`이 쓰는 `sectionTitle`, `quickForm`, `input`, `inputGrid`(다음 스텝에서 rename), `noteInput`, `editActions`, `dangerButton`, `dangerButtonText`.

- [x] **Step 2: inputGrid → inputStack rename (레이아웃 변경 없음)**

같은 파일에서 `styles.inputGrid` 사용처와 스타일 정의를 `inputStack`으로 rename:

```tsx
        <View style={styles.inputStack}>
```
```ts
  inputStack: { gap: spacing.sm },
```

`scripts/verify-presentation-state.mjs`의 정규식도 같은 커밋에서 갱신:

변경 전:
```js
if (/\n\s*inputGrid:\s*{\s*flexDirection:\s*"row"/s.test(careMedicationPanel)) {
```
변경 후:
```js
if (/\n\s*inputStack:\s*{\s*flexDirection:\s*"row"/s.test(careMedicationPanel)) {
```

- [x] **Step 3: 테스트 정리**

`CareMedicationPanel.test.tsx`에서 제거:
- import의 `MedicationRow`
- `rowProps` 선언 블록과 `void rowProps;` 라인

- [x] **Step 4: 검증**

```bash
grep -rn "MedicationRow" apps/mobile/src/contexts/medication/ui apps/mobile/src/presentation
```
Expected: 결과 없음 (application 레이어의 DB row 타입 alias `MedicationRow`는 별개 — `contexts/*/application` 결과는 무시)

Run: `npm run typecheck && npm run verify:presentation`
Expected: 모두 통과

- [x] **Step 5: Commit**

```bash
git add apps/mobile/src/contexts/medication/ui/CareMedicationPanel.tsx apps/mobile/src/contexts/medication/ui/CareMedicationPanel.test.tsx scripts/verify-presentation-state.mjs
git commit -m "refactor(medication): drop dead MedicationRow, rename inputGrid to inputStack"
```

---
