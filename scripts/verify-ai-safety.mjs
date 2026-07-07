import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const scanRoots = ["apps/mobile/src", "supabase/functions"].map((path) => join(root, path));
const forbidden = [
  /increase the dose/i,
  /decrease the dose/i,
  /stop the medication/i,
  /no vet visit is needed/i,
  /definitely an emergency/i,
  /definitely not an emergency/i,
  /you can treat this at home/i,
  /약을 늘리/i,
  /약을 줄이/i,
  /병원에 가지 않아도/i,
];

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(full) ? [full] : [];
  });
}

const failures = [];
for (const file of scanRoots.flatMap(walk)) {
  const text = readFileSync(file, "utf8");
  for (const pattern of forbidden) {
    if (pattern.test(text)) {
      failures.push(`${relative(root, file)} contains unsafe AI wording: ${pattern}`);
    }
  }
}

const safetyText = readFileSync(join(root, "docs/product/AI_SAFETY.md"), "utf8");
if (!safetyText.includes("record-based summary") || !safetyText.includes("진단이 아니라 기록 기반 요약")) {
  failures.push("AI safety doc must contain English and Korean required disclaimer copy.");
}

const requiredEnglishDisclaimer = "This is a record-based summary, not a diagnosis. Contact a veterinarian for medical decisions.";
const requiredKoreanDisclaimer = "이 내용은 진단이 아니라 기록 기반 요약입니다. 의학적 판단은 수의사에게 문의하세요.";
const translationsText = readFileSync(join(root, "apps/mobile/src/i18n/translations.ts"), "utf8");
const sampleReportText = readFileSync(join(root, "apps/mobile/src/contexts/report/ui/sampleReport.ts"), "utf8");
const sampleBriefText = readFileSync(join(root, "apps/mobile/src/contexts/briefing/ui/sampleBrief.ts"), "utf8");

if (!translationsText.includes(requiredEnglishDisclaimer) || !translationsText.includes(requiredKoreanDisclaimer)) {
  failures.push("App translations must keep the exact English and Korean report disclaimer copy.");
}

if (!sampleReportText.includes(requiredKoreanDisclaimer) || !sampleBriefText.includes(requiredKoreanDisclaimer)) {
  failures.push("Sample report and brief data must use the exact Korean report disclaimer copy.");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("AI safety verification passed.");
