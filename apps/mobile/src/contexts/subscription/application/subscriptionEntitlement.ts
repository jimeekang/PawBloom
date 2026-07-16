import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../../shared-kernel/supabase/client";
import { entitlements, type Entitlement, type SubscriptionPlan } from "../domain/entitlement";

type EntitlementRow = {
  plan: SubscriptionPlan;
  active_until: string | null;
};

export const subscriptionEntitlementKey = (userId: string | null) => ["subscription_entitlement", userId] as const;

export function useSubscriptionEntitlement(userId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: subscriptionEntitlementKey(userId),
    enabled: Boolean(enabled && supabase && userId),
    queryFn: async () => {
      if (!supabase || !userId) return entitlements.free;
      const { data, error } = await supabase
        .from("subscription_entitlements")
        .select("plan,active_until")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return resolveEntitlement(data as EntitlementRow | null);
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function resolveEntitlement(row: EntitlementRow | null, now = Date.now()): Entitlement {
  if (!row || !isSubscriptionPlan(row.plan)) return entitlements.free;
  if (row.active_until) {
    const activeUntil = Date.parse(row.active_until);
    if (!Number.isFinite(activeUntil) || activeUntil < now) return entitlements.free;
  }
  return entitlements[row.plan];
}

function isSubscriptionPlan(value: string): value is SubscriptionPlan {
  return value === "free" || value === "plus" || value === "family";
}
