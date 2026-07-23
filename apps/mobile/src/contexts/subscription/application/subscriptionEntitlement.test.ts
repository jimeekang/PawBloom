import { canCreatePet, entitlements } from "../domain/entitlement";
import { resolveEntitlement } from "./subscriptionEntitlement";

if (resolveEntitlement(null) !== entitlements.free) {
  throw new Error("missing subscription rows must resolve to the Free entitlement");
}
if (resolveEntitlement({ plan: "family", active_until: "2020-01-01T00:00:00.000Z" }) !== entitlements.free) {
  throw new Error("expired subscriptions must fall back to Free");
}
if (resolveEntitlement({ plan: "family", active_until: null }) !== entitlements.family) {
  throw new Error("active Family subscriptions must enable family sharing");
}
if (canCreatePet(entitlements.free, 1) || !canCreatePet(entitlements.plus, 1)) {
  throw new Error("pet creation must follow the current plan limit");
}
if (!entitlements.free.reportSharingEnabled || entitlements.free.dailyPhotoLimit !== 5) {
  throw new Error("the approved beta policy keeps report links available and the five-photo limit plan-neutral");
}
