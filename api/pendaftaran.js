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
    const { getAuth } = require('firebase-admin/auth');
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
      const decoded = await getAuth().verifyIdToken(idToken, false);
      const db = getFirestore();
      const adminDoc = await db.collection('users').doc(decoded.uid).get();
      const role = adminDoc.exists ? String(adminDoc.data().role || '') : '';
      if (!['admin', 'pembina', 'pengurus'].includes(role)) {
        return json(res, 403, { error: 'Tidak berwenang melihat pendaftaran.' });
      }

      // Detail tidak ikut dikirim saat halaman pertama dibuka. Ini menjaga
      // payload ringan, terutama ketika jumlah pendaftar mulai banyak.
      const detailId = String(req.query?.id || '').trim();
      if (detailId) {
        // Ambil hanya field yang dipakai pada modal detail. Jangan mengirim
        // authUid/email/username dan metadata internal yang tidak diperlukan.
        // `select()` adalah metode Query, bukan DocumentReference. Query dokumen
        // berdasarkan ID + field mask agar hanya field detail yang dibaca/dikirim.
        const { FieldPath } = require('firebase-admin/firestore');
        const detailSnap = await db.collection('pendaftaran')
          .where(FieldPath.documentId(), '==', detailId)
          .select('nama', 'nik', 'kelas', 'divisi', 'nomorInduk', 'tempatLahir', 'tanggalLahir',
            'agama', 'jenisKelamin', 'noHandphone', 'golonganDarah', 'alamat',
            'desaKelurahan', 'kecamatan', 'kabKota', 'provinsi', 'status')
          .limit(1)
          .get();
        if (detailSnap.empty) return json(res, 404, { error: 'Pendaftaran tidak ditemukan.' });
        const doc = detailSnap.docs[0];
        const data = doc.data() || {};
        if (String(data.status || '') !== 'pending') {
          return json(res, 409, { error: 'Pendaftaran ini sudah diproses.' });
        }
        return json(res, 200, { ok: true, data: { id: doc.id, ...data } });
      }

      // Hanya field yang diperlukan tabel yang dikirim. Batas 50 mencegah
      // satu halaman admin mengunduh seluruh data pendaftaran sekaligus.
      const snap = await db.collection('pendaftaran')
        .where('status', '==', 'pending')
        .select('nama', 'nik', 'kelas', 'divisi', 'nomorInduk', 'createdAt')
        .limit(50)
        .get();
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => {
        const av = a.createdAt?.toMillis?.() ?? new Date(a.createdAt || 0).getTime();
        const bv = b.createdAt?.toMillis?.() ?? new Date(b.createdAt || 0).getTime();
        return bv - av;
      });
      return json(res, 200, { ok: true, data, limited: snap.size >= 50 });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (clean(body.website, 100)) return json(res, 400, { error: 'Pendaftaran tidak valid.' });

    const idToken = clean(body.idToken, 5000);
    if (!idToken) return json(res, 401, { error: 'Akun pendaftaran belum terautentikasi.' });
    const decoded = await getAuth().verifyIdToken(idToken, true);
    const uid = decoded.uid;
    const userSnap = await getFirestore().collection('users').doc(uid).get();
    if (!userSnap.exists) return json(res, 403, { error: 'Profil akun belum siap. Ulangi tahap pembuatan akun.' });
    const userProfile = userSnap.data() || {};
    if (String(userProfile.status || '').toLowerCase() !== 'pending' || String(userProfile.role || '') !== 'anggota') {
      return json(res, 409, { error: 'Akun ini sudah memiliki status pendaftaran yang berbeda.' });
    }

    const data = {
      nama: clean(body.nama, 120),
      nik: clean(body.nik, 32),
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
      divisi: clean(body.divisi, 80),
      jurusan: clean(body.jurusan, 80),
      fotoDrive: clean(body.fotoDrive, 1000),
      status: 'pending',
      authUid: uid,
      username: clean(userProfile.username || body.username, 40).toLowerCase(),
      email: clean(userProfile.email || decoded.email || body.email, 160).toLowerCase(),
      sumber: 'pendaftaran-publik',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    const required = [
      ['nama', 'Nama lengkap'], ['tempatLahir', 'Tempat lahir'], ['tanggalLahir', 'Tanggal lahir'],
      ['agama', 'Agama'], ['jenisKelamin', 'Jenis kelamin'], ['noHandphone', 'Nomor handphone'],
      ['golonganDarah', 'Golongan darah'], ['alamat', 'Alamat'], ['kelas', 'Kelas'], ['jurusan', 'Jurusan'], ['divisi', 'Divisi PMR'], ['fotoDrive', 'Foto KTA dari Google Drive']
    ];
    const missing = required.find(([key]) => !data[key]);
    if (missing) return json(res, 400, { error: `${missing[1]} wajib diisi.` });
    if (data.nik && !/^\d{5,20}$/.test(data.nik)) return json(res, 400, { error: 'NIK/NISN harus berupa 5–20 digit angka.' });
    if (!/^https?:\/\/(?:drive\.google\.com|docs\.google\.com)\//i.test(data.fotoDrive)) return json(res, 400, { error: 'Link foto harus berasal dari Google Drive.' });

    const db = getFirestore();
    if (data.nik) {
      const existing = await db.collection('pendaftaran').where('nik', '==', data.nik).limit(5).get();
      if (existing.docs.some(d => ['pending', 'approved'].includes(String(d.data().status || '')))) {
        return json(res, 409, { error: 'NIK/NISN tersebut sudah memiliki pendaftaran yang sedang diproses atau sudah disetujui.' });
      }
      const anggotaExisting = await db.collection('anggota_private').where('nik', '==', data.nik).limit(1).get();
      if (!anggotaExisting.empty) return json(res, 409, { error: 'NIK/NISN tersebut sudah terdaftar sebagai anggota.' });
    }
    const ownRegistrations = await db.collection('pendaftaran').where('authUid', '==', uid).limit(5).get();
    if (ownRegistrations.docs.some(d => String(d.data().status || '') === 'pending')) return json(res, 409, { error: 'Pendaftaran untuk akun ini sudah dikirim dan sedang menunggu persetujuan.' });

    const ref = await db.collection('pendaftaran').add(data);
    return json(res, 201, { ok: true, id: ref.id, status: 'pending' });
  } catch (e) {
    console.error('[api/pendaftaran]', e);
    const message = String(e?.message || '');
    if (req.method === 'GET') {
      // Pesan GET harus menggambarkan kegagalan membaca, bukan menyimpan data.
      const safeError = /RESOURCE_EXHAUSTED|Quota exceeded/i.test(message)
        ? 'Data pendaftaran sedang sulit dimuat karena batas layanan sementara. Coba lagi nanti.'
        : 'Gagal memuat data pendaftaran.';
      return json(res, 500, { error: safeError });
    }
    const safeError = /RESOURCE_EXHAUSTED|Quota exceeded/i.test(message)
      ? 'Pendaftaran sedang mengalami gangguan sementara. Silakan coba kembali nanti.'
      : 'Gagal menyimpan pendaftaran.';
    return json(res, 500, { error: safeError });
  }
};
