import type { Appearance } from "./appearance";

export type CharacterPaint = "coat" | "shade" | "accent" | "white" | "ginger" | "black" | "inner" | "nose" | "ink" | "blush" | "eyeLeft" | "eyeRight" | "eyeRing" | "highlight" | "collar" | "bell" | "outline";
export type CharacterPath = { d: string; fill: CharacterPaint | "none"; opacity?: number; stroke?: CharacterPaint; strokeWidth?: number; nonScalingStroke?: boolean; clip?: string; feature?: "head" | "body" | "earLeft" | "earRight" | "tail" | "paw" | "marking" | "earInner" | "muzzle" };
export const characterLayers = ["tail", "body", "backEar", "head", "eyes", "frontPaws"] as const;
export type CharacterLayer = (typeof characterLayers)[number];
export type CharacterGeometry = Record<CharacterLayer, CharacterPath[]>;
export const ellipse = (x: number, y: number, rx: number, ry: number) => `M${x - rx},${y}a${rx},${ry} 0 1,0 ${rx * 2},0a${rx},${ry} 0 1,0 ${-rx * 2},0`;
export const path = (d: string, fill: CharacterPaint, opacity?: number): CharacterPath => ({ d, fill, opacity });
export const line = (d: string, stroke: CharacterPaint, strokeWidth = 1.5): CharacterPath => ({ d, fill: "none", stroke, strokeWidth });
export const marking = (d: string, fill: CharacterPaint, clip: string): CharacterPath => ({ ...path(d, fill), clip, feature: "marking" });
export const earInner = (d: string, clip: string): CharacterPath => ({ ...path(d, "inner"), clip, feature: "earInner" });
const isLight = (a: Appearance, fill: CharacterPaint) => ["white", "cream"].includes(fill === "coat" ? a.coatColor : fill === "accent" ? a.accentColor : fill);
export function silhouette(d: string, fill: CharacterPaint, a: Appearance, feature: CharacterPath["feature"]): CharacterPath {
  return { ...path(d, fill), feature, ...(isLight(a, fill) ? { stroke: "outline" as const, strokeWidth: 1.25, nonScalingStroke: true } : {}) };
}
/** Repeat only the outer contour after clipped markings so its inner half stays visible. */
export const contour = (d: string, fill: CharacterPaint, a: Appearance): CharacterPath[] => isLight(a, fill) ? [{ ...line(d, "outline", 1.25), nonScalingStroke: true }] : [];

