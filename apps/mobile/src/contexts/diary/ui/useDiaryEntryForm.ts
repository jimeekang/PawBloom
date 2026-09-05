import { useRef, useState } from "react";
import type { DiaryCategory, DiaryDetailInput, DiaryEntry, DiaryPhotoInput } from "../domain/diaryEntry";
import type { PetRoutine } from "../../routine/domain/petRoutine";
import { createDefaultDiaryDetail } from "./DiaryDetailPanel";
import { buildRoutineDiaryDetail } from "./diaryFormDefaults";
import { findEditableDailyStructuredEntry, formatDiaryTime, getEditableDiaryMemo, isStructuredDailyDiaryCategory, normalizeDiaryTimeInput } from "./DiaryEntryScreen.logic";

type Fields = {
  selected: DiaryCategory;
  detail: DiaryDetailInput;
  conditionScore: 1 | 2 | 3 | 4 | 5;
  memo: string;
  photos: DiaryPhotoInput[];
  occurredTime: string;
  timeDirty: boolean;
};
type State = Fields & { scope: string; editingEntry: DiaryEntry | null; baseline: string; saved: boolean; isDetailPanelOpen: boolean; source: string };
type Params = { petId: string; selectedDateKey: string; entries: DiaryEntry[]; routine?: PetRoutine };

export function useDiaryEntryForm({ petId, selectedDateKey, entries, routine }: Params) {
  const scope = `${petId}:${selectedDateKey}`;
  const currentScope = useRef({ identity: "", version: 0 });
  // Retain successful payloads until the parent list catches up, including queued creates.
  const savedDrafts = useRef(new Map<string, { state: State; source: string }>());
  function entryFor(category: DiaryCategory) {
    return findEditableDailyStructuredEntry(entries.filter((entry) => entry.petId === petId), category, selectedDateKey);
  }
  function sourceFor(entry?: DiaryEntry | null) { return JSON.stringify([entry, entry?.detail ? null : routine]); }
  function initial(category: DiaryCategory, editingEntry: DiaryEntry | null = null): State {
    const entry = editingEntry ?? entryFor(category);
    const source = sourceFor(entry);
    const cached = savedDrafts.current.get(`${scope}:${category}`);
    if (!editingEntry && cached && cached.source === source) return { ...cached.state, isDetailPanelOpen: true };
    const fields: Fields = {
      selected: category, detail: entry?.detail ?? createDetailForCategory(category, routine),
      conditionScore: entry?.conditionScore ?? 3, memo: entry ? getEditableDiaryMemo(entry) : "", photos: [],
      occurredTime: normalizeDiaryTimeInput(entry?.occurredAt ?? "") ?? formatDiaryTime(), timeDirty: false,
    };
    return { ...fields, scope, editingEntry, source, baseline: fingerprint(fields), saved: entry?.origin === "diary", isDetailPanelOpen: true };
  }
  const [state, setState] = useState<State>(() => initial("food"));
  const identity = `${scope}:${state.selected}:${state.editingEntry?.id ?? "new"}`;
  if (currentScope.current.identity !== identity) currentScope.current = { identity, version: currentScope.current.version + 1 };
  const version = currentScope.current.version;
  const incoming = sourceFor(state.editingEntry ?? entryFor(state.selected));
  // Reset before committing a render for a different pet/date. Late responses use currentScope below.
  if (state.scope !== scope) setState(initial(state.selected));
  else if (!state.editingEntry && fingerprint(state) === state.baseline && state.source !== incoming) {
    setState({ ...initial(state.selected), isDetailPanelOpen: state.isDetailPanelOpen });
  }
  function change<K extends keyof Fields>(key: K, value: Fields[K]) {
    setState((current) => ({ ...current, [key]: value }));
  }
  function selectCategory(category: DiaryCategory) {
    if (state.editingEntry) return;
    if (category === state.selected) setState((current) => ({ ...current, isDetailPanelOpen: true }));
    else setState(initial(category));
  }
  function loadEditingEntry(entry: DiaryEntry) { setState(initial(entry.category, entry)); }
  function cancelEdit() { setState({ ...initial(state.selected), isDetailPanelOpen: false }); }
  function markSaved(occurredTime: string) {
    if (currentScope.current.version !== version) return;
    if (!isStructuredDailyDiaryCategory(state.selected)) {
      setState({ ...initial(state.selected), editingEntry: null, memo: "", photos: [], isDetailPanelOpen: false });
      return;
    }
    const next = { ...state, editingEntry: null, occurredTime, timeDirty: false, saved: true, isDetailPanelOpen: false };
    next.baseline = fingerprint(next);
    // A week-list edit can belong to a different day than the calendar selection.
    if (state.editingEntry && state.editingEntry.entryDate !== selectedDateKey) {
      setState({ ...initial(state.selected), isDetailPanelOpen: false });
      return;
    }
    savedDrafts.current.set(`${scope}:${state.selected}`, { state: next, source: sourceFor(entryFor(state.selected)) });
    setState((current) => fingerprint(current) === fingerprint(state) ? next : {
      ...current, editingEntry: null, baseline: next.baseline, saved: true,
    });
  }
  const structured = isStructuredDailyDiaryCategory(state.selected);
  return {
    ...state, selectCategory, loadEditingEntry, cancelEdit, markSaved,
    isCurrentScope: () => currentScope.current.version === version,
    saveBlockedByState: structured && (!state.isDetailPanelOpen || (state.saved && fingerprint(state) === state.baseline)),
    preservesTime: Boolean(state.editingEntry || (structured && state.saved) || state.timeDirty),
    setSelected: selectCategory,
    setDetail: (value: DiaryDetailInput) => change("detail", value),
    setConditionScore: (value: Fields["conditionScore"]) => change("conditionScore", value),
    setMemo: (value: string) => change("memo", value),
    setPhotos: (value: DiaryPhotoInput[]) => change("photos", value),
    setOccurredTime: (value: string) => setState((current) => ({ ...current, occurredTime: value, timeDirty: true })),
  };
}

function fingerprint(fields: Fields) {
  return JSON.stringify([fields.selected, fields.detail, fields.selected === "condition" ? fields.conditionScore : null, fields.occurredTime]);
}

export function createDetailForCategory(category: DiaryCategory, routine?: PetRoutine): DiaryDetailInput {
  if (routine && category !== "memo" && category !== "photo") return buildRoutineDiaryDetail(category, routine);
  return createDefaultDiaryDetail(category);
}
