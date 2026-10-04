/* =========================================================
   PUBLIC STATS — statistik ringan untuk halaman publik.
   Hanya mengembalikan jumlah anggota dengan statusKeanggotaan=Aktif.
   Tidak membuka data anggota ke browser publik.
   ========================================================= */
function json(res, status, payload) {
  res.status(status)
    .setHeader('Content-Type', 'application/json; charset=utf-8')
    .setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
    .setHeader('Vercel-CDN-Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    .setHeader('CDN-Cache-Control', 'max-age=60, stale-while-revalidate=300');
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
    // IMPORTANT: never download every active member document just to count them.
    // The previous .get() returned every matching document, so every public visitor
    // caused one Firestore document read per active member. With the landing page
    // polling every 15 seconds, dozens of visitors could burn the daily read quota.
    // Firestore aggregation count returns only the count metadata instead.
    const aggregate = await db.collection('anggota')
      .where('statusKeanggotaan', '==', 'Aktif')
      .count()
      .get();
    const activeMembers = Number(aggregate.data().count || 0);

    return json(res, 200, {
      ok: true,
      activeMembers,
      updatedAt: new Date().toISOString()
    });
  } catch (e) {
    console.error('[api/public-stats]', e);
    return json(res, 500, { error: e.message || 'Gagal mengambil statistik anggota.' });
  }
};
