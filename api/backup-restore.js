/* =========================================================
   API/BACKUP-RESTORE.JS — Admin-only restore
   - preview: validates backup and compares it with Firestore
   - restore: replaces the whitelisted collections with backup data
   - Firebase Auth accounts/passwords are NOT restored; only users/* docs.
   ========================================================= */
const crypto = require("crypto");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, Timestamp, GeoPoint } = require("firebase-admin/firestore");

if (!getApps().length && process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    initializeApp({ credential: cert(serviceAccount) });
  } catch (e) {
    console.error("[api/backup-restore] FIREBASE_SERVICE_ACCOUNT_KEY tidak valid:", e.message);
  }
}

const KOLEKSI_BACKUP = [
  "users", "anggota", "kegiatan", "keuangan", "presensi",
  "pengurus", "inventaris", "piket", "upacara", "iuran",
  "artikel", "video", "poster", "dokumentasi"
];
const MAX_DOCS = 20000;
const PLAN_TTL_MS = 10 * 60 * 1000;

function secret() {
  return process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "";
}
function sign(value) {
  return crypto.createHmac("sha256", secret()).update(value).digest("hex");
}
function stableJson(value) {
  return JSON.stringify(value, Object.keys(value || {}).sort());
}
function hashBackup(backup) {
  return crypto.createHash("sha256").update(JSON.stringify(backup)).digest("hex");
}
function makePlan(uid, backupHash) {
  const payload = JSON.stringify({ uid, backupHash, exp: Date.now() + PLAN_TTL_MS });
  return Buffer.from(payload).toString("base64url") + "." + sign(payload);
}
function readPlan(token, uid, backupHash) {
  if (typeof token !== "string") throw new Error("Konfirmasi restore tidak valid.");
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) throw new Error("Konfirmasi restore tidak valid.");
  const payload = Buffer.from(encoded, "base64url").toString("utf8");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(sign(payload)))) {
    throw new Error("Konfirmasi restore tidak valid.");
  }
  const data = JSON.parse(payload);
  if (data.uid !== uid || data.backupHash !== backupHash || Date.now() > data.exp) {
    throw new Error("Preview restore sudah kedaluwarsa. Buat preview baru.");
  }
}

function deserializeValue(value, fdb) {
  if (Array.isArray(value)) return value.map(v => deserializeValue(v, fdb));
  if (value && typeof value === "object") {
    if (value.__pmrType === "timestamp") {
      if (!Number.isInteger(value.seconds) || !Number.isInteger(value.nanoseconds)) throw new Error("Timestamp backup tidak valid.");
      return new Timestamp(value.seconds, value.nanoseconds);
    }
    if (value.__pmrType === "geopoint") {
      return new GeoPoint(Number(value.latitude), Number(value.longitude));
    }
    if (value.__pmrType === "bytes") {
      return Buffer.from(String(value.base64 || ""), "base64");
    }
    /* Legacy backup v1: Firestore Timestamp.toJSON() biasanya menjadi
       {seconds,nanoseconds}. Hanya konversi objek tepat dengan bentuk ini. */
    const keys = Object.keys(value);
    if (keys.length === 2 && keys.includes("seconds") && keys.includes("nanoseconds") &&
        Number.isInteger(value.seconds) && Number.isInteger(value.nanoseconds)) {
      return new Timestamp(value.seconds, value.nanoseconds);
    }
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = deserializeValue(item, fdb);
    return out;
  }
  return value;
}

function getBackupVersion(backup) {
  return backup?.backupFormatVersion == null ? 1 : backup.backupFormatVersion;
}

function validateBackup(backup) {
  if (!backup || typeof backup !== "object") throw new Error("File backup tidak valid.");
  const version = getBackupVersion(backup);
  if (![1, 2].includes(version)) throw new Error("Versi format backup tidak didukung.");
  if (!backup.collections || typeof backup.collections !== "object" || Array.isArray(backup.collections)) {
    throw new Error("Bagian collections tidak ditemukan atau rusak.");
  }

  const unknown = Object.keys(backup.collections).filter(k => !KOLEKSI_BACKUP.includes(k));
  if (unknown.length) throw new Error(`Backup mengandung collection yang tidak diizinkan: ${unknown.join(", ")}`);

  let total = 0;
  for (const nama of KOLEKSI_BACKUP) {
    const rows = backup.collections[nama] ?? [];
    if (!Array.isArray(rows)) throw new Error(`Collection ${nama} harus berupa array.`);
    const seen = new Set();
    for (const row of rows) {
      if (!row || typeof row !== "object" || Array.isArray(row) || typeof row.id !== "string" || !row.id.trim()) {
        throw new Error(`Dokumen tidak valid di collection ${nama}.`);
      }
      if (seen.has(row.id)) throw new Error(`ID dokumen duplikat di ${nama}: ${row.id}`);
      seen.add(row.id);
      if (version >= 2) {
        if (!Object.prototype.hasOwnProperty.call(row, "data") || !row.data || typeof row.data !== "object") {
          throw new Error(`Data dokumen tidak valid di ${nama}/${row.id}.`);
        }
      }
      total++;
      if (total > MAX_DOCS) throw new Error(`Backup melebihi batas ${MAX_DOCS.toLocaleString("id-ID")} dokumen.`);
    }
  }
  return { total };
}

function rowData(row, version) {
  if (version === 1) {
    const { id, ...data } = row;
    return data;
  }
  return row.data;
}

