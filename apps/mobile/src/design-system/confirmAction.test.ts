import { confirmDestructiveAction, confirmPrimaryAction } from "./confirmAction";

const copy = { title: "삭제", message: "정말 삭제할까요?", cancelText: "취소", confirmText: "삭제" };
const originalConfirm = globalThis.confirm;

globalThis.confirm = () => false;
const cancelled = await confirmDestructiveAction(copy, () => true);
if (cancelled) throw new Error("web cancellation must resolve false");

globalThis.confirm = () => true;
const confirmed = await confirmDestructiveAction(copy, () => true);
if (!confirmed) throw new Error("web confirmation must resolve onConfirm result");

const rejected = await confirmDestructiveAction(copy, () => {
  throw new Error("boom");
});
if (rejected) throw new Error("failed confirmation callbacks must resolve false");

globalThis.confirm = () => false;
const primaryCancelled = await confirmPrimaryAction(copy, () => true);
if (primaryCancelled) throw new Error("web cancellation must resolve false for primary confirms");

globalThis.confirm = () => true;
const primaryConfirmed = await confirmPrimaryAction(copy, () => true);
if (!primaryConfirmed) throw new Error("web confirmation must resolve onConfirm result for primary confirms");

globalThis.confirm = originalConfirm;
