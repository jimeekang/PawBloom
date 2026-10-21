import { useEffect, useRef } from "react";
/** Render-specific UI scope. Returning A→B→A never revives a callback from the first A. */
export function useShellMutationScope(key: string) {
  const scope = useRef({ key, revision: 0, mounted: true });
  if (scope.current.key !== key) scope.current = { key, revision: scope.current.revision + 1, mounted: true };
  const captured = scope.current;
  useEffect(() => { captured.mounted = true; return () => { captured.mounted = false; }; }, [key]);
  const isCurrent = () => captured.mounted && scope.current === captured;
  return { isCurrent, guard: <T extends (...args: any[]) => any>(callback: T): T => ((...args: Parameters<T>) => { if (isCurrent()) return callback(...args); }) as T };
}
