/* =========================================================
   ACTIVITY + PEMBINA NOTES
   v1.1.42
   Log aplikasi ringan, bukan audit keamanan.
   ========================================================= */

function _activityEsc(value) {
  return String(value ?? "—")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

async function logActivity(activity, detail = "") {
  if (!FIREBASE_ENABLED) return;
  try {
    const user = getCurrentUser();
    if (!user || user.role === "demo") return;
    await firebase.firestore().collection("activityLogs").add({
      uid: String(user.authUid || ""),
      nama: String(user.nama || "Pengguna"),
      role: String(user.role || "unknown"),
      activity: String(activity || "Aktivitas"),
      detail: String(detail || ""),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    console.warn("[PMR] Activity log gagal:", e);
  }
}

async function fetchPembinaNotes(limit = 20, forAdmin = false, force = false) {
  if (!FIREBASE_ENABLED) return [];
  try {
    const user = getCurrentUser();
    if (!user) return [];
    const cacheKey = `pmr_notes_${forAdmin ? "admin" : String(user.authUid || "pembina")}`;
    const cached = window.__PMR_NOTES_CACHE?.[cacheKey];
    if (!force && cached && (Date.now() - cached.time) < 30000) return cached.items.slice(0, limit);
    let q = firebase.firestore().collection("catatanPembina");
    if (!forAdmin) q = q.where("authorUid", "==", String(user.authUid || ""));
    const snap = await q.limit(Math.max(limit, 50)).get();
    const items = snap.docs.map(d => ({ id:d.id, ...d.data() }))
      .sort((a,b) => {
        const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
        const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
        return tb - ta;
      });
    window.__PMR_NOTES_CACHE = window.__PMR_NOTES_CACHE || {};
    window.__PMR_NOTES_CACHE[cacheKey] = { time:Date.now(), items };
    return items.slice(0, limit);
  } catch (e) {
    console.warn("[PMR] Catatan Pembina gagal dimuat:", e);
    return [];
  }
}

async function createPembinaNote({ title, body, status = "Catatan" }) {
  if (!FIREBASE_ENABLED) return { ok:false, error:"Firebase tidak aktif." };
  const user = getCurrentUser();
  if (!user || user.role !== "pembina") return { ok:false, error:"Akses hanya untuk Pembina." };
  try {
    const ref = await firebase.firestore().collection("catatanPembina").add({
      title: String(title || "").trim(),
      body: String(body || "").trim(),
      status: String(status || "Catatan"),
      authorUid: String(user.authUid || ""),
      authorName: String(user.nama || "Pembina"),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await logActivity("Tambah Catatan Pembina", String(title || "").trim());
    window.__PMR_NOTES_CACHE = {};
    return { ok:true, id:ref.id };
  } catch (e) {
    return { ok:false, error:e.message || "Gagal menyimpan catatan." };
  }
}

function _formatActivityTime(value) {
  try {
    const d = value?.toDate ? value.toDate() : new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("id-ID", { dateStyle:"medium", timeStyle:"short" });
  } catch { return "—"; }
}
