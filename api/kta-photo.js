// Same-origin image proxy for KTA photos stored in Google Drive.
// Redirect targets are revalidated and response size/time are bounded.
const ALLOWED_HOST = host => host === 'drive.google.com' || host === 'docs.google.com' || host === 'drive.usercontent.google.com' || host.endsWith('.googleusercontent.com');
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_REDIRECTS = 4;

async function fetchDriveImage(initialUrl) {
  let url = new URL(initialUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (url.protocol !== 'https:' || !ALLOWED_HOST(url.hostname.toLowerCase())) {
      throw Object.assign(new Error('Tujuan Google Drive tidak diizinkan.'), { statusCode: 400 });
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    try {
      const response = await fetch(url, { redirect: 'manual', signal: controller.signal, headers: { Accept: 'image/*' } });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (hop === MAX_REDIRECTS) throw Object.assign(new Error('Terlalu banyak redirect dari Google Drive.'), { statusCode: 502 });
        const location = response.headers.get('location');
        if (!location) throw Object.assign(new Error('Redirect Google Drive tidak valid.'), { statusCode: 502 });
        url = new URL(location, url);
        continue;
      }
      if (!response.ok) throw Object.assign(new Error(`Google Drive HTTP ${response.status}.`), { statusCode: response.status >= 400 && response.status < 500 ? 400 : 502 });
      const type = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (!type.startsWith('image/')) throw Object.assign(new Error('File Drive bukan gambar.'), { statusCode: 415 });
      const length = Number(response.headers.get('content-length') || 0);
      if (length > MAX_BYTES) throw Object.assign(new Error('Ukuran foto melebihi batas 8 MB.'), { statusCode: 413 });
      const chunks = [];
      let size = 0;
      if (!response.body) throw Object.assign(new Error('Respons foto kosong.'), { statusCode: 502 });
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_BYTES) {
            await reader.cancel();
            throw Object.assign(new Error('Ukuran foto melebihi batas 8 MB.'), { statusCode: 413 });
          }
          chunks.push(Buffer.from(value));
        }
      } finally { reader.releaseLock(); }
      return { body: Buffer.concat(chunks), type };
    } catch (error) {
      if (error?.name === 'AbortError') throw Object.assign(new Error('Pengambilan foto Google Drive timeout.'), { statusCode: 504 });
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw Object.assign(new Error('Tidak dapat mengambil foto.'), { statusCode: 502 });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method tidak diizinkan.' });
  try {
    let target = String(req.query?.url || '').trim();
    const id = String(req.query?.id || '').trim();
    if (id) {
      if (!/^[A-Za-z0-9_-]{10,200}$/.test(id)) return res.status(400).json({ error: 'ID Google Drive tidak valid.' });
      target = `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1600`;
    }
    if (!target || target.length > 2048) return res.status(400).json({ error: 'URL Google Drive tidak valid.' });
    let parsed;
    try { parsed = new URL(target); } catch (_) { return res.status(400).json({ error: 'URL Google Drive tidak valid.' }); }
    if (parsed.protocol !== 'https:' || !ALLOWED_HOST(parsed.hostname.toLowerCase())) {
      return res.status(400).json({ error: 'URL harus berasal dari Google Drive.' });
    }
    const result = await fetchDriveImage(parsed.toString());
    res.setHeader('Content-Type', result.type);
    res.setHeader('Content-Length', String(result.body.length));
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).send(result.body);
  } catch (error) {
    if (!error?.statusCode || error.statusCode >= 500) console.error('[api/kta-photo]', error);
    return res.status(Number(error?.statusCode) || 502).json({ error: error?.message || 'Gagal mengambil foto dari Google Drive.' });
  }
};
