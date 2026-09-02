const crypto = require('crypto');

function json(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify(payload));
}

function randomPassword() {
  return crypto.randomBytes(9).toString('base64url') + 'A1!';
}

function emailFor(ni) {
  return `${String(ni).trim().toLowerCase()}@pmr-smkibg3.app`;
}

function getServiceAccount() {
  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY tidak valid. Pastikan nilainya berupa JSON service account Firebase yang valid.');
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method tidak diizinkan.' });
  }

  try {
    // Lazy-load Firebase Admin so a module/runtime error becomes a readable JSON error,
    // instead of Vercel's generic HTML "A server error has occurred" response.
    const { initializeApp, cert, getApps } = require('firebase-admin/app');
    const { getAuth } = require('firebase-admin/auth');
    const { getFirestore, FieldValue } = require('firebase-admin/firestore');

    if (!getApps().length) {
      const serviceAccount = getServiceAccount();
      if (!serviceAccount) {
        return json(res, 500, { error: 'Backend Firebase belum dikonfigurasi. Tambahkan FIREBASE_SERVICE_ACCOUNT_KEY di Environment Variables Vercel.' });
      }
      initializeApp({ credential: cert(serviceAccount) });
    }

    const body = typeof req.body === 'string'
      ? JSON.parse(req.body || '{}')
      : (req.body || {});
    const { idToken, anggotaId, action = 'create' } = body;

    if (!idToken || !anggotaId) {
      return json(res, 400, { error: 'idToken dan anggotaId wajib diisi.' });
    }

    const auth = getAuth();
    const decoded = await auth.verifyIdToken(idToken, true);
    const db = getFirestore();

    const adminDoc = await db.collection('users').doc(decoded.uid).get();
    const adminRole = adminDoc.exists ? adminDoc.data().role : null;
    if (!adminDoc.exists || !['admin', 'ketua', 'wakil', 'sekretaris'].includes(adminRole)) {
      return json(res, 403, { error: 'Tidak berwenang membuat akun anggota.' });
    }

    const ref = db.collection('anggota').doc(String(anggotaId));
    const snap = await ref.get();
    if (!snap.exists) {
      return json(res, 404, { error: 'Anggota tidak ditemukan.' });
    }

    const a = snap.data() || {};
    const ni = String(a.nomorInduk || '').trim();
    if (!ni) {
      return json(res, 400, { error: 'Nomor Induk anggota belum diisi.' });
    }

    const email = emailFor(ni);
    let user;
    let created = false;
    let password = null;

    try {
      user = await auth.getUserByEmail(email);
    } catch (e) {
      if (e.code !== 'auth/user-not-found') throw e;
      if (action !== 'create') return json(res, 404, { error: 'Akun anggota belum dibuat.' });
      password = randomPassword();
      user = await auth.createUser({
        email,
        password,
        displayName: String(a.nama || ni)
      });
      created = true;
    }

    if (action === 'reset') {
      password = randomPassword();
      await auth.updateUser(user.uid, { password });
    } else if (action !== 'create') {
      return json(res, 400, { error: 'Aksi akun tidak valid.' });
    }

    await db.collection('users').doc(user.uid).set({
      username: ni,
      nama: a.nama || ni,
      role: 'anggota',
      email,
      anggotaId: String(anggotaId),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    const ktaToken = a.ktaToken || crypto.randomBytes(18).toString('hex');
    await ref.update({
      authUid: user.uid,
      statusAkun: 'active',
      ktaToken,
      updatedAt: FieldValue.serverTimestamp()
    });

    await db.collection('kta').doc(String(anggotaId)).set({
      anggotaId: String(anggotaId),
      authUid: user.uid,
      ktaToken,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    return json(res, 200, {
      ok: true,
      uid: user.uid,
      ktaToken,
      created,
      temporaryPassword: password,
      action
    });
  } catch (e) {
    console.error('[api/kta-account]', e);
    const code = e && e.code;
    const known = {
      'auth/id-token-expired': 'Sesi admin sudah kedaluwarsa. Silakan login ulang.',
      'auth/id-token-revoked': 'Sesi admin sudah dicabut. Silakan login ulang.',
      'auth/invalid-id-token': 'Token login admin tidak valid. Silakan login ulang.',
      'auth/email-already-exists': 'Email akun anggota sudah digunakan akun lain.',
      'auth/invalid-password': 'Password awal tidak memenuhi aturan Firebase.',
      'permission-denied': 'Backend tidak memiliki izin mengakses Firestore.',
    };
    return json(res, 500, { error: known[code] || (e && e.message) || 'Gagal membuat akun KTA.' });
  }
};
