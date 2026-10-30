export type MainTab = "house" | "care" | "memories" | "more";
export type PetSection = "care" | "memories" | "profile";
/** Optional schedule/date identifiers are navigation targets, never completion commands. */
export type CareDestination = { view: "default" } | { view: "diary"; entryId?: string; dateKey?: string } | { view: "medication"; scheduleId?: string; dateKey?: string } | { view: "reports" };
export type PetDetailRoute = { kind: "pet"; petId: string; section: PetSection; destination: CareDestination };
export type AppRoute = { kind: "main"; tab: MainTab } | PetDetailRoute | { kind: "record-target" } | { kind: "pet-create" } | { kind: "appearance"; petId: string; onboarding: boolean; returnTo: "house" | "profile" };
export type AppRouteAction =
  | { type: "appearance"; petId: string; onboarding?: boolean; returnTo?: "house" | "profile" }
  | { type: "tab"; tab: MainTab }
  | { type: "openPet"; petId: string; section?: PetSection; destination?: CareDestination }
  | { type: "section"; section: PetSection }
  | { type: "careView"; destination: CareDestination }
  | { type: "recordTarget" | "petCreate" | "back" | "reconcile" };
export const houseRoute: AppRoute = { kind: "main", tab: "house" };

/** Unknown or revoked IDs return to the accessible list, never another pet's editor. */
export function resolveAccessibleRoute(route: AppRoute, accessibleIds: readonly string[], editableIds: readonly string[] = accessibleIds): AppRoute {
  if (route.kind === "appearance" && !editableIds.includes(route.petId)) return houseRoute;
  return (route.kind === "pet" || route.kind === "appearance") && !accessibleIds.includes(route.petId) ? houseRoute : route;
}

export function getBackNavigation(route: AppRoute): { handled: boolean; nextRoute: AppRoute } {
  if (route.kind === "appearance" && route.returnTo === "profile") return { handled: true, nextRoute: { kind: "pet", petId: route.petId, section: "profile", destination: { view: "default" } } };
  if (route.kind === "main" && route.tab === "house") return { handled: false, nextRoute: route };
  if (route.kind === "pet" && route.section === "care" && route.destination.view !== "default") {
    return { handled: true, nextRoute: { ...route, destination: { view: "default" } } };
  }
  return { handled: true, nextRoute: houseRoute };
}

export function reduceAppRoute(route: AppRoute, action: AppRouteAction, accessibleIds: readonly string[]): AppRoute {
  const current = resolveAccessibleRoute(route, accessibleIds);
  switch (action.type) {
    case "appearance": return resolveAccessibleRoute({ kind: "appearance", petId: action.petId, onboarding: action.onboarding ?? false, returnTo: action.returnTo ?? "house" }, accessibleIds);
    case "tab": return { kind: "main", tab: action.tab };
    case "openPet": return resolveAccessibleRoute({ kind: "pet", petId: action.petId, section: action.section ?? "care", destination: action.destination ?? { view: "default" } }, accessibleIds);
    case "section": return current.kind === "pet" ? { ...current, section: action.section, destination: { view: "default" } } : current;
    case "careView": return current.kind === "pet" ? { ...current, section: "care", destination: action.destination } : current;
    case "recordTarget": return { kind: "record-target" };
    case "petCreate": return { kind: "pet-create" };
    case "back": return getBackNavigation(current).nextRoute;
    case "reconcile": return current;
  }
}
