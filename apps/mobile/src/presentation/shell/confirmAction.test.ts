import { confirmDestructiveAction } from "./confirmAction";

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

globalThis.confirm = originalConfirm;
