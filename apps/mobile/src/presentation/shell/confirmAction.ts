import { Alert, Platform } from "react-native";

export type ConfirmActionCopy = {
  title: string;
  message: string;
  cancelText: string;
  confirmText: string;
};

export function confirmDestructiveAction(copy: ConfirmActionCopy, onConfirm: () => Promise<boolean> | boolean) {
  if (Platform.OS === "web") {
    return runWebConfirm(copy, onConfirm);
  }

  return new Promise<boolean>((resolve) =>
    Alert.alert(
      copy.title,
      copy.message,
      [
        { text: copy.cancelText, style: "cancel", onPress: () => resolve(false) },
        { text: copy.confirmText, style: "destructive", onPress: () => void resolveConfirm(resolve, onConfirm) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}

async function runWebConfirm(copy: ConfirmActionCopy, onConfirm: () => Promise<boolean> | boolean) {
  if (typeof globalThis.confirm === "function" && !globalThis.confirm(`${copy.title}\n\n${copy.message}`)) return false;
  return resolveConfirmValue(onConfirm);
}

async function resolveConfirm(resolve: (value: boolean) => void, onConfirm: () => Promise<boolean> | boolean) {
  resolve(await resolveConfirmValue(onConfirm));
}

async function resolveConfirmValue(onConfirm: () => Promise<boolean> | boolean) {
  try {
    return await onConfirm();
  } catch {
    return false;
  }
}
