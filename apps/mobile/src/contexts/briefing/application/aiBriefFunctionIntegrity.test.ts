declare const require: (moduleName: string) => unknown;
declare const process: { cwd(): string };

const { readFileSync } = require("node:fs") as { readFileSync(path: string, encoding: "utf8"): string };
const { AiBriefRequestError, parseAiBriefRequest } = require("../../../../../../supabase/functions/generate-ai-brief/contract.ts") as {
  AiBriefRequestError: new (message: string) => Error;
  parseAiBriefRequest(input: unknown): { petId: string; rangeDays: 3 | 7 | 14 };
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

for (const rangeDays of [3, 7, 14] as const) {
  const parsed = parseAiBriefRequest({ petId: "  pet-1  ", rangeDays });
  assert(parsed.petId === "pet-1", "the brief request parser must normalize the pet id");
  assert(parsed.rangeDays === rangeDays, `the brief request parser must accept ${rangeDays} days`);
}

for (const rangeDays of [undefined, null, 0, 2, 4, 8, 13, 15, 3.5, "3", "7", true, {}, [], Number.NaN, Number.POSITIVE_INFINITY]) {
  let thrown: unknown;
  try {
    parseAiBriefRequest({ petId: "pet-1", rangeDays });
  } catch (error) {
    thrown = error;
  }
  assert(thrown instanceof AiBriefRequestError, `the brief request parser must reject rangeDays=${String(rangeDays)}`);
}

for (const input of [null, undefined, [], {}, { petId: "", rangeDays: 7 }, { petId: "   ", rangeDays: 7 }]) {
  let thrown: unknown;
  try {
    parseAiBriefRequest(input);
  } catch (error) {
    thrown = error;
  }
  assert(thrown instanceof AiBriefRequestError, "the brief request parser must reject malformed request bodies");
}

const source = readFileSync(`${process.cwd()}/supabase/functions/generate-ai-brief/index.ts`, "utf8");
for (const required of [
  "parseAiBriefRequest(await readJson<unknown>(request))",
  "const until = new Date().toISOString()",
  ".lte(\"occurred_at\", until)",
  ".lte(\"scheduled_at\", until)",
  "if (entriesResult.error) failSourceQuery(\"diary entries\", entriesResult.error)",
  "if (dosesResult.error) failSourceQuery(\"medication doses\", dosesResult.error)",
  ".catch((error: unknown) => failSourceQuery(\"source records\", error))",
  "if (error instanceof AiBriefSourceError) return errorResponse(error.message, 500)",
]) {
  assert(source.includes(required), `generate-ai-brief source integrity guard is missing: ${required}`);
}

assert(!source.includes("const [{ data: entries }, { data: doses }]"), "source-query errors must not be discarded while destructuring data");
