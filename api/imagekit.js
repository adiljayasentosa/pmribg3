/* =========================================================
   API/IMAGEKIT.JS — ImageKit server-side helpers
   GET  /api/imagekit -> upload auth (authenticated staff only)
   POST /api/imagekit -> delete file (authenticated staff only)
   Private key is never returned to the browser.
   ========================================================= */
const crypto = require("crypto");
const https = require("https");

function json(res, status, payload) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  return res.status(status).json(payload);
}

function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body || "{}"); } catch (_) { return {}; }
  }
  return {};
}

async function verifyStaff(idToken) {
  if (!idToken) throw Object.assign(new Error("Token login wajib diisi."), { statusCode: 401 });
  const raw = String(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "").trim();
  if (!raw) throw Object.assign(new Error("Backend Firebase belum dikonfigurasi."), { statusCode: 500 });
  let serviceAccount;
  try { serviceAccount = JSON.parse(raw); }
  catch (_) { throw Object.assign(new Error("Konfigurasi Firebase server tidak valid."), { statusCode: 500 }); }

  const { initializeApp, cert, getApps } = require("firebase-admin/app");
  if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });
  const { getAuth } = require("firebase-admin/auth");
  const { getFirestore } = require("firebase-admin/firestore");
  const decoded = await getAuth().verifyIdToken(idToken, true);
  const profile = await getFirestore().collection("users").doc(decoded.uid).get();
  if (!profile.exists) throw Object.assign(new Error("Profil akun tidak ditemukan."), { statusCode: 403 });
  const role = String(profile.data()?.role || "").trim().toLowerCase();
  const allowed = new Set(["admin", "pembina", "pengurus", "ketua", "wakil", "sekretaris", "bendahara", "pj", "pj_pertolongan_pertama", "pj_tandu"]);
  if (!allowed.has(role) && !role.startsWith("pj_")) throw Object.assign(new Error("Akses hanya untuk akun pengurus yang berwenang."), { statusCode: 403 });
  return decoded;
}

function panggilImageKitDelete(fileId, privateKey) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${privateKey}:`).toString("base64");
    const req = https.request({
      hostname: "api.imagekit.io",
      path: `/v1/files/${encodeURIComponent(fileId)}`,
      method: "DELETE",
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
      timeout: 10000
    }, (response) => {
      let data = "";
      response.on("data", chunk => { if (data.length < 20000) data += chunk.toString(); });
      response.on("end", () => resolve({ status: response.statusCode, body: data }));
    });
    req.on("timeout", () => req.destroy(new Error("ImageKit timeout.")));
    req.on("error", reject);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return json(res, 405, { error: "Method tidak diizinkan. Gunakan GET atau POST." });
  }

  try {
    const body = parseBody(req);
    await verifyStaff(String(body.idToken || req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim());

    if (req.method === "GET") {
      const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
      const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
      const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;
      if (!publicKey || !privateKey || !urlEndpoint) {
        return json(res, 500, { error: "Konfigurasi ImageKit belum lengkap di server." });
      }
      const token = crypto.randomBytes(16).toString("hex");
      const expire = Math.floor(Date.now() / 1000) + 10 * 60;
      const signature = crypto.createHmac("sha1", privateKey).update(token + expire).digest("hex");
      res.setHeader("Cache-Control", "no-store");
      return json(res, 200, { token, expire, signature, publicKey, urlEndpoint });
    }

    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    if (!privateKey) return json(res, 500, { error: "Konfigurasi ImageKit belum lengkap di server." });
    const fileId = String(body.fileId || "").trim();
    if (!fileId || fileId.length > 200 || !/^[A-Za-z0-9_-]+$/.test(fileId)) {
      return json(res, 400, { error: "fileId ImageKit tidak valid." });
    }
    const result = await panggilImageKitDelete(fileId, privateKey);
    if (result.status === 204 || result.status === 404) return json(res, 200, { ok: true });
    console.error("[api/imagekit] ImageKit menolak:", result.status, result.body);
    return json(res, 502, { error: "ImageKit menolak permintaan hapus." });
  } catch (error) {
    const status = Number(error?.statusCode) || (String(error?.code || "").startsWith("auth/") ? 401 : 500);
    if (status >= 500) console.error("[api/imagekit] Request error:", error);
    return json(res, status, { error: status === 401 ? "Sesi login tidak valid. Silakan login ulang." : (error.message || "Permintaan ImageKit gagal.") });
  }
};
