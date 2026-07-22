/* =========================================================
   PAGES/UPACARA.JS (F4.4 — Petugas Upacara)
   =========================================================
   Konsep SAMA dengan Piket (F4.1): rotasi adil berbasis riwayat,
   lewat js/core/rotation-engine.js (F4.4) — TIDAK ada algoritma
   rotasi kedua yang ditulis ulang di sini (lihat PATCH F4.4,
   Fitur 3). Yang berbeda sengaja HANYA: nama, tampilan (aksen
   biru `--info`, lihat css/upacara.css), teks, collection data
   ("upacara", terpisah dari "piket"), dan kontrol "Jumlah
   Petugas" yang berbentuk pilihan tetap 8–15 (bukan input bebas
   seperti Piket) sesuai PATCH F4.4.

   RBAC — disamakan persis dengan Piket (modul dengan konsep
   sama, tidak ada alasan untuk berbeda):
     Read          : semua role — transparansi jadwal
     Create/Update : admin, ketua, wakil, sekretaris, pj
     Delete        : admin, ketua saja

   Struktur dokumen Firestore (collection "upacara"):
     tanggal    : string ("YYYY-MM-DD")
     lokasi     : string  (mis. "Lapangan Upacara")
     status     : "Terjadwal" | "Selesai" | "Dibatalkan"
     keterangan : string (opsional)
     petugas    : [{ id, nama }, ...]
   ========================================================= */

const STATUS_UPACARA = ["Terjadwal", "Selesai", "Dibatalkan"];
const PILIHAN_JUMLAH_PETUGAS_UPACARA = [8,9,10,11,12,13,14,15];

/* ─────────────────────────────────────────────────────────
   RENDER UTAMA — 2 tab: Jadwal (CRUD) & Riwayat (statistik).
   Struktur identik dengan piket.js (konsep sama), tapi dibungkus
   <div class="upacara-page"> agar css/upacara.css bisa scoped
   tanpa memengaruhi halaman lain.
───────────────────────────────────────────────────────── */
function renderUpacara(el, user) {
  const canEdit   = ["admin","ketua","wakil","sekretaris","pj"].includes(user.role);
  const canDelete = ["admin","ketua"].includes(user.role);
  const canGenerate = canEdit;

  el.innerHTML = `
  <div class="upacara-page">
    <div class="page-head">
      <div><h1>🚩 Petugas Upacara</h1><p class="page-sub">Rotasi adil petugas upacara bendera</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${canGenerate?`<button class="btn btn-primary btn-sm" id="btn-generate-upacara">✨ Generate Petugas</button>`:""}
        ${canEdit?`<button class="btn btn-outline btn-sm" id="btn-tambah-upacara">+ Tambah Manual</button>`:""}
      </div>
    </div>
    <div id="ringkasan-upacara" class="grid grid-4" style="margin-bottom:24px"></div>
    <div class="tab-bar">
      <button class="tab-btn active" id="tab-jadwal-upacara">Jadwal</button>
      <button class="tab-btn" id="tab-riwayat-upacara">Riwayat &amp; Statistik</button>
    </div>
    <div id="tab-content-upacara"></div>
  </div>`;

  _renderRingkasanUpacara();

  function tampilTab(tab) {
    document.getElementById("tab-jadwal-upacara").classList.toggle("active", tab === "jadwal");
    document.getElementById("tab-riwayat-upacara").classList.toggle("active", tab === "riwayat");
    if (tab === "jadwal") _renderTabJadwalUpacara(el, user, canEdit, canDelete);
    else _renderTabRiwayatUpacara();
  }
  document.getElementById("tab-jadwal-upacara").addEventListener("click", () => tampilTab("jadwal"));
  document.getElementById("tab-riwayat-upacara").addEventListener("click", () => tampilTab("riwayat"));
  tampilTab("jadwal");

  document.getElementById("btn-tambah-upacara")?.addEventListener("click", () =>
    bukaFormUpacara(null, () => renderUpacara(el, user)));
  document.getElementById("btn-generate-upacara")?.addEventListener("click", () =>
    _bukaModalGenerateUpacara(el, user));
}

