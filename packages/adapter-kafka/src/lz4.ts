/**
 * Minimal pure-JS LZ4 (frame) decompressor so dsui can browse Kafka topics
 * whose messages are LZ4-compressed. The bundled kafkajs build disables
 * LZ4/Snappy/ZSTD codecs (they throw "not implemented"), so we patch the
 * codec at adapter load time with this implementation.
 *
 * Kafka uses the LZ4 framing format but historically omits the standard
 * 7-byte frame header; we prepend a synthetic header (matching kafkajs'
 * convention) when the magic number is absent.
 */

const LZ4_MAGIC = 0x184d2204;

function decompressBlock(src: Uint8Array, out: number[]): void {
  let sp = 0;
  const n = src.length;
  while (sp < n) {
    const token = src[sp++];
    let litLen = token >> 4;
    if (litLen === 15) {
      let b = src[sp++];
      while (b === 255) {
        litLen += 255;
        b = src[sp++];
      }
      litLen += b;
    }
    for (let i = 0; i < litLen; i++) out.push(src[sp++]);
    if (sp >= n) break;
    const offset = src[sp] | (src[sp + 1] << 8);
    sp += 2;
    let matchLen = token & 0x0f;
    if (matchLen === 15) {
      let b = src[sp++];
      while (b === 255) {
        matchLen += 255;
        b = src[sp++];
      }
      matchLen += b;
    }
    matchLen += 4;
    let start = out.length - offset;
    for (let i = 0; i < matchLen; i++) out.push(out[start++]);
  }
}

function parseFrame(buf: Buffer): Buffer {
  let pos = 4; // skip magic
  const flg = buf[pos++];
  const bd = buf[pos++];
  pos++; // header checksum
  const blockIndep = (flg >> 5) & 1;
  void blockIndep;
  const blockChecksum = (flg >> 4) & 1;
  const contentSizeFlag = (flg >> 3) & 1;
  const contentChecksum = (flg >> 2) & 1;
  const dictIdFlag = flg & 0x3;
  if (contentSizeFlag) pos += 8;
  if (dictIdFlag === 1) pos += 4;
  const out: number[] = [];
  while (pos + 4 <= buf.length) {
    const blockSize = buf.readUInt32LE(pos);
    pos += 4;
    if (blockSize === 0) break; // end mark
    const uncompressed = (blockSize & 0x80000000) !== 0;
    const size = blockSize & 0x7fffffff;
    const block = buf.subarray(pos, pos + size);
    pos += size;
    if (blockChecksum) pos += 4;
    if (uncompressed) {
      for (let i = 0; i < block.length; i++) out.push(block[i]);
    } else {
      decompressBlock(block, out);
    }
  }
  void bd;
  void contentChecksum;
  return Buffer.from(out);
}

export function lz4Decompress(input: Buffer): Buffer {
  if (input.length >= 4 && input.readUInt32LE(0) === LZ4_MAGIC) {
    return parseFrame(input);
  }
  const header = Buffer.from([0x04, 0x22, 0x4d, 0x18, 0x64, 0x70, 0x6d]);
  return parseFrame(Buffer.concat([header, input]));
}
