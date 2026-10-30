import type { Appearance, CharacterSpecies } from "./appearance";
import { catCharacterGeometry, characterEyes, collarPaths, contour, earInner, ellipse, faceDetails, marking, path, silhouette, type CharacterGeometry } from "./catCharacterGeometry";

export function dogCharacterGeometry(a: Appearance): CharacterGeometry {
  const g = catCharacterGeometry(a);
  const earColor = a.coatPattern === "bicolor" ? "accent" : "coat";
  const ear = a.earShape === "pointed" ? "M16,42L16,6Q22,0 29,12L43,32Z" : "M31,28C15,20 5,31 5,49C4,70 9,83 18,81C29,79 27,52 31,28Z";
  const right = a.earShape === "pointed" ? "M77,32L91,12Q98,0 104,6L104,42Z" : "M89,28C105,20 115,31 115,49C116,70 111,83 102,81C91,79 93,52 89,28Z";
  // A narrower upper head, higher/closer eyes, and a low projecting muzzle distinguish dogs.
  const head = "M23,46C23,24 39,20 60,20C81,20 97,24 97,46C100,63 98,78 88,86Q78,96 60,98Q42,96 32,86C22,78 20,63 23,46Z";
  const muzzle = "M35,69C38,61 48,62 60,65C72,62 82,61 85,69C91,78 86,92 76,98Q60,107 44,98C34,92 29,78 35,69Z";
  g.head = [silhouette(right, earColor, a, "earRight"), ...(a.earShape === "pointed" ? [earInner("M97,17L95,34L85,30Z", right)] : []), silhouette(head, "coat", a, "head"), { ...path("M24,74Q60,107 96,74Q91,98 60,99Q29,98 24,74Z", "shade"), clip: head }];
  if (a.coatPattern === "bicolor") g.head.push(marking("M90,25Q103,29 104,45Q104,58 92,59Q89,48 90,25Z", "accent", head));
  if (a.faceMark === "blaze") g.head.push(marking("M57,22L49,73L71,73L63,22Z", "white", head));
  if (a.faceMark === "maskedEyes") g.head.push(marking(ellipse(43, 49, 16, 16), "white", head), marking(ellipse(77, 49, 16, 16), "white", head));
  g.head.push(...contour(head, "coat", a), silhouette(muzzle, "shade", a, "muzzle"));
  if (a.faceMark === "whiteMuzzle") g.head.push(marking(muzzle, "white", muzzle), ...contour(muzzle, "white", a));
  g.head.push(...faceDetails(true).map((part) => part.fill === "blush" ? { ...part, clip: head } : part));
  g.backEar = [silhouette(ear, earColor, a, "earLeft"), ...(a.earShape === "pointed" ? [earInner("M23,17L25,34L35,30Z", ear)] : [])];
  g.eyes = characterEyes(true, false);
  const tail = a.tail === "short" ? "M83,136C96,129 107,130 109,138C111,147 97,155 84,151Z"
    : a.tail === "fluffy" ? "M82,140C104,148 119,132 116,114C113,100 94,96 86,108C78,120 88,133 100,129C109,126 108,114 101,113C95,112 92,119 97,122C88,119 94,105 104,113C114,124 102,140 84,132Z"
    : "M82,139C94,133 103,121 106,108C107,102 114,102 116,108C120,128 108,149 88,154C82,156 78,146 82,139Z";
  g.tail = [silhouette(tail, "coat", a, "tail")];
  return g;
}

/** Other pets deliberately use a neutral, rounded silhouette. */
export function otherCharacterGeometry(a: Appearance): CharacterGeometry {
  const g = dogCharacterGeometry({ ...a, coatPattern: "solid", earShape: "floppy" });
  const left = ellipse(32, 26, 18, 19), right = ellipse(88, 26, 18, 19), head = ellipse(60, 59, 49, 40);
  g.head = [silhouette(right, "coat", a, "earRight"), silhouette(head, "coat", a, "head"), ...faceDetails(true)];
  g.backEar = [silhouette(left, "coat", a, "earLeft"), earInner(ellipse(32, 26, 10, 11), left)];
  g.tail = [silhouette(ellipse(91, 138, 13, 13), "coat", a, "tail")];
  g.frontPaws = [silhouette(ellipse(43, 150, 13, 10), "coat", a, "paw"), silhouette(ellipse(77, 150, 13, 10), "coat", a, "paw"), ...collarPaths(a)];
  return g;
}

export function characterGeometry(species: CharacterSpecies, appearance: Appearance, smiling = false): CharacterGeometry {
  const g = species === "cat" ? catCharacterGeometry(appearance, smiling) : species === "dog" ? dogCharacterGeometry(appearance) : otherCharacterGeometry(appearance);
  if (smiling) g.eyes = characterEyes(species !== "cat", true);
  return g;
}
