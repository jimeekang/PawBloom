import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const file = join(process.cwd(), "apps/mobile/src/i18n/translations.ts");
const sourceRoot = join(process.cwd(), "apps/mobile/src");
const appEntryFile = join(process.cwd(), "apps/mobile/App.tsx");
const text = readFileSync(file, "utf8");
const dynamicKeyPrefixes = [
  "care.status.",
  "category.",
  "diary.appetite.",
  "diary.intensity.",
  "diary.level.",
  "diary.meal.",
  "diary.stool.",
  "reports.missing.",
  "reports.q.",
  "settings.membersRole.",
  "settings.membersStatus.",
  "settings.plan.",
];

function extractKeys(language) {
  const block = text.match(new RegExp(`${language}:\\s*\\{([\\s\\S]*?)\\n\\s*\\}`, "m"));
  if (!block) {
    throw new Error(`Missing ${language} translation block`);
  }
  return [...block[1].matchAll(/"([^"]+)":/g)].map((match) => match[1]).sort();
}

const en = extractKeys("en");
const ko = extractKeys("ko");
const missingInKo = en.filter((key) => !ko.includes(key));
const missingInEn = ko.filter((key) => !en.includes(key));

if (missingInKo.length || missingInEn.length) {
  console.error(`i18n mismatch\nMissing in ko: ${missingInKo.join(", ")}\nMissing in en: ${missingInEn.join(", ")}`);
  process.exit(1);
}

const sourceText = collectSourceFiles(sourceRoot)
  .filter((sourceFile) => sourceFile !== file && !/\.test\.(ts|tsx)$/.test(sourceFile))
  .map((sourceFile) => readFileSync(sourceFile, "utf8"))
  .concat(readFileSync(appEntryFile, "utf8"))
  .join("\n");
const unused = en.filter((key) => !isUsedKey(key, sourceText));

if (unused.length) {
  console.error(`Unused i18n keys: ${unused.join(", ")}`);
  process.exit(1);
}

console.log(`i18n verification passed (${en.length} keys, 0 unused).`);

function collectSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

function isUsedKey(key, source) {
  if (dynamicKeyPrefixes.some((prefix) => key.startsWith(prefix))) return true;
  return [`"${key}"`, `'${key}'`, `\`${key}\``].some((literal) => source.includes(literal));
}