function _renderRingkasanUpacara() {
  const sekarang = new Date().toISOString().split("T")[0];
  const totalJadwal     = AppState.upacara.length;
  const jadwalMendatang = AppState.upacara.filter(u => u.status === "Terjadwal" && u.tanggal >= sekarang).length;
  const upacaraSelesai  = AppState.upacara.filter(u => u.status === "Selesai").length;
  const anggotaAktif    = AppState.anggota.filter(a => a.status === "Aktif").length;
  const totalSlot       = AppState.upacara.reduce((s,u) => s + (u.petugas||[]).length, 0);
  const rataRata        = anggotaAktif ? (totalSlot / anggotaAktif).toFixed(1) : "0";

  document.getElementById("ringkasan-upacara").innerHTML = [
    _statCardUpacara("Total Jadwal", totalJadwal, "sepanjang waktu",
      `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 21h18M5 21V7l8-4v18M13 21V11l6 2v8M9 9v.01M9 12v.01M9 15v.01"/>`),
    _statCardUpacara("Jadwal Mendatang", jadwalMendatang, "belum terlaksana",
      `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>`),
    _statCardUpacara("Upacara Selesai", upacaraSelesai, "sudah terlaksana",
      `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>`),
    _statCardUpacara("Rata-rata per Anggota", rataRata + "x", "distribusi beban",
      `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>`)
  ].join("");
}

/* Kartu statistik aksen biru — DITULIS TERPISAH dari statCard() milik
   state.js (yang tidak punya hook warna), persis alasan yang sama
   dengan kenapa keuangan.js menulis kartunya sendiri (warna
   success/danger custom per kartu). */
function _statCardUpacara(label, value, sub, svgPath) {
  return `<div class="card stat-card">
    <div class="stat-icon" style="background:var(--info-bg);color:var(--info)">
      <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">${svgPath}</svg>
    </div>
    <div class="stat-value" style="color:var(--info)">${value}</div>
    <div class="stat-label">${label}</div>
    <div class="stat-delta" style="color:var(--ink-soft)">${sub}</div>
  </div>`;
}

