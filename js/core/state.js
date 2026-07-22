/* =========================================================
   STATE.JS — Helper shared lintas halaman
   Diekstrak dari dashboard.js (Fase 3 — modularisasi).
   Tidak ada perubahan logika, hanya pemindahan lokasi.
   Bergantung pada global dari core/utils.js (renderTable,
   tampilToast) dan firebase-config.js (FIREBASE_ENABLED).
   ========================================================= */

/**
 * Pasang search bar realtime ke tabel.
 * Dipakai oleh: anggota.js, kegiatan.js, keuangan.js, presensi.js.
 */
function pasangSearch(inputId, tbodyId, data, rowFn, kolom) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.addEventListener("input", () => {
    const q = input.value.toLowerCase().trim();
    const filtered = q
      ? data.filter(d => kolom.some(k => String(d[k]||"").toLowerCase().includes(q)))
      : data;
    renderTable(document.getElementById(tbodyId), filtered, rowFn);
  });
}

/**
 * Kartu statistik (angka besar + ikon + delta).
 * Dipakai oleh: beranda.js.
 *
 * F3.3: dir bisa "up"/"down" (menampilkan arrow, perilaku lama
 * tidak berubah) ATAU dikosongkan/"neutral" untuk kasus di mana
 * tidak ada data tren historis nyata — menghindari statistik palsu
 * (arrow "▲ up" yang di-hardcode tanpa dasar perbandingan data).
 */
function statCard(label, value, delta, dir, svgPath) {
  const adaArrow = dir === "up" || dir === "down";
  const deltaHtml = adaArrow
    ? `<div class="stat-delta ${dir}">${dir==="up"?"▲":"▼"} ${delta}</div>`
    : `<div class="stat-delta" style="color:var(--ink-soft)">${delta}</div>`;

  return `<div class="card stat-card">
    <div class="stat-icon">
      <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">${svgPath}</svg>
    </div>
    <div class="stat-value">${value}</div>
    <div class="stat-label">${label}</div>
    ${deltaHtml}
  </div>`;
}

/**
 * Tombol simpan: loading state + pesan mode + error handling.
 * Dipakai oleh: anggota.js, kegiatan.js, keuangan.js.
 */
async function _jalankanSimpan(btnId, fn) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const teks = btn.textContent;
  btn.disabled = true;
  btn.textContent = FIREBASE_ENABLED ? "Menyimpan…" : "Memproses…";
  try { await fn(); }
  catch(e) {
    console.error("[PMR] Simpan error:", e);
    tampilToast("Terjadi kesalahan: " + e.message, "danger");
    btn.disabled = false;
    btn.textContent = teks;
  }
}
