// Pet weight text-input parsing (0006 E1). Number("8.5kg") is NaN — unlike
// parseFloat — so unit suffixes are rejected with inline guidance instead of
// being silently truncated to a partial value.
export function parsePetWeightInput(value: string): { ok: boolean; value: number } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: Number.NaN };
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return { ok: false, value: Number.NaN };
  return { ok: true, value: parsed };
}
