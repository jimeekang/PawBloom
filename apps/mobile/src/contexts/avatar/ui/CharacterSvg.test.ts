import { createHookHarness, findElements } from '../../../presentation/testHookHarness';
import { defaultAppearance } from '../domain/appearance';
import { getPixelFrame, getPixelClip } from '../domain/pixelFrames';
import { characterPixelPaths } from './pixelPaths';
import { characterHeadCrop } from './characterHeadCrop';
declare const require: (name: string) => any;
const modules = require('node:module'), original = modules._load, react = require('react'), rn = require('react-native');
const harness = createHookHarness();
class Value { interpolate(range: unknown) { return range; } }
const values = Object.fromEntries(['frame','wander','direction','lift','opacity'].map(key => [key,new Value()]));
let motionOptions: any;
modules._load = function(name: string, parent: unknown, main: boolean) {
  if (name === 'react') return { ...react, ...Object.fromEntries(Object.keys(harness.hooks).map(key => [key, (...args: any[]) => (harness.hooks as any)[key](...args)])) };
  if (name === 'react-native') return { ...rn, Animated: { multiply: (...args: unknown[]) => args, add: (...args: unknown[]) => args } };
  if (name === 'react-native-svg') return { __esModule: true, default: 'Svg', Path: 'Path' };
  if (name.endsWith('/useCharacterMotion')) return { useCharacterMotion: (options: any, config: any) => { motionOptions = options; const frames=getPixelClip(config.species,config.pose??'sit');return {values,pose:config.pose??'sit',frames,opacities:frames.map((_,i)=>i===0?1:0)}; } };
  if (name.endsWith('/CharacterMotionView')) return { CharacterMotionView: 'Motion' };
  return original.call(this,name,parent,main);
};
try {
  const { CharacterSvg, defaultCharacterCanvas } = require('./CharacterSvg');
  const appearance = { ...defaultAppearance(), coatColor: 'white', coatPattern: 'calico', earShape: 'folded' } as const;
  let props: any = { species: 'cat', appearance, size: 96, withBody: true, pose: 'walkRight', motion: { id: 'same/pet', enabled: true, paused: false, reduced: false } };
  const render = () => harness.render(() => CharacterSvg(props));
  const body = render(), svg = findElements(body, node => node.type === 'Svg')[0]!;
  assert(findElements(body, node => node.type === 'Svg').length === 4, 'only the current four-frame clip is mounted');
  assert(svg.props.viewBox === '0 0 48 48' && svg.props.shapeRendering === 'crispEdges', 'square logical pixels preserve canvas and baseline');
  const paths = findElements(body, node => node.type === 'Path');
  assert(findElements(body,node=>node.type==='Svg').every(svg=>findElements(svg,node=>node.type==='Path').length<=14) && paths.every(p => p.props.shapeRendering === 'crispEdges' && p.props.stroke === undefined), 'actual renderer respects path budget and crisp fill-only edges');
  assert(body.props.pointerEvents === 'none' && body.props.accessibilityElementsHidden && body.props.importantForAccessibility === 'no-hide-descendants', 'decorative SVG preserves parent accessible name');
  const root = findElements(body, node => node.type === 'Motion')[0]!;
  assert(root.props.sources.length === 4 && root.props.sources.includes(values.wander) && root.props.sources.includes(values.opacity), 'outer motion/web subscriptions remain connected');
  assert(motionOptions.enabled && !motionOptions.paused && !motionOptions.reduced && motionOptions.id === 'same/pet', 'existing gates pass unchanged to hook');
  assert(JSON.stringify(defaultCharacterCanvas(96,true)) === JSON.stringify({width:96,height:96}), 'body is exactly 48 logical pixels at 2x');
  props = { ...props, withBody: false, pose: 'sleep' };
  const head = render(), headSvg = findElements(head,node => node.type === 'Svg')[0]!;
  const headRows = characterHeadCrop('cat').rows;
  assert(headSvg.props.viewBox === `0 0 48 ${headRows}` && headRows > 26, 'head viewport runs from the ears to the chin');
  assert(JSON.stringify(findElements(head,node => node.type === 'Path').map(node => node.props.d)) === JSON.stringify(characterPixelPaths(getPixelFrame('cat','sit'),appearance,'cat',false).map(p => p.d)), 'head always crops sit, even when a body pose was requested');
  assert(JSON.stringify(defaultCharacterCanvas(72,true))===JSON.stringify({width:72,height:72})&&defaultCharacterCanvas(48,false).height===headRows,'1.5x body and integer head crop use one uniform unit');
  harness.unmount();
} finally { modules._load = original; }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
