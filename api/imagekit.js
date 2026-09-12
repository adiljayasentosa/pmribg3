/* =========================================================
   API/IMAGEKIT.JS — ImageKit server-side helpers
   GET  /api/imagekit  -> upload authentication parameters
   POST /api/imagekit -> delete a file by ImageKit fileId
   Private key is never returned to the browser.
   ========================================================= */
const crypto = require("crypto");
const https = require("https");

function panggilImageKitDelete(fileId, privateKey) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${privateKey}:`).toString("base64");
    const req = https.request(
      {
        hostname: "api.imagekit.io",
        path: `/v1/files/${encodeURIComponent(fileId)}`,
        method: "DELETE",
        headers: { Authorization: `Basic ${auth}` }
      },
      (response) => {
        let data = "";
        response.on("data", (chunk) => (data += chunk));
        response.on("end", () => resolve({ status: response.statusCode, body: data }));
      }
    );
    req.on("error", reject);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
      const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
      const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;
      if (!publicKey || !privateKey || !urlEndpoint) {
        return res.status(500).json({ error: "Konfigurasi ImageKit belum lengkap di server (environment variable hilang)." });
      }
      const token = crypto.randomBytes(16).toString("hex");
      const expire = Math.floor(Date.now() / 1000) + 10 * 60;
      const signature = crypto.createHmac("sha1", privateKey).update(token + expire).digest("hex");
      return res.status(200).json({ token, expire, signature, publicKey, urlEndpoint });
    } catch (error) {
      console.error("[api/imagekit] Auth error:", error);
      return res.status(500).json({ error: "Gagal membuat parameter otentikasi ImageKit." });
    }
  }

  if (req.method === "POST") {
    try {
      const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
      if (!privateKey) return res.status(500).json({ error: "Konfigurasi ImageKit belum lengkap di server." });
      const { fileId } = req.body || {};
      if (!fileId || typeof fileId !== "string") return res.status(400).json({ error: "fileId wajib diisi." });
      const hasil = await panggilImageKitDelete(fileId, privateKey);
      if (hasil.status === 204 || hasil.status === 404) return res.status(200).json({ ok: true });
      console.error("[api/imagekit] ImageKit menolak:", hasil.status, hasil.body);
      return res.status(502).json({ error: "ImageKit menolak permintaan hapus." });
    } catch (error) {
      console.error("[api/imagekit] Delete error:", error);
      return res.status(500).json({ error: "Gagal menghapus file di ImageKit." });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method tidak diizinkan. Gunakan GET atau POST." });
};
