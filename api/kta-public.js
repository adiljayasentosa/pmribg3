const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

if (!getApps().length && process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  try { initializeApp({credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY))}); }
  catch (e) { console.error('[api/kta-public] init:', e.message); }
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'GET') return res.status(405).json({error:'Method tidak diizinkan.'});
  if (!getApps().length) return res.status(500).json({error:'Backend Firebase belum dikonfigurasi.'});
  const token = String(req.query?.token || '').trim();
  if (!/^[a-f0-9]{24,128}$/i.test(token)) return res.status(400).json({error:'Token KTA tidak valid.'});
  try {
    const db = getFirestore();
    const qs = await db.collection('kta').where('ktaToken','==',token).limit(1).get();
    if (qs.empty) return res.status(404).json({error:'KTA tidak ditemukan.'});
    const kta = qs.docs[0].data();
    const snap = await db.collection('anggota').doc(kta.anggotaId).get();
    if (!snap.exists) return res.status(404).json({error:'Data anggota tidak ditemukan.'});
    const a = snap.data();
    if ((a.statusKeanggotaan || 'Aktif') === 'Tidak Aktif') return res.status(410).json({error:'KTA ini sudah tidak aktif.'});
    return res.status(200).json({
      ok:true,
      verified:true,
      nama:String(a.nama || 'Anggota PMR'),
      nomorInduk:String(a.nomorInduk || '—'),
      kelas:String(a.kelas || '—'),
      jabatan:String(a.jabatan || 'Anggota'),
      divisi:String(a.divisi || '—'),
      statusKeanggotaan:String(a.statusKeanggotaan || 'Aktif')
    });
  } catch (e) {
    console.error('[api/kta-public]', e);
    return res.status(500).json({error:'Gagal memverifikasi KTA.'});
  }
};
