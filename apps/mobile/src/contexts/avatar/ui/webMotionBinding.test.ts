import { bindWebMotion, resolveMotionStyle } from "./webMotionBinding";

let value = 0;
const listeners = new Map<string, () => void>();
const driver = { __getValue: () => value, addListener: (callback: () => void) => { listeners.set("one", callback); return "one"; }, removeListener: (id: string) => { listeners.delete(id); } };
const node = { style: { opacity: "", transform: "" } };
const dispose = bindWebMotion(node, { opacity: driver, transform: [{ translateX: driver }, { rotate: "6deg" }, { scale: 1.02 }] });
assert(listeners.size === 1, "shared drivers subscribed once");
for (let frame = 0; frame < 600; frame++) { value = frame / 600; listeners.forEach((callback) => callback()); }
assert(node.style.transform.startsWith(`translateX(${value}px) rotate(6deg)`), "frames reach DOM without a React setter");
assert(node.style.opacity === String(value), "opacity updates");
assert(resolveMotionStyle({ transform: [{ scaleY: driver }] }).transform[0].scaleY === value, "nested values resolve");
dispose(); assert(listeners.size === 0, "unmount removes all listeners");
function assert(value: unknown, message: string): void { if (!value) throw new Error(message); }

declare const require: (name: string) => any;
// Actual installed RN Web nodes: interpolations/multiplications have no attached children.
const RealValue = require("react-native-web/dist/cjs/vendor/react-native/Animated/nodes/AnimatedValue");
const RealMultiply = require("react-native-web/dist/cjs/vendor/react-native/Animated/nodes/AnimatedMultiplication");
const breathe = new RealValue(0), sit = new RealValue(0);
const scale = new RealMultiply(breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] }), sit.interpolate({ inputRange: [0, 1], outputRange: [1, 0.92] }));
const rotation = breathe.interpolate({ inputRange: [0, 1], outputRange: ["-6deg", "6deg"] });
const cleanup = bindWebMotion(node, { transform: [{ scaleY: scale }, { rotate: rotation }] }, [breathe, sit]);
breathe.setValue(1);
assert(node.style.transform === "scaleY(1.02) rotate(6deg)", "real derived nodes update from source subscription");
sit.setValue(1);
assert(node.style.transform.startsWith(`scaleY(${1.02 * 0.92})`), "second source reaches multiplication");
cleanup(); const finalTransform = node.style.transform;
breathe.setValue(0); assert(node.style.transform === finalTransform, "real source listeners are removed");

const wander = new RealValue(0), character = { style: { opacity: "", transform: "" } }, label = { style: { opacity: "", transform: "" } };
const removeCharacter = bindWebMotion(character, { transform: [{ translateX: wander }] }, [wander]);
const removeLabel = bindWebMotion(label, { transform: [{ translateX: wander }] }, [wander]);
for (let frame = 0; frame < 600; frame++) {
  wander.setValue(Math.sin(frame / 60) * 16);
  assert(character.style.transform === label.style.transform, "one real RN Web driver moves both siblings equally without React renders");
}
wander.setValue(0);
assert(character.style.transform === "translateX(0px)" && label.style.transform === "translateX(0px)", "a gate reset reaches both bindings");
removeLabel(); wander.setValue(8);
assert(label.style.transform === "translateX(0px)" && character.style.transform === "translateX(8px)", "label cleanup removes only its own listener");
removeCharacter(); wander.setValue(16);
assert(character.style.transform === "translateX(8px)", "both unmounted siblings release their listeners");
