/* =========================================================
   PUBLIC STATS — statistik ringan untuk halaman publik.
   Hanya mengembalikan jumlah anggota dengan statusKeanggotaan=Aktif.
   Tidak membuka data anggota ke browser publik.
   ========================================================= */
function json(res, status, payload) {
  res.status(status)
    .setHeader('Content-Type', 'application/json; charset=utf-8')
    .setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0')
    .setHeader('Vercel-CDN-Cache-Control', 'no-store')
    .setHeader('CDN-Cache-Control', 'no-store');
  return res.end(JSON.stringify(payload));
}

function serviceAccount() {
  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '').trim();
  if (!raw) return null;
  try { return JSON.parse(raw); }
  catch { throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY tidak valid.'); }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method tidak diizinkan.' });
  try {
    const { initializeApp, cert, getApps } = require('firebase-admin/app');
    const { getFirestore } = require('firebase-admin/firestore');

    if (!getApps().length) {
      const sa = serviceAccount();
      if (!sa) return json(res, 500, { error: 'Backend Firebase belum dikonfigurasi.' });
      initializeApp({ credential: cert(sa) });
    }

    const db = getFirestore();
    const snap = await db.collection('anggota')
      .where('statusKeanggotaan', '==', 'Aktif')
      .select('statusKeanggotaan')
      .get();

    return json(res, 200, {
      ok: true,
      activeMembers: snap.size,
      updatedAt: new Date().toISOString()
    });
  } catch (e) {
    console.error('[api/public-stats]', e);
    return json(res, 500, { error: e.message || 'Gagal mengambil statistik anggota.' });
  }
};
