/* =========================================================
   API/IMAGEKIT-AUTH.JS — [F8.0 — ImageKit Migration]
   =========================================================
   Vercel Serverless Function (Node.js runtime, CommonJS —
   project ini tidak punya package.json, jadi CommonJS dipakai
   supaya jalan tanpa konfigurasi tambahan apapun).

   Menghasilkan parameter otentikasi yang dibutuhkan ImageKit
   untuk UPLOAD LANGSUNG DARI BROWSER (client-side upload):
   token, expire, dan signature (HMAC-SHA1 dari token+expire
   memakai IMAGEKIT_PRIVATE_KEY).

   IMAGEKIT_PRIVATE_KEY HANYA dibaca di sini (server), dipakai
   untuk menghitung signature, dan TIDAK PERNAH dikembalikan
   ke response. Yang dikirim ke browser hanya: token, expire,
   signature (hasil HMAC, bukan key itu sendiri), publicKey
   (memang publik), dan urlEndpoint (memang publik).
   ========================================================= */

const crypto = require("crypto");

module.exports = function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method tidak diizinkan. Gunakan GET." });
  }

  try {
    const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;

    if (!publicKey || !privateKey || !urlEndpoint) {
      return res.status(500).json({ error: "Konfigurasi ImageKit belum lengkap di server (environment variable hilang)." });
    }

    const token = crypto.randomBytes(16).toString("hex");
    const expire = Math.floor(Date.now() / 1000) + 10 * 60; // berlaku 10 menit
    const signature = crypto
      .createHmac("sha1", privateKey)
      .update(token + expire)
      .digest("hex");

    /* privateKey TIDAK ikut di sini — hanya hasil turunannya (signature). */
    return res.status(200).json({ token, expire, signature, publicKey, urlEndpoint });
  } catch (error) {
    console.error("[api/imagekit-auth] Error:", error);
    return res.status(500).json({ error: "Gagal membuat parameter otentikasi ImageKit." });
  }
};
