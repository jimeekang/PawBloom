import { colors } from "./tokens";
import type { AppIconName } from "./iconography";

export type CategoryKey = "food" | "water" | "walk" | "stool" | "condition" | "memo" | "photo" | "medication" | "night";

export type CategoryVisual = {
  label: string;
  icon: AppIconName;
  color: string;
  background: string;
};

export const categoryVisuals: Record<CategoryKey, CategoryVisual> = {
  food: { label: "식사", icon: "food", color: colors.orangeDeep, background: "#FFF0E7" },
  water: { label: "물", icon: "water", color: colors.water, background: "#EDF9FF" },
  walk: { label: "산책", icon: "walk", color: colors.walk, background: "#EEFBF4" },
  stool: { label: "배변", icon: "stool", color: colors.stool, background: "#FFF1DF" },
  condition: { label: "컨디션", icon: "condition", color: colors.coral, background: "#FFF0F2" },
  memo: { label: "메모", icon: "memo", color: colors.memo, background: "#FFF4E4" },
  photo: { label: "사진", icon: "addPhoto", color: colors.water, background: "#EDF9FF" },
  medication: { label: "투약", icon: "medication", color: colors.salmon, background: "#FFF0F0" },
  night: { label: "야간", icon: "night", color: colors.purple, background: "#F2EEFF" },
};
