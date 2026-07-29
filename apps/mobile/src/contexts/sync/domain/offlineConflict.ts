import type { OfflineMutation } from "./offlineMutation";

export type StoredOfflineConflict = {
  id: string;
  createdAt: string;
  mutation: OfflineMutation | null;
};

export type OfflineConflictMetadata = {
  id: string;
  petId: string | null;
  category: string | null;
  recordDate: string;
};
