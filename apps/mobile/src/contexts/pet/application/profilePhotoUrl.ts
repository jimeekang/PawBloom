import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../../shared-kernel/supabase/client";

const SIGNED_URL_TTL_SECONDS = 60 * 60;
export const petProfilePhotoKey = (petId: string | null | undefined, userId: string | null) => ["pet-profile-photo-url", petId, userId] as const;

export function usePetProfilePhotoUrl(petId: string | null | undefined, userId: string | null = null) {
  return useQuery({
    queryKey: petProfilePhotoKey(petId, userId),
    enabled: Boolean(supabase && petId && userId),
    staleTime: 45 * 60 * 1000,
    refetchOnMount: "always",
    queryFn: async () => {
      if (!supabase || !petId) {
        return null;
      }

      const { data: asset, error: assetError } = await supabase
        .from("media_assets")
        .select("storage_path")
        .eq("pet_id", petId)
        .is("diary_entry_id", null)
        .like("storage_path", `${petId}/profile/%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (assetError) {
        throw new Error(assetError.message ?? "반려동물 사진을 불러오지 못했습니다.");
      }

      if (!asset?.storage_path) {
        return null;
      }

      const { data, error } = await supabase.storage.from("pet-media").createSignedUrl(asset.storage_path, SIGNED_URL_TTL_SECONDS);

      if (error || !data?.signedUrl) {
        throw new Error(error?.message ?? "반려동물 사진을 불러오지 못했습니다.");
      }

      return data.signedUrl;
    },
  });
}