/* ─────────────────────────────────────────────────────────
   TAB 1 — JADWAL (search, filter, sort, CRUD)
───────────────────────────────────────────────────────── */
function _renderTabJadwalUpacara(el, user, canEdit, canDelete) {
  const c = document.getElementById("tab-content-upacara");
  c.innerHTML = `
  <div class="card">
    <div class="table-toolbar">
      <div class="search-bar">
        <svg class="search-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input id="search-upacara" type="search" placeholder="Cari tempat, nama petugas…">
      </div>
      <select id="filter-status-upacara" style="padding:9px 14px;border:1.5px solid var(--gray-300);border-radius:var(--radius-pill);background:var(--gray-100);font-size:0.85rem">
        <option value="">Semua Status</option>
        ${STATUS_UPACARA.map(s => `<option value="${s}">${s}</option>`).join("")}
      </select>
      <select id="sort-upacara" style="padding:9px 14px;border:1.5px solid var(--gray-300);border-radius:var(--radius-pill);background:var(--gray-100);font-size:0.85rem">
        <option value="tanggal-desc">Tanggal Terbaru</option>
        <option value="tanggal-asc">Tanggal Terlama</option>
        <option value="petugas-desc">Jumlah Petugas Terbanyak</option>
      </select>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Hari</th><th>Tanggal</th><th>Tempat</th><th>Petugas</th><th>Status</th><th>Aksi</th></tr></thead>
        <tbody id="tb-upacara"></tbody>
      </table>
    </div>
  </div>`;

  const rowUpacara = u => `<tr>
    <td>${formatHari(u.tanggal)}</td>
    <td style="white-space:nowrap">${formatTanggal(u.tanggal)}</td>
    <td>${u.lokasi||"—"}</td>
    <td>
      <button class="btn btn-ghost btn-sm btn-lihat-petugas-upacara" data-id="${u.id}" aria-label="Lihat daftar petugas upacara">
        🚩 ${(u.petugas||[]).length} orang
      </button>
    </td>
    <td>${statusBadge(u.status)}</td>
    <td><div style="display:flex;gap:6px">
      ${canEdit?`<button class="btn btn-ghost btn-sm btn-edit-upacara" data-id="${u.id}" title="Edit" aria-label="Edit jadwal upacara">✏</button>`:""}
      ${canDelete?`<button class="btn btn-ghost btn-sm btn-hapus-upacara" data-id="${u.id}" title="Hapus" aria-label="Hapus jadwal upacara" style="color:var(--danger)">🗑</button>`:""}
    </div></td>
  </tr>`;

  function terapkanFilterSort() {
    const q        = document.getElementById("search-upacara").value.toLowerCase().trim();
    const statusF  = document.getElementById("filter-status-upacara").value;
    const sortF    = document.getElementById("sort-upacara").value;

    let hasil = AppState.upacara.filter(u => {
      const cocokTeks = !q ||
        (u.lokasi||"").toLowerCase().includes(q) ||
        (u.petugas||[]).some(pt => pt.nama.toLowerCase().includes(q));
      const cocokStatus = !statusF || u.status === statusF;
      return cocokTeks && cocokStatus;
    });

    switch (sortF) {
      case "tanggal-desc": hasil.sort((a,b) => b.tanggal.localeCompare(a.tanggal)); break;
      case "tanggal-asc":  hasil.sort((a,b) => a.tanggal.localeCompare(b.tanggal)); break;
      case "petugas-desc": hasil.sort((a,b) => (b.petugas||[]).length - (a.petugas||[]).length); break;
    }

    renderTable(document.getElementById("tb-upacara"), hasil, rowUpacara);
  }

  terapkanFilterSort();
  document.getElementById("search-upacara").addEventListener("input", terapkanFilterSort);
  document.getElementById("filter-status-upacara").addEventListener("change", terapkanFilterSort);
  document.getElementById("sort-upacara").addEventListener("change", terapkanFilterSort);

  document.getElementById("tb-upacara").addEventListener("click", e => {
    const id = e.target.closest("[data-id]")?.dataset.id;
    if (!id) return;
    const u = AppState.upacara.find(x => x.id === id);

    if (e.target.closest(".btn-lihat-petugas-upacara")) _bukaDetailPetugasUpacara(u);
    if (e.target.closest(".btn-edit-upacara") && canEdit) {
      bukaFormUpacara(u, () => renderUpacara(el, user));
    }
    if (e.target.closest(".btn-hapus-upacara") && canDelete) {
      Modal.konfirmasi(`Hapus jadwal upacara <strong>${formatTanggal(u.tanggal)}</strong>?`, async () => {
        await DB.upacara.hapus(id);
        if (!FIREBASE_ENABLED) renderUpacara(el, user);
        tampilToast("Jadwal upacara dihapus.", "default");
      });
    }
  });
}

function _bukaDetailPetugasUpacara(u) {
  Modal.buka({
    judul: `Petugas Upacara — ${formatTanggal(u.tanggal)}`,
    konten: `
      <p style="margin-top:0;color:var(--ink-soft);font-size:0.85rem">${formatHari(u.tanggal)} · ${u.lokasi||"—"}</p>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${(u.petugas||[]).map(pt => `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--info-bg);border-radius:var(--radius-sm)">
            <div class="avatar" style="width:30px;height:30px;font-size:0.7rem;background:var(--info)">${getInisial(pt.nama)}</div>
            <span style="font-size:0.88rem;font-weight:600">${pt.nama}</span>
          </div>`).join("") || `<p style="color:var(--ink-soft)">Belum ada petugas.</p>`}
      </div>
      ${u.keterangan ? `<p style="margin-top:14px;font-size:0.85rem;color:var(--ink-soft)"><strong>Keterangan:</strong> ${u.keterangan}</p>` : ""}`,
    aksi: [{ label:"Tutup", kelas:"btn-primary", id:"m-tutup-detail-upacara", onClick:()=>Modal.tutup() }]
  });
}

