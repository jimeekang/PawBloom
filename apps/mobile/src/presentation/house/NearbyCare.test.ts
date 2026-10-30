import type { PetProfile } from "../../contexts/pet/domain/pet";
import type { TodayCareItem, TodayCarePetState } from "../screens/TodayCareScreen";
import { findElements } from "../testHookHarness";
declare const require: (name: string) => any;
const modules = require("node:module"), original = modules._load;
const NativeDate = Date;
globalThis.Date = class extends NativeDate { constructor() { super("2026-10-28T20:30:00"); } } as DateConstructor;
const avatar = () => null;
modules._load = function(name: string, parent: unknown, main: boolean) {
  if (name.endsWith("/PetAvatar")) return { PetAvatar: avatar };
  if (name.endsWith("/PetNameChip")) return { PetNameChip: () => null, StatusChip: () => null };
  return original.call(this, name, parent, main);
};
try {
  const { NearbyCare } = require("./NearbyCare");
  const pets = [{ id: "a", name: "모찌" }, { id: "b", name: "루나" }] as PetProfile[];
  const routine: TodayCareItem = { id: "condition", source: "routine", label: "컨디션", status: "pending", dateKey: "2026-10-28" };
  const dose = (id: string, scheduledTime: string, status: TodayCareItem["status"] = "pending"): TodayCareItem => ({ ...routine, source: "dose", id, label: "심장사상충 예방약", scheduledTime, status });
  let opened = "";
  const render = (items: TodayCareItem[], second: TodayCarePetState = { petId: "b", status: "ready", items: [routine] }) => NearbyCare({ pets, userId: null, careStates: [{ petId: "a", status: "ready", items }, second], onOpenPet: (id: string) => { opened = id; } });
  // Even overdue pending schedules precede daily records.
  let tree = render([routine, dose("pending", "00:00"), dose("done", "00:01", "completed")]);
  let buttons = findElements(tree, (node) => node.props?.accessibilityRole === "button");
  assert(buttons[0].props.accessibilityLabel.includes("00:00") && buttons[0].props.accessibilityLabel.includes("모찌"), "pending timed care precedes daily records, even after its time");
  assert(!JSON.stringify(tree).includes("00:01"), "completed schedules are excluded");
  buttons[0].props.onPress(); assert(opened === "a", "card opens the exact pet without recording a dose");
  tree = render([routine, dose("first", "00:00"), dose("next", "23:59")]);
  buttons = findElements(tree, (node) => node.props?.accessibilityRole === "button");
  assert(buttons.length === 2 && buttons.every((node) => /00:00|23:59/.test(node.props.accessibilityLabel)), "next two schedules may belong to the same pet");
  assert(buttons[0].props.accessibilityLabel.includes("23:59"), "upcoming schedules precede past pending schedules");
  tree = render([], { petId: "b", status: "error", items: [dose("stale", "20:00")] });
  assert(!findElements(tree, (node) => node.props?.accessibilityRole === "button").length, "error state never surfaces stale schedules");
} finally { modules._load = original; globalThis.Date = NativeDate; }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
