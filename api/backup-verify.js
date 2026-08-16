/* =========================================================
   API/BACKUP-VERIFY.JS — [F4.5 — Backup Data]                BARU
   =========================================================
   Vercel Serverless Function.

   KENAPA ENDPOINT INI PERLU ADA (bukan cukup client + Firestore
   Rules seperti fitur-fitur lain di project ini):
   Backup Data harus benar-benar TIDAK BISA dipicu oleh non-admin —
   termasuk untuk collection yang sebenarnya sudah boleh dibaca role
   lain (anggota/kegiatan/pengurus/piket/upacara), bukan cuma "gagal
   di collection yang lebih sensitif seperti keuangan". Ini keputusan
   eksplisit project (bukan default arsitektur project ini, yang
   biasanya murni client + firestore.rules) — makanya verifikasi
   identitas + pembacaan SEMUA data backup dilakukan di SERVER
   (Firebase Admin SDK, pakai service account), bukan di client.
   Client TIDAK PERNAH memegang/melihat service account key.

   BUTUH package.json BARU (dependency: firebase-admin) — project
   ini sebelumnya nol npm dependency (imagekit-auth.js/imagekit-
   delete.js murni pakai built-in `https`, tanpa Admin SDK). Endpoint
   ini SATU-SATUNYA yang butuh Admin SDK — dependency baru scope-nya
   kecil & alasannya jelas (lihat Phase 2 — poin ini sudah disetujui
   sebelum ditambahkan).

   ENV VAR YANG DIBUTUHKAN (WAJIB di-set manual di Vercel dashboard,
   Project Settings → Environment Variables — TIDAK ADA di repo/kode
   ini dan TIDAK BOLEH di-commit):

     FIREBASE_SERVICE_ACCOUNT_KEY
       Isi: JSON LENGKAP service account (Firebase Console →
       Project Settings → Service Accounts → Generate New Private
       Key → paste seluruh isi file .json sebagai value env var ini,
       satu baris). File ini SANGAT SENSITIF (setara akses admin
       penuh ke seluruh project Firebase) — sengaja TIDAK PERNAH
       dikirim ke atau dibaca dari browser, hanya dipakai di sini,
       server-side.

   Tanpa env var ini ter-set, endpoint mengembalikan 500 (bukan
   crash) — fitur lain di aplikasi tetap berjalan normal.
   ========================================================= */

const admin = require("firebase-admin");

/* Inisialisasi SEKALI per instance server — Vercel bisa memakai
   ulang ("warm") container yang sama antar-request; initializeApp()
   kedua kali pada instance yang sama akan error kalau tidak dijaga. */
if (!admin.apps.length && process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } catch (e) {
    console.error("[api/backup-verify] FIREBASE_SERVICE_ACCOUNT_KEY tidak valid:", e.message);
  }
}

/* Whitelist eksplisit collection yang masuk backup — SENGAJA tidak
   enumerasi otomatis semua collection Firestore, supaya kalau suatu
   hari ada collection baru ditambahkan ke project, backup TIDAK
   otomatis ikut membocorkannya sebelum ada review sadar dari
   pengelola project. Tidak ada satupun field credential/password di
   collection-collection ini (password ditangani Firebase Auth,
   bukan Firestore — lihat auth.js). */
const KOLEKSI_BACKUP = [
  "users", "anggota", "kegiatan", "keuangan", "presensi",
  "pengurus", "inventaris", "piket", "upacara", "iuran",
  "artikel", "video", "poster", "dokumentasi"
];

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method tidak diizinkan. Gunakan POST." });
  }

  if (!admin.apps.length) {
    return res.status(500).json({ error: "Konfigurasi backend (FIREBASE_SERVICE_ACCOUNT_KEY) belum lengkap di server." });
  }

  try {
    const { idToken } = req.body || {};
    if (!idToken || typeof idToken !== "string") {
      return res.status(400).json({ error: "idToken wajib diisi." });
    }

    /* Verifikasi token Firebase Auth pengirim request — checkRevoked
       true supaya token yang sudah di-revoke (mis. akun dinonaktifkan
       admin) langsung ditolak, tidak menunggu token lama kedaluwarsa
       sendiri. */
    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(idToken, true);
    } catch (e) {
      return res.status(401).json({ error: "Sesi tidak valid, silakan login ulang." });
    }

    /* Cek role dari Firestore users/{uid} — SATU-SATUNYA sumber
       kebenaran role di project ini (identik dengan yang dipakai
       firestore.rules & auth.js di client), BUKAN dari custom claim
       token (project ini tidak memakainya). */
    const userDoc = await admin.firestore().collection("users").doc(decoded.uid).get();
    const role = userDoc.exists ? userDoc.data().role : null;
    if (role !== "admin") {
      return res.status(403).json({ error: "Hanya admin yang boleh membuat backup." });
    }

    /* Ambil seluruh collection backup secara paralel, langsung dari
       server (bypass firestore.rules lewat service account — sengaja,
       supaya admin yang memang berhak tidak terhambat Rules yang
       dirancang untuk membatasi role LAIN, bukan admin). */
    const fdb = admin.firestore();
    const collections = {};
    await Promise.all(KOLEKSI_BACKUP.map(async (nama) => {
      const snap = await fdb.collection(nama).get();
      collections[nama] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }));

    return res.status(200).json({
      generatedAt: new Date().toISOString(),
      generatedByUid: decoded.uid,
      collections
    });
  } catch (error) {
    console.error("[api/backup-verify] Error:", error);
    return res.status(500).json({ error: "Gagal membuat backup." });
  }
};
