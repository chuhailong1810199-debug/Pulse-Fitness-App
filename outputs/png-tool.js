#!/usr/bin/env node
/**
 * Giải mã / mã hoá PNG tối giản, đủ để đổi màu logo mà không cần thư viện ngoài.
 * Máy này không có rsvg, inkscape hay ImageMagick, và Quick Look thì chèn lề
 * trắng — nên tự làm là đường ngắn nhất và kiểm chứng được.
 *
 * Chỉ hỗ trợ bit depth 8, colorType 2 (RGB) và 6 (RGBA). Xuất luôn ra RGBA.
 */
const zlib = require("zlib");

function decode(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("khong phai PNG");
  let p = 8, W = 0, H = 0, bd = 0, ct = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.slice(p + 4, p + 8).toString("ascii");
    const d = buf.slice(p + 8, p + 8 + len);
    if (type === "IHDR") { W = d.readUInt32BE(0); H = d.readUInt32BE(4); bd = d[8]; ct = d[9]; }
    else if (type === "IDAT") idat.push(d);
    else if (type === "IEND") break;
    p += 12 + len;
  }
  if (bd !== 8 || (ct !== 2 && ct !== 6)) throw new Error(`chua ho tro bitDepth ${bd} colorType ${ct}`);

  const ch = ct === 6 ? 4 : 3, stride = W * ch;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const img = Buffer.alloc(H * stride);
  let o = 0;
  for (let y = 0; y < H; y++) {
    const f = raw[o++], line = raw.slice(o, o + stride); o += stride;
    const cur = img.slice(y * stride, (y + 1) * stride);
    const prev = y > 0 ? img.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0;
      let v = line[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[i] = v & 255;
    }
  }
  // chuẩn hoá về RGBA cho mọi bước sau
  const out = Buffer.alloc(W * H * 4);
  for (let i = 0, j = 0; i < W * H; i++, j += ch) {
    out[i * 4] = img[j]; out[i * 4 + 1] = img[j + 1]; out[i * 4 + 2] = img[j + 2];
    out[i * 4 + 3] = ch === 4 ? img[j + 3] : 255;
  }
  return { W, H, px: out };
}

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c; }
  return (b) => { let c = -1;
    for (let i = 0; i < b.length; i++) c = t[(c ^ b[i]) & 255] ^ (c >>> 8);
    return (c ^ -1) >>> 0; };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(CRC(td));
  return Buffer.concat([len, td, crc]);
}

/** Mã hoá RGBA (colorType 6). Lọc theo kiểu 0 — ảnh nhỏ, nén vẫn tốt. */
function encode(W, H, px) {
  const stride = W * 4;
  const raw = Buffer.alloc(H * (stride + 1));
  for (let y = 0; y < H; y++) {
    raw[y * (stride + 1)] = 0;
    px.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Thu nhỏ bằng lấy trung bình vùng — nét mảnh không bị đứt như lấy mẫu điểm. */
function resize(W, H, px, w, h) {
  const out = Buffer.alloc(w * h * 4);
  const sx = W / w, sy = H / h;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = y0; yy < y1 && yy < H; yy++) {
        for (let xx = x0; xx < x1 && xx < W; xx++) {
          const i = (yy * W + xx) * 4, al = px[i + 3] / 255;
          // trộn theo alpha, nếu không viền sẽ bị kéo màu nền vào
          r += px[i] * al; g += px[i + 1] * al; b += px[i + 2] * al; a += px[i + 3]; n++;
        }
      }
      const j = (y * w + x) * 4, aa = a / n;
      const k = aa > 0 ? 255 / aa : 0;
      out[j] = Math.min(255, Math.round(r / n * k));
      out[j + 1] = Math.min(255, Math.round(g / n * k));
      out[j + 2] = Math.min(255, Math.round(b / n * k));
      out[j + 3] = Math.round(aa);
    }
  }
  return out;
}

module.exports = { decode, encode, resize };
