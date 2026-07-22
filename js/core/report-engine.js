/* =========================================================
   REPORT-ENGINE.JS (F4.3 — Report Engine)
   =========================================================
   Engine GENERIK untuk seluruh jenis laporan. Satu template,
   satu jalur render (REPORT_DEFINITIONS → renderPreviewHTML →
   Cetak/PDF/CSV) dipakai oleh SEMUA jenis laporan — tidak ada
   implementasi terpisah per laporan.

   Menambah HALAMAN baru ("Laporan") lewat js/pages/laporan.js.
   TIDAK mengubah Firestore Schema/Rules/Auth, TIDAK menambah
   role baru. RBAC memakai ulang konstanta yang sudah ada
   (ROLE_AKSES_KEUANGAN, ROLE_AKSES_PRESENSI dari firebase-db.js)
   ditambah pemetaan yang mencerminkan visibilitas sidebar yang
   sudah berlaku (lihat REPORT_ROLE_ACCESS di bawah).

   Dependency baru (CDN, dimuat dari dashboard.html — TIDAK ada
   perubahan pada firebase-config.js/Firestore):
     - jsPDF 2.5.2      → generate file PDF
     - jsPDF-AutoTable 3.8.2 → tabel otomatis + header/footer
       berulang tiap halaman + nomor halaman di PDF.
   Tanpa library ini, tombol "PDF" akan menampilkan pesan error
   yang jelas (lihat _pastikanJsPDF()) — tidak pernah gagal diam.
   [F4.4] Perluasan (Fitur 1.D — Update Sistem Keuangan):
     - Laporan "Keuangan" sekarang memuat rekap pembayaran iuran
       (summary diperluas + subTable baru: rekap per anggota).
     - ReportEngine diperluas dengan dukungan `cfg.subTable` (tabel
       kedua opsional per laporan) — additive, tidak mengubah
       perilaku 7 laporan F4.3 yang tidak memakainya.
     - Perbaikan bug: cfg.summary() SEBELUMNYA tidak pernah ikut ke
       export PDF/CSV (hanya tampil di preview/print) — sekarang
       konsisten di ketiga jalur export.
     TIDAK ada engine export baru dibuat — semua lewat ReportEngine
     yang sama (F4.3), sesuai instruksi PATCH F4.4.
   ========================================================= */

/* ─────────────────────────────────────────────────────────
   IDENTITAS ORGANISASI — dipakai di header/footer SEMUA laporan.
   Sengaja TANPA info tahun/masa bakti (mis. "2025/2026") — sesuai
   keputusan: info itu tidak informatif untuk laporan dan berpotensi
   rancu (tahun ajaran? tahun laporan? tahun generate?). Tanggal
   Generate di bawah judul sudah cukup sebagai info waktu.
───────────────────────────────────────────────────────── */
const LAPORAN_ORG = {
  nama:      "PMR WIRA UNIT",
  sub:       "SMK IBG 3",
  logo:      "assets/logo.svg",
  identitas: "Sistem Manajemen PMR WIRA UNIT SMK IBG 3"
};

/* ─────────────────────────────────────────────────────────
   RBAC PER JENIS LAPORAN
   Memakai ulang ROLE_AKSES_KEUANGAN & ROLE_AKSES_PRESENSI yang
   SUDAH ADA di firebase-db.js (sinkron dengan Firestore Rules)
   untuk laporan Keuangan & Presensi. Untuk laporan Anggota,
   mengikuti kesepakatan yang SUDAH berlaku di sidebar (lihat
   `sembunyikanUntukAnggota` di dashboard.js) — role "anggota"
   tidak melihat menu "Anggota" (memakai akun bersama, hanya
   melihat profil sendiri lewat Profil Saya), sehingga juga
   tidak diberi opsi cetak roster Anggota di sini. Inventaris,
   Kegiatan, dan Piket bersifat baca-universal (sesuai komentar
   RBAC di inventaris.js/piket.js), begitu juga Pengumuman
   karena sumber datanya sama dengan Kegiatan.
───────────────────────────────────────────────────────── */
const _SEMUA_ROLE = ["admin","ketua","wakil","sekretaris","bendahara","pj","anggota"];

