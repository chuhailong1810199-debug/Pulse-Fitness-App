/**
 * Ô tạ điền sẵn (clients/{id}/sessionLoads/{day}) lưu THEO VỊ TRÍ:
 * "<clientId>_<day>_<phaseIdx>_<exIdx>". Đổi giáo án mà giữ nguyên các ô đó thì
 * tạ của bài cũ hiện sang bài mới ở cùng vị trí (RDL 45 kg rơi vào ô Incline
 * Press). Hàm này chuyển tạ THEO TÊN BÀI sang bố cục mới: bài còn giữ thì mang
 * tạ theo, bài mới thì để trống. Thuần, không I/O — test được.
 */

const nameKey = (n) => String(n || "").toLowerCase().normalize("NFC").replace(/\s+/g, " ").trim();

/** key vị trí -> { day, name } theo một giáo án. */
function positions(cid, prog) {
  const m = {};
  for (const [day, d] of Object.entries(prog || {})) {
    ((d && d.phases) || []).forEach((ph, pi) => ((ph && ph.exercises) || []).forEach((x, ei) => {
      m[`${cid}_${day}_${pi}_${ei}`] = { day, name: nameKey(x && x.name) };
    }));
  }
  return m;
}

/**
 * @param {string} cid
 * @param {object} oldProg  giáo án cũ (để biết vị trí cũ là bài gì)
 * @param {object} newProg  giáo án mới
 * @param {object} oldDocs  { [day]: { exerciseLoads, setLoads } } — sessionLoads hiện có
 * @returns {{ docs: object, carried: string[] }}  docs: { [day]: { exerciseLoads, setLoads } }
 *   — MỌI vị trí của giáo án mới đều có khoá (null / []) để đè số cũ còn kẹt trên máy.
 */
function remapSessionLoads(cid, oldProg, newProg, oldDocs) {
  const oldPos = positions(cid, oldProg);
  const sameDay = {}, anyDay = {};
  for (const docData of Object.values(oldDocs || {})) {
    const el = (docData && docData.exerciseLoads) || {}, sl = (docData && docData.setLoads) || {};
    for (const k of new Set([...Object.keys(el), ...Object.keys(sl)])) {
      const p = oldPos[k];
      if (!p || !p.name) continue;
      const load = Number(el[k]);
      const sets = Array.isArray(sl[k]) ? sl[k].map((v) => (v == null ? null : Number(v))) : [];
      const hasLoad = Number.isFinite(load) && load > 0;
      if (!hasLoad && !sets.some((v) => Number.isFinite(v) && v > 0)) continue;
      const rec = { load: hasLoad ? load : null, sets };
      sameDay[p.day + "|" + p.name] = rec;          // ưu tiên tạ của chính buổi đó
      if (!anyDay[p.name]) anyDay[p.name] = rec;    // bài chuyển sang buổi khác vẫn mang tạ theo
    }
  }
  const docs = {}, carried = [];
  for (const [day, d] of Object.entries(newProg || {})) {
    const exerciseLoads = {}, setLoads = {};
    ((d && d.phases) || []).forEach((ph, pi) => ((ph && ph.exercises) || []).forEach((x, ei) => {
      const k = `${cid}_${day}_${pi}_${ei}`, n = nameKey(x && x.name);
      const rec = n ? (sameDay[day + "|" + n] || anyDay[n]) : null;
      if (rec) { exerciseLoads[k] = rec.load; setLoads[k] = rec.sets; carried.push(x.name); }
      else { exerciseLoads[k] = null; setLoads[k] = []; }
    }));
    docs[day] = { exerciseLoads, setLoads };
  }
  return { docs, carried };
}

module.exports = { remapSessionLoads, nameKey };
