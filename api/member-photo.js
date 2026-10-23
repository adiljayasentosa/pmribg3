function json(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify(payload));
}
function serviceAccount() {
  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '').trim();
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY tidak valid.'); }
}
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
    const idToken = String(body.idToken || '').trim();
    const foto = String(body.foto || '').trim();
    if (!idToken) return json(res, 401, { error: 'Sesi login diperlukan.' });
    if (foto && (foto.length > 1000 || !/^https:\/\/(?:drive\.google\.com|docs\.google\.com)\//i.test(foto))) {
      return json(res, 400, { error: 'Masukkan link Google Drive yang valid atau kosongkan kolom.' });
    }
    const decoded = await getAuth().verifyIdToken(idToken, true);
    const db = getFirestore();
    const userRef = db.collection('users').doc(decoded.uid);
    const userSnap = await userRef.get();
    const user = userSnap.exists ? userSnap.data() || {} : {};
    if (user.role !== 'anggota') return json(res, 403, { error: 'Fitur ini hanya tersedia untuk akun anggota.' });
    const anggotaId = String(user.anggotaId || '').trim();
    if (!anggotaId) return json(res, 403, { error: 'Akun belum terhubung ke data anggota. Hubungi pengurus.' });
    const memberRef = db.collection('anggota').doc(anggotaId);
    const memberSnap = await memberRef.get();
    if (!memberSnap.exists || String((memberSnap.data() || {}).authUid || '') !== decoded.uid) {
      return json(res, 403, { error: 'Data anggota belum terhubung secara aman ke akun ini. Hubungi pengurus.' });
    }
    await memberRef.update({ foto, updatedAt: FieldValue.serverTimestamp() });
    return json(res, 200, { ok: true, foto });
  } catch (e) {
    console.error('[api/member-photo]', e);
    const known = {
      'auth/id-token-expired': 'Sesi login kedaluwarsa. Silakan login ulang.',
      'auth/id-token-revoked': 'Sesi login sudah dicabut. Silakan login ulang.',
      'auth/invalid-id-token': 'Token login tidak valid.'
    };
    return json(res, 500, { error: known[e?.code] || 'Gagal menyimpan link foto. Coba lagi atau hubungi pengurus.' });
  }
};
