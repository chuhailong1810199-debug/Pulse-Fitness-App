/**
 * MIGRATION: Rename day keys (Mon/Wed/Fri) → SessionA/SessionB/SessionC
 *
 * HOW TO RUN:
 * 1. Mở app trên browser (đã đăng nhập với coach account)
 * 2. Mở DevTools Console (F12 hoặc Cmd+Option+J)
 * 3. Paste toàn bộ script này vào console và nhấn Enter
 * 4. Đợi log "✅ Migration complete!" rồi hard reload app
 */

(async () => {
  const DAY_ORDER = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const db = firebase.firestore();

  console.log('🚀 Starting migration: day keys → SessionA/B/C...');

  const clientsSnap = await db.collection('clients').get();

  for (const clientDoc of clientsSnap.docs) {
    const clientData = clientDoc.data();
    const program = clientData.program || {};

    // Only migrate old-style day keys
    const oldDays = DAY_ORDER.filter(d => program[d]);
    if (oldDays.length === 0) {
      console.log(`⏭️  ${clientDoc.id}: already migrated or no program`);
      continue;
    }

    // Build mapping: Mon→SessionA, Wed→SessionB, Fri→SessionC etc.
    const dayMap = {};
    oldDays.forEach((day, i) => { dayMap[day] = `Session${String.fromCharCode(65 + i)}`; });
    console.log(`📋 ${clientDoc.id}:`, dayMap);

    // ── 1. Rename program keys ──────────────────────────────
    const newProgram = {};
    for (const [old, newKey] of Object.entries(dayMap)) newProgram[newKey] = program[old];
    // Keep any non-day keys (e.g. already-migrated Session* keys)
    for (const [k, v] of Object.entries(program)) {
      if (!DAY_ORDER.includes(k)) newProgram[k] = v;
    }

    // ── 2. Migrate sessionLoads ─────────────────────────────
    const slRef = db.collection('clients').doc(clientDoc.id).collection('sessionLoads');
    const slSnap = await slRef.get();
    for (const slDoc of slSnap.docs) {
      const newKey = dayMap[slDoc.id];
      if (!newKey) continue; // skip already-migrated docs
      const slData = slDoc.data();

      // Remap exerciseLoad + setLoad keys: clientId_Mon_0_0 → clientId_SessionA_0_0
      const remapKeys = (obj) => {
        const out = {};
        for (const [k, v] of Object.entries(obj || {})) {
          out[k.replace(`_${slDoc.id}_`, `_${newKey}_`)] = v;
        }
        return out;
      };

      await slRef.doc(newKey).set({
        ...slData,
        exerciseLoads: remapKeys(slData.exerciseLoads),
        setLoads: remapKeys(slData.setLoads),
      });
      await slDoc.ref.delete();
      console.log(`  📁 sessionLoads: ${slDoc.id} → ${newKey}`);
    }

    // ── 3. Migrate workoutHistory day field ─────────────────
    const histSnap = await db.collection('clients').doc(clientDoc.id)
      .collection('workoutHistory').get();
    const batch = db.batch();
    let batchCount = 0;
    for (const histDoc of histSnap.docs) {
      const newDay = dayMap[histDoc.data().day];
      if (newDay) { batch.update(histDoc.ref, { day: newDay }); batchCount++; }
      if (batchCount >= 400) { await batch.commit(); batchCount = 0; }
    }
    if (batchCount > 0) await batch.commit();
    console.log(`  📜 workoutHistory: ${histSnap.docs.length} sessions updated`);

    // ── 4. Update program (last step) ──────────────────────
    await clientDoc.ref.update({ program: newProgram });
    console.log(`✅ ${clientDoc.id} done`);
  }

  console.log('🎉 Migration complete! Hard reload app now (Cmd+Shift+R)');
})();
