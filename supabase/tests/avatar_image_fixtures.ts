import { deflateSync } from "node:zlib";
export const joinBytes = (...parts: Uint8Array[]) => new Uint8Array(Buffer.concat(parts));
export const ascii = (value: string) => new Uint8Array(Buffer.from(value));
export function pngChunk(kind: string, bytes = new Uint8Array()) {
  const output = Buffer.alloc(bytes.length + 12); output.writeUInt32BE(bytes.length); output.write(kind, 4); output.set(bytes, 8);
  let crc = 0xffffffff;
  for (let at = 4; at < output.length - 4; at++) {
    crc ^= output[at]!;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ crc >>> 1 : crc >>> 1;
  }
  output.writeUInt32BE((crc ^ 0xffffffff) >>> 0, output.length - 4); return new Uint8Array(output);
}
export const pngSignature = new Uint8Array([137,80,78,71,13,10,26,10]);
export function pngFixture(extra: Uint8Array[] = [], indexed = false) {
  const header = Buffer.alloc(13); header.writeUInt32BE(1,0); header.writeUInt32BE(1,4); header[8] = 8; header[9] = indexed ? 3 : 6;
  const chunks = [pngChunk("IHDR",header), ...(indexed ? [pngChunk("PLTE",new Uint8Array([255,0,0,0,0,255])),pngChunk("tRNS",new Uint8Array([255,128]))] : []),
    ...extra, pngChunk("IDAT",deflateSync(new Uint8Array(indexed ? [0,0] : [0,255,0,0,255]))),pngChunk("IEND")];
  return joinBytes(pngSignature,...chunks);
}
export function jpegSegment(marker: number, payload: Uint8Array) {
  const bytes = Buffer.alloc(payload.length + 4); bytes.set([255,marker]); bytes.writeUInt16BE(payload.length + 2,2); bytes.set(payload,4); return new Uint8Array(bytes);
}
export const jpegScan = new Uint8Array([3,255,0,4,255,208,5]);
export function jpegFixture(extra: Uint8Array[] = [], between: Uint8Array[] = []) {
  const scanHeader = jpegSegment(0xda,new Uint8Array([1,1,0,0,63,0]));
  return joinBytes(new Uint8Array([255,216]),jpegSegment(0xe0,ascii("JFIF\0")),...extra,
    jpegSegment(0xc0,new Uint8Array([8,0,1,0,1,1,1,17,0])),jpegSegment(0xdb,new Uint8Array([0,...Array(64).fill(1)])),
    scanHeader,jpegScan,...(between.length ? [...between,scanHeader,jpegScan] : []),new Uint8Array([255,217]));
}
export function webpChunk(kind: string, bytes: Uint8Array) {
  const chunk = Buffer.alloc(8 + bytes.length + (bytes.length & 1)); chunk.write(kind,0); chunk.writeUInt32LE(bytes.length,4); chunk.set(bytes,8); return new Uint8Array(chunk);
}
export function webpFixture(chunks: Uint8Array[]) {
  const bytes = Buffer.from(joinBytes(ascii("RIFF"),new Uint8Array(4),ascii("WEBP"),...chunks)); bytes.writeUInt32LE(bytes.length - 8,4); return new Uint8Array(bytes);
}
export const vp8Pixels = new Uint8Array([0,0,0,0x9d,1,0x2a,1,0,1,0]);
export const vp8lPixels = new Uint8Array([0x2f,0,0,0,0,1]);
