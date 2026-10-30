import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const root = process.cwd(), require = createRequire(import.meta.url);
const ts = require(join(root, "apps/mobile/node_modules/typescript"));
const Module = require("node:module"), originalLoad = Module._load;
Module._load = function (name, parent, main) {
  if (name === "react-native") return { Platform: { select: (values) => values.default } };
  return originalLoad.call(this, name, parent, main);
};
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
const { presetAppearances, randomAppearance } = require(join(root, "apps/mobile/src/contexts/avatar/domain/appearance.ts"));
const { characterGeometry } = require(join(root, "apps/mobile/src/contexts/avatar/domain/dogCharacterGeometry.ts"));
const { characterEyeY, characterLayers } = require(join(root, "apps/mobile/src/contexts/avatar/domain/catCharacterGeometry.ts"));
const { characterSvgClips } = require(join(root, "apps/mobile/src/contexts/avatar/domain/characterSvgClips.ts"));
const { characterPalette } = require(join(root, "apps/mobile/src/contexts/avatar/ui/characterPalette.ts"));
const { colors, sceneColors } = require(join(root, "apps/mobile/src/design-system/tokens.ts"));
const arg = (name, fallback) => { const at = process.argv.indexOf(name); return at < 0 ? fallback : process.argv[at + 1]; };
const output = resolve(arg("--output-dir", "/private/tmp/pawbloom-character-images"));
const sources = resolve(arg("--source-dir", join(output, "sources")));
const chrome = arg("--chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
mkdirSync(output, { recursive: true }); mkdirSync(sources, { recursive: true });

function svg(species, appearance, pose = "idle", instanceId) {
  const g = characterGeometry(species, appearance, pose === "saveReact"), palette = characterPalette(appearance);
  const layers = characterLayers.map((layer) => {
    const eyeY = characterEyeY(species !== "cat");
    const transform = layer === "eyes" && pose === "blink" ? `translate(0 ${eyeY}) scale(1 .1) translate(0 -${eyeY})` : layer === "body" && pose === "sit" ? "translate(0 6.4) translate(60 80) scale(1 .92) translate(-60 -80)" : layer === "frontPaws" && pose === "sit" ? "translate(60 0) scale(.9 1) translate(-60 0)" : "";
    const clipped = characterSvgClips(g[layer], instanceId, layer);
    const definitions = clipped.definitions.map((clip) => `<clipPath id="${clip.id}" clipPathUnits="userSpaceOnUse"><path d="${clip.d}"/></clipPath>`).join("");
    const paths = clipped.paths.map((part) => `<path d="${part.d}" fill="${palette[part.fill] ?? "none"}"${part.feature ? ` data-feature="${part.feature}"` : ""}${part.clipId ? ` clip-path="url(#${part.clipId})"` : ""}${part.opacity === undefined ? "" : ` opacity="${part.opacity}"`}${part.stroke ? ` stroke="${palette[part.stroke]}" stroke-width="${part.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"` : ""}${part.nonScalingStroke ? ' vector-effect="non-scaling-stroke"' : ""}/>`).join("");
    return `<g data-layer="${layer}" transform="${transform}"><defs>${definitions}</defs>${paths}</g>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -12 136 182" width="200" height="240"><ellipse cx="60" cy="157" rx="46" ry="8" fill="${sceneColors.groundShadow}"${pose === "lift" ? ' opacity=".6" transform="translate(60 157) scale(.8) translate(-60 -157)"' : ""}/><g transform="${pose === "lift" ? "translate(60 80) translate(0 -10) scale(1.08) translate(-60 -80)" : ""}">${layers}</g></svg>`;
}
const sheets = [
  { name: "sheet-cats", width: 960, height: 780, columns: 4, pets: [...presetAppearances("cat"), ...Array.from({ length: 6 }, (_, i) => randomAppearance("cat", i + 240))].map((a) => ({ species: "cat", a })) },
  { name: "sheet-dogs", width: 720, height: 520, columns: 3, pets: presetAppearances("dog").map((a) => ({ species: "dog", a })) },
  { name: "sheet-poses", width: 1200, height: 290, columns: 5, pets: ["idle", "blink", "sit", "lift", "saveReact"].map((pose) => ({ species: "cat", a: presetAppearances("cat")[0], pose })) },
];
for (const sheet of sheets) {
  const html = `<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:${colors.appBackground};display:grid;grid-template-columns:repeat(${sheet.columns},240px);font:14px system-ui;color:${colors.text}}figure{margin:0;height:260px;display:flex;flex-direction:column;align-items:center;justify-content:center}figcaption{height:24px}</style>${sheet.pets.map(({ species, a, pose }, index) => `<figure>${svg(species, a, pose, `${sheet.name}-${index}`)}${pose ? `<figcaption>${pose}</figcaption>` : ""}</figure>`).join("")}`;
  writeFileSync(join(sources, `${sheet.name}.html`), html);
}
if (!process.argv.includes("--html-only")) {
  for (const sheet of sheets) {
    const file = join(output, `${sheet.name}.png`);
    const result = spawnSync(chrome, ["--headless", "--disable-gpu", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${join(sources, "chrome-profile")}`, "--hide-scrollbars", `--window-size=${sheet.width},${sheet.height}`, "--force-device-scale-factor=2", `--screenshot=${file}`, pathToFileURL(join(sources, `${sheet.name}.html`)).href], { encoding: "utf8", timeout: 30000 });
    if (result.status !== 0) { console.error(`Chrome capture failed: status=${result.status}, signal=${result.signal}\n${result.stderr ?? ""}`); process.exit(1); }
    console.log(file);
  }
} else console.log(`Static sheet sources ready: ${sources}`);
