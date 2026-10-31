import { AvatarError, type ImageType } from "./contract.ts";

type Removed = Record<string, { segments: number; bytes: number }>;
const invalid = (): never => { throw new AvatarError("avatar_image_invalid"); };
const tag = (bytes: Uint8Array, at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));
const view = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
function outputFor(bytes: Uint8Array) {
  const output = new Uint8Array(bytes.length), removed: Removed = {};
  let written = 0;
  return {
    keep(start: number, end: number) { output.set(bytes.subarray(start, end), written); written += end - start; },
    drop(kind: string, count: number) { const old = removed[kind] ?? { segments: 0, bytes: 0 }; removed[kind] = { segments: old.segments + 1, bytes: old.bytes + count }; },
    finish() { return { bytes: output.slice(0, written), removed }; },
  };
}

function jpeg(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) invalid();
  const out = outputFor(bytes), data = view(bytes);
  out.keep(0, 2);
  let at = 2, sawFrame = false, sawScan = false;
  while (at < bytes.length) {
    const start = at;
    if (bytes[at++] !== 0xff) invalid();
    while (bytes[at] === 0xff) at++;
    if (at >= bytes.length) invalid();
    const marker = bytes[at++]!;
    if (marker === 0xd9) {
      if (!sawFrame || !sawScan) invalid();
      out.keep(start, at);
      if (at < bytes.length) out.drop("JPEG_TRAILER", bytes.length - at);
      return out.finish();
    }
    if (marker === 0x01) { out.keep(start, at); continue; }
    if (marker < 0xc0 || marker === 0xd8 || marker >= 0xd0 && marker <= 0xd7 || at + 2 > bytes.length) invalid();
    const length = data.getUint16(at), end = at + length;
    if (length < 2 || end > bytes.length) invalid();
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      const components = bytes[at + 7] ?? 0;
      if (length !== 8 + 3 * components || !components || data.getUint16(at + 3) === 0 || data.getUint16(at + 5) === 0) invalid();
      sawFrame = true;
    }
    if (marker >= 0xe1 && marker <= 0xef && marker !== 0xe2 && marker !== 0xee || marker === 0xfe) out.drop(marker === 0xfe ? "JPEG_COM" : `JPEG_APP${marker - 0xe0}`, end - start);
    else out.keep(start, end);
    at = end;
    if (marker !== 0xda) continue;
    if (!sawFrame || length < 6 || length !== 6 + 2 * (bytes[end - length + 2] ?? 0)) invalid();
    sawScan = true;
    const scanStart = at;
    // Stuffed FF00 and restart markers belong to compressed pixels, including progressive scans.
    while (at < bytes.length) {
      if (bytes[at] !== 0xff) { at++; continue; }
      let code = at + 1;
      while (bytes[code] === 0xff) code++;
      if (code >= bytes.length) invalid();
      if (bytes[code] === 0 || bytes[code]! >= 0xd0 && bytes[code]! <= 0xd7) { at = code + 1; continue; }
      break;
    }
    out.keep(scanStart, at);
  }
  return invalid();
}

const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  let value = n;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ value >>> 1 : value >>> 1;
  return value >>> 0;
});
function crc32(bytes: Uint8Array, start: number, end: number) {
  let value = 0xffffffff;
  for (let at = start; at < end; at++) value = crcTable[(value ^ bytes[at]!) & 255]! ^ value >>> 8;
  return (value ^ 0xffffffff) >>> 0;
}
function png(bytes: Uint8Array) {
  if (bytes.length < 8 || ![137,80,78,71,13,10,26,10].every((n, i) => bytes[i] === n)) invalid();
  const out = outputFor(bytes), data = view(bytes);
  out.keep(0, 8);
  let at = 8, sawHeader = false, sawData = false, dataEnded = false, dataBytes = 0, palette = false, color = -1;
  while (at < bytes.length) {
    if (at + 12 > bytes.length) invalid();
    const size = data.getUint32(at), end = at + size + 12, kind = tag(bytes, at + 4);
    if (size > 0x7fffffff || end > bytes.length || !/^[A-Za-z]{2}[A-Z][A-Za-z]$/.test(kind) || crc32(bytes, at + 4, end - 4) !== data.getUint32(end - 4)) invalid();
    if (!sawHeader && kind !== "IHDR") invalid();
    if (kind === "IHDR") {
      if (sawHeader || size !== 13 || !data.getUint32(at + 8) || !data.getUint32(at + 12)) invalid();
      const depth = bytes[at + 16]!, allowed: Record<number, number[]> = { 0: [1,2,4,8,16], 2: [8,16], 3: [1,2,4,8], 4: [8,16], 6: [8,16] };
      color = bytes[at + 17]!;
      if (!allowed[color]?.includes(depth) || bytes[at + 18] !== 0 || bytes[at + 19] !== 0 || bytes[at + 20]! > 1) invalid();
      sawHeader = true;
    } else if (kind === "PLTE") {
      if (palette || sawData || size === 0 || size % 3 !== 0 || size > 768 || color === 0 || color === 4) invalid();
      palette = true;
    } else if (kind === "IDAT") {
      if (dataEnded || color === 3 && !palette) invalid();
      sawData = true; dataBytes += size;
    } else if (kind === "IEND") {
      if (!sawData || !dataBytes || size !== 0) invalid();
      out.keep(at, end);
      if (end < bytes.length) out.drop("PNG_TRAILER", bytes.length - end);
      return out.finish();
    } else {
      if (kind[0] === kind[0]!.toUpperCase()) invalid();
      if (sawData) dataEnded = true;
    }
    if (["tEXt", "zTXt", "iTXt", "eXIf"].includes(kind)) out.drop(`PNG_${kind}`, end - at);
    else out.keep(at, end);
    at = end;
  }
  return invalid();
}