const REPORT_ROLE_ACCESS = {
  anggota:    _SEMUA_ROLE.filter(r => r !== "anggota"),
  inventaris: _SEMUA_ROLE,
  keuangan:   ROLE_AKSES_KEUANGAN,
  kegiatan:   _SEMUA_ROLE,
  presensi:   ROLE_AKSES_PRESENSI,
  piket:      _SEMUA_ROLE,
  pengumuman: _SEMUA_ROLE
};

/* ─────────────────────────────────────────────────────────
   Helper kolom Kegiatan — dipakai BERSAMA oleh laporan
   "Kegiatan" dan "Pengumuman" (sumber data identik, sesuai
   keputusan: Pengumuman = seluruh data Kegiatan). Didefinisikan
   sekali agar tidak ada duplikasi definisi kolom.
───────────────────────────────────────────────────────── */
const _KOLOM_KEGIATAN = [
  { key:"nama",     label:"Nama Kegiatan" },
  { key:"tanggal",  label:"Tanggal",  format:r => formatTanggal(r.tanggal) },
  { key:"lokasi",   label:"Lokasi",   format:r => r.lokasi || "—" },
  { key:"pj",       label:"Penanggung Jawab", format:r => r.pj || "—" },
  { key:"peserta",  label:"Peserta",  format:r => `${r.peserta||0} orang`, align:"right" },
  { key:"status",   label:"Status" }
];
function _dataKegiatan() { return AppState.kegiatan; }

