import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { AvatarError } from "../functions/generate-pet-avatar/contract.ts";
import { stripImageMetadata } from "../functions/generate-pet-avatar/imageMetadata.ts";
import { ascii, joinBytes, jpegFixture, jpegScan, jpegSegment, pngChunk, pngFixture, pngSignature, vp8Pixels, vp8lPixels, webpChunk, webpFixture } from "./avatar_image_fixtures.ts";
const invalid = (bytes: Uint8Array, type: "image/jpeg" | "image/png" | "image/webp") => assert.throws(() => stripImageMetadata(bytes,type), (error: unknown) => error instanceof AvatarError && error.code === "avatar_image_invalid");
const verify = (bytes: Uint8Array, type: "image/jpeg" | "image/png" | "image/webp", expected: Uint8Array, imageEnd = bytes.length) => {
  const original = bytes.slice(), cleaned = stripImageMetadata(bytes,type);
  assert.deepEqual(bytes,original,"source bytes remain immutable"); assert.deepEqual(cleaned.bytes,expected,"retained image bytes remain identical");
  assert.deepEqual(stripImageMetadata(cleaned.bytes,type),{bytes:expected,removed:{}},"metadata-free input is stable and idempotent");
  for (let cut = 0; cut < imageEnd; cut++) invalid(bytes.slice(0,cut),type);
  return cleaned;
};
const metadata = ascii("unit-only metadata sentinel; no private user data");
const iccPart1 = jpegSegment(0xe2,joinBytes(ascii("ICC_PROFILE\0"),new Uint8Array([1,2]),ascii("opaque color profile part one")));
const iccPart2 = jpegSegment(0xe2,joinBytes(ascii("ICC_PROFILE\0"),new Uint8Array([2,2]),ascii("opaque color profile part two")));
const adobe = jpegSegment(0xee,joinBytes(ascii("Adobe"),new Uint8Array([0,100,0,0,0,0,1])));
const jpegExtras = [...Array.from({length:15},(_,i)=>i===1 ? iccPart1 : i===13 ? adobe : jpegSegment(0xe1+i,metadata)),jpegSegment(0xfe,metadata)];
const jpeg = jpegFixture(jpegExtras,[jpegSegment(0xe1,metadata),iccPart2,jpegSegment(0xfe,metadata)]);
const jpegClean = verify(jpeg,"image/jpeg",jpegFixture([iccPart1,adobe],[iccPart2]));
assert.deepEqual(Object.keys(jpegClean.removed),[...Array.from({length:15},(_,i)=>i+1).filter(n=>n!==2&&n!==14).map(n=>`JPEG_APP${n}`),"JPEG_COM"]);
assert.equal(jpegClean.removed.JPEG_APP1?.segments,2);
assert.equal(jpegClean.removed.JPEG_COM?.segments,2);
assert.equal(Object.values(jpegClean.removed).reduce((sum,entry)=>sum+entry.bytes,0),jpeg.length-jpegClean.bytes.length,"only removed segments are counted");
verify(jpegFixture([iccPart1,adobe]),"image/jpeg",jpegFixture([iccPart1,adobe]));
assert.equal(Buffer.from(jpegClean.bytes).includes(Buffer.from(jpegScan)),true,"entropy stuffing/restart bytes retained");
invalid(new Uint8Array([255,216,255,225,0,1,255,217]),"image/jpeg");
invalid(jpeg.slice(0,-2),"image/jpeg");
invalid(joinBytes(jpeg.slice(0,-2),jpeg),"image/jpeg");

