import { readFileSync } from "node:fs";
const app = readFileSync("apps/mobile/src/contexts/avatar/domain/appearance.ts", "utf8");
const server = readFileSync("supabase/functions/generate-pet-avatar/contract.ts", "utf8");
for (const name of ["coatColors", "coatPatterns", "eyeColors", "earShapes", "furLengths", "builds", "tails", "faceMarks", "collars"]) {
  const pattern = new RegExp(`export const ${name} = (\\[[^\\]]*\\]) as const;`);
  const a = app.match(pattern)?.[1];
  const b = server.match(pattern)?.[1];
  if (!a || !b || a !== b) throw new Error(`Avatar enum differs: ${name}`);
}
console.log("Avatar server/mobile enum contract passed (9 option arrays).");