/* ─────────────────────────────────────────────────────────
   REPORT_DEFINITIONS — SATU tempat pendaftaran seluruh jenis
   laporan. Menambah jenis laporan baru = menambah satu entri
   di sini, TANPA menyentuh ReportEngine ataupun laporan.js.
───────────────────────────────────────────────────────── */
const REPORT_DEFINITIONS = [
  {
    key: "anggota", label: "Data Anggota", emoji: "👥",
    deskripsi: "Daftar seluruh anggota terdaftar",
    columns: [
      { key:"nama",      label:"Nama" },
      { key:"kelas",     label:"Kelas" },
      { key:"divisi",    label:"Divisi" },
      { key:"status",    label:"Status" },
      { key:"noHp",      label:"No. HP", format:r => r.noHp || "—" },
      { key:"bergabung", label:"Bergabung", format:r => formatTanggal(r.bergabung) }
    ],
    getData: () => AppState.anggota,
    summary: rows => [
      { label:"Total Anggota", value:rows.length },
      { label:"Aktif",         value:rows.filter(a=>a.status==="Aktif").length },
      { label:"Tidak Aktif",   value:rows.filter(a=>a.status==="Tidak Aktif").length }
    ]
  },
  {
    key: "inventaris", label: "Inventaris", emoji: "📦",
    deskripsi: "Aset & perlengkapan PMR",
    columns: [
      { key:"nama",       label:"Nama Barang" },
      { key:"kategori",   label:"Kategori" },
      { key:"jumlah",     label:"Jumlah", format:r => `${r.jumlah ?? 0} ${r.satuan||""}`.trim(), align:"right" },
      { key:"kondisi",    label:"Kondisi" },
      { key:"lokasi",     label:"Lokasi",     format:r => r.lokasi || "—" },
      { key:"keterangan", label:"Keterangan", format:r => r.keterangan || "—" }
    ],
    getData: () => AppState.inventaris,
    summary: rows => [
      { label:"Total Jenis Barang", value:rows.length },
      { label:"Total Unit",         value:rows.reduce((s,x)=>s+(+x.jumlah||0),0) }
    ]
  },
  {
    key: "keuangan", label: "Keuangan", emoji: "💰",
    deskripsi: "Buku kas, pemasukan, pengeluaran & pembayaran iuran",
    columns: [
      { key:"tanggal", label:"Tanggal", format:r => formatTanggal(r.tanggal) },
      { key:"uraian",  label:"Uraian" },
      { key:"jenis",   label:"Jenis" },
      { key:"jumlah",  label:"Jumlah", format:r => formatRupiah(r.jumlah), align:"right" }
    ],
    getData: () => AppState.keuangan,
    /* [F4.4] Diperluas dari F4.3: sekarang juga memuat rekap pembayaran
       iuran bulan berjalan (Fitur 1.D — "laporan tidak hanya berisi
       daftar transaksi"). Memakai ulang _hitungRekapIuran() dari
       keuangan.js — SATU sumber kebenaran untuk rekap, bukan
       dihitung ulang di sini. */
    summary: rows => {
      const masuk  = rows.filter(t=>t.jenis==="Masuk").reduce((s,t)=>s+t.jumlah,0);
      const keluar = rows.filter(t=>t.jenis==="Keluar").reduce((s,t)=>s+t.jumlah,0);
      const now = new Date();
      const rekap = _hitungRekapIuran(now.getMonth()+1, now.getFullYear());
      return [
        { label:"Total Pemasukan",   value:formatRupiah(masuk) },
        { label:"Total Pengeluaran", value:formatRupiah(keluar) },
        { label:"Saldo Akhir",       value:formatRupiah(AppState.ringkasan.kasSaldo ?? (masuk-keluar)) },
        { label:`Iuran ${formatBulanTahun(now.getMonth()+1, now.getFullYear())}`,
          value:`${rekap.jumlahSudahBayar}/${rekap.totalAnggota} anggota (${rekap.persentase}%)` },
        { label:"Tunggakan Bulan Ini", value:formatRupiah(rekap.totalTunggakan) }
      ];
    },
    /* [F4.4] Tabel kedua (opsional, lihat ReportEngine) — rekap
       pembayaran PER ANGGOTA untuk bulan berjalan, bukan cuma angka
       agregat di summary. Ini yang membuat laporan "mengikuti format
       administrasi PMR yang sebenarnya" (bendahara perlu tahu SIAPA
       yang belum bayar, tidak cukup hanya persentase). */
    subTable: () => {
      const now = new Date();
      const rekap = _hitungRekapIuran(now.getMonth()+1, now.getFullYear());
      return {
        judul: `Rekap Pembayaran Iuran — ${formatBulanTahun(now.getMonth()+1, now.getFullYear())}`,
        columns: [
          { key:"nama",  label:"Nama" },
          { key:"kelas", label:"Kelas" },
          { key:"statusIuran", label:"Status" },
          { key:"nominalIuran", label:"Nominal", format:r => r.nominalIuran ? formatRupiah(r.nominalIuran) : "—", align:"right" }
        ],
        rows: rekap.baris
      };
    }
  },
  {
    key: "kegiatan", label: "Kegiatan", emoji: "📅",
    deskripsi: "Program & agenda PMR",
    columns: _KOLOM_KEGIATAN,
    getData: _dataKegiatan
  },
  {
    key: "presensi", label: "Presensi", emoji: "✅",
    deskripsi: "Rekap kehadiran per anggota",
    columns: [
      { key:"nama",  label:"Nama" },
      { key:"kelas", label:"Kelas" },
      { key:"hadir", label:"Hadir",       align:"right" },
      { key:"alpha", label:"Alpha",       align:"right" },
      { key:"izin",  label:"Izin/Sakit",  align:"right" },
      { key:"pct",   label:"% Kehadiran", format:r => `${r.pct}%`, align:"right" }
    ],
    /* Memakai ulang hitungRekapPresensi() dari presensi.js (diekstrak
       khusus F4.3 dari renderTabRekap() aslinya) — bukan duplikasi. */
    getData: () => hitungRekapPresensi(),
    summary: () => [
      { label:"Jumlah Pertemuan", value:hitungJumlahPertemuanPresensi() }
    ]
  },
  {
    key: "piket", label: "Piket", emoji: "🕐",
    deskripsi: "Jadwal & petugas piket",
    columns: [
      { key:"tanggal",    label:"Tanggal", format:r => formatTanggal(r.tanggal) },
      { key:"hari",       label:"Hari",    format:r => formatHari(r.tanggal) },
      { key:"lokasi",     label:"Lokasi" },
      { key:"petugas",    label:"Petugas", format:r => (r.petugas||[]).map(p=>p.nama).join(", ") || "—" },
      { key:"status",     label:"Status" },
      { key:"keterangan", label:"Keterangan", format:r => r.keterangan || "—" }
    ],
    getData: () => AppState.piket
  },
  {
    key: "pengumuman", label: "Pengumuman", emoji: "📢",
    deskripsi: "Seluruh kegiatan sebagai pengumuman",
    /* Keputusan (dikonfirmasi pengguna): tidak ada collection
       terpisah untuk Pengumuman — sumber data = SELURUH data
       Kegiatan, sama persis dengan laporan "Kegiatan" (kolom &
       fungsi data dipakai ulang, bukan didefinisikan ulang). */
    columns: _KOLOM_KEGIATAN,
    getData: _dataKegiatan
  }
];

