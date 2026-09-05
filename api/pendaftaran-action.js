/* =========================================================
   API AKSI PENDAFTARAN: approve / reject
   Hanya admin, ketua, wakil, sekretaris.
   ========================================================= */
function json(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify(payload));
}
function serviceAccount() {
  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '').trim();
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY tidak valid.'); }
}
function clean(v, max = 200) { return String(v ?? '').trim().slice(0, max); }

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method tidak diizinkan.' });
  try {
    const { initializeApp, cert, getApps } = require('firebase-admin/app');
    const { getAuth } = require('firebase-admin/auth');
    const { getFirestore, FieldValue } = require('firebase-admin/firestore');
    if (!getApps().length) {
      const sa = serviceAccount();
      if (!sa) return json(res, 500, { error: 'Backend Firebase belum dikonfigurasi.' });
      initializeApp({ credential: cert(sa) });
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { idToken, pendaftaranId, action } = body;
    if (!idToken || !pendaftaranId || !['approve', 'reject'].includes(action)) return json(res, 400, { error: 'Data aksi tidak lengkap.' });

    const auth = getAuth();
    const decoded = await auth.verifyIdToken(idToken, true);
    const db = getFirestore();
    const adminDoc = await db.collection('users').doc(decoded.uid).get();
    const role = adminDoc.exists ? adminDoc.data().role : null;
    if (!['admin', 'ketua', 'wakil', 'sekretaris'].includes(role)) return json(res, 403, { error: 'Tidak berwenang memproses pendaftaran.' });

    const ref = db.collection('pendaftaran').doc(String(pendaftaranId));
    const snap = await ref.get();
    if (!snap.exists) return json(res, 404, { error: 'Pendaftaran tidak ditemukan.' });
    const p = snap.data() || {};
    if (p.status !== 'pending') return json(res, 409, { error: 'Pendaftaran ini sudah diproses.' });

    if (action === 'reject') {
      await ref.update({ status: 'rejected', diprosesOleh: decoded.uid, diprosesPada: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      return json(res, 200, { ok: true, status: 'rejected' });
    }

    // Nomor Induk dibuat otomatis dari prefix tetap + tanggal lahir (DDMMYY) + urutan 4 digit.
    // Contoh: 270124 + 270409 + 0028 = 2701242704090028.
    const tanggalLahir = clean(p.tanggalLahir, 20);
    const matchTanggal = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tanggalLahir);
    if (!matchTanggal) return json(res, 400, { error: 'Tanggal lahir pendaftaran tidak valid untuk pembentukan Nomor Induk.' });
    const [, tahun, bulan, hari] = matchTanggal;
    const kodeTanggalLahir = `${hari}${bulan}${tahun.slice(-2)}`;
    const counterRef = db.collection('system_counters').doc('nomor_induk_anggota');
    const anggotaRef = db.collection('anggota').doc();
    let nomorInduk = '';

    await db.runTransaction(async tx => {
      const counterSnap = await tx.get(counterRef);
      let lastNumber = counterSnap.exists ? Number(counterSnap.data().lastNumber || 0) : 0;

      // Nomor urut lama PMR saat ini berhenti di 0096. Jadikan 0096 sebagai
      // batas bawah agar pendaftaran baru selalu melanjutkan dari 0097,
      // tanpa menghitung ulang berdasarkan jumlah anggota di database.
      lastNumber = Math.max(lastNumber, 96);

      // Saat pertama kali counter dipakai, sinkronkan dengan NIN lama yang sudah ada
      // agar tidak menimpa nomor yang pernah diterbitkan.
      if (!counterSnap.exists) {
        const existingMembers = await tx.get(db.collection('anggota').select('nomorInduk'));
        for (const doc of existingMembers.docs) {
          const ni = String(doc.data().nomorInduk || '');
          const suffix = Number(ni.slice(-4));
          if (/^\d{16}$/.test(ni) && Number.isInteger(suffix)) lastNumber = Math.max(lastNumber, suffix);
        }
      }

      const nextNumber = lastNumber + 1;
      if (nextNumber > 9999) throw new Error('Nomor urut anggota sudah mencapai batas 9999.');
      const nomorUrut = String(nextNumber).padStart(4, '0');
      nomorInduk = `270124${kodeTanggalLahir}${nomorUrut}`;

      const existingNi = await tx.get(db.collection('anggota').where('nomorInduk', '==', nomorInduk).limit(1));
      if (!existingNi.empty) throw new Error('Nomor Induk PMR yang terbentuk sudah digunakan. Silakan proses pendaftaran kembali.');

      tx.set(counterRef, { lastNumber: nextNumber, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    });
    /* Data operasional yang aman untuk collection anggota tetap minimal.
       Data pribadi pendaftaran disimpan terpisah agar tidak ikut terbaca
       oleh seluruh akun login yang memang membutuhkan daftar anggota. */
    const anggotaData = {
      nama: p.nama || '', nomorInduk, kelas: p.kelas || '', divisi: p.divisi || 'Pertolongan Pertama',
      jabatan: 'Anggota', statusKeanggotaan: 'Aktif', statusAkun: 'pending', sumberData: 'registration',
      foto: p.linkDrive || '', linkDrive: p.linkDrive || '', bergabung: new Date().toISOString().slice(0, 10),
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
    };
    const anggotaPrivateData = {
      anggotaId: anggotaRef.id,
      nik: p.nik || '', tempatLahir: p.tempatLahir || '', tanggalLahir: p.tanggalLahir || '',
      agama: p.agama || '', jenisKelamin: p.jenisKelamin || '', noHandphone: p.noHandphone || '',
      golonganDarah: p.golonganDarah || '', provinsi: p.provinsi || '', kabKota: p.kabKota || '',
      kecamatan: p.kecamatan || '', desaKelurahan: p.desaKelurahan || '', alamat: p.alamat || '',
      linkDrive: p.linkDrive || '',
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
    };
    await db.runTransaction(async tx => {
      tx.set(anggotaRef, anggotaData);
      tx.set(db.collection('anggota_private').doc(anggotaRef.id), anggotaPrivateData);
      tx.update(ref, { status: 'approved', anggotaId: anggotaRef.id, nomorInduk, diprosesOleh: decoded.uid, diprosesPada: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    });
    return json(res, 200, { ok: true, status: 'approved', anggotaId: anggotaRef.id, nomorInduk });
  } catch (e) {
    console.error('[api/pendaftaran-action]', e);
    const known = {
      'auth/id-token-expired': 'Sesi admin sudah kedaluwarsa. Silakan login ulang.',
      'auth/id-token-revoked': 'Sesi admin sudah dicabut. Silakan login ulang.',
      'auth/invalid-id-token': 'Token admin tidak valid. Silakan login ulang.'
    };
    return json(res, 500, { error: known[e.code] || e.message || 'Gagal memproses pendaftaran.' });
  }
};
