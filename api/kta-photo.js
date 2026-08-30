// Same-origin image proxy for KTA photos stored in Google Drive.
// The browser loads this endpoint instead of drawing a cross-origin Drive image
// directly into canvas, avoiding canvas CORS/tainting problems.
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method tidak diizinkan.' });
  try {
    let target = String(req.query?.url || '').trim();
    const id = String(req.query?.id || '').trim();
    if (id) target = `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1600`;
    if (!target || !/^https:\/\/drive\.google\.com\//i.test(target)) {
      return res.status(400).json({ error: 'URL Google Drive tidak valid.' });
    }
    const upstream = await fetch(target, { redirect: 'follow' });
    if (!upstream.ok) return res.status(upstream.status).json({ error: `Google Drive HTTP ${upstream.status}.` });
    const type = upstream.headers.get('content-type') || '';
    if (!type.startsWith('image/')) return res.status(415).json({ error: 'File Drive bukan gambar.' });
    const body = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).send(body);
  } catch (error) {
    console.error('[api/kta-photo]', error);
    return res.status(502).json({ error: 'Gagal mengambil foto dari Google Drive.' });
  }
};
