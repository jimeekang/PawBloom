// Deterministic handler/rerender tests, not a replacement for native layout testing.
const assert = require("node:assert/strict");
const path = require("node:path");
const Module = require("node:module");
let active;
const equalDeps = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
const react = {
  useState(initial) {
    const owner = active, i = owner.cursor++;
    if (!(i in owner.slots)) owner.slots[i] = typeof initial === "function" ? initial() : initial;
    return [owner.slots[i], next => {
      const value = typeof next === "function" ? next(owner.slots[i]) : next;
      if (!Object.is(value, owner.slots[i])) { owner.slots[i] = value; owner.dirty = true; }
    }];
  },
  useRef(value) {
    const i = active.cursor++;
    if (!(i in active.slots)) active.slots[i] = { current: value };
    return active.slots[i];
  },
  useMemo(fn, deps) {
    const i = active.cursor++, old = active.slots[i];
    if (!old || !equalDeps(deps, old.deps)) active.slots[i] = { value: fn(), deps };
    return active.slots[i].value;
  },
  useCallback(fn, deps) { return react.useMemo(() => fn, deps); },
  useEffect(fn, deps) {
    const owner = active, i = owner.cursor++, old = owner.slots[i];
    if (!old || !equalDeps(deps, old.deps)) owner.effects.push(() => {
      old?.cleanup?.(); owner.slots[i] = { deps, cleanup: fn() };
    });
  },
};
const components = new Proxy({}, { get: (_, key) => String(key) });
const jsx = (type, props) => ({ type, props });
function load(file, mocks = {}) {
  const original = Module._load;
  const defaults = {
    react, "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "react-native": { ...Object.fromEntries(["View", "Text", "TextInput", "Pressable"].map(v => [v, v])), StyleSheet: { create: x => x }, Platform: { OS: "ios", select: x => x.ios ?? x.default } },
    components, iconography: components,
  };
  const replacements = { ...defaults, ...mocks };
  Module._load = function(request, parent, isMain) {
    const key = Object.hasOwn(replacements, request) ? request : path.basename(request);
    if (Object.hasOwn(replacements, key)) return replacements[key];
    return original.call(this, request, parent, isMain);
  };
  try { return require(path.resolve(file)); } finally { Module._load = original; }
}
class Renderer {
  constructor(fn, props) { this.fn = fn; this.props = props; this.slots = []; }
  render() {
    let runs = 0;
    do {
      assert.ok(++runs < 30, "render loop");
      this.dirty = false; this.cursor = 0; this.effects = []; active = this;
      this.tree = this.fn(this.props);
      // Render-phase state resets discard that render, matching React's commit boundary.
      if (!this.dirty) for (const effect of this.effects) effect();
    } while (this.dirty);
    return this.tree;
  }
  unmount() { for (const slot of this.slots) slot?.cleanup?.(); }
}
function find(tree, name) {
  if (!tree) return;
  if (Array.isArray(tree)) {
    for (const child of tree) { const result = find(child, name); if (result) return result; }
    return;
  }
  if (tree.type === name || tree.type?.name === name) return tree;
  return find(tree.props?.children, name);
}
module.exports = { load, Renderer, find, components, flush: () => new Promise(resolve => setImmediate(resolve)) };
