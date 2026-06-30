import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const trackedFiles = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

const failures = [];

const jwtPattern = /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g;
const secretAssignmentPattern =
  /^\s*(?:EXPO_PUBLIC_SUPABASE_(?:PUBLISHABLE_)?KEY|SUPABASE_(?:ANON_KEY|PUBLISHABLE_KEY|SERVICE_ROLE_KEY|SECRET_KEY)|OPENAI_API_KEY)\s*=\s*([^\s#]+)/gm;

const allowedPlaceholderValues = new Set([
  "your-publishable-key",
  "server-only-edge-function-secret",
  "your-anon-key",
  "your-service-role-key",
]);

for (const file of trackedFiles) {
  if (!existsSync(file) || file.endsWith("package-lock.json")) {
    continue;
  }

  const content = readFileSync(file, "utf8");

  if (jwtPattern.test(content)) {
    failures.push(`${file}: contains a JWT-like token`);
  }

  for (const match of content.matchAll(secretAssignmentPattern)) {
    const value = match[1].trim().replace(/^["']|["']$/g, "");
    if (value && !allowedPlaceholderValues.has(value)) {
      failures.push(`${file}: contains a non-placeholder secret assignment`);
    }
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Secret verification passed.");
