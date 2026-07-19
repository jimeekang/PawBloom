import { resolveInitialLanguage } from "./resolveInitialLanguage";

// A stored user preference always wins so existing users see no change.
if (resolveInitialLanguage("en", "ko") !== "en") throw new Error("stored English must win over a Korean device locale");
if (resolveInitialLanguage("ko", "en") !== "ko") throw new Error("stored Korean must win over an English device locale");

// With no stored preference the device language drives the default.
if (resolveInitialLanguage(null, "ko") !== "ko") throw new Error("no stored preference + Korean device must resolve to Korean");
if (resolveInitialLanguage(null, "en") !== "en") throw new Error("no stored preference + English device must resolve to English");
if (resolveInitialLanguage(null, "ja") !== "en") throw new Error("no stored preference + unsupported device locale must resolve to English");
if (resolveInitialLanguage(null, undefined) !== "en") throw new Error("no stored preference + unknown device locale must resolve to English");
