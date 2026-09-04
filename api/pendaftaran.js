/* =========================================================
   API PENDAFTARAN ANGGOTA PMR
   Public submit -> Firestore collection `pendaftaran`.
   Tidak membuka write public langsung ke Firestore.
   ========================================================= */
function json(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify(payload));
}

function clean(v, max = 500) {
  return String(v ?? '').trim().slice(0, max);
}

function getServiceAccount() {
  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '').trim();
  if (!raw) return null;
  try { return JSON.parse(raw); }
  catch { throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY tidak valid.'); }
}

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return json(res, 405, { error: 'Method tidak diizinkan.' });
  try {
    const { initializeApp, cert, getApps } = require('firebase-admin/app');
    const { getFirestore, FieldValue } = require('firebase-admin/firestore');
    if (!getApps().length) {
      const serviceAccount = getServiceAccount();
      if (!serviceAccount) return json(res, 500, { error: 'Backend Firebase belum dikonfigurasi.' });
      initializeApp({ credential: cert(serviceAccount) });
    }

    /* GET dipakai halaman Persetujuan Anggota. Query dilakukan lewat
       Admin SDK supaya halaman admin tidak bergantung pada Firestore
       client rules untuk membaca collection sensitif `pendaftaran`. */
    if (req.method === 'GET') {
      const { getAuth } = require('firebase-admin/auth');
      const tokenHeader = String(req.headers.authorization || '');
      const idToken = tokenHeader.replace(/^Bearer\s+/i, '').trim();
      if (!idToken) return json(res, 401, { error: 'Token autentikasi diperlukan.' });
      const decoded = await getAuth().verifyIdToken(idToken, true);
      const db = getFirestore();
      const adminDoc = await db.collection('users').doc(decoded.uid).get();
      const role = adminDoc.exists ? String(adminDoc.data().role || '') : '';
      if (!['admin', 'ketua', 'wakil', 'sekretaris'].includes(role)) {
        return json(res, 403, { error: 'Tidak berwenang melihat pendaftaran.' });
      }
      const snap = await db.collection('pendaftaran').where('status', '==', 'pending').get();
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => {
        const av = a.createdAt?.toMillis?.() ?? new Date(a.createdAt || 0).getTime();
        const bv = b.createdAt?.toMillis?.() ?? new Date(b.createdAt || 0).getTime();
        return bv - av;
      });
      return json(res, 200, { ok: true, data });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (clean(body.website, 100)) return json(res, 400, { error: 'Pendaftaran tidak valid.' });

    const data = {
      nama: clean(body.nama, 120),
      nik: clean(body.nik, 32),
      nomorInduk: clean(body.nomorInduk, 64),
      kelas: clean(body.kelas, 60),
      tempatLahir: clean(body.tempatLahir, 100),
      tanggalLahir: clean(body.tanggalLahir, 20),
      agama: clean(body.agama, 40),
      jenisKelamin: clean(body.jenisKelamin, 30),
      noHandphone: clean(body.noHandphone, 30),
      golonganDarah: clean(body.golonganDarah, 8),
      provinsi: clean(body.provinsi, 80),
      kabKota: clean(body.kabKota, 100),
      kecamatan: clean(body.kecamatan, 100),
      desaKelurahan: clean(body.desaKelurahan, 100),
      alamat: clean(body.alamat, 500),
      unitPmiKabKota: clean(body.unitPmiKabKota, 150),
      divisi: clean(body.divisi, 80),
      linkDrive: clean(body.linkDrive, 1000),
      status: 'pending',
      sumber: 'pendaftaran-publik',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    const required = [
      ['nama', 'Nama lengkap'], ['nik', 'NIK'], ['tempatLahir', 'Tempat lahir'],
      ['tanggalLahir', 'Tanggal lahir'], ['agama', 'Agama'], ['jenisKelamin', 'Jenis kelamin'],
      ['noHandphone', 'Nomor handphone'], ['golonganDarah', 'Golongan darah'],
      ['provinsi', 'Provinsi'], ['kabKota', 'Kab/Kota'], ['kecamatan', 'Kecamatan'],
      ['desaKelurahan', 'Desa/Kelurahan'], ['alamat', 'Alamat'],
      ['unitPmiKabKota', 'Unit PMI Kab/Kota'], ['kelas', 'Kelas']
    ];
    const missing = required.find(([key]) => !data[key]);
    if (missing) return json(res, 400, { error: `${missing[1]} wajib diisi.` });
    if (!/^\d{10,20}$/.test(data.nik)) return json(res, 400, { error: 'NIK harus berupa 10–20 digit angka.' });
    if (!data.linkDrive) return json(res, 400, { error: 'Link Google Drive wajib diisi.' });
    if (!/^https:\/\/(drive\.google\.com|docs\.google\.com)\//i.test(data.linkDrive)) return json(res, 400, { error: 'Link Google Drive tidak valid.' });

    const db = getFirestore();
    const existing = await db.collection('pendaftaran').where('nik', '==', data.nik).limit(5).get();
    if (existing.docs.some(d => ['pending', 'approved'].includes(String(d.data().status || '')))) {
      return json(res, 409, { error: 'NIK tersebut sudah memiliki pendaftaran yang sedang diproses atau sudah disetujui.' });
    }
    const anggotaExisting = await db.collection('anggota').where('nik', '==', data.nik).limit(1).get();
    if (!anggotaExisting.empty) return json(res, 409, { error: 'NIK tersebut sudah terdaftar sebagai anggota.' });

    const ref = await db.collection('pendaftaran').add(data);
    return json(res, 201, { ok: true, id: ref.id, status: 'pending' });
  } catch (e) {
    console.error('[api/pendaftaran]', e);
    return json(res, 500, { error: e.message || 'Gagal menyimpan pendaftaran.' });
  }
};
