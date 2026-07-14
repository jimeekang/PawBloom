import { FontAwesome5, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { colors, iconSize } from "./tokens";

type IconFamily = "ion" | "material" | "fa5";
type IconDefinition = {
  family: IconFamily;
  name: string;
};

export const icon = {
  logo: { family: "fa5", name: "paw" },
  bell: { family: "ion", name: "notifications-outline" },
  menu: { family: "ion", name: "menu" },
  back: { family: "ion", name: "chevron-back" },
  calendar: { family: "ion", name: "calendar-clear-outline" },
  time: { family: "ion", name: "time-outline" },
  settings: { family: "ion", name: "settings-outline" },
  add: { family: "ion", name: "add" },
  addPhoto: { family: "ion", name: "image-outline" },
  camera: { family: "ion", name: "camera-outline" },
  home: { family: "ion", name: "home-outline" },
  homeFilled: { family: "ion", name: "home" },
  diary: { family: "ion", name: "calendar-outline" },
  care: { family: "material", name: "medical-bag" },
  reports: { family: "ion", name: "document-text-outline" },
  food: { family: "material", name: "bowl" },
  water: { family: "ion", name: "water" },
  walk: { family: "fa5", name: "paw" },
  stool: { family: "material", name: "emoticon-poop" },
  condition: { family: "ion", name: "heart" },
  memo: { family: "ion", name: "document-text" },
  medication: { family: "material", name: "pill" },
  check: { family: "ion", name: "checkmark" },
  circle: { family: "ion", name: "ellipse-outline" },
  spark: { family: "ion", name: "sparkles" },
  shield: { family: "ion", name: "shield-checkmark-outline" },
  chevronDown: { family: "ion", name: "chevron-down" },
  report: { family: "ion", name: "reader" },
  share: { family: "ion", name: "share-outline" },
  lock: { family: "ion", name: "lock-closed-outline" },
  pet: { family: "fa5", name: "dog" },
  close: { family: "ion", name: "close" },
} as const satisfies Record<string, IconDefinition>;

export type AppIconName = keyof typeof icon;

type Props = {
  name: AppIconName;
  size?: number;
  color?: string;
};

export function AppIcon({ name, size = iconSize.md, color = colors.text }: Props) {
  const definition = icon[name];

  if (definition.family === "ion") {
    return <Ionicons name={definition.name as ComponentProps<typeof Ionicons>["name"]} size={size} color={color} />;
  }

  if (definition.family === "material") {
    return <MaterialCommunityIcons name={definition.name as ComponentProps<typeof MaterialCommunityIcons>["name"]} size={size} color={color} />;
  }

  if (definition.family === "fa5") {
    return <FontAwesome5 name={definition.name as ComponentProps<typeof FontAwesome5>["name"]} size={size} color={color} />;
  }
}
