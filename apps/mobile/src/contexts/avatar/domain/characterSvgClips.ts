import type { CharacterLayer, CharacterPath } from "./catCharacterGeometry";

/** Injective encoding: punctuation in a pet ID/useId cannot collide after SVG sanitization. */
const encodeId = (value: string) => Array.from(value, (char) => char.codePointAt(0)!.toString(16)).join("-");

/** RN and sheet renderers use the same layer-local definitions and references. */
export function characterSvgClips(parts: readonly CharacterPath[], instanceId: string, layer: CharacterLayer) {
  const definitions: { id: string; d: string }[] = [];
  const byPath = new Map<string, string>();
  const paths = parts.map((part) => {
    if (!part.clip) return { ...part, clipId: undefined };
    let clipId = byPath.get(part.clip);
    if (!clipId) {
      clipId = `character-${encodeId(instanceId)}-${layer}-${definitions.length}`;
      byPath.set(part.clip, clipId);
      definitions.push({ id: clipId, d: part.clip });
    }
    return { ...part, clipId };
  });
  return { definitions, paths };
}
