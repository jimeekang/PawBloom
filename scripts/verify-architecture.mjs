import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const requiredDocs = [
  "AGENTS.md",
  "ARCHITECTURE.md",
  "docs/product/PRODUCT_SPEC.md",
  "docs/product/AI_SAFETY.md",
  "docs/engineering/FRONTEND.md",
  "docs/engineering/BACKEND.md",
  "docs/engineering/DATABASE.md",
  "docs/engineering/QUALITY.md",
  "docs/engineering/RELEASE.md",
];

const failures = [];

for (const doc of requiredDocs) {
  if (!existsSync(join(root, doc))) {
    failures.push(`Missing required harness document: ${doc}`);
  }
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === ".expo") return [];
      return walk(full);
    }
    return [full];
  });
}

const sourceFiles = walk(join(root, "apps/mobile/src")).filter((file) => /\.(ts|tsx)$/.test(file));
const contextRoot = join(root, "apps/mobile/src/contexts");

for (const file of sourceFiles) {
  const rel = relative(root, file).replaceAll("\\", "/");
  const text = readFileSync(file, "utf8");
  const lineCount = text.split(/\r?\n/).length;

  if (lineCount > 260) {
    failures.push(`${rel} has ${lineCount} lines; split it before adding more behavior.`);
  }

  if (file.startsWith(contextRoot)) {
    const parts = relative(contextRoot, file).split(/[\\/]/);
    const currentContext = parts[0];
    const forbidden = [...text.matchAll(/from\s+["'][^"']*contexts\/([^/"']+)/g)].map((match) => match[1]);
    for (const importedContext of forbidden) {
      if (importedContext !== currentContext) {
        failures.push(`${rel} imports another context directly: ${importedContext}`);
      }
    }
  }
}

const appJson = readFileSync(join(root, "apps/mobile/app.json"), "utf8");
if (!appJson.includes("com.pawbloom.app")) {
  failures.push("apps/mobile/app.json must declare iOS and Android application identifiers.");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Architecture verification passed (${sourceFiles.length} source files checked).`);

