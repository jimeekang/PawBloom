import { createDefaultHouseLayout } from "./houseLayout";
import { createHookHarness, findElements } from "../testHookHarness";
declare const require: (name: string) => any;
const modules = require("node:module"), original = modules._load, react = require("react"), rn = require("react-native");
const harness = createHookHarness(), Character = () => null, Name = () => null;
class Value { constructor(public value: any) {} setValue(value: any) { this.value = value; } }
class ValueXY extends Value { getTranslateTransform() { return [{ translateX: this.value.x }, { translateY: this.value.y }]; } }
modules._load = function(name: string, parent: unknown, main: boolean) {
  if (name === "react") return { ...react, ...harness.hooks };
  if (name === "react-native") return { ...rn, Animated: { Value, ValueXY, View: "AnimatedView" }, PanResponder: { create: (handlers: unknown) => ({ panHandlers: handlers }) }, useWindowDimensions: () => ({ width: 390 }) };
  if (name.endsWith("/HouseCharacter")) return { HouseCharacter: Character, HouseCharacterName: Name };
  if (name.endsWith("/DefaultPetCharacter")) return { defaultCharacterCanvas: (size: number) => ({ width: size * 1.2, height: size * 1.6 }) };
  return original.call(this, name, parent, main);
};
try {
  const { HouseScene, getHouseSceneGeometry, toHouseScenePosition } = require("./HouseScene");
  for (const width of [280, 350, 430]) for (const count of [1, 2, 3, 4, 6, 17]) {
    const ids = Array.from({ length: count }, (_, i) => `pet-${i}`), layout = createDefaultHouseLayout(ids), geometry = getHouseSceneGeometry(width, count);
    const points = ids.map((id) => toHouseScenePosition(layout[id], geometry));
    for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
      // Full-size bounds include the complete body/name and ±16px wander on both sides.
      assert(Math.abs(points[i].x - points[j].x) >= 68 * 1.2 + 32 || Math.abs(points[i].y - points[j].y) >= geometry.canvasHeight + 32, `${count} pets at ${width}px: faces and names have separate default slots`);
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
  const previous = findElements(tree, (node) => node.type === Character && node.props.pet.id === "front")[0].props.wanderOffset;
  props.pets = pets.slice(0, 1); harness.render(() => HouseScene(props));
  props.pets = pets; const readded = harness.render(() => HouseScene(props));
  assert(findElements(readded, (node) => node.type === Character && node.props.pet.id === "front")[0].props.wanderOffset !== previous, "removed pets release their scene-owned wander references");
  harness.unmount();
} finally { modules._load = original; }
function flatten(style: any): any { return Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : style ?? {}; }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
