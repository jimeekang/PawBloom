---
owner_model: claude-opus-4.8-extra
domain: planning
edit_policy: exclusive
---

# 케어 탭 약 추가 UX: Task 8–9

### Task 8: ProfileCareDefaultsPanel 교정 (교정 #6, #10)

**Files:**
- Modify: `apps/mobile/src/contexts/care/ui/ProfileCareDefaultsPanel.tsx`

- [x] **Step 1: 시간 삭제 버튼 a11y 라벨 교정 (#10)**

144행 부근:

변경 전:
```tsx
                accessibilityLabel={t("ko", "pet.careDefaultsClearDate")}
```
변경 후:
```tsx
                accessibilityLabel={t("ko", "care.removeTimeA11y")}
```

- [x] **Step 2: 에러 색상 시멘틱 통일 (#6)**

styles:

변경 전:
```ts
  errorText: { ...type.caption, color: colors.coral },
```
변경 후:
```ts
  errorText: { ...type.caption, color: colors.danger },
```

- [x] **Step 3: 검증 + Commit**

Run: `npm run typecheck && npm run verify:presentation`
Expected: 통과

```bash
git add apps/mobile/src/contexts/care/ui/ProfileCareDefaultsPanel.tsx
git commit -m "fix(care): profile defaults a11y label and danger error color"
```

---

### Task 9: 미사용 i18n 키 정리 + 최종 검증

**Files:**
- Modify: `apps/mobile/src/i18n/translations.ts`

- [x] **Step 1: 후보 키 사용처 grep**

CareSetupPanel 삭제와 임시 투약 흐름 대체로 미사용이 되었을 후보들. **각 키마다 grep으로 0건 확인 후에만 삭제** (en/ko 양쪽 동시):

```bash
for key in care.temporaryAdd care.temporaryCopy care.setupTitle care.setupCopy care.setupRepeat care.setupEveryDay care.setupCustomRepeat care.setupCustomRepeatSuffix care.setupClearDate care.setupEndDate care.noConditionLinked care.useToday care.setupStartDate care.setupPeriod; do
  echo "== $key: $(grep -rn "\"$key\"" apps/mobile/src --include="*.ts" --include="*.tsx" | grep -v i18n/translations | wc -l | tr -d ' ') usages"
done
```

Expected 참고: `care.useToday`/`care.setupStartDate`/`care.setupPeriod`는 새 코드가 사용하므로 1건 이상 → **유지**. 0건인 키만 삭제.

- [x] **Step 2: 0건 키를 en/ko 양쪽에서 삭제**

- [x] **Step 3: 최종 전체 검증**

Run: `npm run verify:i18n && npm run typecheck && npm run verify:presentation && npm run verify:architecture`
Expected: 모두 통과

- [x] **Step 4: 육안 확인 (환경이 허용하면)**

```bash
npm run mobile:export-web && npm run mobile:preview-web
```
Browser로 `http://127.0.0.1:8082` 접속, viewport `390x844`:
1. 케어 탭 최상단이 "오늘 투약 확인"인지
2. "+ 약 추가" → 오늘만/며칠간/매일 3분기 전환
3. "며칠간" 저장 → 아젠다에 즉시 행 생성 + "약 일정" 카드에 `~M/D까지` 뱃지
4. "매일" → 프로필 케어 기본값 화면으로 이동
5. 먹였어요/못 먹였어요 버튼 가로 배치, 행 "수정" → 행 바로 아래 편집 폼
6. 스케줄 4개 이상일 때 "외 N개 더 보기"

브라우저 접근이 차단되면 이 스텝은 건너뛰고 커밋 메시지에 "visual check pending" 명시.

- [x] **Step 5: Commit**

```bash
git add apps/mobile/src/i18n/translations.ts
git commit -m "chore(i18n): drop keys orphaned by care setup panel removal"
```
