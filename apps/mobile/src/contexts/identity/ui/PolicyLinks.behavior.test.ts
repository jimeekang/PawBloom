export {};
declare const require: any;
declare const process: { cwd(): string };
const assert = require("node:assert/strict");
const { load, Renderer, components } = require(`${process.cwd()}/scripts/react-hook-harness.cjs`);
let openURL: (url: string) => Promise<void> = async () => { throw new Error("private platform error"); };
const native = { Linking: { openURL: (url: string) => openURL(url) }, View: "View", Text: "Text", Pressable: "Pressable",
  StyleSheet: { create: (v: unknown) => v }, Platform: { OS: "ios", select: (v: any) => v.ios ?? v.default } };
const common = { "react-native": native, "react-native-safe-area-context": components,
  languageContext: { useLanguage: () => ({ language: "en", setLanguage: () => {} }) },
  useAccountDeletion: { useAccountDeletion: () => ({ status: "idle" }) },
  ChangePasswordForm: components, PasswordField: components,
  authContext: { useAuth: () => ({ loading: false, resetMessage: () => {} }) },
};
const { SettingsScreen } = load(`${process.cwd()}/apps/mobile/src/contexts/identity/ui/SettingsScreen.tsx`, common);
const { AuthScreen } = load(`${process.cwd()}/apps/mobile/src/contexts/identity/ui/AuthScreen.tsx`, common);
const { translations, setRuntimeLanguage } = require("../../../i18n/translations");
const { SUPPORT_URL, PRIVACY_POLICY_URL } = require("../../../shared-kernel/config");
function all(tree: any): any[] {
  if (!tree) return [];
  if (Array.isArray(tree)) return tree.flatMap(all);
  return [tree, ...all(tree.props?.children)];
}
for (const screenType of [SettingsScreen, AuthScreen]) {
  for (const language of ["en", "ko"]) {
    setRuntimeLanguage(language);
    const screen = new Renderer(screenType, { configured: false, onOpenPetProfiles: () => {}, onSignOut: () => {} }); screen.render();
    const link = (key: string) => all(screen.tree).find(n => n.props?.accessibilityRole === "link" && n.props.accessibilityLabel === translations[language][key]).props;
    const errors = () => all(screen.tree).filter(n => n.type === "NoticeBanner" && n.props.tone === "error");
    for (const [key, url] of [["settings.support", SUPPORT_URL], ["settings.privacyPolicy", PRIVACY_POLICY_URL]]) {
      openURL = async () => { throw new Error("private platform error"); };
      await link(key).onPress(); screen.render();
      assert.equal(errors().length, 1);
      assert.equal(errors()[0].props.text, translations[language]["settings.linkOpenFailed"].replace("{url}", url));
      assert.ok(!errors()[0].props.text.includes("private platform error"));
      openURL = async () => {};
      await link(key).onPress(); screen.render(); assert.equal(errors().length, 0);
    }
    let rejectOld: (error: Error) => void = () => {};
    openURL = () => new Promise((_, reject) => { rejectOld = reject; });
    const old = link("settings.support").onPress();
    openURL = async () => {};
    await link("settings.privacyPolicy").onPress(); rejectOld(new Error("slow failure")); await old;
    screen.render(); assert.equal(errors().length, 0, "old failure cannot replace a newer success");
    screen.unmount();
  }
}
setRuntimeLanguage(null);
console.log("Policy links: Auth/Settings, EN/KO, failure fallback, retry, stale rejection PASS");
