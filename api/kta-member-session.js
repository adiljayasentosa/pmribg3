function json(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify(payload));
}

function getServiceAccount() {
  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '').trim();
  if (!raw) return null;
  try { return JSON.parse(raw); }
  catch (_) { throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY tidak valid.'); }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method tidak diizinkan.' });

  try {
    const { initializeApp, cert, getApps } = require('firebase-admin/app');
    const { getAuth } = require('firebase-admin/auth');
    const { getFirestore, FieldValue } = require('firebase-admin/firestore');

    if (!getApps().length) {
      const serviceAccount = getServiceAccount();
      if (!serviceAccount) return json(res, 500, { error: 'Backend Firebase belum dikonfigurasi.' });
      initializeApp({ credential: cert(serviceAccount) });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const idToken = String(body.idToken || '').trim();
    const targetToken = String(body.targetToken || '').trim();
    if (!idToken) return json(res, 400, { error: 'Token login wajib diisi.' });

    const auth = getAuth();
    const decoded = await auth.verifyIdToken(idToken, true);
    const db = getFirestore();

    const userRef = db.collection('users').doc(decoded.uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return json(res, 403, { error: 'Profil akun anggota belum terhubung. Hubungi pengurus.' });

    const user = userSnap.data() || {};
    if (user.role !== 'anggota') return json(res, 403, { error: 'Akun ini bukan akun anggota.' });

    let anggotaId = String(user.anggotaId || '').trim();
    let anggotaSnap = anggotaId ? await db.collection('anggota').doc(anggotaId).get() : null;

    // Repair only a strong, unambiguous binding: anggota.authUid == authenticated UID.
    // This handles older accounts whose users/{uid}.anggotaId was missing/stale.
    if (!anggotaSnap || !anggotaSnap.exists || String((anggotaSnap.data() || {}).authUid || '') !== decoded.uid) {
      const q = await db.collection('anggota').where('authUid', '==', decoded.uid).limit(2).get();
      if (q.size === 1) {
        anggotaSnap = q.docs[0];
        anggotaId = q.docs[0].id;
        await userRef.set({
          anggotaId,
          username: String((anggotaSnap.data() || {}).nomorInduk || user.username || ''),
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
      }
    }

    if (!anggotaSnap || !anggotaSnap.exists || !anggotaId) {
      return json(res, 403, { error: 'Akun berhasil login, tetapi hubungan akun dengan data anggota belum ditemukan. Hubungi pengurus untuk sinkronisasi akun KTA.' });
    }

    const a = anggotaSnap.data() || {};
    if (String(a.authUid || '') !== decoded.uid) {
      return json(res, 403, { error: 'Akun belum terhubung ke data anggota yang valid. Hubungi pengurus.' });
    }
    if (a.statusKeanggotaan === 'Tidak Aktif') return json(res, 403, { error: 'KTA ini tidak aktif.' });

    const ktaRef = db.collection('kta').doc(anggotaId);
    let ktaSnap = await ktaRef.get();
    let kta = ktaSnap.exists ? (ktaSnap.data() || {}) : {};

    // KTA documents created by the current account are safe to repair if missing.
    // Never create/repair from a weak client-supplied member ID alone.
    if (!ktaSnap.exists || String(kta.authUid || '') !== decoded.uid) {
      if (String(kta.authUid || '') && String(kta.authUid) !== decoded.uid) {
        return json(res, 403, { error: 'Data KTA terhubung ke akun lain. Hubungi pengurus.' });
      }
      const ktaToken = String(kta.ktaToken || a.ktaToken || '').trim();
      if (!ktaToken) return json(res, 403, { error: 'KTA belum diaktifkan untuk akun ini. Hubungi pengurus.' });
      await ktaRef.set({
        anggotaId,
        authUid: decoded.uid,
        ktaToken,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      kta = { ...kta, anggotaId, authUid: decoded.uid, ktaToken };
    }

    const ktaToken = String(kta.ktaToken || '').trim();
    if (!ktaToken) return json(res, 403, { error: 'KTA belum memiliki token. Hubungi pengurus.' });
    if (targetToken && targetToken !== ktaToken) return json(res, 403, { error: 'QR KTA ini bukan milik akun yang sedang login.' });

    return json(res, 200, {
      ok: true,
      member: {
        id: anggotaId,
        nama: a.nama || 'Anggota PMR',
        nomorInduk: a.nomorInduk || '',
        kelas: a.kelas || '',
        jabatan: a.jabatan || 'Anggota',
        divisi: a.divisi || '',
        statusKeanggotaan: a.statusKeanggotaan || 'Aktif'
      },
      kta: { anggotaId, ktaToken }
    });
  } catch (e) {
    console.error('[api/kta-member-session]', e);
    const code = e && e.code;
    const known = {
      'auth/id-token-expired': 'Sesi login sudah kedaluwarsa. Silakan login lagi.',
      'auth/id-token-revoked': 'Sesi login sudah dicabut. Silakan login lagi.',
      'auth/invalid-id-token': 'Token login tidak valid. Silakan login lagi.',
      'permission-denied': 'Backend tidak memiliki izin mengakses data KTA.'
    };
    return json(res, code === 'auth/id-token-expired' || code === 'auth/id-token-revoked' || code === 'auth/invalid-id-token' ? 401 : 500,
      { error: known[code] || e.message || 'Gagal memuat KTA anggota.' });
  }
};
