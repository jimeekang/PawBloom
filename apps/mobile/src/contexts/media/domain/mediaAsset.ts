import type { UUID } from "../../../shared-kernel/types";

export type MediaAsset = {
  id: UUID;
  petId: UUID;
  storagePath: string;
  contentType: string;
  createdAt: string;
};

export function petMediaPath(petId: UUID, objectId: UUID) {
  return `${petId}/${objectId}`;
}

