const { initializeApp, cert, getApps } = require('firebase-admin/app');

// Proxy khusus foto Google Drive agar Canvas generator KTA tidak mentok CORS.
// Hanya host Google Drive yang diterima, bukan URL arbitrer.
function initFirebase() {
  if (!getApps().length && process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try { initializeApp({credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY))}); } catch (_) {}
  }
}

function extractDriveId(value) {
  const raw = String(value || '').trim();
  if (/^[A-Za-z0-9_-]{10,200}$/.test(raw)) return raw;
  const m = raw.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([^/?&]+)/i);
  return m ? m[1] : '';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({error:'Method tidak diizinkan.'});
  const id = extractDriveId(req.query?.id);
  if (!id) return res.status(400).json({error:'ID foto Google Drive tidak valid.'});

  try {
    const url = `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1600`;
    const upstream = await fetch(url, {redirect:'follow'});
    if (!upstream.ok) return res.status(404).json({error:'Foto Google Drive tidak dapat diakses.'});
    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return res.status(415).json({error:'File Drive bukan gambar atau belum dapat diakses publik.'});
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control','public, max-age=86400, s-maxage=86400');
    return res.status(200).send(buffer);
  } catch (e) {
    console.error('[api/kta-photo]', e);
    return res.status(500).json({error:'Gagal mengambil foto Google Drive.'});
  }
};