/* ─────────────────────────────────────────────────────────
   TAB 2 — RIWAYAT & STATISTIK (per-anggota, langsung pakai
   RotationEngine.hitungRiwayat — tidak ada wrapper backward-
   compat di sini karena upacara.js modul baru, tidak ada kode
   lama yang perlu dijaga bentuknya.)
───────────────────────────────────────────────────────── */
function _renderTabRiwayatUpacara() {
  const c = document.getElementById("tab-content-upacara");
  const riwayat = RotationEngine.hitungRiwayat(AppState.upacara);

  const data = AppState.anggota
    .filter(a => a.status === "Aktif")
    .map(a => ({ ...a, ...(riwayat[a.id] || { jumlah:0, terakhir:null }) }))
    .sort((x,y) => x.jumlah - y.jumlah);

  c.innerHTML = `
  <div class="card">
    <div class="card-title">Riwayat Petugas Upacara per Anggota <span class="badge badge-info">${data.length} anggota aktif</span></div>
    <div class="table-toolbar">
      <div class="search-bar">
        <svg class="search-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input id="search-riwayat-upacara" type="search" placeholder="Cari nama…">
      </div>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Nama</th><th>Kelas</th><th>Jumlah Bertugas</th><th>Terakhir Bertugas</th></tr></thead>
        <tbody id="tb-riwayat-upacara"></tbody>
      </table>
    </div>
  </div>`;

  const rowRiwayat = r => `<tr>
    <td><div style="display:flex;align-items:center;gap:8px">
      <div class="avatar" style="width:28px;height:28px;font-size:0.65rem;background:var(--info)">${getInisial(r.nama)}</div>${r.nama}
    </div></td>
    <td>${r.kelas}</td>
    <td><strong>${r.jumlah}x</strong></td>
    <td>${r.terakhir ? formatTanggal(r.terakhir) : `<span style="color:var(--ink-soft)">Belum pernah</span>`}</td>
  </tr>`;

  renderTable(document.getElementById("tb-riwayat-upacara"), data, rowRiwayat);
  pasangSearch("search-riwayat-upacara", "tb-riwayat-upacara", data, rowRiwayat, ["nama","kelas"]);
}

/* State sementara daftar petugas terpilih di modal form — pola sama
   dengan _petugasTerpilih milik piket.js, sengaja variabel TERPISAH
   (bukan reuse punya piket.js) supaya kedua modul independen dan
   tidak saling bocor state jika kebetulan dibuka bergantian. */
let _petugasTerpilihUpacara = [];

