/* =========================================================
   PAGES/LAPORAN.JS (F4.3 — Report Engine)
   =========================================================
   Halaman ini TIDAK berisi logika laporan apa pun — murni UI
   pemilih jenis laporan + tombol aksi. Seluruh logika (data,
   kolom, render, export) ada di js/core/report-engine.js supaya
   Report Engine benar-benar generik satu jalur untuk semua
   jenis laporan (sesuai spec F4.3).

   RBAC: daftar jenis laporan yang muncul di sini sudah disaring
   lewat REPORT_ROLE_ACCESS (report-engine.js), yang memakai
   ulang RBAC yang sudah ada di project (ROLE_AKSES_KEUANGAN,
   ROLE_AKSES_PRESENSI, dan pola sembunyikanUntukAnggota).
   ========================================================= */
function renderLaporan(el, user) {
  const daftarLaporan = REPORT_DEFINITIONS.filter(cfg =>
    (REPORT_ROLE_ACCESS[cfg.key] || []).includes(user.role));

  el.innerHTML = `
  <div class="page-head">
    <div><h1>Laporan</h1><p class="page-sub">Pusat export laporan organisasi — Print, PDF, atau CSV</p></div>
  </div>

  <div class="laporan-picker" id="laporan-picker">
    ${daftarLaporan.map(cfg => `
      <button type="button" class="card laporan-tipe-btn" data-key="${cfg.key}">
        <div class="laporan-tipe-icon">${cfg.emoji}</div>
        <div class="laporan-tipe-label">${cfg.label}</div>
        <div class="laporan-tipe-desc">${cfg.deskripsi}</div>
      </button>`).join("")}
  </div>

  ${daftarLaporan.length === 0 ? `
    <div class="card"><div class="empty-state">
      <p>Tidak ada jenis laporan yang tersedia untuk role Anda.</p>
    </div></div>
  ` : `
    <div class="card laporan-toolbar">
      <div class="laporan-toolbar-title" id="laporan-hasil-judul"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-outline btn-sm" id="btn-laporan-cetak">🖨 Cetak</button>
        <button class="btn btn-outline btn-sm" id="btn-laporan-pdf">⬇ Unduh PDF</button>
        <button class="btn btn-outline btn-sm" id="btn-laporan-csv">⬇ Unduh CSV</button>
      </div>
    </div>
    <div id="laporan-preview-area" class="laporan-sheet"></div>
  `}`;

  if (daftarLaporan.length === 0) return;

  let cfgAktif = null;
  let rowsAktif = [];

  function tampilkanLaporan(cfg) {
    cfgAktif  = cfg;
    rowsAktif = cfg.getData(user) || [];

    document.querySelectorAll(".laporan-tipe-btn").forEach(b =>
      b.classList.toggle("active", b.dataset.key === cfg.key));
    document.getElementById("laporan-hasil-judul").textContent = `Laporan ${cfg.label}`;
    document.getElementById("laporan-preview-area").innerHTML =
      ReportEngine.renderPreviewHTML(cfg, rowsAktif);
  }

  document.getElementById("laporan-picker").addEventListener("click", (e) => {
    const btn = e.target.closest(".laporan-tipe-btn");
    if (!btn) return;
    const cfg = daftarLaporan.find(c => c.key === btn.dataset.key);
    if (cfg) tampilkanLaporan(cfg);
  });

  document.getElementById("btn-laporan-cetak").addEventListener("click", () => {
    window.print();
  });

  document.getElementById("btn-laporan-pdf").addEventListener("click", async () => {
    const btn = document.getElementById("btn-laporan-pdf");
    const teksAsli = btn.textContent;
    btn.disabled = true; btn.textContent = "Membuat PDF…";
    try {
      await ReportEngine.exportPDF(cfgAktif, rowsAktif);
    } catch (e) {
      console.error("[PMR] Gagal export PDF:", e);
      tampilToast("Gagal membuat PDF: " + e.message, "danger");
    } finally {
      btn.disabled = false; btn.textContent = teksAsli;
    }
  });

  document.getElementById("btn-laporan-csv").addEventListener("click", () => {
    try {
      ReportEngine.exportCSV(cfgAktif, rowsAktif);
    } catch (e) {
      console.error("[PMR] Gagal export CSV:", e);
      tampilToast("Gagal membuat CSV: " + e.message, "danger");
    }
  });

  /* Tampilkan jenis laporan pertama yang tersedia secara default */
  tampilkanLaporan(daftarLaporan[0]);
}
