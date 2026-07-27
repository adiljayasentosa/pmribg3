/* =========================================================
   API/IMAGEKIT-DELETE.JS — [F8.0 — ImageKit Migration]      BARU
   =========================================================
   Vercel Serverless Function, CommonJS (alasan sama dengan
   imagekit-auth.js — tidak ada package.json di project ini).

   ImageKit Delete API (DELETE /v1/files/{fileId}) mewajibkan
   Basic Auth pakai private key — TIDAK BISA dipanggil langsung
   dari browser tanpa membocorkan key. Endpoint ini jadi
   perantara: browser kirim fileId saja, server yang menyertakan
   privateKey saat memanggil ImageKit.

   privateKey HANYA dipakai di sini untuk Authorization header
   ke ImageKit, TIDAK PERNAH dikirim balik ke browser.
   ========================================================= */

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
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on("error", reject);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method tidak diizinkan. Gunakan POST." });
  }

  try {
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    if (!privateKey) {
      return res.status(500).json({ error: "Konfigurasi ImageKit belum lengkap di server." });
    }

    const { fileId } = req.body || {};
    if (!fileId || typeof fileId !== "string") {
      return res.status(400).json({ error: "fileId wajib diisi." });
    }

    const hasil = await panggilImageKitDelete(fileId, privateKey);

    /* ImageKit balas 204 (berhasil) atau 404 (sudah tidak ada) —
       keduanya dianggap "aman", supaya tombol Hapus di UI tidak
       gagal hanya karena file sudah lebih dulu terhapus manual. */
    if (hasil.status === 204 || hasil.status === 404) {
      return res.status(200).json({ ok: true });
    }
    console.error("[api/imagekit-delete] ImageKit menolak:", hasil.status, hasil.body);
    return res.status(502).json({ error: "ImageKit menolak permintaan hapus." });
  } catch (error) {
    console.error("[api/imagekit-delete] Error:", error);
    return res.status(500).json({ error: "Gagal menghapus file di ImageKit." });
  }
};