const textKinds = ["tEXt","zTXt","iTXt","eXIf"];
for (const indexed of [false,true]) {
  const input = pngFixture(textKinds.map(kind=>pngChunk(kind,metadata)),indexed);
  const clean = verify(input,"image/png",pngFixture([],indexed));
  assert.deepEqual(Object.keys(clean.removed),textKinds.map(kind=>`PNG_${kind}`));
}
const gamma = Buffer.alloc(4); gamma.writeUInt32BE(45455);
const chromaticities = Buffer.alloc(32);
[31270,32900,64000,33000,30000,60000,15000,6000].forEach((value,i)=>chromaticities.writeUInt32BE(value,i*4));
const colorProfiles = [pngChunk("iCCP",joinBytes(ascii("unit-color-profile\0\0"),deflateSync(ascii("opaque ICC color profile")))),pngChunk("sRGB",new Uint8Array([0]))];
for (const indexed of [false,true]) for (const profile of colorProfiles) {
  const colorChunks = [pngChunk("gAMA",gamma),pngChunk("cHRM",chromaticities),profile];
  const source = pngFixture([...colorChunks,...textKinds.map(kind=>pngChunk(kind,metadata))],indexed);
  const result = verify(source,"image/png",pngFixture(colorChunks,indexed));
  assert.deepEqual(Object.keys(result.removed),textKinds.map(kind=>`PNG_${kind}`),"color chunks are never counted as removed");
  assert.equal(Object.values(result.removed).reduce((sum,entry)=>sum+entry.bytes,0),source.length-result.bytes.length);
  verify(pngFixture(colorChunks,indexed),"image/png",pngFixture(colorChunks,indexed));
}
const png = pngFixture([pngChunk("tEXt",metadata)]);
const badCrc = png.slice(); badCrc[badCrc.length-1] ^= 1; invalid(badCrc,"image/png");
const textAt = 8 + 25, badMetadataCrc = png.slice(); badMetadataCrc[textAt+8] ^= 1; invalid(badMetadataCrc,"image/png");
invalid(png.slice(0,-12),"image/png");
invalid(joinBytes(pngSignature,pngChunk("IEND")),"image/png");
invalid(pngFixture([pngChunk("ABCD",metadata)]),"image/png");

