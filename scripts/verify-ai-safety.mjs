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

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("AI safety verification passed.");