/** 120×160 canvas; the lower center (60,160) is the shared foot anchor. */
export function catCharacterGeometry(a: Appearance, smiling = false): CharacterGeometry {
  const width = a.build === "slim" ? 23 : a.build === "round" ? 35 : 29;
  const cheek = a.build === "round" ? 3 : a.build === "slim" ? -3 : 0;
  const pointed = a.coatPattern === "pointed";
  const white = ["bicolor", "calico", "tabbyWhite"].includes(a.coatPattern);
  const base: CharacterPaint = pointed ? "accent" : "coat";
  const forehead = `M${13 - cheek},48 C12,22 33,16 60,19 C87,16 108,22 ${107 + cheek},48`;
  const head = a.furLength === "long"
    ? `${forehead} C111,53 114,55 115,61 Q116,66 108,67 Q119,74 109,79 Q106,82 100,81 Q105,89 95,92 Q90,94 85,91 C76,102 44,102 35,91 Q30,94 25,92 Q15,89 20,81 Q14,82 11,79 Q1,74 12,67 Q4,66 5,61 Q6,55 ${13 - cheek},48Z`
    : `${forehead} C116,79 94,99 60,99 C26,99 4,79 ${13 - cheek},48Z`;
  const body = a.furLength === "long"
    ? `M60,85 Q${65 - width},88 ${60 - width},104 Q${52 - width},111 ${57 - width},117 Q${50 - width},126 ${58 - width},129 Q${55 - width},150 ${70 - width},155 Q60,165 ${50 + width},155 Q${65 + width},150 ${62 + width},129 Q${70 + width},126 ${63 + width},117 Q${68 + width},111 ${60 + width},104 Q${55 + width},88 60,85Z`
    : ellipse(60, 122, width, 37);
  const ears = a.earShape === "folded" ? ["M17,39Q10,11 34,20L43,36Z", "M77,36L86,20Q110,11 103,39Z"]
    : a.earShape === "curled" ? ["M16,41Q0,1 21,9Q28,14 26,20L43,34Z", "M77,34L94,20Q92,14 99,9Q120,1 104,41Z"]
    : ["M15,43L13,5Q16,0 22,6L46,32Z", "M74,32L98,6Q104,0 107,5L105,43Z"];
  const inners = a.earShape === "folded" ? ["M21,26Q25,23 30,26L34,30Q26,29 21,28Z", "M99,26Q95,23 90,26L86,30Q94,29 99,28Z"]
    : a.earShape === "curled" ? ["M18,28Q13,18 18,17Q21,17 21,23L32,32Q24,31 18,28Z", "M102,28Q107,18 102,17Q99,17 99,23L88,32Q96,31 102,28Z"]
    : ["M21,16L24,34L36,30Z", "M99,16L96,34L84,30Z"];
  const tail = a.tail === "short" ? "M86,139Q112,126 106,144Q101,154 86,151Z" : a.tail === "fluffy" ? "M83,141Q106,132 101,111Q94,108 98,100Q93,93 100,89Q115,89 118,103Q122,119 116,136Q109,152 89,155Z" : "M84,143Q111,143 106,113Q105,103 111,102Q119,101 118,116Q120,153 87,154Z";
  const g: CharacterGeometry = {
    tail: [silhouette(tail, pointed ? "accent" : "coat", a, "tail")],
    body: [silhouette(body, "coat", a, "body"), { ...path(`M60,86Q${60 + width},93 ${60 + width},127Q${60 + width},160 60,158Q${77 + width / 3},146 75,123Q73,101 60,86Z`, "shade"), clip: body }],
    backEar: [silhouette(ears[0]!, base, a, "earLeft"), earInner(inners[0]!, ears[0]!)],
    head: [silhouette(ears[1]!, base, a, "earRight"), earInner(inners[1]!, ears[1]!), silhouette(head, base, a, "head"), { ...path("M18,74Q39,100 71,91Q93,87 106,72Q98,99 60,99Q29,99 18,74Z", pointed ? "accent" : "shade"), clip: head }],
    eyes: [], frontPaws: [],
  };
  if (white) {
    g.body.push(marking(ellipse(57, 125, width * 0.64, 27), "white", body));
    g.head.push(marking("M60,34Q54,49 42,64Q29,78 39,88Q60,102 81,88Q91,78 78,64Q66,49 60,34Z", "white", head));
  }
  if (a.coatPattern === "calico") {
    g.head.push(marking("M23,29Q38,17 49,24L47,45Q28,61 17,48Z", "ginger", head), marking("M76,24Q100,23 105,47Q102,62 84,53Z", "black", head));
    g.body.push(marking(ellipse(77, 121, 12, 19), "black", body), marking(ellipse(43, 111, 10, 14), "ginger", body));
  }
  if (a.coatPattern === "tabby" || a.coatPattern === "tabbyWhite") {
    const stripe: CharacterPaint = a.coatPattern === "tabbyWhite" ? "white" : "accent";
    g.head.push(marking("M44,21L51,39L55,21ZM57,20L60,43L65,20ZM70,21L67,39L77,23ZM13,53L30,58L12,62ZM108,53L90,58L109,62ZM16,68L30,69L19,75ZM104,68L90,69L101,75Z", stripe, head));
    g.body.push(marking(`M${60 - width},112L45,116L${60 - width},121ZM${60 + width},127L77,131L${60 + width},136Z`, stripe, body));
    g.tail.push(marking(a.tail === "short" ? "M99,134L104,131L107,141L102,144Z" : "M105,114L118,112L118,119L107,121ZM102,134L115,133L112,141L100,140Z", stripe, tail));
  }
  if (a.faceMark === "blaze") g.head.push(marking("M59,25L53,58L45,72Q60,82 75,72L67,58L62,25Z", "white", head));
  if (a.faceMark === "maskedEyes") g.head.push(marking(ellipse(38, 56, 18, 14), "white", head), marking(ellipse(82, 56, 18, 14), "white", head));
  if (a.faceMark === "whiteMuzzle") g.head.push(marking(ellipse(50, 76, 16, 12), "white", head), marking(ellipse(70, 76, 16, 12), "white", head));
  g.body.push(...contour(body, "coat", a)); g.tail.push(...contour(tail, base, a));
  g.head.push(...contour(head, base, a), ...faceDetails());
  g.eyes = characterEyes(false, smiling);
  g.frontPaws = [silhouette(ellipse(43, 150, 13, 10), pointed ? "accent" : white ? "white" : "coat", a, "paw"), silhouette(ellipse(77, 150, 13, 10), pointed ? "accent" : white ? "white" : "coat", a, "paw"), ...collarPaths(a)];
  return g;
}

export const characterEyeY = (dog: boolean) => dog ? 49 : 55;
export function characterEyes(dog: boolean, smiling: boolean): CharacterPath[] {
  if (smiling) return [line(dog ? "M35,50Q43,40 51,50M69,50Q77,40 85,50" : "M29,57Q38,45 47,57M73,57Q82,45 91,57", "ink", 3)];
  const y = characterEyeY(dog);
  return (dog ? [43, 77] : [38, 82]).flatMap((x, i) => [
    { ...path(dog ? ellipse(x, y, 9, 10) : `M${x - 12},55Q${x},39 ${x + 12},55Q${x},70 ${x - 12},55Z`, i ? "eyeRight" : "eyeLeft"), stroke: "eyeRing" as const, strokeWidth: 1.8 },
    path(ellipse(x, y, dog ? 5.5 : 4.5, 8), "ink"), path(ellipse(x - 2, y - 4, 2.4, 2.7), "highlight"),
  ]);
}
export function faceDetails(dog = false): CharacterPath[] {
  return [path(ellipse(dog ? 29 : 26, dog ? 65 : 72, 7, 4), "blush", 0.55), path(ellipse(dog ? 91 : 94, dog ? 65 : 72, 7, 4), "blush", 0.55),
    path(dog ? "M49,70Q60,64 71,70C75,77 68,83 60,84C52,83 45,77 49,70Z" : "M55,68Q60,66 65,68Q65,71 60,74Q55,71 55,68Z", dog ? "ink" : "nose"),
    line(dog ? "M60,83L60,88Q52,97 45,88M60,88Q68,97 75,88" : "M60,74L60,78Q55,84 51,78M60,78Q65,84 69,78", "ink", 1.7),
    ...(dog ? [] : [line("M8,66L26,69M7,75L25,74M94,69L112,66M95,74L113,75", "ink", 1)]),
  ];
}
export function collarPaths(a: Appearance): CharacterPath[] {
  return a.collar === "none" ? [] : [path("M35,94Q60,105 85,94L83,102Q60,113 37,102Z", "collar"), path(ellipse(60, 108, 5, 6), "bell"), line("M60,108L60,112", "ink", 1)];
}
