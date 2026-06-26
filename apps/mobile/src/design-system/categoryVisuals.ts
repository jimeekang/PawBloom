import { colors } from "./tokens";
import type { AppIconName } from "./iconography";

export type CategoryKey = "food" | "water" | "walk" | "stool" | "condition" | "memo" | "medication" | "night";

export type CategoryVisual = {
  label: string;
  icon: AppIconName;
  color: string;
  background: string;
};

export const categoryVisuals: Record<CategoryKey, CategoryVisual> = {
  food: { label: "Food", icon: "food", color: colors.orangeDeep, background: "#FFF0E7" },
  water: { label: "Water", icon: "water", color: colors.water, background: "#EDF9FF" },
  walk: { label: "Walk", icon: "walk", color: colors.walk, background: "#EEFBF4" },
  stool: { label: "Stool", icon: "stool", color: colors.stool, background: "#FFF1DF" },
  condition: { label: "Condition", icon: "condition", color: colors.coral, background: "#FFF0F2" },
  memo: { label: "Memo", icon: "memo", color: colors.memo, background: "#FFF4E4" },
  medication: { label: "Medication", icon: "medication", color: colors.salmon, background: "#FFF0F0" },
  night: { label: "Night condition", icon: "night", color: colors.purple, background: "#F2EEFF" },
};