/* ─────────────────────────────────────────────────────────
   MODAL FORM — Tambah/Edit Manual
───────────────────────────────────────────────────────── */
function bukaFormUpacara(data, onSimpan) {
  const isEdit = !!data;
  const petugasAwal = data?.petugas || [];

  Modal.buka({
    judul: isEdit ? "Edit Jadwal Upacara" : "Tambah Jadwal Upacara Manual",
    ukuran: "modal-lg",
    konten: `
      <div class="grid grid-2">
        <div class="field">
          <label>Tanggal</label>
          <input id="f-tanggal-upacara" type="date" value="${data?.tanggal||""}">
        </div>
        <div class="field">
          <label>Status</label>
          <select id="f-status-upacara">
            ${STATUS_UPACARA.map(s => `<option ${data?.status===s?"selected":""}>${s}</option>`).join("")}
          </select>
        </div>
        <div class="field" style="grid-column:1/-1">
          <label>Tempat Upacara</label>
          <input id="f-lokasi-upacara" type="text" value="${data?.lokasi||""}" placeholder="Contoh: Lapangan Upacara">
        </div>
        <div class="field" style="grid-column:1/-1">
          <label>Keterangan <span style="color:var(--ink-soft);font-weight:400">(opsional)</span></label>
          <input id="f-keterangan-upacara" type="text" value="${data?.keterangan||""}" placeholder="Catatan tambahan">
        </div>
      </div>
      <div class="field">
        <label>Petugas</label>
        <div class="search-bar" style="margin-bottom:10px">
          <svg class="search-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input id="cari-petugas-upacara" type="search" placeholder="Cari & tambah nama anggota…">
        </div>
        <div id="daftar-petugas-terpilih-upacara" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px"></div>
        <div id="daftar-kandidat-petugas-upacara" style="max-height:180px;overflow-y:auto;border:1px solid var(--gray-200);border-radius:var(--radius-sm);display:none"></div>
      </div>
      <div id="form-upacara-err" class="alert alert-danger" style="display:none;margin-top:8px"></div>`,
    aksi: [
      { label:"Batal", kelas:"btn-ghost", id:"m-batal-upacara", onClick:()=>Modal.tutup() },
      { label: isEdit?"Simpan":"Tambah", kelas:"btn-primary", id:"m-simpan-upacara", onClick:()=>{
        const tanggal = document.getElementById("f-tanggal-upacara").value;
        if (!tanggal) {
          const err = document.getElementById("form-upacara-err");
          err.textContent = "Tanggal wajib diisi."; err.style.display = "flex"; return;
        }
        if (_petugasTerpilihUpacara.length === 0) {
          const err = document.getElementById("form-upacara-err");
          err.textContent = "Minimal 1 petugas harus dipilih."; err.style.display = "flex"; return;
        }
        const payload = {
          tanggal,
          status: document.getElementById("f-status-upacara").value,
          lokasi: document.getElementById("f-lokasi-upacara").value.trim(),
          keterangan: document.getElementById("f-keterangan-upacara").value.trim(),
          petugas: _petugasTerpilihUpacara.map(p => ({ id:p.id, nama:p.nama }))
        };
        _jalankanSimpan("m-simpan-upacara", async () => {
          if (isEdit) await DB.upacara.update(data.id, payload);
          else await DB.upacara.tambah(payload);
          Modal.tutup();
          if (!FIREBASE_ENABLED) onSimpan?.();
          tampilToast(isEdit ? "Jadwal upacara diperbarui." : "Jadwal upacara ditambahkan.", "success");
        });
      }}
    ]
  });

  _petugasTerpilihUpacara = [...petugasAwal];
  _renderChipPetugasUpacara();

  document.getElementById("cari-petugas-upacara").addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase().trim();
    const wrapKandidat = document.getElementById("daftar-kandidat-petugas-upacara");
    if (!q) { wrapKandidat.style.display = "none"; wrapKandidat.innerHTML = ""; return; }

    const hasil = AppState.anggota
      .filter(a => a.status === "Aktif")
      .filter(a => a.nama.toLowerCase().includes(q))
      .filter(a => !_petugasTerpilihUpacara.some(p => p.id === a.id))
      .slice(0, 8);

    wrapKandidat.style.display = hasil.length ? "block" : "none";
    wrapKandidat.innerHTML = hasil.map(a => `
      <div class="kandidat-petugas-upacara-item" data-id="${a.id}" data-nama="${a.nama}"
        style="padding:8px 12px;cursor:pointer;font-size:0.85rem;border-bottom:1px solid var(--gray-100)">
        ${a.nama} <span style="color:var(--ink-soft);font-size:0.78rem">· ${a.kelas}</span>
      </div>`).join("");

    wrapKandidat.querySelectorAll(".kandidat-petugas-upacara-item").forEach(item => {
      item.addEventListener("click", () => {
        _petugasTerpilihUpacara.push({ id:item.dataset.id, nama:item.dataset.nama });
        _renderChipPetugasUpacara();
        document.getElementById("cari-petugas-upacara").value = "";
        wrapKandidat.style.display = "none";
      });
    });
  });
}

function _renderChipPetugasUpacara() {
  const wrap = document.getElementById("daftar-petugas-terpilih-upacara");
  if (!wrap) return;
  wrap.innerHTML = _petugasTerpilihUpacara.length === 0
    ? `<span style="font-size:0.82rem;color:var(--ink-soft)">Belum ada petugas dipilih.</span>`
    : _petugasTerpilihUpacara.map(p => `
      <span class="badge badge-info" style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px">
        ${p.nama}
        <button type="button" class="btn-hapus-chip-petugas-upacara" data-id="${p.id}"
          aria-label="Hapus ${p.nama} dari daftar petugas"
          style="background:none;border:none;cursor:pointer;color:inherit;font-weight:700;padding:0">✕</button>
      </span>`).join("");

  wrap.querySelectorAll(".btn-hapus-chip-petugas-upacara").forEach(btn => {
    btn.addEventListener("click", () => {
      _petugasTerpilihUpacara = _petugasTerpilihUpacara.filter(p => p.id !== btn.dataset.id);
      _renderChipPetugasUpacara();
    });
  });
}

