/* =========================================================
   API AKSI PENDAFTARAN: approve / reject
   Hanya admin, ketua, wakil, sekretaris.
   ========================================================= */
function json(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify(payload));
}
function serviceAccount() {
  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '').trim();
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY tidak valid.'); }
}
function clean(v, max = 200) { return String(v ?? '').trim().slice(0, max); }

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method tidak diizinkan.' });
  try {
    const { initializeApp, cert, getApps } = require('firebase-admin/app');
    const { getAuth } = require('firebase-admin/auth');
    const { getFirestore, FieldValue } = require('firebase-admin/firestore');
    if (!getApps().length) {
      const sa = serviceAccount();
      if (!sa) return json(res, 500, { error: 'Backend Firebase belum dikonfigurasi.' });
      initializeApp({ credential: cert(sa) });
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { idToken, pendaftaranId, action } = body;
    if (!idToken || !pendaftaranId || !['approve', 'reject'].includes(action)) return json(res, 400, { error: 'Data aksi tidak lengkap.' });

    const auth = getAuth();
    const decoded = await auth.verifyIdToken(idToken, true);
    const db = getFirestore();
    const adminDoc = await db.collection('users').doc(decoded.uid).get();
    const role = adminDoc.exists ? adminDoc.data().role : null;
    if (!['admin', 'ketua', 'wakil', 'sekretaris'].includes(role)) return json(res, 403, { error: 'Tidak berwenang memproses pendaftaran.' });

    const ref = db.collection('pendaftaran').doc(String(pendaftaranId));
    const snap = await ref.get();
    if (!snap.exists) return json(res, 404, { error: 'Pendaftaran tidak ditemukan.' });
    const p = snap.data() || {};
    if (p.status !== 'pending') return json(res, 409, { error: 'Pendaftaran ini sudah diproses.' });

    if (action === 'reject') {
      await ref.update({ status: 'rejected', diprosesOleh: decoded.uid, diprosesPada: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      return json(res, 200, { ok: true, status: 'rejected' });
    }

    const nomorInduk = clean(body.nomorInduk || p.nomorInduk, 64);
    if (!nomorInduk) return json(res, 400, { error: 'Nomor Induk PMR wajib ditentukan sebelum menyetujui.' });

    const existingNi = await db.collection('anggota').where('nomorInduk', '==', nomorInduk).limit(1).get();
    if (!existingNi.empty) return json(res, 409, { error: 'Nomor Induk PMR tersebut sudah digunakan.' });

    const anggotaRef = db.collection('anggota').doc();
    const anggotaData = {
      nama: p.nama || '', nomorInduk, kelas: p.kelas || '', divisi: p.divisi || 'Pertolongan Pertama',
      jabatan: 'Anggota', statusKeanggotaan: 'Aktif', statusAkun: 'pending', sumberData: 'registration',
      foto: p.linkDrive || '', linkDrive: p.linkDrive || '', bergabung: new Date().toISOString().slice(0, 10),
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
    };
    await db.runTransaction(async tx => {
      tx.set(anggotaRef, anggotaData);
      tx.update(ref, { status: 'approved', anggotaId: anggotaRef.id, nomorInduk, diprosesOleh: decoded.uid, diprosesPada: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    });
    return json(res, 200, { ok: true, status: 'approved', anggotaId: anggotaRef.id, nomorInduk });
  } catch (e) {
    console.error('[api/pendaftaran-action]', e);
    const known = {
      'auth/id-token-expired': 'Sesi admin sudah kedaluwarsa. Silakan login ulang.',
      'auth/id-token-revoked': 'Sesi admin sudah dicabut. Silakan login ulang.',
      'auth/invalid-id-token': 'Token admin tidak valid. Silakan login ulang.'
    };
    return json(res, 500, { error: known[e.code] || e.message || 'Gagal memproses pendaftaran.' });
  }
};
