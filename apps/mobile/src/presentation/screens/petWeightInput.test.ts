import { parsePetWeightInput } from "./petWeightInput";

if (parsePetWeightInput("8.5").value !== 8.5 || !parsePetWeightInput("8.5").ok) {
  throw new Error("plain numeric weights must parse");
}
if (!parsePetWeightInput("").ok || !Number.isNaN(parsePetWeightInput("").value)) {
  throw new Error("an empty weight is allowed and stores as unset");
}
for (const bad of ["8.5kg", "abc", "-3", "0"]) {
  if (parsePetWeightInput(bad).ok) {
    throw new Error(`invalid weight input must be rejected instead of truncated: ${bad}`);
  }
}
