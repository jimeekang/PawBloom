import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const root = process.cwd(), require = createRequire(import.meta.url);
const ts = require(join(root, 'apps/mobile/node_modules/typescript'));
const { PNG } = require(join(root, 'apps/mobile/node_modules/pngjs'));
const Module = require('node:module'), originalLoad = Module._load;
Module._load = function (name, parent, main) {
  if (name === 'react-native') return { Platform: { select: values => values.default } };
  return originalLoad.call(this, name, parent, main);
};
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
const domain = 'apps/mobile/src/contexts/avatar/domain', ui = 'apps/mobile/src/contexts/avatar/ui';
const { presetAppearances, randomAppearance } = require(join(root, domain, 'appearance.ts'));
const { getPixelClip, getPixelFrame, pixelPoses } = require(join(root, domain, 'pixelFrames.ts'));
const { composePixelFrame } = require(join(root, domain, 'pixelMasks.ts'));
const { characterPixelPaths } = require(join(root, ui, 'pixelPaths.ts'));
const { characterPalette } = require(join(root, ui, 'characterPalette.ts'));
const { colors } = require(join(root, 'apps/mobile/src/design-system/tokens.ts'));
const arg = (name, fallback) => { const at = process.argv.indexOf(name); return at < 0 ? fallback : process.argv[at + 1]; };
const output = resolve(arg('--output-dir', '/private/tmp/pawbloom-character-images'));
const sources = resolve(arg('--source-dir', join(output, 'sources')));
const chrome = arg('--chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
mkdirSync(output, { recursive: true }); mkdirSync(sources, { recursive: true });
function svg({ species, appearance, frame }) {
  const paths = characterPixelPaths(frame, appearance, species);
  if (paths.length > 14) throw new Error(`${species}/${frame.pose}:${frame.index}: ${paths.length} paths exceeds budget`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="192" height="192" shape-rendering="crispEdges">${paths.map(part => `<path d="${part.d}" fill="${part.fill}"/>`).join('')}</svg>`;
}
const cat = presetAppearances('cat')[0], dog = presetAppearances('dog')[1];
const sheets = [
  { name: 'sheet-cats', columns: 4, pets: [...presetAppearances('cat'), ...Array.from({ length: 6 }, (_, i) => randomAppearance('cat', i + 240))].map(appearance => ({ species: 'cat', appearance, frame: getPixelFrame('cat') })) },
  { name: 'sheet-dogs', columns: 4, pets: ['sit', 'blink', 'walkSide', 'sleep'].flatMap(pose => getPixelClip('dog', pose).map(frame => ({ species: 'dog', appearance: dog, frame, label: `${pose} ${frame.index + 1}` }))) },
  { name: 'sheet-clips', columns: 4, pets: pixelPoses.flatMap(pose => getPixelClip('cat', pose).map(frame => ({ species: 'cat', appearance: cat, frame, label: `${pose} ${frame.index + 1}` }))) },
];
for (const sheet of sheets) {
  sheet.width = sheet.columns * 240; sheet.height = Math.ceil(sheet.pets.length / sheet.columns) * 240;
  const html = `<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:${colors.appBackground};display:grid;grid-template-columns:repeat(${sheet.columns},240px);font:14px system-ui;color:${colors.text}}figure{margin:0;height:240px;display:flex;flex-direction:column;align-items:center;justify-content:center}figcaption{height:24px}svg{image-rendering:pixelated}</style>${sheet.pets.map((pet, index) => {
    const source = svg(pet); writeFileSync(join(sources, `${sheet.name}-${index}.svg`), source);
    return `<figure>${source}${pet.label ? `<figcaption>${pet.label}</figcaption>` : ''}</figure>`;
  }).join('')}`;
  writeFileSync(join(sources, `${sheet.name}.html`), html);
  // Direct logical-grid inspection is independent of Chrome; PNG sheet captures still use SVG below.
  const cell = 200, png = new PNG({ width: sheet.columns * cell, height: Math.ceil(sheet.pets.length / sheet.columns) * cell });
  const paper = [1,3,5].map(start => parseInt(colors.appBackground.slice(start,start+2),16));
  for (let at=0;at<png.data.length;at+=4) { for (let c=0;c<3;c++) png.data[at+c]=paper[c]; png.data[at+3]=255; }
  sheet.pets.forEach(({ species, appearance, frame }, index) => {
    const palette = characterPalette(appearance), grid = composePixelFrame(frame, appearance, species);
    grid.forEach((row, y) => row.forEach((paint, x) => {
      if (paint === '.') return;
      const color = palette[paint], rgb = [1, 3, 5].map(start => parseInt(color.slice(start, start + 2), 16));
      for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) {
        const at = ((Math.floor(index / sheet.columns) * cell + y * 4 + dy) * png.width + index % sheet.columns * cell + x * 4 + dx) * 4;
        for (let channel = 0; channel < 3; channel++) png.data[at + channel] = rgb[channel]; png.data[at + 3] = 255;
      }
    }));
  });
  writeFileSync(join(sources, `inspection-${sheet.name}.png`), PNG.sync.write(png));
}
if (!process.argv.includes('--html-only')) {
  for (const sheet of sheets) {
    const file = join(output, `${sheet.name}.png`);
    const result = spawnSync(chrome, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${join(sources, 'chrome-profile')}`, '--hide-scrollbars', `--window-size=${sheet.width},${sheet.height}`, '--force-device-scale-factor=2', `--screenshot=${file}`, pathToFileURL(join(sources, `${sheet.name}.html`)).href], { encoding: 'utf8', timeout: 30000 });
    if (result.status !== 0) { console.error(`Chrome capture failed: status=${result.status}, signal=${result.signal}\n${result.stderr ?? ''}`); process.exit(1); }
    console.log(file);
  }
} else console.log(`Static SVG, HTML and logical-grid inspection sources ready: ${sources}`);
