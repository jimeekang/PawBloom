import { colors } from "./tokens";
import type { AppIconName } from "./iconography";

export type CategoryKey = "food" | "water" | "walk" | "stool" | "condition" | "memo" | "photo" | "medication" | "night";

export type CategoryVisual = {
  labelKey: `category.${CategoryKey}`;
  icon: AppIconName;
  color: string;
  background: string;
};

export const categoryVisuals: Record<CategoryKey, CategoryVisual> = {
  food: { labelKey: "category.food", icon: "food", color: colors.orangeDeep, background: "#FFF0E7" },
  water: { labelKey: "category.water", icon: "water", color: colors.water, background: "#EDF9FF" },
  walk: { labelKey: "category.walk", icon: "walk", color: colors.walk, background: "#EEFBF4" },
  stool: { labelKey: "category.stool", icon: "stool", color: colors.stool, background: "#FFF1DF" },
  condition: { labelKey: "category.condition", icon: "condition", color: colors.coral, background: "#FFF0F2" },
  memo: { labelKey: "category.memo", icon: "memo", color: colors.memo, background: "#FFF4E4" },
  photo: { labelKey: "category.photo", icon: "addPhoto", color: colors.water, background: "#EDF9FF" },
  medication: { labelKey: "category.medication", icon: "medication", color: colors.salmon, background: "#FFF0F0" },
  night: { labelKey: "category.night", icon: "night", color: colors.purple, background: "#F2EEFF" },
};
