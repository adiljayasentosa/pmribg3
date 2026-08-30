// Server-side proxy for the Google Apps Script Web App.
// Keeps browser CORS/redirect behavior out of the client-side sync flow.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ success:false, error:'Method not allowed' });
  const url = process.env.GOOGLE_SHEETS_APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbyx4MlGQi9vaJujLLzR5pe8m1tpG2rcfnZOhDauePFjknNCZ-J-IkOTcMfSPYxGtxa7zw/exec';
    try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    const text = await response.text();
    if (!response.ok) return res.status(502).json({ success:false, error:`Apps Script HTTP ${response.status}`, raw:text.slice(0,500) });
    let data;
    try { data = JSON.parse(text); } catch { return res.status(502).json({ success:false, error:'Respons Apps Script bukan JSON.', raw:text.slice(0,500) }); }
    return res.status(200).json(data);
  } catch (error) {
    return res.status(502).json({ success:false, error:error.message });
  }
}
