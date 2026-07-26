declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const { readFileSync } = require("node:fs") as {
  readFileSync(path: string, encoding: "utf8"): string;
};

// Regression: 0006 A4 — the AI brief must stay wired end to end: the home
// screen mounts the card, the card calls the generate-ai-brief hook, and the
// localized not-a-diagnosis disclaimer renders with the content.

function read(path: string) {
  return readFileSync(`${process.cwd()}/apps/mobile/src/${path}`, "utf8");
}

function occurrences(source: string, needle: string) {
  return source.split(needle).length - 1;
}

const homeScreen = read("presentation/screens/HomeScreen.tsx");
const briefCard = read("contexts/briefing/ui/AiBriefCard.tsx");
const briefHook = read("contexts/briefing/application/useAiBrief.ts");
const translations = read("i18n/translations.ts");

if (!homeScreen.includes("AiBriefCard")) {
  throw new Error("HomeScreen must mount AiBriefCard (PRODUCT_SPEC home AI summary card)");
}

if (!briefCard.includes("useAiBrief") || !briefCard.includes("briefing.disclaimer") || !briefCard.includes("briefing.notDiagnosis")) {
  throw new Error("AiBriefCard must call useAiBrief and always render the localized disclaimer and not-a-diagnosis badge");
}

if (!briefCard.includes("briefing.failed") || !briefCard.includes("briefing.generating")) {
  throw new Error("AiBriefCard must surface loading and failure states");
}

if (!briefHook.includes('functions.invoke<unknown>("generate-ai-brief"') || !briefHook.includes("parseGenerateAiBriefResponse")) {
  throw new Error("useAiBrief must call the generate-ai-brief edge function and validate the response");
}

for (const key of ['"briefing.generate"', '"briefing.failed"', '"briefing.empty"', '"briefing.questionsTitle"']) {
  if (occurrences(translations, key) < 2) {
    throw new Error(`${key} must be defined in both en and ko translations`);
  }
}
