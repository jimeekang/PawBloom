export type SubscriptionPlan = "free" | "plus" | "family";

export type Entitlement = {
  plan: SubscriptionPlan;
  maxPets: number;
  aiBriefsEnabled: boolean;
  familySharingEnabled: boolean;
};

export const entitlements: Record<SubscriptionPlan, Entitlement> = {
  free: { plan: "free", maxPets: 1, aiBriefsEnabled: false, familySharingEnabled: false },
  plus: { plan: "plus", maxPets: 5, aiBriefsEnabled: true, familySharingEnabled: false },
  family: { plan: "family", maxPets: 10, aiBriefsEnabled: true, familySharingEnabled: true },
};