async function getCurrentCounts(fdb) {
  const current = {};
  await Promise.all(KOLEKSI_BACKUP.map(async nama => {
    const snap = await fdb.collection(nama).get();
    current[nama] = new Map(snap.docs.map(d => [d.id, d.data()]));
  }));
  return current;
}

function normalizeComparable(value) {
  if (value instanceof Timestamp) return { __pmrType: "timestamp", seconds: value.seconds, nanoseconds: value.nanoseconds };
  if (value instanceof GeoPoint) return { __pmrType: "geopoint", latitude: value.latitude, longitude: value.longitude };
  if (value && value.constructor?.name === "Bytes" && typeof value.toBase64 === "function") {
    return { __pmrType: "bytes", base64: value.toBase64() };
  }
  if (Array.isArray(value)) return value.map(normalizeComparable);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = normalizeComparable(value[key]);
    return out;
  }
  return value;
}

function shallowComparable(data) {
  return JSON.stringify(normalizeComparable(data));
}

async function buildSummary(backup, fdb) {
  const version = getBackupVersion(backup);
  const current = await getCurrentCounts(fdb);
  const summary = {};
  let totalAdded = 0, totalUpdated = 0, totalDeleted = 0;

  for (const nama of KOLEKSI_BACKUP) {
    const targetRows = backup.collections[nama] ?? [];
    const target = new Map(targetRows.map(row => [row.id, rowData(row, version)]));
    const cur = current[nama];
    let added = 0, updated = 0, deleted = 0;
    for (const [id, data] of target) {
      if (!cur.has(id)) added++;
      else if (shallowComparable(cur.get(id)) !== shallowComparable(data)) updated++;
    }
    for (const id of cur.keys()) if (!target.has(id)) deleted++;
    summary[nama] = { current: cur.size, backup: target.size, added, updated, deleted };
    totalAdded += added; totalUpdated += updated; totalDeleted += deleted;
  }
  return { summary, totals: { added: totalAdded, updated: totalUpdated, deleted: totalDeleted } };
}

async function applyRestore(backup, fdb) {
  const db = fdb;
  const version = getBackupVersion(backup);
  let written = 0, deleted = 0;

  /* Per-batch atomicity: each Firestore batch is atomic. Cross-collection
     restore cannot be globally atomic, so the client must create a safety
     backup immediately before this operation. */
  for (const nama of KOLEKSI_BACKUP) {
    const ref = db.collection(nama);
    const currentSnap = await ref.get();
    const targetRows = backup.collections[nama] ?? [];
    const targetIds = new Set(targetRows.map(r => r.id));
    const ops = [];

    for (const row of targetRows) {
      ops.push({ type: "set", ref: ref.doc(row.id), data: deserializeValue(rowData(row, version), db) });
    }
    for (const doc of currentSnap.docs) {
      if (!targetIds.has(doc.id)) ops.push({ type: "delete", ref: doc.ref });
    }

    for (let i = 0; i < ops.length; i += 450) {
      const chunk = ops.slice(i, i + 450);
      const batch = db.batch();
      for (const op of chunk) {
        if (op.type === "set") batch.set(op.ref, op.data);
        else batch.delete(op.ref);
      }
      await batch.commit();
      written += chunk.filter(op => op.type === "set").length;
      deleted += chunk.filter(op => op.type === "delete").length;
    }
  }
  return { written, deleted };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method tidak diizinkan. Gunakan POST." });
  }
  if (!getApps().length) return res.status(500).json({ error: "Konfigurasi backend belum lengkap di server." });

  try {
    const { idToken, action, backup, confirmToken } = req.body || {};
    if (!idToken || typeof idToken !== "string") return res.status(400).json({ error: "idToken wajib diisi." });
    if (!['preview', 'restore'].includes(action)) return res.status(400).json({ error: "Action tidak valid." });

    let decoded;
    try { decoded = await getAuth().verifyIdToken(idToken, true); }
    catch (_) { return res.status(401).json({ error: "Sesi tidak valid, silakan login ulang." }); }

    const userDoc = await getFirestore().collection("users").doc(decoded.uid).get();
    if (!userDoc.exists || userDoc.data().role !== "admin") {
      return res.status(403).json({ error: "Hanya admin yang boleh melakukan restore." });
    }

    /* Restore adalah operasi destruktif. Minta autentikasi yang relatif baru. */
    if (action === 'restore' && Number(decoded.auth_time || 0) < Math.floor((Date.now() - PLAN_TTL_MS) / 1000)) {
      return res.status(401).json({ error: "Sesi admin sudah terlalu lama. Login ulang sebelum melakukan restore." });
    }

    const validation = validateBackup(backup);
    const fdb = getFirestore();
    const backupHash = hashBackup(backup);

    if (action === 'preview') {
      const diff = await buildSummary(backup, fdb);
      return res.status(200).json({
        ok: true,
        backupFormatVersion: getBackupVersion(backup),
        appVersion: backup.appVersion || null,
        documentCount: validation.total,
        ...diff,
        confirmToken: makePlan(decoded.uid, backupHash),
        expiresInSeconds: Math.floor(PLAN_TTL_MS / 1000)
      });
    }

    readPlan(confirmToken, decoded.uid, backupHash);
    const result = await applyRestore(backup, fdb);
    return res.status(200).json({ ok: true, message: "Restore selesai.", ...result });
  } catch (error) {
    console.error("[api/backup-restore] Error:", error);
    return res.status(400).json({ error: error.message || "Restore gagal." });
  }
};