/* ─────────────────────────────────────────────────────────
   MODAL GENERATE — Tahap 1: input parameter algoritma.
   Beda kunci dari Piket sesuai PATCH F4.4: "Jumlah Petugas"
   berupa PILIHAN TETAP 8–15 (<select>), bukan input bebas —
   supaya pengguna langsung sadar ini bukan modul Piket.
───────────────────────────────────────────────────────── */
function _bukaModalGenerateUpacara(el, user, prefill = {}) {
  Modal.buka({
    judul: "Generate Petugas Upacara",
    konten: `
      <p style="margin-top:0;color:var(--ink-soft);font-size:0.85rem">
        Sistem akan memilih petugas secara adil berdasarkan riwayat bertugas upacara —
        yang paling jarang &amp; paling lama tidak bertugas diprioritaskan.
      </p>
      <div class="grid grid-2">
        <div class="field">
          <label>Tanggal Upacara</label>
          <input id="gen-tanggal-upacara" type="date" value="${prefill.tanggal||""}">
        </div>
        <div class="field">
          <label>Tempat Upacara</label>
          <input id="gen-lokasi-upacara" type="text" value="${prefill.lokasi||""}" placeholder="Contoh: Lapangan Upacara">
        </div>
        <div class="field">
          <label>Jumlah Petugas</label>
          <select id="gen-jumlah-upacara">
            ${PILIHAN_JUMLAH_PETUGAS_UPACARA.map(n =>
              `<option value="${n}" ${(+prefill.jumlah||8)===n?"selected":""}>${n} petugas</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Minimal Jeda Bertugas (hari)</label>
          <input id="gen-jeda-upacara" type="number" min="0" value="${prefill.jeda??7}">
        </div>
      </div>
      <div id="gen-err-upacara" class="alert alert-danger" style="display:none"></div>`,
    aksi: [
      { label:"Batal", kelas:"btn-ghost", id:"m-batal-gen-upacara", onClick:()=>Modal.tutup() },
      { label:"Preview Petugas →", kelas:"btn-primary", id:"m-preview-gen-upacara", onClick:()=>{
        const tanggal = document.getElementById("gen-tanggal-upacara").value;
        const lokasi  = document.getElementById("gen-lokasi-upacara").value.trim();
        const jumlah  = +document.getElementById("gen-jumlah-upacara").value;
        const jeda    = +document.getElementById("gen-jeda-upacara").value;
        const err = document.getElementById("gen-err-upacara");

        if (!tanggal) { err.textContent = "Tanggal wajib diisi."; err.style.display = "flex"; return; }

        const hasil = RotationEngine.generateJadwal({
          koleksi: AppState.upacara, tanggalTarget: tanggal, jumlahPetugas: jumlah, minimalJeda: jeda
        });

        if (hasil.terpilih.length < jumlah) {
          err.innerHTML = `Hanya <strong>${hasil.terpilih.length} dari ${jumlah}</strong> slot terisi —
            kandidat memenuhi syarat tidak cukup. Coba turunkan Minimal Jeda atau pilih jumlah petugas lebih sedikit.`;
          err.style.display = "flex";
        }

        _bukaModalPreviewGenerateUpacara(el, user, { tanggal, lokasi, jumlah, jeda }, hasil);
      }}
    ]
  });
}

/* ─────────────────────────────────────────────────────────
   MODAL GENERATE — Tahap 2: preview hasil + exclude/ganti.
   Memakai field generik RotationEngine langsung (jumlah/terakhir)
   — tidak perlu wrapper backward-compat karena modul baru.
───────────────────────────────────────────────────────── */
function _bukaModalPreviewGenerateUpacara(el, user, param, hasilAwal) {
  let terpilih = [...hasilAwal.terpilih];
  let cadangan = [...hasilAwal.kandidatCadangan];

  function render() {
    const belumPernah = terpilih.filter(t => t.jumlah === 0).length;
    const lamaGak = terpilih.length - belumPernah;

    Modal.buka({
      judul: "Preview Petugas Upacara",
      ukuran: "modal-lg",
      konten: `
        <p style="margin-top:0;color:var(--ink-soft);font-size:0.85rem">
          ${formatHari(param.tanggal)}, ${formatTanggal(param.tanggal)} · ${param.lokasi||"—"}
        </p>

        <div class="grid grid-4" style="margin-bottom:16px">
          <div class="card" style="padding:14px;text-align:center">
            <div style="font-size:1.3rem;font-weight:700">${terpilih.length}</div>
            <div style="font-size:0.72rem;color:var(--ink-soft)">Petugas Terpilih</div>
          </div>
          <div class="card" style="padding:14px;text-align:center">
            <div style="font-size:1.3rem;font-weight:700;color:var(--info)">${belumPernah}</div>
            <div style="font-size:0.72rem;color:var(--ink-soft)">Belum Pernah Bertugas</div>
          </div>
          <div class="card" style="padding:14px;text-align:center">
            <div style="font-size:1.3rem;font-weight:700;color:var(--warning)">${lamaGak}</div>
            <div style="font-size:0.72rem;color:var(--ink-soft)">Lama Tidak Bertugas</div>
          </div>
          <div class="card" style="padding:14px;text-align:center">
            <div style="font-size:1.1rem;font-weight:700;color:var(--success)">✓ Terpenuhi</div>
            <div style="font-size:0.72rem;color:var(--ink-soft)">Aturan Jeda ${param.jeda} Hari</div>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:6px;max-height:280px;overflow-y:auto">
          ${terpilih.map(t => `
            <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--info-bg);border-radius:var(--radius-sm)">
              <div class="avatar" style="width:32px;height:32px;font-size:0.7rem;flex-shrink:0;background:var(--info)">${getInisial(t.nama)}</div>
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:0.87rem">${t.nama}</div>
                <div style="font-size:0.75rem;color:var(--ink-soft)">${t.alasan}</div>
              </div>
              <button class="btn btn-ghost btn-sm btn-ganti-petugas-preview-upacara" data-id="${t.id}" aria-label="Ganti ${t.nama}">🔄 Ganti</button>
            </div>`).join("")}
        </div>
        <div id="preview-gen-err-upacara" class="alert alert-danger" style="display:none;margin-top:10px"></div>`,
      aksi: [
        { label:"← Kembali", kelas:"btn-ghost", id:"m-kembali-preview-upacara", onClick:() => {
          Modal.tutup();
          _bukaModalGenerateUpacara(el, user, param);
        }},
        { label:"Konfirmasi & Simpan", kelas:"btn-primary", id:"m-konfirmasi-preview-upacara", onClick: async () => {
          const btn = document.getElementById("m-konfirmasi-preview-upacara");
          btn.disabled = true; btn.textContent = "Menyimpan…";
          try {
            await DB.upacara.tambah({
              tanggal: param.tanggal,
              lokasi: param.lokasi,
              status: "Terjadwal",
              keterangan: "",
              petugas: terpilih.map(t => ({ id:t.id, nama:t.nama }))
            });
            Modal.tutup();
            if (!FIREBASE_ENABLED) renderUpacara(el, user);
            tampilToast(`Petugas upacara ${formatTanggal(param.tanggal)} berhasil dibuat.`, "success");
          } catch(e) {
            console.error("[PMR] Gagal simpan jadwal upacara:", e);
            tampilToast("Gagal menyimpan jadwal. Coba lagi.", "danger");
            btn.disabled = false; btn.textContent = "Konfirmasi & Simpan";
          }
        }}
      ]
    });

    document.querySelectorAll(".btn-ganti-petugas-preview-upacara").forEach(btn => {
      btn.addEventListener("click", () => {
        const idDiganti = btn.dataset.id;
        terpilih = terpilih.filter(t => t.id !== idDiganti);
        if (cadangan.length > 0) {
          const pengganti = cadangan.shift();
          terpilih.push({
            id: pengganti.id, nama: pengganti.nama, jumlah: pengganti.jumlah, terakhir: pengganti.terakhir,
            alasan: pengganti.jumlah === 0
              ? "Belum pernah dapat giliran"
              : `Terakhir giliran ${pengganti.selisihHari} hari lalu (${pengganti.jumlah}x total)`
          });
        }
        render();
      });
    });
  }

  render();
}
