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
    if (!idToken) return json(res, 400, { error: 'Token login wajib diisi.' });

    const auth = getAuth();
    const decoded = await auth.verifyIdToken(idToken, true);
    const uid = decoded.uid;
    const email = String(decoded.email || '').trim().toLowerCase();
    if (!email) return json(res, 400, { error: 'Akun Firebase tidak memiliki email internal.' });

    const db = getFirestore();
    const uidRef = db.collection('users').doc(uid);
    const uidSnap = await uidRef.get();
    if (uidSnap.exists) return json(res, 200, { ok: true, profile: uidSnap.data(), migrated: false });

    // Migrasi akun lama: cari tepat satu profil Auto-ID berdasarkan email.
    const matches = await db.collection('users').where('email', '==', email).limit(5).get();
    const candidates = matches.docs.filter(d => d.id !== uid);

    if (candidates.length > 1) {
      return json(res, 409, { error: 'Ditemukan lebih dari satu profil untuk akun ini. Hubungi admin untuk merapikan data pengguna.' });
    }

    if (candidates.length === 1) {
      const oldRef = candidates[0].ref;
      const oldData = candidates[0].data() || {};
      const profile = {
        username: String(oldData.username || email.split('@')[0]).trim().toLowerCase(),
        nama: String(oldData.nama || decoded.name || email.split('@')[0]).trim(),
        role: String(oldData.role || '').trim().toLowerCase(),
        email,
        ...(oldData.anggotaId ? { anggotaId: String(oldData.anggotaId) } : {}),
        migratedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };
      const allowedRoles = ['admin','ketua','wakil','sekretaris','bendahara','pj','anggota','demo'];
      if (!allowedRoles.includes(profile.role)) return json(res, 409, { error: 'Role profil lama tidak valid. Hubungi admin.' });

      await uidRef.set(profile, { merge: true });
      const confirm = await uidRef.get();
      if (!confirm.exists) return json(res, 500, { error: 'Profil baru gagal dikonfirmasi.' });

      // Hapus Auto-ID lama hanya setelah users/{uid} berhasil terbaca.
      await oldRef.delete();
      return json(res, 200, { ok: true, profile: confirm.data(), migrated: true });
    }

    // Fallback aman untuk akun anggota: bila Auth email cocok dengan NI
    // pada satu dokumen anggota dan dokumen itu belum memiliki users/{uid},
    // buat profil role anggota. Tidak ada role pengurus yang diinferensikan.
    const username = email.split('@')[0];
    const memberMatches = await db.collection('anggota').where('nomorInduk', '==', username).limit(2).get();
    if (memberMatches.size === 1) {
      const memberDoc = memberMatches.docs[0];
      const a = memberDoc.data() || {};
      const profile = {
        username,
        nama: String(a.nama || username),
        role: 'anggota',
        email,
        anggotaId: memberDoc.id,
        updatedAt: FieldValue.serverTimestamp()
      };
      await uidRef.set(profile, { merge: true });
      await memberDoc.ref.set({ authUid: uid, statusAkun: 'active', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      const confirm = await uidRef.get();
      return json(res, 200, { ok: true, profile: confirm.data(), migrated: false, linkedMember: true });
    }

    return json(res, 404, { error: 'Profil pengguna belum dibuat. Hubungi admin.' });
  } catch (e) {
    console.error('[api/auth-profile]', e);
    const known = {
      'auth/id-token-expired': 'Sesi login sudah kedaluwarsa. Silakan login ulang.',
      'auth/id-token-revoked': 'Sesi login sudah dicabut. Silakan login ulang.',
      'auth/invalid-id-token': 'Token login tidak valid. Silakan login ulang.'
    };
    return json(res, 500, { error: known[e?.code] || e?.message || 'Gagal menyinkronkan profil pengguna.' });
  }
};