function webp(bytes: Uint8Array) {
  if (bytes.length < 12 || tag(bytes, 0) !== "RIFF" || tag(bytes, 8) !== "WEBP") invalid();
  const data = view(bytes), out = outputFor(bytes);
  const riffEnd = data.getUint32(4, true) + 8;
  if (riffEnd < 12 || riffEnd > bytes.length) invalid();
  out.keep(0, 12);
  let at = 12, image = false, extendedAt = -1, animated = false, animationHeader = false, iccProfile = false;
  function checkImage(kind: string, start: number, size: number) {
    if (kind === "VP8 ") {
      if (size < 10 || bytes[start]! & 1 || bytes[start + 3] !== 0x9d || bytes[start + 4] !== 1 || bytes[start + 5] !== 0x2a
        || !(data.getUint16(start + 6, true) & 0x3fff) || !(data.getUint16(start + 8, true) & 0x3fff)) invalid();
    } else if (size < 5 || bytes[start] !== 0x2f || bytes[start + 4]! & 0xe0) invalid();
  }
  while (at < riffEnd) {
    if (at + 8 > riffEnd) invalid();
    const kind = tag(bytes, at), size = data.getUint32(at + 4, true), end = at + 8 + size, padded = end + (size & 1);
    if (!/^[\x20-\x7e]{4}$/.test(kind) || padded > riffEnd || size & 1 && bytes[end] !== 0) invalid();
    if (kind === "VP8X") {
      if (at !== 12 || extendedAt >= 0 || size !== 10 || bytes[at + 8]! & 0xc1 || bytes.subarray(at + 9, at + 12).some(n => n !== 0)) invalid();
      extendedAt = at + 8; animated = !!(bytes[at + 8]! & 2);
    } else if (kind === "ICCP") {
      iccProfile = true;
    } else if (kind === "VP8 " || kind === "VP8L") {
      if (image || animated) invalid();
      checkImage(kind, at + 8, size); image = true;
    } else if (kind === "ANIM") {
      if (!animated || animationHeader || size !== 6) invalid();
      animationHeader = true;
    } else if (kind === "ANMF") {
      if (!animationHeader || size < 16 || bytes[at + 23]! & 0xfc) invalid();
      let sub = at + 24, frameImage = false;
      while (sub < end) {
        if (sub + 8 > end) invalid();
        const child = tag(bytes, sub), childSize = data.getUint32(sub + 4, true), childEnd = sub + 8 + childSize, childPadded = childEnd + (childSize & 1);
        if (childPadded > end || childSize & 1 && bytes[childEnd] !== 0 || !["ALPH", "VP8 ", "VP8L"].includes(child)) invalid();
        if (child !== "ALPH") { if (frameImage) invalid(); checkImage(child, sub + 8, childSize); frameImage = true; }
        sub = childPadded;
      }
      if (!frameImage) invalid();
      image = true;
    }
    if (kind === "EXIF" || kind === "XMP ") out.drop(`WEBP_${kind.trim()}`, padded - at);
    else out.keep(at, padded);
    at = padded;
  }
  if (!image) invalid();
  if (riffEnd < bytes.length) out.drop("WEBP_TRAILER", bytes.length - riffEnd);
  const cleaned = out.finish();
  view(cleaned.bytes).setUint32(4, cleaned.bytes.length - 8, true);
  if (extendedAt >= 0) cleaned.bytes[extendedAt] = (cleaned.bytes[extendedAt]! & ~0x2c) | (iccProfile ? 0x20 : 0);
  return cleaned;
}

/** Rewrites only container metadata; compressed image data remains byte-for-byte intact. */
export function stripImageMetadata(bytes: Uint8Array, mediaType: ImageType) {
  try { return mediaType === "image/jpeg" ? jpeg(bytes) : mediaType === "image/png" ? png(bytes) : webp(bytes); }
  catch (error) { if (error instanceof AvatarError) throw error; return invalid(); }
}
