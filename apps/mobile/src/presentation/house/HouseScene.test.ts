import { createDefaultHouseLayout } from "./houseLayout";
import { createHookHarness, findElements } from "../testHookHarness";
declare const require: (name: string) => any;
const modules = require("node:module"), original = modules._load, react = require("react"), rn = require("react-native");
let screenWidth=390;
const harness = createHookHarness(), Character = () => null, Name = () => null;
class Value { constructor(public value: any) {} setValue(value: any) { this.value = value; } }
class ValueXY extends Value { getTranslateTransform() { return [{ translateX: this.value.x }, { translateY: this.value.y }]; } }
modules._load = function(name: string, parent: unknown, main: boolean) {
  if (name === "react") return { ...react, ...harness.hooks };
  if (name === "react-native") return { ...rn, Animated: { Value, ValueXY, View: "AnimatedView" }, PanResponder: { create: (handlers: unknown) => ({ panHandlers: handlers }) }, useWindowDimensions: () => ({ width: screenWidth }) };
  if (name.endsWith("/HouseCharacter")) return { HouseCharacter: Character, HouseCharacterName: Name, houseNameTagHeight: 24, houseNameTagOffset: 4 };
  if (name.endsWith("/DefaultPetCharacter")) return { defaultCharacterCanvas: (size: number) => ({ width: size, height: size }), characterGroundOffset:(size:number)=>size*45/48 };
  return original.call(this, name, parent, main);
};
try {
  const { HouseScene, getHouseSceneGeometry, toHouseScenePosition } = require("./HouseScene");
  for (const width of [280, 350, 430]) for (const count of [1, 2, 3, 4, 6, 17]) {
    const ids = Array.from({ length: count }, (_, i) => `pet-${i}`), layout = createDefaultHouseLayout(ids), geometry = getHouseSceneGeometry(width, count);
    const points = ids.map((id) => toHouseScenePosition(layout[id], geometry));
    for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
      // Full-size bounds include the complete body/name and ±16px wander on both sides.
      assert(Math.abs(points[i].x - points[j].x) >= geometry.characterSize + 32 || Math.abs(points[i].y - points[j].y) >= geometry.canvasHeight + 32, `${count} pets at ${width}px: faces and names have separate default slots`);
    }
  }
  for (const width of [320, 335, 350, 390]) for (const size of [72, 96]) for (const count of [1, 2, 4, 6]) {
    const ids = Array.from({ length: count }, (_, i) => `pet-${i}`), layout = createDefaultHouseLayout(ids), geometry = getHouseSceneGeometry(width, count, size);
    // Extremes of the safe range, not only default slots: dragging can park a pet in any corner.
    for (const point of [...ids.map((id) => layout[id]), { x: 0, y: 0 }, { x: 1, y: 1 }]) {
      const slot = toHouseScenePosition(point, geometry), center = Math.round((slot.x + 60) * 1e6) / 1e6;
      // Mirrored poses stay inside the square canvas, so ±size/2 plus the 16px wander bounds every pixel.
      assert(center - size / 2 - 16 >= 8 && center + size / 2 + 16 <= geometry.contentWidth - 8, `${count} pets ${size}px at ${width}px: sprite keeps 8px from the side walls`);
      assert(center - 60 - 16 >= 8 && center + 60 + 16 <= geometry.contentWidth - 8, `${count} pets at ${width}px: a full-width name tag stays inside the room`);
      assert(slot.y + geometry.groundOffset + 4 + 24 <= geometry.height - 8, `${count} pets at ${width}px: the bottom name tag keeps 8px from the floor edge`);
      assert(slot.y >= 8, `${count} pets at ${width}px: ears stay below the ceiling`);
    }
  }
  const pets = ["back", "front"].map((id) => ({ id, name: id, species: "cat" }));
  const props = { pets, userId: null, layout: { back: { x: 0.5, y: 0.2 }, front: { x: 0.5, y: 0.8 } }, motionEnabled: false, positionsLocked: false, selectedPetId: "back", showSelection: true, onPetTap() {}, onMovePet() {}, registerPetNode() {} };
  const tree = harness.render(() => HouseScene(props));
  const slots = findElements(tree, (node) => node.props?.accessibilityRole === "button" && pets.some((pet) => pet.name === node.props.accessibilityLabel));
  const labels = findElements(tree, (node) => pets.some((pet) => node.props?.testID === `house-name-${pet.id}`));
  assert(slots.length === 2 && labels.length === 2, "one named interaction target and one visual name per pet");
  for (const label of labels) {
    assert(label.props.pointerEvents === "none" && label.props.accessibilityElementsHidden, "overlay cannot block dragging or duplicate screen-reader names");
    assert(flatten(label.props.style).zIndex > 1000, "all name labels paint above even a lifted character");
  }
  assert(findElements(tree, (node) => node.type === Name && node.props.pet.name === "back")[0]?.props.selected, "selection indicator moves with the name layer");
  for (const pet of pets) {
    const character = findElements(tree, (node) => node.type === Character && node.props.pet.id === pet.id)[0];
    const label = findElements(tree, (node) => node.props?.testID === `house-name-wander-${pet.id}`)[0];
    assert(character.props.wanderOffset === label.props.sources[0] && label.props.style.transform[0].translateX === character.props.wanderOffset, "name overlay and pet share one wander driver with no mirrored text");
    const nextTree = harness.render(() => HouseScene(props));
    assert(findElements(nextTree, (node) => node.type === Character && node.props.pet.id === pet.id)[0].props.wanderOffset === character.props.wanderOffset, "rerenders preserve the shared driver");
  }
  assert(findElements(tree,(node)=>node.type===Character).every(node=>node.props.size===96), "390px room uses exact 2x size96");
  for(const node of [...slots,...labels]) assert(flatten(node.props.style).transform.every((part:any)=>!("scale" in part)), "depth affects zIndex only, never pixel multiplier");
  const g=getHouseSceneGeometry(358,2,96),point={x:.5,y:.5},position=toHouseScenePosition(point,g);
  assert(g.canvasHeight===96&&g.groundOffset===90&&Math.abs(position.y+90-(g.feetTop+(.5-.08)*g.spanY))<1e-9,"logical row44 bottom remains the normalized foot anchor");
  for (const narrow of [360, 375]) { screenWidth=narrow;const narrowTree=harness.render(()=>HouseScene(props));
  assert(findElements(narrowTree,(node)=>node.type===Character).every(node=>node.props.size===72),`${narrow}px phone uses exact1.5x size72`); }
  screenWidth=390;
  const previous = findElements(tree, (node) => node.type === Character && node.props.pet.id === "front")[0].props.wanderOffset;
  props.pets = pets.slice(0, 1); harness.render(() => HouseScene(props));
  props.pets = pets; const readded = harness.render(() => HouseScene(props));
  assert(findElements(readded, (node) => node.type === Character && node.props.pet.id === "front")[0].props.wanderOffset !== previous, "removed pets release their scene-owned wander references");
  harness.unmount();
} finally { modules._load = original; }
function flatten(style: any): any { return Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : style ?? {}; }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
