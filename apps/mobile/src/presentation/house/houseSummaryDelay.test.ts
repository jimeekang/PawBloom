declare const require: (name: string) => any;
const modules = require("node:module"), original = modules._load;
// Geometry imports the rendered character only for its tag/canvas sizes; timing needs none of the SVG stack.
modules._load = function(name: string, parent: unknown, main: boolean) {
  if (name.endsWith("/HouseCharacter")) return { houseNameTagHeight: 24, houseNameTagOffset: 4 };
  if (name.endsWith("/DefaultPetCharacter")) return { defaultCharacterCanvas: (size: number) => ({ width: size, height: size }), characterGroundOffset: (size: number) => size * 45 / 48 };
  return original.call(this, name, parent, main);
};
try {
  const { summaryOpenDelay } = require("./houseSceneGeometry"), { characterReactionDuration } = require("../../contexts/avatar/ui/characterMotionController");

  const wave = characterReactionDuration("cat", "wave");
  assert(Math.abs(wave - 4 * 1000 / 6) < 1e-9, `wave clip is 4 frames at 6fps (${wave}ms)`);
  // Cats have a four-frame wave: the sheet waits past its last frame's start but leaves render headroom under 650ms.
  const cat = summaryOpenDelay("cat", "scene", false);
  assert(cat > wave * 3 / 4 && cat <= 600, `cat scene tap opens after the wave's last frame starts, with render headroom under 650ms (${cat}ms)`);
  // Dog and other sprites have no wave clip yet (a single held frame), so nothing is worth waiting for past 320ms.
  for (const species of ["dog", "other"] as const) {
    assert(characterReactionDuration(species, "wave") < 320 && summaryOpenDelay(species, "scene", false) === 320, `${species} tap keeps 320ms while its wave is a single held frame`);
  }
  for (const species of ["cat", "dog", "other"] as const) {
    assert(summaryOpenDelay(species, "scene", true) === 120 && summaryOpenDelay(species, "list", true) === 120, `${species} reduced motion opens at 120ms`);
    assert(summaryOpenDelay(species, "list", false) === 320, `${species} list tap keeps the short 320ms acknowledgement`);
  }
  console.log(`Summary delay: scene ${summaryOpenDelay("cat", "scene", false)}ms (wave ${Math.round(wave)}ms), list 320ms, reduced 120ms.`);
} finally { modules._load = original; }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