function _cariReportDef(key) {
  return REPORT_DEFINITIONS.find(d => d.key === key) || null;
}

/* ─────────────────────────────────────────────────────────
   Ambil nilai satu sel sesuai definisi kolom (dipakai bersama
   oleh preview HTML, CSV, dan PDF supaya isi selalu identik).
───────────────────────────────────────────────────────── */
function _nilaiSel(kolom, row) {
  const v = kolom.format ? kolom.format(row) : (row[kolom.key] ?? "—");
  return (v === "" || v === null || v === undefined) ? "—" : String(v);
}

function _tanggalGenerateSekarang() {
  const d = new Date();
  return d.toLocaleDateString("id-ID", { day:"numeric", month:"long", year:"numeric" });
}
function _waktuGenerateSekarang() {
  const d = new Date();
  return d.toLocaleString("id-ID", { hour:"2-digit", minute:"2-digit" }) + " WIB";
}

/* ─────────────────────────────────────────────────────────
   ReportEngine — API yang dipakai js/pages/laporan.js
───────────────────────────────────────────────────────── */
const ReportEngine = (() => {

  /* Template TUNGGAL untuk preview layar & cetak (Print).
     PDF menggambar ulang header/footer yang sama secara manual
     (lihat exportPDF) karena jsPDF tidak merender HTML — tapi
     susunan & isinya sengaja disamakan agar "satu template
     konsisten" tetap terasa sama di ketiga jalur export. */
  function renderPreviewHTML(cfg, rows) {
    const kolomHtml = cfg.columns.map(k => `<th${k.align?` style="text-align:${k.align}"`:""}>${k.label}</th>`).join("");
    const barisHtml = rows.length
      ? rows.map(r => `<tr>${cfg.columns.map(k =>
          `<td${k.align?` style="text-align:${k.align}"`:""}>${_nilaiSel(k, r)}</td>`).join("")}</tr>`).join("")
      : `<tr><td colspan="${cfg.columns.length}"><div class="empty-state" style="padding:28px 0">
           <p>Belum ada data untuk laporan ini.</p></div></td></tr>`;

    const ringkasanHtml = cfg.summary ? `
      <div class="laporan-summary">
        ${cfg.summary(rows).map(s => `
          <div class="laporan-summary-item">
            <div class="laporan-summary-value">${s.value}</div>
            <div class="laporan-summary-label">${s.label}</div>
          </div>`).join("")}
      </div>` : "";

    /* [F4.4] Tabel kedua opsional (mis. rekap pembayaran iuran di
       laporan Keuangan) — dirender dengan struktur tabel yang identik,
       hanya kolom/data berbeda, supaya tetap terasa satu template. */
    const subTableHtml = cfg.subTable ? (() => {
      const st = cfg.subTable();
      const kolomSt = st.columns.map(k => `<th${k.align?` style="text-align:${k.align}"`:""}>${k.label}</th>`).join("");
      const barisSt = st.rows.length
        ? st.rows.map(r => `<tr>${st.columns.map(k =>
            `<td${k.align?` style="text-align:${k.align}"`:""}>${_nilaiSel(k, r)}</td>`).join("")}</tr>`).join("")
        : `<tr><td colspan="${st.columns.length}"><div class="empty-state" style="padding:20px 0"><p>Belum ada data.</p></div></td></tr>`;
      return `
        <h3 style="font-size:0.95rem;margin:20px 0 10px">${st.judul}</h3>
        <div class="table-wrap">
          <table class="data-table laporan-table">
            <thead><tr>${kolomSt}</tr></thead>
            <tbody>${barisSt}</tbody>
          </table>
        </div>`;
    })() : "";

    return `
      <div class="laporan-kop">
        <img src="${LAPORAN_ORG.logo}" alt="Logo PMR" class="laporan-logo" onerror="this.style.display='none'"/>
        <div class="laporan-kop-teks">
          <div class="laporan-kop-nama">${LAPORAN_ORG.nama}</div>
          <div class="laporan-kop-sub">${LAPORAN_ORG.sub}</div>
        </div>
      </div>
      <div class="laporan-judul">
        <h2>Laporan ${cfg.label}</h2>
        <p>Tanggal Generate: ${_tanggalGenerateSekarang()}</p>
      </div>
      ${ringkasanHtml}
      ${subTableHtml}
      ${cfg.subTable ? `<h3 style="font-size:0.95rem;margin:20px 0 10px">Daftar Transaksi</h3>` : ""}
      <div class="table-wrap">
        <table class="data-table laporan-table">
          <thead><tr>${kolomHtml}</tr></thead>
          <tbody>${barisHtml}</tbody>
        </table>
      </div>
      <div class="laporan-footer">
        <span>${LAPORAN_ORG.identitas}</span>
        <span>Dibuat: ${_waktuGenerateSekarang()}</span>
      </div>`;
  }

  /* ── Export CSV — murni vanilla JS, tanpa dependency tambahan.
     [F4.4 / perbaikan] Sebelumnya cfg.summary() TIDAK PERNAH ikut
     ke CSV (hanya tampil di preview/print) — celah yang baru
     ketahuan saat memperluas laporan Keuangan untuk F4.4. Sekarang
     summary & subTable (jika ada) ditulis sebagai blok ringkas di
     ATAS tabel data utama, dipisah baris kosong. ── */
  function exportCSV(cfg, rows) {
    const esc = (val) => {
      const s = String(val ?? "");
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
    };
    const blok = [];

    if (cfg.summary) {
      blok.push(esc("Ringkasan"));
      cfg.summary(rows).forEach(s => blok.push(`${esc(s.label)},${esc(s.value)}`));
      blok.push("");
    }
    if (cfg.subTable) {
      const st = cfg.subTable();
      blok.push(esc(st.judul));
      blok.push(st.columns.map(k => esc(k.label)).join(","));
      st.rows.forEach(r => blok.push(st.columns.map(k => esc(_nilaiSel(k, r))).join(",")));
      blok.push("");
    }

    blok.push(cfg.columns.map(k => esc(k.label)).join(","));
    rows.forEach(r => blok.push(cfg.columns.map(k => esc(_nilaiSel(k, r))).join(",")));

    const csv = "\uFEFF" + blok.join("\n"); // BOM → Excel-friendly

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `laporan-${cfg.key}-${_namaFileTanggal()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function _namaFileTanggal() {
    const d = new Date();
    const p = n => String(n).padStart(2,"0");
    return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}`;
  }

  /* Pastikan jsPDF + AutoTable sudah termuat (CDN, lihat dashboard.html).
     Jika gagal dimuat (mis. koneksi terputus), lempar error yang jelas
     alih-alih gagal diam — dashboard.js/laporan.js akan menampilkan
     pesan ini lewat tampilToast(). */
  function _pastikanJsPDF() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error("Pustaka pembuat PDF gagal dimuat. Periksa koneksi internet lalu coba lagi.");
    }
  }

  /* Coba ubah logo SVG jadi PNG data-URL lewat <canvas> supaya bisa
     ditempel jsPDF (yang tidak mendukung SVG). Best-effort murni:
     kegagalan apa pun (mis. dibuka lewat file://) tidak boleh
     menggagalkan seluruh export PDF — header teks tetap tampil. */
  function _logoSebagaiPNG() {
    return new Promise((resolve) => {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth || 64;
            canvas.height = img.naturalHeight || 64;
            canvas.getContext("2d").drawImage(img, 0, 0);
            resolve(canvas.toDataURL("image/png"));
          } catch { resolve(null); }
        };
        img.onerror = () => resolve(null);
        img.src = LAPORAN_ORG.logo;
      } catch { resolve(null); }
    });
  }

  /* ── Export PDF — jsPDF + AutoTable. Header & footer digambar ulang
     di SETIAP halaman lewat hook didDrawPage, termasuk nomor halaman
     ("Halaman X dari Y") yang ditulis ulang setelah seluruh halaman
     selesai dibuat (pola standar jsPDF-AutoTable). ── */
  async function exportPDF(cfg, rows) {
    _pastikanJsPDF();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit:"pt", format:"a4" });
    const logoDataUrl = await _logoSebagaiPNG();

    const marginX = 40;
    const headerTinggi = 92;

    function gambarHeaderFooter(data) {
      /* Header */
      let xTeks = marginX;
      if (logoDataUrl) {
        try { doc.addImage(logoDataUrl, "PNG", marginX, 28, 34, 34); xTeks = marginX + 46; } catch {}
      }
      doc.setFont("helvetica","bold"); doc.setFontSize(13); doc.setTextColor(200,16,46);
      doc.text(LAPORAN_ORG.nama, xTeks, 42);
      doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(90,90,95);
      doc.text(LAPORAN_ORG.sub, xTeks, 56);

      doc.setFont("helvetica","bold"); doc.setFontSize(12); doc.setTextColor(28,27,31);
      doc.text(`Laporan ${cfg.label}`, marginX, 78);
      doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(90,90,95);
      doc.text(`Tanggal Generate: ${_tanggalGenerateSekarang()}`, marginX, 92);

      doc.setDrawColor(216,214,220);
      doc.line(marginX, headerTinggi, doc.internal.pageSize.getWidth()-marginX, headerTinggi);

      /* Footer */
      const tinggiHalaman = doc.internal.pageSize.getHeight();
      doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(120,120,125);
      doc.text(LAPORAN_ORG.identitas, marginX, tinggiHalaman-24);
      doc.text(`Dibuat: ${_waktuGenerateSekarang()}`, marginX, tinggiHalaman-14);
      /* Nomor halaman ("Halaman X dari Y") ditulis lengkap di loop akhir
         di bawah, setelah total halaman diketahui — supaya jadi satu
         string utuh (align:"right"), bukan dua doc.text() terpisah
         dengan posisi X ditebak manual (sempat menyebabkan teks
         "Halaman 1dari 1" tertempel tanpa jarak — sudah diverifikasi
         lewat ekstraksi teks PDF sungguhan sebelum & sesudah perbaikan). */
    }

    /* [F4.4 / perbaikan] Ringkasan (cfg.summary) SEBELUMNYA tidak
       pernah digambar di PDF sama sekali (celah yang sama seperti di
       CSV — baru ketahuan saat memperluas laporan Keuangan). Sekarang
       digambar sebagai tabel 2-kolom polos (tanpa header berwarna)
       SEBELUM tabel data utama. subTable (jika ada, mis. rekap
       pembayaran iuran) digambar setelahnya, dengan judul & warna
       header sendiri (biru, bukan merah) supaya jelas beda dari
       tabel data utama. Posisi vertikal antar tabel dihitung dari
       doc.lastAutoTable.finalY — pola standar jsPDF-AutoTable untuk
       menumpuk beberapa tabel dalam satu dokumen. */
    let startY = headerTinggi + 16;

    if (cfg.summary) {
      const ringkasan = cfg.summary(rows);
      doc.autoTable({
        body: ringkasan.map(s => [String(s.label), String(s.value)]),
        startY,
        margin: { top: headerTinggi + 16, bottom: 50, left: marginX, right: marginX },
        theme: "plain",
        styles: { font: "helvetica", fontSize: 9, cellPadding: { top: 2, bottom: 2, left: 0, right: 10 }, textColor: [28,27,31] },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 170 } },
        didDrawPage: gambarHeaderFooter
      });
      startY = doc.lastAutoTable.finalY + 14;
    }

    if (cfg.subTable) {
      const st = cfg.subTable();
      doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(28,27,31);
      doc.text(st.judul, marginX, startY);
      startY += 8;
      doc.autoTable({
        head: [st.columns.map(k => k.label)],
        body: st.rows.length
          ? st.rows.map(r => st.columns.map(k => _nilaiSel(k, r)))
          : [[{ content:"Belum ada data.", colSpan:st.columns.length, styles:{ halign:"center", textColor:[120,120,125] } }]],
        startY,
        margin: { top: headerTinggi + 16, bottom: 50, left: marginX, right: marginX },
        styles: { font:"helvetica", fontSize:8.5, cellPadding:5, textColor:[28,27,31] },
        headStyles: { fillColor:[37,99,235], textColor:255, fontStyle:"bold" }, /* biru — beda dari tabel utama */
        alternateRowStyles: { fillColor:[247,246,248] },
        columnStyles: Object.fromEntries(st.columns.map((k,i) => [i, { halign: k.align || "left" }])),
        didDrawPage: gambarHeaderFooter
      });
      startY = doc.lastAutoTable.finalY + 18;

      doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(28,27,31);
      doc.text("Daftar Transaksi", marginX, startY);
      startY += 8;
    }

    doc.autoTable({
      head: [cfg.columns.map(k => k.label)],
      body: rows.length
        ? rows.map(r => cfg.columns.map(k => _nilaiSel(k, r)))
        : [[{ content:"Belum ada data untuk laporan ini.", colSpan:cfg.columns.length, styles:{ halign:"center", textColor:[120,120,125] } }]],
      startY,
      margin: { top: headerTinggi + 16, bottom: 50, left: marginX, right: marginX },
      styles: { font:"helvetica", fontSize:9, cellPadding:6, textColor:[28,27,31] },
      headStyles: { fillColor:[200,16,46], textColor:255, fontStyle:"bold" },
      alternateRowStyles: { fillColor:[247,246,248] },
      columnStyles: Object.fromEntries(
        cfg.columns.map((k,i) => [i, { halign: k.align || "left" }])
      ),
      didDrawPage: gambarHeaderFooter
    });

    /* Nomor halaman "Halaman X dari Y" — satu string utuh, digambar
       setelah total halaman pasti diketahui (pola standar jsPDF-AutoTable). */
    const totalHalaman = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalHalaman; i++) {
      doc.setPage(i);
      const tinggiHalaman = doc.internal.pageSize.getHeight();
      doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(120,120,125);
      doc.text(`Halaman ${i} dari ${totalHalaman}`, doc.internal.pageSize.getWidth()-marginX, tinggiHalaman-14, { align:"right" });
    }

    doc.save(`laporan-${cfg.key}-${_namaFileTanggal()}.pdf`);
  }

  return { renderPreviewHTML, exportCSV, exportPDF };
})();
