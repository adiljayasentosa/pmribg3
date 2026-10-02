/* Unified authentication backend.
   Actions:
   - lookup  : resolve username -> Firebase Auth email
   - profile : verify Firebase ID token and sync/migrate Firestore profile
*/
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

function clean(v, max = 80) {
  return String(v ?? '').trim().toLowerCase().slice(0, max);
}

async function getAdmin() {
  const { initializeApp, cert, getApps } = require('firebase-admin/app');
  if (!getApps().length) {
    const serviceAccount = getServiceAccount();
    if (!serviceAccount) throw Object.assign(new Error('Backend Firebase belum dikonfigurasi.'), { code: 'CONFIG_MISSING' });
    initializeApp({ credential: cert(serviceAccount) });
  }
  const { getAuth } = require('firebase-admin/auth');
  const { getFirestore, FieldValue } = require('firebase-admin/firestore');
  return { auth: getAuth(), db: getFirestore(), FieldValue };
}

async function lookup(req, res, body) {
  const username = clean(body.username);
  if (!/^[a-z0-9._-]{4,40}$/.test(username)) {
    return json(res, 400, { error: 'Username tidak valid.' });
  }

  const { db } = await getAdmin();
  const snap = await db.collection('users').where('username', '==', username).limit(2).get();
  if (snap.empty) return json(res, 404, { error: 'Username tidak ditemukan.' });

  const profiles = snap.docs.map(d => d.data()).filter(p => p && p.email);
  if (profiles.length !== 1) {
    return json(res, 409, { error: 'Username tidak dapat digunakan. Hubungi pengurus.' });
  }

  return json(res, 200, { ok: true, email: String(profiles[0].email).trim().toLowerCase() });
}

async function profile(req, res, body) {
  const idToken = String(body.idToken || '').trim();
  if (!idToken) return json(res, 400, { error: 'Token login wajib diisi.' });

  const { auth, db, FieldValue } = await getAdmin();
  const decoded = await auth.verifyIdToken(idToken, true);
  const uid = decoded.uid;
  const email = String(decoded.email || '').trim().toLowerCase();
  if (!email) return json(res, 400, { error: 'Akun Firebase tidak memiliki email internal.' });

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
    const profileData = {
      username: String(oldData.username || email.split('@')[0]).trim().toLowerCase(),
      nama: String(oldData.nama || decoded.name || email.split('@')[0]).trim(),
      role: String(oldData.role || '').trim().toLowerCase(),
      email,
      ...(oldData.anggotaId ? { anggotaId: String(oldData.anggotaId) } : {}),
      migratedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };
    const allowedRoles = ['admin', 'pembina', 'pengurus', 'anggota'];
    if (!allowedRoles.includes(profileData.role)) {
      return json(res, 409, { error: 'Role profil lama tidak valid. Hubungi admin.' });
    }

    await uidRef.set(profileData, { merge: true });
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
    const profileData = {
      username,
      nama: String(a.nama || username),
      role: 'anggota',
      email,
      anggotaId: memberDoc.id,
      updatedAt: FieldValue.serverTimestamp()
    };
    await uidRef.set(profileData, { merge: true });
    await memberDoc.ref.set({ authUid: uid, statusAkun: 'active', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    const confirm = await uidRef.get();
    return json(res, 200, { ok: true, profile: confirm.data(), migrated: false, linkedMember: true });
  }

  return json(res, 404, { error: 'Profil pengguna belum dibuat. Hubungi admin.' });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method tidak diizinkan.' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const action = clean(body.action, 20);

    if (action === 'lookup') return await lookup(req, res, body);
    if (action === 'profile') return await profile(req, res, body);

    return json(res, 400, { error: 'Action autentikasi tidak valid.' });
  } catch (e) {
    console.error('[api/auth]', e);
    const known = {
      'auth/id-token-expired': 'Sesi login sudah kedaluwarsa. Silakan login ulang.',
      'auth/id-token-revoked': 'Sesi login sudah dicabut. Silakan login ulang.',
      'auth/invalid-id-token': 'Token login tidak valid. Silakan login ulang.'
    };
    if (e?.code === 'CONFIG_MISSING') return json(res, 500, { error: e.message });
    return json(res, 500, { error: known[e?.code] || e?.message || 'Gagal memproses autentikasi.' });
  }
};
