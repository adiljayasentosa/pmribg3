/* =========================================================
   UTILITIES
   Fungsi pembantu yang dipakai lintas modul.
   ========================================================= */

/** Format angka ke Rupiah: 2450000 → "Rp 2.450.000" */
function formatRupiah(angka) {
  return "Rp " + Number(angka).toLocaleString("id-ID");
}

/** Format tanggal ISO ke Indonesia: "2026-07-04" → "4 Juli 2026" */
function formatTanggal(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

/** [F4.4] Format bulan+tahun ke Indonesia: (7, 2026) → "Juli 2026".
 *  Dipakai oleh firebase-db.js (DB.iuran), keuangan.js, report-engine.js.
 *  Sengaja pakai Intl (sama seperti formatTanggal/formatHari), BUKAN
 *  array nama-bulan manual, supaya satu-satunya sumber nama bulan
 *  konsisten di seluruh aplikasi. */
function formatBulanTahun(bulan, tahun) {
  return new Date(tahun, bulan - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

/** Ambil inisial dari nama: "Raka Pratama" → "RP" */
function getInisial(nama) {
  return nama
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/**
 * Buat badge HTML berdasarkan status teks.
 * status: "Aktif" | "Tidak Aktif" | "Selesai" | "Terjadwal" | ...
 */
function statusBadge(status) {
  const map = {
    "Aktif":       "badge-success",
    "Tidak Aktif": "badge-gray",
    "Selesai":     "badge-success",
    "Terjadwal":   "badge-info",
    "Menunggu":    "badge-warning",
    "Dibatalkan":  "badge-gray",
    "Masuk":       "badge-success",
    "Keluar":      "badge-red",
    /* F4.0 — Kondisi barang inventaris */
    "Baik":          "badge-success",
    "Rusak Ringan":  "badge-warning",
    "Rusak Berat":   "badge-red",
    "Perlu Diganti": "badge-info",
    /* F4.4 — Status pembayaran iuran bulanan */
    "Lunas":         "badge-success",
    "Khusus":        "badge-info",
    "Belum Bayar":   "badge-warning"
  };
  const cls = map[status] || "badge-gray";
  return `<span class="badge ${cls}">${status}</span>`;
}

/**
 * Tampilkan toast notifikasi.
 * @param {string} pesan
 * @param {"default"|"success"|"danger"} tipe
 * @param {number} durasi  ms sebelum menghilang
 */
function tampilToast(pesan, tipe = "default", durasi = 3000) {
  let stack = document.getElementById("toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.id = "toast-stack";
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }

  const el = document.createElement("div");
  el.className = "toast " + (tipe !== "default" ? tipe : "");
  el.textContent = pesan;
  stack.appendChild(el);

  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity 0.3s";
    setTimeout(() => el.remove(), 350);
  }, durasi);
}

/**
 * Render baris tabel dari array data.
 * @param {HTMLElement} tbody  — elemen <tbody>
 * @param {Array}       rows   — array objek data
 * @param {Function}    rowFn  — fn(item) → HTML string satu <tr>
 */
function renderTable(tbody, rows, rowFn) {
  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="99"><div class="empty-state">
      <svg class="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
      </svg>
      <p>Belum ada data.</p>
    </div></td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map((item, index) => rowFn(item, index)).join("");
}

/** Helper: cegah aksi default form & balikin data FormData sebagai object */
function getFormValues(formEl) {
  formEl.addEventListener("submit", (e) => e.preventDefault(), { once: true });
  return Object.fromEntries(new FormData(formEl));
}

/* =========================================================
   SKELETON LOADING — generator (F5.1 — UI Polish Final)
   =========================================================
   Satu komponen skeleton dipakai di seluruh project (bukan
   spinner). Semua fungsi murni presentasi: mengembalikan
   string HTML berisi elemen ber-class `.skeleton*` yang
   sudah didefinisikan di css/components.css. Tidak membaca
   atau mengubah AppState/Firestore — aman dipanggil kapan pun,
   termasuk sebelum data siap.
   ========================================================= */

/** Beberapa baris teks skeleton dengan lebar acak wajar. */
function skLines(n = 3) {
  const widths = ["w-100", "w-75", "w-60", "w-40"];
  return Array.from({ length: n }, (_, i) =>
    `<div class="skeleton skeleton-text ${widths[i % widths.length]}"></div>`).join("");
}

/** 1) Kartu skeleton generik (mis. pengganti stat-card / card konten). */
function skCard({ icon = true, lines = 2 } = {}) {
  return `<div class="skeleton-card">
    ${icon ? `<div class="skeleton skeleton-circle"></div>` : ""}
    <div class="skeleton skeleton-title"></div>
    ${skLines(lines)}
  </div>`;
}

/** Baris kartu skeleton (mis. grid stat card). */
function skCardRow(n = 4) {
  return `<div class="grid grid-${n > 4 ? 4 : n}">${Array.from({ length: n }, () => skCard({ lines: 1 })).join("")}</div>`;
}

/** 2) Baris tabel skeleton — cols = jumlah kolom semu per baris. */
function skTableRows(cols = 4, rows = 5) {
  return Array.from({ length: rows }, () =>
    `<div class="skeleton-table-row">${Array.from({ length: cols }, () => `<div class="skeleton"></div>`).join("")}</div>`
  ).join("");
}

/** 3) List skeleton (item dengan avatar bulat) — dipakai utk jadwal/pengumuman/aktivitas. */
function skList(n = 4) {
  return Array.from({ length: n }, () => `
    <div class="skeleton-list-item">
      <div class="skeleton skeleton-circle"></div>
      <div class="skeleton-list-body">
        <div class="skeleton skeleton-text w-60"></div>
        <div class="skeleton skeleton-text w-40"></div>
      </div>
    </div>`).join("");
}

/** 4) Grid kalender skeleton (7 kolom, n sel). */
function skCalendar(n = 35) {
  return `<div class="skeleton-calendar">${Array.from({ length: n }, () => `<div class="skeleton"></div>`).join("")}</div>`;
}

/** 5) Chart batang skeleton — n batang tinggi acak wajar. */
function skChart(n = 7) {
  const heights = [40, 65, 50, 80, 55, 70, 45];
  return `<div class="skeleton-chart">${Array.from({ length: n }, (_, i) =>
    `<div class="skeleton" style="height:${heights[i % heights.length]}%"></div>`).join("")}</div>`;
}

/** 6) Profil skeleton (avatar besar + beberapa baris info). */
function skProfile() {
  return `<div class="skeleton-profile">
    <div class="skeleton skeleton-circle"></div>
    <div class="skeleton skeleton-text w-40" style="height:16px"></div>
    <div class="skeleton skeleton-text w-25"></div>
  </div>`;
}

/** 7) Grid video skeleton (thumbnail 16:9 + judul). */
function skVideoGrid(n = 3) {
  return `<div class="grid grid-3">${Array.from({ length: n }, () => `
    <div>
      <div class="skeleton skeleton-video"></div>
      <div class="skeleton skeleton-text w-75" style="margin-top:12px"></div>
      <div class="skeleton skeleton-text w-40"></div>
    </div>`).join("")}</div>`;
}

/** Skeleton halaman penuh generik: judul + beberapa baris kartu/list.
 *  Dipakai dashboard.js sebagai tampilan sementara SEBELUM DB.init()
 *  selesai (satu-satunya jeda loading Firestore yang nyata di app ini
 *  — lihat komentar di dashboard.js). */
function skPageBeranda() {
  return `
  <div class="skeleton skeleton-title" style="width:220px;height:26px;margin-bottom:20px"></div>
  <div class="skeleton" style="height:220px;border-radius:var(--radius-lg);margin-bottom:24px"></div>
  <div class="grid grid-4" style="margin-bottom:24px">${Array.from({ length: 4 }, () => skCard({ lines: 1 })).join("")}</div>
  <div class="grid grid-3">
    <div class="skeleton-card">${skList(3)}</div>
    <div class="skeleton-card">${skList(3)}</div>
    <div class="skeleton-card">${skList(2)}</div>
  </div>`;
}

/** Skeleton generik: baris stat card + toolbar (search/filter) + tabel.
 *  Cocok untuk halaman list/CRUD: Anggota, Kegiatan, Inventaris,
 *  Presensi, Keuangan, Pengurus, Laporan, Petugas Upacara. */
function skPageStatTable({ stats = 4, cols = 5, rows = 6 } = {}) {
  return `
  <div class="skeleton skeleton-title" style="width:200px;height:24px;margin-bottom:18px"></div>
  ${stats ? `<div class="grid grid-${stats}" style="margin-bottom:20px">${Array.from({ length: stats }, () => skCard({ lines: 1 })).join("")}</div>` : ""}
  <div class="skeleton-card">
    <div class="skeleton-row" style="margin-bottom:18px">
      <div class="skeleton" style="height:38px;flex:2"></div>
      <div class="skeleton" style="height:38px"></div>
      <div class="skeleton" style="height:38px"></div>
    </div>
    ${skTableRows(cols, rows)}
  </div>`;
}

/** Skeleton Piket/Upacara: stat row + kalender + jadwal (tabel). */
function skPagePiketUpacara() {
  return `
  <div class="skeleton skeleton-title" style="width:200px;height:24px;margin-bottom:18px"></div>
  <div class="grid grid-4" style="margin-bottom:20px">${Array.from({ length: 4 }, () => skCard({ lines: 1 })).join("")}</div>
  <div class="skeleton-card" style="margin-bottom:20px">${skCalendar(14)}</div>
  <div class="skeleton-card">${skTableRows(5, 5)}</div>`;
}

/** Skeleton Profil: avatar besar + informasi. */
function skPageProfil() {
  return `<div class="grid grid-3">
    <div class="skeleton-card">${skProfile()}</div>
    <div class="skeleton-card" style="grid-column:span 2">${skLines(6)}</div>
  </div>`;
}

/** Dispatcher: pilih bentuk skeleton sesuai halaman tujuan (dibaca dari
 *  location.hash — TEKNIK YANG SAMA dengan yang sudah dipakai router
 *  navigateTo() untuk `initPage`). Murni presentasi: hanya menentukan
 *  markup placeholder mana yang ditampilkan sesaat sebelum DB.init()
 *  selesai — tidak mengubah routing/logic itu sendiri. */
function skeletonUntukHalaman(pageId) {
  switch (pageId) {
    case "piket":
    case "upacara":
      return skPagePiketUpacara();
    case "profilsaya":
      return skPageProfil();
    case "presensi":
      return skPageStatTable({ stats: 3, cols: 4, rows: 6 });
    case "keuangan":
      return skPageStatTable({ stats: 3, cols: 4, rows: 6 });
    case "laporan":
      return skPageStatTable({ stats: 4, cols: 4, rows: 5 });
    case "anggota":
    case "kegiatan":
    case "inventaris":
    case "pengurus":
      return skPageStatTable({ stats: 4, cols: 5, rows: 6 });
    case "pengaturan":
      return skPageProfil();
    case "beranda":
    default:
      return skPageBeranda();
  }
}
