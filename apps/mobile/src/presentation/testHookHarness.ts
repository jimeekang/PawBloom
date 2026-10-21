/** Minimal synchronous hook host for invoking real screen callbacks without a native renderer. */
export function createHookHarness() {
  const values: any[] = [], dependencies: Array<readonly unknown[] | undefined> = [];
  const cleanups: Array<void | (() => void)> = [];
  let cursor = 0, dirty = false, effects: Array<() => void> = [];
  const changed = (index: number, deps?: readonly unknown[]) => !deps || !dependencies[index] || deps.some((value, i) => !Object.is(value, dependencies[index]?.[i]));
  const hooks = {
    useState(initial: any) {
      const index = cursor++;
      if (!(index in values)) values[index] = typeof initial === "function" ? initial() : initial;
      return [values[index], (next: any) => { const value = typeof next === "function" ? next(values[index]) : next; if (!Object.is(value, values[index])) { values[index] = value; dirty = true; } }];
    },
    useEffect(effect: () => void | (() => void), deps?: readonly unknown[]) {
      const index = cursor++;
      if (changed(index, deps)) { dependencies[index] = deps; effects.push(() => { cleanups[index]?.(); cleanups[index] = effect(); }); }
    },
    useMemo(factory: () => any, deps?: readonly unknown[]) {
      const index = cursor++;
      if (changed(index, deps)) { dependencies[index] = deps; values[index] = factory(); }
      return values[index];
    },
    useCallback(callback: (...args: any[]) => any, deps?: readonly unknown[]) { return hooks.useMemo(() => callback, deps); },
    useRef(initial: any) { return hooks.useMemo(() => ({ current: initial }), []); },
  };
  return {
    hooks,
    unmount() { for (const cleanup of cleanups) cleanup?.(); },
    render(component: () => any) {
      let tree: any;
      for (let pass = 0; pass < 20; pass++) {
        cursor = 0; dirty = false; effects = []; tree = component();
        for (const effect of effects) effect();
        if (!dirty) return tree;
      }
      throw new Error("Hook harness did not settle");
    },
  };
}
export function findElements(tree: any, predicate: (element: any) => boolean): any[] {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap((item) => findElements(item, predicate));
  return [...(predicate(tree) ? [tree] : []), ...findElements(tree.props?.children, predicate)];
}
