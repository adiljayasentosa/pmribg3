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


async function adminUsage(req, res, body) {
  const idToken = String(body.idToken || '').trim();
  if (!idToken) return json(res, 400, { error: 'Token admin wajib diisi.' });

  const { auth, db, app } = await getAdmin();
  const decoded = await auth.verifyIdToken(idToken, true);
  const profile = await db.collection('users').doc(decoded.uid).get();
  if (!profile.exists || String(profile.data()?.role || '').toLowerCase() !== 'admin') {
    return json(res, 403, { error: 'Akses hanya untuk Admin.' });
  }

  const projectId = String(app.options.projectId || '').trim();
  const credential = app.options.credential;
  if (!projectId || !credential || typeof credential.getAccessToken !== 'function') {
    return json(res, 500, { error: 'Credential backend tidak mendukung Cloud Monitoring.' });
  }

  const access = await credential.getAccessToken();
  const token = access?.access_token || access?.accessToken;
  if (!token) return json(res, 500, { error: 'Token Cloud Monitoring tidak tersedia.' });

  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);

  async function metric(metricType, mode = 'sum') {
    const filter = `metric.type="firestore.googleapis.com/${metricType}" AND resource.type="firestore.googleapis.com/Database"`;
    const url = new URL(`https://monitoring.googleapis.com/v3/projects/${encodeURIComponent(projectId)}/timeSeries`);
    url.searchParams.set('filter', filter);
    url.searchParams.set('interval.startTime', start.toISOString());
    url.searchParams.set('interval.endTime', end.toISOString());
    url.searchParams.set('aggregation.alignmentPeriod', '86400s');
    url.searchParams.set('aggregation.perSeriesAligner', mode === 'latest' ? 'ALIGN_NEXT_OLDER' : 'ALIGN_SUM');
    url.searchParams.set('aggregation.crossSeriesReducer', 'REDUCE_SUM');

    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error?.message || `Cloud Monitoring ${response.status}`);

    const series = Array.isArray(data.timeSeries) ? data.timeSeries : [];
    if (mode === 'latest') {
      let latest = null;
      for (const seriesItem of series) {
        for (const point of (seriesItem.points || [])) {
          const value = point.value?.int64Value ?? point.value?.doubleValue;
          if (value != null) {
            const time = point.interval?.endTime || '';
            if (!latest || time > latest.time) latest = { time, value: Number(value) };
          }
        }
      }
      return latest?.value || 0;
    }

    let total = 0;
    for (const seriesItem of series) {
      for (const point of (seriesItem.points || [])) {
        const value = point.value?.int64Value ?? point.value?.doubleValue;
        if (value != null) total += Number(value);
      }
    }
    return total;
  }

  const [reads, writes, deletes, activeConnections, totalUsers, adminCount, pembinaCount, pengurusCount] = await Promise.all([
    metric('document/read_ops_count'),
    metric('document/write_ops_count'),
    metric('document/delete_ops_count'),
    metric('network/active_connections', 'latest'),
    db.collection('users').count().get(),
    db.collection('users').where('role', '==', 'admin').count().get(),
    db.collection('users').where('role', '==', 'pembina').count().get(),
    db.collection('users').where('role', '==', 'pengurus').count().get()
  ]);

  return json(res, 200, {
    ok: true,
    projectId,
    reads,
    writes,
    deletes,
    activeConnections,
    totalUsers: Number(totalUsers.data().count || 0),
    roleCounts: {
      admin: Number(adminCount.data().count || 0),
      pembina: Number(pembinaCount.data().count || 0),
      pengurus: Number(pengurusCount.data().count || 0)
    },
    updatedAt: end.toISOString(),
    window: '24h'
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method tidak diizinkan.' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const action = clean(body.action, 20);

    if (action === 'lookup') return await lookup(req, res, body);
    if (action === 'profile') return await profile(req, res, body);
    if (action === 'admin-usage') return await adminUsage(req, res, body);

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
