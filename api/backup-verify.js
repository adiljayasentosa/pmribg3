/* =========================================================
   API/BACKUP-VERIFY.JS — F4.5 Backup Data
   Server-side admin-only backup with a versioned, restore-safe format.
   ========================================================= */
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, Timestamp, GeoPoint } = require("firebase-admin/firestore");

if (!getApps().length && process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    initializeApp({ credential: cert(serviceAccount) });
  } catch (e) {
    console.error("[api/backup-verify] FIREBASE_SERVICE_ACCOUNT_KEY tidak valid:", e.message);
  }
}

const KOLEKSI_BACKUP = [
  "users", "anggota", "kegiatan", "keuangan", "presensi",
  "pengurus", "inventaris", "piket", "upacara", "iuran",
  "artikel", "video", "poster", "dokumentasi"
];

function serializeValue(value) {
  if (value instanceof Timestamp) {
    return { __pmrType: "timestamp", seconds: value.seconds, nanoseconds: value.nanoseconds };
  }
  if (value instanceof GeoPoint) {
    return { __pmrType: "geopoint", latitude: value.latitude, longitude: value.longitude };
  }
  if (value && value.constructor?.name === "Bytes" && typeof value.toBase64 === "function") {
    return { __pmrType: "bytes", base64: value.toBase64() };
  }
  if (Array.isArray(value)) return value.map(serializeValue);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = serializeValue(item);
    return out;
  }
  return value;
}

async function createBackup(uid) {
  const fdb = getFirestore();
  const collections = {};
  await Promise.all(KOLEKSI_BACKUP.map(async (nama) => {
    const snap = await fdb.collection(nama).get();
    collections[nama] = snap.docs.map((d) => ({ id: d.id, data: serializeValue(d.data()) }));
  }));

  return {
    backupFormatVersion: 2,
    appVersion: "1.1.4",
    project: "pmr-wira-unit",
    generatedAt: new Date().toISOString(),
    generatedByUid: uid,
    collections
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method tidak diizinkan. Gunakan POST." });
  }
  if (!getApps().length) {
    return res.status(500).json({ error: "Konfigurasi backend (FIREBASE_SERVICE_ACCOUNT_KEY) belum lengkap di server." });
  }

  try {
    const { idToken } = req.body || {};
    if (!idToken || typeof idToken !== "string") {
      return res.status(400).json({ error: "idToken wajib diisi." });
    }

    let decoded;
    try {
      decoded = await getAuth().verifyIdToken(idToken, true);
    } catch (_) {
      return res.status(401).json({ error: "Sesi tidak valid, silakan login ulang." });
    }

    const userDoc = await getFirestore().collection("users").doc(decoded.uid).get();
    const role = userDoc.exists ? userDoc.data().role : null;
    if (role !== "admin") {
      return res.status(403).json({ error: "Hanya admin yang boleh membuat backup." });
    }

    const startedAt = Date.now();
    const backup = await createBackup(decoded.uid);
    const payload = JSON.stringify(backup);
    const payloadBytes = Buffer.byteLength(payload, "utf8");
    console.log(`[api/backup-verify] Backup siap: ${payloadBytes} bytes dalam ${Date.now() - startedAt} ms`);

    // Vercel membatasi ukuran response Function. Beri error JSON yang jelas
    // sebelum platform memotong response menjadi respons kosong/generic 500.
    if (payloadBytes > 4_200_000) {
      return res.status(413).json({
        error: "Backup terlalu besar untuk dikirim langsung dari Vercel.",
        bytes: payloadBytes,
        limitBytes: 4_200_000
      });
    }

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).send(payload);
  } catch (error) {
    console.error("[api/backup-verify] Error:", error);
    return res.status(500).json({ error: "Gagal membuat backup." });
  }
};
