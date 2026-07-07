import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

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

const srcRoot = join(root, "apps/mobile/src");
const sourceFiles = walk(srcRoot).filter((file) => /\.(ts|tsx)$/.test(file));

const contextLayers = new Set(["domain", "application", "infrastructure", "ui"]);

function classify(srcRel) {
  if (srcRel.startsWith("contexts/")) {
    const [, context, layer] = srcRel.split("/");
    return { kind: "context", context, layer: contextLayers.has(layer) ? layer : "root" };
  }
  if (srcRel.startsWith("presentation/")) return { kind: "presentation" };
  if (srcRel.startsWith("design-system/")) return { kind: "design-system" };
  if (srcRel.startsWith("i18n/")) return { kind: "i18n" };
  if (srcRel.startsWith("shared-kernel/")) return { kind: "shared-kernel" };
  return { kind: "other" };
}

function parseImports(text) {
  const statements = [];
  const staticPattern = /(?:^|\n)\s*((?:import|export)[^;"']*?from\s*["']([^"']+)["'])/g;
  for (const match of text.matchAll(staticPattern)) {
    statements.push({ specifier: match[2], typeOnly: /^\s*(import\s+type|export\s+type)\b/.test(match[1]) });
  }
  const dynamicPattern = /import\s*\(\s*["']([^"']+)["']\s*\)/g;
  for (const match of text.matchAll(dynamicPattern)) {
    statements.push({ specifier: match[1], typeOnly: false });
  }
  return statements;
}

// Layer rules. Each rule receives the importing file's class, the imported
// file's class, and whether the import is type-only; returns an error string
// or null. Cooperation between contexts is allowed only from the application
// layer to another context's application/domain (explicit use case calls) and
// as type-only domain imports from ui (props typing). Everything else must go
// through composition in presentation/App wiring.
function checkImport(from, to, typeOnly) {
  if (from.kind === "context") {
    if (to.kind === "presentation") return "contexts must not import presentation (compose in presentation/App instead)";
    if (to.kind === "shared-kernel") return null;
    if (to.kind === "design-system") return from.layer === "ui" ? null : `${from.layer} must not import design-system`;
    if (to.kind === "i18n") return from.layer === "ui" ? null : `${from.layer} must not import i18n`;
    if (to.kind === "context") {
      if (to.context === from.context) {
        if (from.layer === "domain" && to.layer !== "domain") return "domain may only import its own domain and shared-kernel";
        if (from.layer === "application" && to.layer === "ui") return "application must not import ui";
        if (from.layer === "infrastructure" && (to.layer === "ui" || to.layer === "application")) return "infrastructure may only import its own domain and shared-kernel";
        return null;
      }
      if (from.layer === "application" && (to.layer === "application" || to.layer === "domain")) return null;
      if (from.layer === "ui" && to.layer === "domain" && typeOnly) return null;
      return `${from.layer} of context "${from.context}" must not import context "${to.context}" ${to.layer} (${typeOnly ? "type-only" : "runtime"})`;
    }
    return null;
  }
  if (from.kind === "presentation") {
    if (to.kind === "context" && to.layer === "infrastructure") return "presentation must not import context infrastructure (use application/ui)";
    return null;
  }
  if (from.kind === "design-system") {
    if (to.kind === "design-system" || to.kind === "i18n" || to.kind === "shared-kernel") return null;
    return "design-system may only import design-system, i18n, and shared-kernel";
  }
  if (from.kind === "i18n") {
    return to.kind === "shared-kernel" || to.kind === "i18n" ? null : "i18n may only import shared-kernel";
  }
  if (from.kind === "shared-kernel") {
    return to.kind === "shared-kernel" ? null : "shared-kernel must not import app modules";
  }
  return null;
}

const contextEdges = new Map(); // "from>to" -> example file

for (const file of sourceFiles) {
  const rel = relative(root, file).replaceAll("\\", "/");
  const srcRel = relative(srcRoot, file).replaceAll("\\", "/");
  const text = readFileSync(file, "utf8");
  const lineCount = text.split(/\r?\n/).length;

  if (lineCount > 260) {
    failures.push(`${rel} has ${lineCount} lines; split it before adding more behavior.`);
  }

  const isTestFile = /\.test\.(ts|tsx)$/.test(file);
  if (isTestFile) continue; // tests may compose freely across boundaries

  const from = classify(srcRel);
  if (from.kind === "other") continue;

  for (const { specifier, typeOnly } of parseImports(text)) {
    if (!specifier.startsWith(".")) continue; // packages are out of scope
    const targetAbs = resolve(dirname(file), specifier);
    const targetSrcRel = relative(srcRoot, targetAbs).replaceAll("\\", "/");
    if (targetSrcRel.startsWith("..")) continue; // outside src (e.g. generated types)
    const to = classify(targetSrcRel);
    if (to.kind === "other") continue;

    const error = checkImport(from, to, typeOnly);
    if (error) failures.push(`${rel} → ${targetSrcRel}: ${error}`);

    if (from.kind === "context" && to.kind === "context" && from.context !== to.context && !typeOnly) {
      contextEdges.set(`${from.context}>${to.context}`, rel);
    }
  }
}

// Context-level dependency cycles make features break each other; forbid them.
const graph = new Map();
for (const key of contextEdges.keys()) {
  const [from, to] = key.split(">");
  if (!graph.has(from)) graph.set(from, new Set());
  graph.get(from).add(to);
}

function findCycle() {
  const visiting = new Set();
  const visited = new Set();
  const stack = [];

  function visit(node) {
    if (visited.has(node)) return null;
    if (visiting.has(node)) return [...stack.slice(stack.indexOf(node)), node];
    visiting.add(node);
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      const cycle = visit(next);
      if (cycle) return cycle;
    }
    stack.pop();
    visiting.delete(node);
    visited.add(node);
    return null;
  }

  for (const node of graph.keys()) {
    const cycle = visit(node);
    if (cycle) return cycle;
  }
  return null;
}

const cycle = findCycle();
if (cycle) {
  failures.push(`Context dependency cycle detected: ${cycle.join(" → ")}. Break it with a registry/callback so contexts stay independent.`);
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
