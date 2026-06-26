import { readFileSync } from "node:fs";
import { join } from "node:path";

const file = join(process.cwd(), "apps/mobile/src/i18n/translations.ts");
const text = readFileSync(file, "utf8");

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

console.log(`i18n verification passed (${en.length} keys).`);

