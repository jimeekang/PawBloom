export type SubscriptionPlan = "free" | "plus" | "family";

export type Entitlement = {
  plan: SubscriptionPlan;
  maxPets: number;
  aiBriefsEnabled: boolean;
  familySharingEnabled: boolean;
  reportSharingEnabled: boolean;
  dailyPhotoLimit: number;
};

export const entitlements: Record<SubscriptionPlan, Entitlement> = {
  free: { plan: "free", maxPets: 1, aiBriefsEnabled: false, familySharingEnabled: false, reportSharingEnabled: true, dailyPhotoLimit: 5 },
  plus: { plan: "plus", maxPets: 5, aiBriefsEnabled: true, familySharingEnabled: false, reportSharingEnabled: true, dailyPhotoLimit: 5 },
  family: { plan: "family", maxPets: 10, aiBriefsEnabled: true, familySharingEnabled: true, reportSharingEnabled: true, dailyPhotoLimit: 5 },
};

export function canCreatePet(entitlement: Entitlement, currentPetCount: number) {
  return currentPetCount < entitlement.maxPets;
}
