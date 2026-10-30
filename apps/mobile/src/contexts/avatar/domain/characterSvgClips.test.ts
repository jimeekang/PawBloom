import { defaultAppearance } from "./appearance";
import { characterLayers } from "./catCharacterGeometry";
import { characterGeometry } from "./dogCharacterGeometry";
import { characterSvgClips } from "./characterSvgClips";

const geometry = characterGeometry("cat", { ...defaultAppearance(), coatPattern: "calico", earShape: "folded" });
const ids = new Set<string>();
for (const instance of ["pet:1", "pet-1", "pet_1", "아이/🐈", '["pet","r:1"]', '["pet","r:2"]']) {
  for (const layer of characterLayers) {
    const result = characterSvgClips(geometry[layer], instance, layer);
    assert(JSON.stringify(result) === JSON.stringify(characterSvgClips(geometry[layer], instance, layer)), "stable IDs across re-renders");
    assert(result.definitions.length === new Set(geometry[layer].map((part) => part.clip).filter(Boolean)).size, "one definition per silhouette in this layer");
    for (const clip of result.definitions) {
      assert(!ids.has(clip.id), "instance/layer/punctuation never collide"); ids.add(clip.id);
      assert(/^[A-Za-z][A-Za-z0-9-]*$/.test(clip.id), "SVG IDs contain no raw pet-ID punctuation");
    }
    for (const part of result.paths) {
      if (part.clip) assert(result.definitions.find((clip) => clip.id === part.clipId)?.d === part.clip, "every reference resolves to the exact geometry in this layer");
      else assert(!part.clipId, "unclipped outlines and whiskers stay unclipped");
    }
  }
}
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
