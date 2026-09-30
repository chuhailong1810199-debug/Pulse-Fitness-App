/**
 * Bộ giải mã FIT tối giản — chỉ lấy đúng hai thứ: nhịp tim và mốc thời gian
 * của từng bản ghi `record` (global message 20).
 *
 * Vì sao tự viết thay vì cài thư viện: cần đúng một trường trong một loại bản
 * ghi. Thư viện FIT đầy đủ kéo theo toàn bộ profile hàng nghìn trường, phình
 * bundle của Cloud Function cho thứ không dùng tới.
 *
 * Vì sao cần file FIT: AccessLink chỉ trả nhịp tim trung bình và cao nhất cho
 * mỗi buổi, còn `continuous-heart-rate` lấy mẫu ~5 phút một lần. Với kiểu tập
 * ngắt quãng (EMOM, circuit) thì trung bình che mất toàn bộ cấu trúc, và mẫu
 * 5 phút bỏ lọt cả đợt gắng sức. File FIT ghi mỗi giây.
 *
 * Định dạng FIT (bản rút gọn):
 *   [header 12 hoặc 14 byte][các bản ghi][CRC 2 byte]
 *   Mỗi bản ghi mở đầu bằng 1 byte header:
 *     bit 7 = 1  -> compressed timestamp header (dữ liệu, local type ở bit 5-6)
 *     bit 6 = 1  -> definition message (mô tả bố cục cho local type ở bit 0-3)
 *     ngược lại  -> data message theo definition đã khai báo
 *   Definition: [reserved][architecture][globalMsgNum u16][numFields]
 *               rồi numFields × [fieldDefNum, size, baseType]
 *               nếu bit 5 của header bật thì có thêm developer fields.
 */

const RECORD_MSG = 20;     // global message number của "record"
const F_TIMESTAMP = 253;   // field: timestamp (u32, giây kể từ 1989-12-31 UTC)
const F_HEART_RATE = 3;    // field: heart_rate (u8, bpm)
const FIT_EPOCH = Date.UTC(1989, 11, 31) / 1000;

// Kích thước theo base type number (5 bit thấp của byte baseType).
const BASE_SIZE = [1, 1, 1, 2, 2, 4, 4, 1, 4, 8, 1, 2, 4, 1, 8, 8, 8];
// Giá trị "không có dữ liệu" theo base type — phải loại, nếu không 255 thành 255bpm.
const INVALID = { 1: 0x7f, 2: 0xff, 131: 0x7fff, 132: 0xffff, 133: 0x7fffffff, 134: 0xffffffff };

/**
 * @param {Buffer} buf nội dung file .fit
 * @returns {{at:number, hr:number}[]} mốc thời gian (giây epoch Unix) và nhịp tim
 */
function parseFitHeartRate(buf) {
  if (!buf || buf.length < 14) return [];
  if (buf.slice(8, 12).toString("ascii") !== ".FIT") return [];

  const headerSize = buf[0];
  const dataSize = buf.readUInt32LE(4);
  let p = headerSize;
  const end = Math.min(headerSize + dataSize, buf.length);

  const defs = {};          // local message type -> bố cục
  const out = [];

  while (p < end) {
    const h = buf[p];

    // Compressed timestamp header: vẫn là data message, local type nằm ở bit 5-6.
    if (h & 0x80) {
      const local = (h >> 5) & 0x03;
      p += 1;
      p = readData(buf, p, defs[local], out, null);
      if (p < 0) return out;
      continue;
    }

    if (h & 0x40) {          // definition message
      const local = h & 0x0f;
      const hasDev = !!(h & 0x20);
      p += 1;
      if (p + 5 > end) break;
      const arch = buf[p + 1];
      const little = arch === 0;
      const globalNum = little ? buf.readUInt16LE(p + 2) : buf.readUInt16BE(p + 2);
      const numFields = buf[p + 4];
      p += 5;

      const fields = [];
      let size = 0;
      for (let i = 0; i < numFields; i++) {
        if (p + 3 > end) return out;
        const def = { num: buf[p], size: buf[p + 1], base: buf[p + 2], offset: size };
        size += def.size;
        fields.push(def);
        p += 3;
      }
      if (hasDev) {
        if (p >= end) return out;
        const nDev = buf[p]; p += 1;
        for (let i = 0; i < nDev; i++) {
          if (p + 3 > end) return out;
          size += buf[p + 1];
          p += 3;
        }
      }
      defs[local] = { globalNum, fields, size, little };
      continue;
    }

    // data message thường
    const local = h & 0x0f;
    p += 1;
    p = readData(buf, p, defs[local], out, end);
    if (p < 0) return out;
  }
  return out;
}

function readData(buf, p, def, out, end) {
  if (!def) return -1;                       // gặp data trước definition: bỏ phần còn lại
  if (p + def.size > buf.length) return -1;
  if (def.globalNum === RECORD_MSG) {
    let hr = null, ts = null;
    for (const f of def.fields) {
      const at = p + f.offset;
      if (f.num === F_HEART_RATE) {
        const v = buf[at];
        if (v !== INVALID[2] && v > 0) hr = v;
      } else if (f.num === F_TIMESTAMP && f.size >= 4) {
        const v = def.little ? buf.readUInt32LE(at) : buf.readUInt32BE(at);
        if (v !== INVALID[134]) ts = v + FIT_EPOCH;
      }
    }
    if (hr != null) out.push({ at: ts, hr });
  }
  return p + def.size;
}

module.exports = { parseFitHeartRate };