const header = new Uint8Array([0x1c,0,0,0,0,0,0,0,0,0]);
const cleanHeader = header.slice(); cleanHeader[0] &= ~0x0c;
const pixelChunks = [webpChunk("ALPH",new Uint8Array([0,255])),webpChunk("VP8 ",vp8Pixels)];
const input = webpFixture([webpChunk("VP8X",header),webpChunk("EXIF",metadata),...pixelChunks,webpChunk("XMP ",ascii("odd")),webpChunk("EXIF",ascii("two"))]);
const clean = verify(input,"image/webp",webpFixture([webpChunk("VP8X",cleanHeader),...pixelChunks]));
assert.equal(clean.removed.WEBP_EXIF?.segments,2); assert.equal(clean.bytes[20],0x10,"alpha bit remains after EXIF/XMP bits clear");
verify(webpFixture([webpChunk("VP8L",vp8lPixels)]),"image/webp",webpFixture([webpChunk("VP8L",vp8lPixels)]));
const animationHeader = new Uint8Array([0x1e,0,0,0,0,0,0,0,0,0]);
const cleanAnimationHeader = animationHeader.slice(); cleanAnimationHeader[0] &= ~0x0c;
const frame = webpChunk("ANMF",joinBytes(new Uint8Array(16),...pixelChunks)), animation = webpChunk("ANIM",new Uint8Array(6));
verify(webpFixture([webpChunk("VP8X",animationHeader),animation,frame,webpChunk("EXIF",metadata)]),"image/webp",webpFixture([webpChunk("VP8X",cleanAnimationHeader),animation,frame]));
const iccChunk = webpChunk("ICCP",ascii("opaque ICC profile, odd size"));
for (const present of [false,true]) for (const flagSet of [false,true]) {
  const flags = header.slice(); flags[0] = 0x1c | (flagSet ? 0x20 : 0);
  const expectedFlags = flags.slice(); expectedFlags[0] = 0x10 | (present ? 0x20 : 0);
  const profiles = present ? [iccChunk] : [];
  const source = webpFixture([webpChunk("VP8X",flags),...profiles,...pixelChunks,webpChunk("EXIF",metadata),webpChunk("XMP ",ascii("odd"))]);
  const result = verify(source,"image/webp",webpFixture([webpChunk("VP8X",expectedFlags),...profiles,...pixelChunks]));
  assert.equal(result.bytes[20],expectedFlags[0],"ICC flag matches retained ICCP; alpha remains");
  assert.deepEqual(Object.keys(result.removed),["WEBP_EXIF","WEBP_XMP"]);
  assert.equal(Object.values(result.removed).reduce((sum,entry)=>sum+entry.bytes,0),source.length-result.bytes.length);
  const profileOnlySource = webpFixture([webpChunk("VP8X",flags),...profiles,...pixelChunks]);
  const profileOnlyResult = verify(profileOnlySource,"image/webp",webpFixture([webpChunk("VP8X",expectedFlags),...profiles,...pixelChunks]));
  assert.deepEqual(profileOnlyResult.removed,{},"repairing a color flag does not report metadata removal");
}
for (const flagSet of [false,true]) {
  const flags = animationHeader.slice(); flags[0] = 0x1e | (flagSet ? 0x20 : 0);
  const expectedFlags = flags.slice(); expectedFlags[0] = 0x32;
  verify(webpFixture([webpChunk("VP8X",flags),iccChunk,animation,frame,webpChunk("EXIF",metadata)]),"image/webp",webpFixture([webpChunk("VP8X",expectedFlags),iccChunk,animation,frame]));
}
const wrongRiff = input.slice(); wrongRiff[4] ^= 1; invalid(wrongRiff,"image/webp");
const badPad = input.slice(); badPad[badPad.length-1] = 1; invalid(badPad,"image/webp");
invalid(webpFixture([webpChunk("VP8X",new Uint8Array(9)),...pixelChunks]),"image/webp");
invalid(webpFixture([webpChunk("VP8 ",new Uint8Array(10))]),"image/webp");
invalid(webpFixture([webpChunk("EXIF",metadata)]),"image/webp");
// Drop only bytes after the first valid image boundary, including a second complete image.
for (const [type,base,expected,kind] of [
  ["image/jpeg",jpeg,jpegClean.bytes,"JPEG_TRAILER"],
  ["image/png",png,pngFixture(),"PNG_TRAILER"],
  ["image/webp",input,clean.bytes,"WEBP_TRAILER"],
] as const) {
  for (const trailer of [new Uint8Array(4),ascii("SEFHxxxxSEFT"),base]) {
    const source = joinBytes(base,trailer);
    const result = verify(source,type,expected,base.length);
    assert.deepEqual(result.removed[kind],{segments:1,bytes:trailer.length});
    assert.equal(Object.values(result.removed).reduce((sum,entry)=>sum+entry.bytes,0),source.length-result.bytes.length,"trailer totals count only discarded bytes");
    // Every partial trailer is accepted once a complete image is already present.
    for (let length = 0; length < trailer.length; length++) {
      const partial = stripImageMetadata(joinBytes(base,trailer.slice(0,length)),type);
      assert.deepEqual(partial.bytes,expected);
      assert.deepEqual(partial.removed[kind],length ? {segments:1,bytes:length} : undefined);
    }
  }
}
// EOI-like bytes inside a retained APP2 payload or stuffed/restart scan data are not terminators.
const eoiLikeProfile = jpegSegment(0xe2,joinBytes(ascii("ICC_PROFILE\0"),new Uint8Array([1,1,255,217,1])));
const scanBase = jpegFixture([eoiLikeProfile]), scanAt = Buffer.from(scanBase).indexOf(Buffer.from(jpegScan));
assert.ok(scanAt>=0);
const eoiLikeScan = new Uint8Array([3,255,0,217,4,255,208,217,5]);
const eoiLikeJpeg = joinBytes(scanBase.subarray(0,scanAt),eoiLikeScan,scanBase.subarray(scanAt+jpegScan.length));
const eoiLikeResult = verify(joinBytes(eoiLikeJpeg,ascii("SEFHxxxxSEFT")),"image/jpeg",eoiLikeJpeg,eoiLikeJpeg.length);
assert.deepEqual(eoiLikeResult.removed,{JPEG_TRAILER:{segments:1,bytes:12}});
const pngPostIend = joinBytes(png,pngChunk("iTXt",ascii("post-IEND private text")));
assert.deepEqual(verify(pngPostIend,"image/png",pngFixture(),png.length).removed.PNG_TRAILER,{segments:1,bytes:pngPostIend.length-png.length});
const webpOutsideRiff = joinBytes(input,webpChunk("EXIF",metadata));
assert.deepEqual(verify(webpOutsideRiff,"image/webp",clean.bytes,input.length).removed.WEBP_TRAILER,{segments:1,bytes:webpOutsideRiff.length-input.length});
// Bytes outside RIFF cannot repair a chunk/header truncated inside its declared boundary.
const internalTruncation = input.slice(); new DataView(internalTruncation.buffer).setUint32(4,input.length-9,true); invalid(internalTruncation,"image/webp");
const tinyRiff = input.slice(); new DataView(tinyRiff.buffer).setUint32(4,3,true); invalid(tinyRiff,"image/webp");
const missingPixels = webpFixture([webpChunk("VP8X",header)]); invalid(joinBytes(missingPixels,webpFixture(pixelChunks)),"image/webp");
console.log("Image metadata: JPEG APP2/APP14 and PNG/WebP color profiles retained; private metadata/trailers removed at first image boundary; ICC flags, alpha/animation, pixel bytes, immutability, idempotency and malformed regressions verified.");
export default Promise.resolve();
