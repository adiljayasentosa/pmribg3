/* =========================================================
   PAGES/PIKET.JS (F4.1 — Smart Piket & Fair Scheduler)
   =========================================================
   RBAC (sesuai kesepakatan final):
     Read          : semua role (admin,ketua,wakil,sekretaris,
                     bendahara,pj,anggota) — transparansi jadwal
     Create/Update : admin, ketua, wakil, sekretaris, pj
     Delete        : admin, ketua saja

   Struktur dokumen Firestore (collection "piket"):
     tanggal    : string ("YYYY-MM-DD")
     lokasi     : string
     status     : "Terjadwal" | "Selesai" | "Dibatalkan"
     keterangan : string (opsional)
     petugas    : [{ id, nama }, ...]   ← idiom sama dengan
                                           pengurus/struktur.jabatan[].anggota[]

   Field "hari" SENGAJA tidak disimpan — selalu di-derive dari
   `tanggal` saat render (formatHari()) agar tidak ada risiko
   data hari & tanggal saling tidak sinkron.

   [F4.4] Algoritma rotasi (PRNG seed, hitung riwayat, fair
   scheduler) DIPINDAHKAN ke js/core/rotation-engine.js supaya
   bisa dipakai bersama oleh Petugas Upacara — lihat js/pages/
   upacara.js. Fungsi-fungsi di bawah ini SEKARANG hanya wrapper
   tipis ke RotationEngine, dengan nama & bentuk hasil PERSIS
   sama seperti sebelumnya (backward compatible) — tidak ada
   baris lain di file ini yang perlu diubah.
   ========================================================= */

const STATUS_PIKET = ["Terjadwal", "Selesai", "Dibatalkan"];

/* Format "hari" (Senin, Selasa, dst) — DERIVE dari tanggal, tidak disimpan.
   Dipakai juga oleh upacara.js & report-engine.js. */
function formatHari(tanggalIso) {
  return new Date(tanggalIso).toLocaleDateString("id-ID", { weekday: "long" });
}

/* [F4.4] Wrapper backward-compatible — dipakai oleh _renderTabRiwayat()
   di bawah. Bentuk hasil SENGAJA dipertahankan { jumlahPiket, terakhirPiket }
   (bukan { jumlah, terakhir } generik milik RotationEngine) supaya tidak
   ada kode lain di file ini yang perlu ikut diubah. */
function _hitungRiwayatPiket() {
  const generik = RotationEngine.hitungRiwayat(AppState.piket);
  const hasil = {};
  Object.keys(generik).forEach(id => {
    hasil[id] = { jumlahPiket: generik[id].jumlah, terakhirPiket: generik[id].terakhir };
  });
  return hasil;
}

/* [F4.4] Wrapper backward-compatible — signature (posisional) & bentuk
   hasil PERSIS sama seperti generateJadwalPiket() versi asli, termasuk
   teks "alasan" ("Belum pernah piket" / "Terakhir piket X hari lalu…")
   yang dipakai perbandingan string persis di _bukaModalPreviewGenerate
   (hitung "Belum Pernah Piket") dan field kandidatCadangan yang dipakai
   tombol "Ganti" (pengganti.jumlahPiket / .selisihHari). Engine generik
   sengaja TIDAK dipercaya untuk teks/nama field spesifik-piket ini —
   direkonstruksi ulang di sini dari data mentah (jumlah/terakhir/
   selisihHari) yang diekspos RotationEngine. */
function generateJadwalPiket(tanggalTarget, jumlahPetugas, minimalJeda, dikecualikanIds = []) {
  const hasil = RotationEngine.generateJadwal({
    koleksi: AppState.piket, tanggalTarget, jumlahPetugas, minimalJeda, dikecualikanIds
  });
  return {
    terpilih: hasil.terpilih.map(k => ({
      id: k.id, nama: k.nama,
      alasan: k.jumlah === 0
        ? "Belum pernah piket"
        : `Terakhir piket ${k.selisihHari} hari lalu (${k.jumlah}x total)`
    })),
    totalKandidatMemenuhiSyarat: hasil.totalKandidatMemenuhiSyarat,
    kandidatCadangan: hasil.kandidatCadangan.map(k => ({
      id: k.id, nama: k.nama, jumlahPiket: k.jumlah, terakhirPiket: k.terakhir, selisihHari: k.selisihHari
    }))
  };
}

/* ─────────────────────────────────────────────────────────
   RENDER UTAMA — 2 tab: Jadwal (CRUD) & Riwayat (statistik)
───────────────────────────────────────────────────────── */
function renderPiket(el, user) {
  const canEdit   = ["admin","ketua","wakil","sekretaris","pj"].includes(user.role);
  const canDelete = ["admin","ketua"].includes(user.role);
  const canGenerate = canEdit; /* Generate = operasi Create, RBAC sama */

  el.innerHTML = `
  <div class="page-head">
    <div><h1>Piket PMR</h1><p class="page-sub">Jadwal & penjadwalan piket organisasi</p></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${canGenerate?`<button class="btn btn-primary btn-sm" id="btn-generate-piket">✨ Generate Jadwal</button>`:""}
      ${canEdit?`<button class="btn btn-outline btn-sm" id="btn-tambah-piket">+ Tambah Manual</button>`:""}
    </div>
  </div>
  <div id="ringkasan-piket" class="grid grid-4" style="margin-bottom:24px"></div>
  <div class="tab-bar">
    <button class="tab-btn active" id="tab-jadwal">Jadwal</button>
    <button class="tab-btn" id="tab-riwayat">Riwayat & Statistik</button>
  </div>
  <div id="tab-content-piket"></div>`;

  _renderRingkasanPiket();

  function tampilTab(tab) {
    document.getElementById("tab-jadwal").classList.toggle("active", tab === "jadwal");
    document.getElementById("tab-riwayat").classList.toggle("active", tab === "riwayat");
    if (tab === "jadwal") _renderTabJadwal(el, user, canEdit, canDelete);
    else _renderTabRiwayat();
  }
  document.getElementById("tab-jadwal").addEventListener("click", () => tampilTab("jadwal"));
  document.getElementById("tab-riwayat").addEventListener("click", () => tampilTab("riwayat"));
  tampilTab("jadwal");

  document.getElementById("btn-tambah-piket")?.addEventListener("click", () =>
    bukaFormPiket(null, () => renderPiket(el, user)));
  document.getElementById("btn-generate-piket")?.addEventListener("click", () =>
    _bukaModalGenerate(el, user));
}

function _renderRingkasanPiket() {
  const sekarang = new Date().toISOString().split("T")[0];
  const totalJadwal   = AppState.piket.length;
  const jadwalMendatang = AppState.piket.filter(p => p.status === "Terjadwal" && p.tanggal >= sekarang).length;
  const piketSelesai  = AppState.piket.filter(p => p.status === "Selesai").length;
  const anggotaAktif  = AppState.anggota.filter(a => a.status === "Aktif").length;
  const totalSlot     = AppState.piket.reduce((s,p) => s + (p.petugas||[]).length, 0);
  const rataRata      = anggotaAktif ? (totalSlot / anggotaAktif).toFixed(1) : "0";

  document.getElementById("ringkasan-piket").innerHTML = [
    statCard("Total Jadwal", totalJadwal, "sepanjang waktu", "neutral",
      `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>`),
    statCard("Jadwal Mendatang", jadwalMendatang, "belum terlaksana", "neutral",
      `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>`),
    statCard("Piket Selesai", piketSelesai, "sudah terlaksana", "neutral",
      `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>`),
    statCard("Rata-rata per Anggota", rataRata + "x", "distribusi beban", "neutral",
      `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>`)
  ].join("");
}

/* ─────────────────────────────────────────────────────────
   TAB 1 — JADWAL (search, filter, sort, CRUD)
───────────────────────────────────────────────────────── */
function _renderTabJadwal(el, user, canEdit, canDelete) {
  const c = document.getElementById("tab-content-piket");
  c.innerHTML = `
  <div class="card">
    <div class="table-toolbar">
      <div class="search-bar">
        <svg class="search-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input id="search-piket" type="search" placeholder="Cari lokasi, nama petugas…">
      </div>
      <select id="filter-status-piket" style="padding:9px 14px;border:1.5px solid var(--gray-300);border-radius:var(--radius-pill);background:var(--gray-100);font-size:0.85rem">
        <option value="">Semua Status</option>
        ${STATUS_PIKET.map(s => `<option value="${s}">${s}</option>`).join("")}
      </select>
      <select id="sort-piket" style="padding:9px 14px;border:1.5px solid var(--gray-300);border-radius:var(--radius-pill);background:var(--gray-100);font-size:0.85rem">
        <option value="tanggal-desc">Tanggal Terbaru</option>
        <option value="tanggal-asc">Tanggal Terlama</option>
        <option value="petugas-desc">Jumlah Petugas Terbanyak</option>
      </select>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Hari</th><th>Tanggal</th><th>Lokasi</th><th>Petugas</th><th>Status</th><th>Aksi</th></tr></thead>
        <tbody id="tb-piket"></tbody>
      </table>
    </div>
  </div>`;

  const rowPiket = p => `<tr>
    <td>${formatHari(p.tanggal)}</td>
    <td style="white-space:nowrap">${formatTanggal(p.tanggal)}</td>
    <td>${p.lokasi||"—"}</td>
    <td>
      <button class="btn btn-ghost btn-sm btn-lihat-petugas" data-id="${p.id}" aria-label="Lihat daftar petugas">
        👥 ${(p.petugas||[]).length} orang
      </button>
    </td>
    <td>${statusBadge(p.status)}</td>
    <td><div style="display:flex;gap:6px">
      ${canEdit?`<button class="btn btn-ghost btn-sm btn-edit-piket" data-id="${p.id}" title="Edit" aria-label="Edit jadwal">✏</button>`:""}
      ${canDelete?`<button class="btn btn-ghost btn-sm btn-hapus-piket" data-id="${p.id}" title="Hapus" aria-label="Hapus jadwal" style="color:var(--danger)">🗑</button>`:""}
    </div></td>
  </tr>`;

  function terapkanFilterSort() {
    const q        = document.getElementById("search-piket").value.toLowerCase().trim();
    const statusF  = document.getElementById("filter-status-piket").value;
    const sortF    = document.getElementById("sort-piket").value;

    let hasil = AppState.piket.filter(p => {
      const cocokTeks = !q ||
        (p.lokasi||"").toLowerCase().includes(q) ||
        (p.petugas||[]).some(pt => pt.nama.toLowerCase().includes(q));
      const cocokStatus = !statusF || p.status === statusF;
      return cocokTeks && cocokStatus;
    });

    switch (sortF) {
      case "tanggal-desc": hasil.sort((a,b) => b.tanggal.localeCompare(a.tanggal)); break;
      case "tanggal-asc":  hasil.sort((a,b) => a.tanggal.localeCompare(b.tanggal)); break;
      case "petugas-desc": hasil.sort((a,b) => (b.petugas||[]).length - (a.petugas||[]).length); break;
    }

    renderTable(document.getElementById("tb-piket"), hasil, rowPiket);
  }

  terapkanFilterSort();
  document.getElementById("search-piket").addEventListener("input", terapkanFilterSort);
  document.getElementById("filter-status-piket").addEventListener("change", terapkanFilterSort);
  document.getElementById("sort-piket").addEventListener("change", terapkanFilterSort);

  document.getElementById("tb-piket").addEventListener("click", e => {
    const id = e.target.closest("[data-id]")?.dataset.id;
    if (!id) return;
    const p = AppState.piket.find(x => x.id === id);

    if (e.target.closest(".btn-lihat-petugas")) _bukaDetailPetugas(p);
    if (e.target.closest(".btn-edit-piket") && canEdit) {
      bukaFormPiket(p, () => renderPiket(el, user));
    }
    if (e.target.closest(".btn-hapus-piket") && canDelete) {
      Modal.konfirmasi(`Hapus jadwal piket <strong>${formatTanggal(p.tanggal)}</strong>?`, async () => {
        await DB.piket.hapus(id);
        if (!FIREBASE_ENABLED) renderPiket(el, user);
        tampilToast("Jadwal piket dihapus.", "default");
      });
    }
  });
}

function _bukaDetailPetugas(p) {
  Modal.buka({
    judul: `Petugas Piket — ${formatTanggal(p.tanggal)}`,
    konten: `
      <p style="margin-top:0;color:var(--ink-soft);font-size:0.85rem">${formatHari(p.tanggal)} · ${p.lokasi||"—"}</p>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${(p.petugas||[]).map(pt => `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--gray-100);border-radius:var(--radius-sm)">
            <div class="avatar" style="width:30px;height:30px;font-size:0.7rem">${getInisial(pt.nama)}</div>
            <span style="font-size:0.88rem;font-weight:600">${pt.nama}</span>
          </div>`).join("") || `<p style="color:var(--ink-soft)">Belum ada petugas.</p>`}
      </div>
      ${p.keterangan ? `<p style="margin-top:14px;font-size:0.85rem;color:var(--ink-soft)"><strong>Keterangan:</strong> ${p.keterangan}</p>` : ""}`,
    aksi: [{ label:"Tutup", kelas:"btn-primary", id:"m-tutup-detail-piket", onClick:()=>Modal.tutup() }]
  });
}

/* ─────────────────────────────────────────────────────────
   TAB 2 — RIWAYAT & STATISTIK (per-anggota, reuse _hitungRiwayatPiket)
───────────────────────────────────────────────────────── */
function _renderTabRiwayat() {
  const c = document.getElementById("tab-content-piket");
  const riwayat = _hitungRiwayatPiket();

  const data = AppState.anggota
    .filter(a => a.status === "Aktif")
    .map(a => ({ ...a, ...riwayat[a.id] }))
    .sort((x,y) => x.jumlahPiket - y.jumlahPiket);

  c.innerHTML = `
  <div class="card">
    <div class="card-title">Riwayat Piket per Anggota <span class="badge badge-info">${data.length} anggota aktif</span></div>
    <div class="table-toolbar">
      <div class="search-bar">
        <svg class="search-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input id="search-riwayat-piket" type="search" placeholder="Cari nama…">
      </div>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Nama</th><th>Kelas</th><th>Jumlah Piket</th><th>Terakhir Piket</th></tr></thead>
        <tbody id="tb-riwayat-piket"></tbody>
      </table>
    </div>
  </div>`;

  const rowRiwayat = r => `<tr>
    <td><div style="display:flex;align-items:center;gap:8px">
      <div class="avatar" style="width:28px;height:28px;font-size:0.65rem">${getInisial(r.nama)}</div>${r.nama}
    </div></td>
    <td>${r.kelas}</td>
    <td><strong>${r.jumlahPiket}x</strong></td>
    <td>${r.terakhirPiket ? formatTanggal(r.terakhirPiket) : `<span style="color:var(--ink-soft)">Belum pernah</span>`}</td>
  </tr>`;

  renderTable(document.getElementById("tb-riwayat-piket"), data, rowRiwayat);
  pasangSearch("search-riwayat-piket", "tb-riwayat-piket", data, rowRiwayat, ["nama","kelas"]);
}

/* State sementara daftar petugas yang sedang dipilih di dalam modal
   form (Tambah/Edit Manual). Pola sama dengan _pengurusReadOnly di
   pengurus.js — variabel module-level, bukan closure per-modal, karena
   fungsi-fungsi terkait dipanggil dari beberapa listener terpisah. */
let _petugasTerpilih = [];

/* ─────────────────────────────────────────────────────────
   MODAL FORM — Tambah/Edit Manual
───────────────────────────────────────────────────────── */
function bukaFormPiket(data, onSimpan) {
  const isEdit = !!data;
  const petugasAwal = data?.petugas || [];

  Modal.buka({
    judul: isEdit ? "Edit Jadwal Piket" : "Tambah Jadwal Manual",
    ukuran: "modal-lg",
    konten: `
      <div class="grid grid-2">
        <div class="field">
          <label>Tanggal</label>
          <input id="f-tanggal-piket" type="date" value="${data?.tanggal||""}">
        </div>
        <div class="field">
          <label>Status</label>
          <select id="f-status-piket">
            ${STATUS_PIKET.map(s => `<option ${data?.status===s?"selected":""}>${s}</option>`).join("")}
          </select>
        </div>
        <div class="field" style="grid-column:1/-1">
          <label>Lokasi</label>
          <input id="f-lokasi-piket" type="text" value="${data?.lokasi||""}" placeholder="Contoh: Pos UKS">
        </div>
        <div class="field" style="grid-column:1/-1">
          <label>Keterangan <span style="color:var(--ink-soft);font-weight:400">(opsional)</span></label>
          <input id="f-keterangan-piket" type="text" value="${data?.keterangan||""}" placeholder="Catatan tambahan">
        </div>
      </div>
      <div class="field">
        <label>Petugas</label>
        <div class="search-bar" style="margin-bottom:10px">
          <svg class="search-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input id="cari-petugas-piket" type="search" placeholder="Cari & tambah nama anggota…">
        </div>
        <div id="daftar-petugas-terpilih" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px"></div>
        <div id="daftar-kandidat-petugas" style="max-height:180px;overflow-y:auto;border:1px solid var(--gray-200);border-radius:var(--radius-sm);display:none"></div>
      </div>
      <div id="form-piket-err" class="alert alert-danger" style="display:none;margin-top:8px"></div>`,
    aksi: [
      { label:"Batal", kelas:"btn-ghost", id:"m-batal-piket", onClick:()=>Modal.tutup() },
      { label: isEdit?"Simpan":"Tambah", kelas:"btn-primary", id:"m-simpan-piket", onClick:()=>{
        const tanggal = document.getElementById("f-tanggal-piket").value;
        if (!tanggal) {
          const err = document.getElementById("form-piket-err");
          err.textContent = "Tanggal wajib diisi."; err.style.display = "flex"; return;
        }
        if (_petugasTerpilih.length === 0) {
          const err = document.getElementById("form-piket-err");
          err.textContent = "Minimal 1 petugas harus dipilih."; err.style.display = "flex"; return;
        }
        const payload = {
          tanggal,
          status: document.getElementById("f-status-piket").value,
          lokasi: document.getElementById("f-lokasi-piket").value.trim(),
          keterangan: document.getElementById("f-keterangan-piket").value.trim(),
          petugas: _petugasTerpilih.map(p => ({ id:p.id, nama:p.nama }))
        };
        _jalankanSimpan("m-simpan-piket", async () => {
          if (isEdit) await DB.piket.update(data.id, payload);
          else await DB.piket.tambah(payload);
          Modal.tutup();
          if (!FIREBASE_ENABLED) onSimpan?.();
          tampilToast(isEdit ? "Jadwal piket diperbarui." : "Jadwal piket ditambahkan.", "success");
        });
      }}
    ]
  });

  /* Widget pilih petugas — search + chip terpilih, murni UI lokal ke modal ini */
  _petugasTerpilih = [...petugasAwal];
  _renderChipPetugas();

  document.getElementById("cari-petugas-piket").addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase().trim();
    const wrapKandidat = document.getElementById("daftar-kandidat-petugas");
    if (!q) { wrapKandidat.style.display = "none"; wrapKandidat.innerHTML = ""; return; }

    const hasil = AppState.anggota
      .filter(a => a.status === "Aktif")
      .filter(a => a.nama.toLowerCase().includes(q))
      .filter(a => !_petugasTerpilih.some(p => p.id === a.id))
      .slice(0, 8);

    wrapKandidat.style.display = hasil.length ? "block" : "none";
    wrapKandidat.innerHTML = hasil.map(a => `
      <div class="kandidat-petugas-item" data-id="${a.id}" data-nama="${a.nama}"
        style="padding:8px 12px;cursor:pointer;font-size:0.85rem;border-bottom:1px solid var(--gray-100)">
        ${a.nama} <span style="color:var(--ink-soft);font-size:0.78rem">· ${a.kelas}</span>
      </div>`).join("");

    wrapKandidat.querySelectorAll(".kandidat-petugas-item").forEach(item => {
      item.addEventListener("click", () => {
        _petugasTerpilih.push({ id:item.dataset.id, nama:item.dataset.nama });
        _renderChipPetugas();
        document.getElementById("cari-petugas-piket").value = "";
        wrapKandidat.style.display = "none";
      });
    });
  });
}

function _renderChipPetugas() {
  const wrap = document.getElementById("daftar-petugas-terpilih");
  if (!wrap) return;
  wrap.innerHTML = _petugasTerpilih.length === 0
    ? `<span style="font-size:0.82rem;color:var(--ink-soft)">Belum ada petugas dipilih.</span>`
    : _petugasTerpilih.map(p => `
      <span class="badge badge-info" style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px">
        ${p.nama}
        <button type="button" class="btn-hapus-chip-petugas" data-id="${p.id}"
          aria-label="Hapus ${p.nama} dari daftar petugas"
          style="background:none;border:none;cursor:pointer;color:inherit;font-weight:700;padding:0">✕</button>
      </span>`).join("");

  wrap.querySelectorAll(".btn-hapus-chip-petugas").forEach(btn => {
    btn.addEventListener("click", () => {
      _petugasTerpilih = _petugasTerpilih.filter(p => p.id !== btn.dataset.id);
      _renderChipPetugas();
    });
  });
}

/* ─────────────────────────────────────────────────────────
   MODAL GENERATE — Tahap 1: input parameter algoritma
───────────────────────────────────────────────────────── */
function _bukaModalGenerate(el, user, prefill = {}) {
  Modal.buka({
    judul: "Generate Jadwal Piket",
    konten: `
      <p style="margin-top:0;color:var(--ink-soft);font-size:0.85rem">
        Sistem akan memilih petugas secara adil berdasarkan riwayat piket —
        yang paling jarang &amp; paling lama tidak piket diprioritaskan.
      </p>
      <div class="grid grid-2">
        <div class="field">
          <label>Tanggal Piket</label>
          <input id="gen-tanggal" type="date" value="${prefill.tanggal||""}">
        </div>
        <div class="field">
          <label>Lokasi</label>
          <input id="gen-lokasi" type="text" value="${prefill.lokasi||""}" placeholder="Contoh: Pos UKS">
        </div>
        <div class="field">
          <label>Jumlah Petugas</label>
          <input id="gen-jumlah" type="number" min="1" value="${prefill.jumlah||8}">
        </div>
        <div class="field">
          <label>Minimal Jeda Piket (hari)</label>
          <input id="gen-jeda" type="number" min="0" value="${prefill.jeda??7}">
        </div>
      </div>
      <div id="gen-err" class="alert alert-danger" style="display:none"></div>`,
    aksi: [
      { label:"Batal", kelas:"btn-ghost", id:"m-batal-gen", onClick:()=>Modal.tutup() },
      { label:"Preview Jadwal →", kelas:"btn-primary", id:"m-preview-gen", onClick:()=>{
        const tanggal = document.getElementById("gen-tanggal").value;
        const lokasi  = document.getElementById("gen-lokasi").value.trim();
        const jumlah  = +document.getElementById("gen-jumlah").value;
        const jeda    = +document.getElementById("gen-jeda").value;
        const err = document.getElementById("gen-err");

        if (!tanggal) { err.textContent = "Tanggal wajib diisi."; err.style.display = "flex"; return; }
        if (!jumlah || jumlah < 1) { err.textContent = "Jumlah petugas minimal 1."; err.style.display = "flex"; return; }

        const hasil = generateJadwalPiket(tanggal, jumlah, jeda);

        if (hasil.terpilih.length < jumlah) {
          err.innerHTML = `Hanya <strong>${hasil.terpilih.length} dari ${jumlah}</strong> slot terisi —
            kandidat memenuhi syarat tidak cukup. Coba turunkan Minimal Jeda atau lanjutkan dengan jumlah lebih sedikit.`;
          err.style.display = "flex";
        }

        _bukaModalPreviewGenerate(el, user, { tanggal, lokasi, jumlah, jeda }, hasil);
      }}
    ]
  });
}

/* ─────────────────────────────────────────────────────────
   MODAL GENERATE — Tahap 2: preview hasil + exclude/ganti
───────────────────────────────────────────────────────── */
function _bukaModalPreviewGenerate(el, user, param, hasilAwal) {
  let terpilih = [...hasilAwal.terpilih];
  let cadangan = [...hasilAwal.kandidatCadangan];

  function render() {
    const belumPernah = terpilih.filter(t => t.alasan === "Belum pernah piket").length;
    const lamaGakPiket = terpilih.length - belumPernah;

    Modal.buka({
      judul: "Preview Jadwal Piket",
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
            <div style="font-size:0.72rem;color:var(--ink-soft)">Belum Pernah Piket</div>
          </div>
          <div class="card" style="padding:14px;text-align:center">
            <div style="font-size:1.3rem;font-weight:700;color:var(--warning)">${lamaGakPiket}</div>
            <div style="font-size:0.72rem;color:var(--ink-soft)">Lama Tidak Piket</div>
          </div>
          <div class="card" style="padding:14px;text-align:center">
            <div style="font-size:1.1rem;font-weight:700;color:var(--success)">✓ Terpenuhi</div>
            <div style="font-size:0.72rem;color:var(--ink-soft)">Aturan Jeda ${param.jeda} Hari</div>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:6px;max-height:280px;overflow-y:auto">
          ${terpilih.map(t => `
            <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--gray-100);border-radius:var(--radius-sm)">
              <div class="avatar" style="width:32px;height:32px;font-size:0.7rem;flex-shrink:0">${getInisial(t.nama)}</div>
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:0.87rem">${t.nama}</div>
                <div style="font-size:0.75rem;color:var(--ink-soft)">${t.alasan}</div>
              </div>
              <button class="btn btn-ghost btn-sm btn-ganti-petugas-preview" data-id="${t.id}" aria-label="Ganti ${t.nama}">🔄 Ganti</button>
            </div>`).join("")}
        </div>
        <div id="preview-gen-err" class="alert alert-danger" style="display:none;margin-top:10px"></div>`,
      aksi: [
        { label:"← Kembali", kelas:"btn-ghost", id:"m-kembali-preview", onClick:() => {
          Modal.tutup();
          _bukaModalGenerate(el, user, param);
        }},
        { label:"Konfirmasi & Simpan", kelas:"btn-primary", id:"m-konfirmasi-preview", onClick: async () => {
          const btn = document.getElementById("m-konfirmasi-preview");
          btn.disabled = true; btn.textContent = "Menyimpan…";
          try {
            await DB.piket.tambah({
              tanggal: param.tanggal,
              lokasi: param.lokasi,
              status: "Terjadwal",
              keterangan: "",
              petugas: terpilih.map(t => ({ id:t.id, nama:t.nama }))
            });
            Modal.tutup();
            if (!FIREBASE_ENABLED) renderPiket(el, user);
            tampilToast(`Jadwal piket ${formatTanggal(param.tanggal)} berhasil dibuat.`, "success");
          } catch(e) {
            console.error("[PMR] Gagal simpan jadwal piket:", e);
            tampilToast("Gagal menyimpan jadwal. Coba lagi.", "danger");
            btn.disabled = false; btn.textContent = "Konfirmasi & Simpan";
          }
        }}
      ]
    });

    document.querySelectorAll(".btn-ganti-petugas-preview").forEach(btn => {
      btn.addEventListener("click", () => {
        const idDiganti = btn.dataset.id;
        terpilih = terpilih.filter(t => t.id !== idDiganti);
        if (cadangan.length > 0) {
          const pengganti = cadangan.shift();
          terpilih.push({
            id: pengganti.id, nama: pengganti.nama,
            alasan: pengganti.jumlahPiket === 0
              ? "Belum pernah piket"
              : `Terakhir piket ${pengganti.selisihHari} hari lalu (${pengganti.jumlahPiket}x total)`
          });
        }
        render(); /* re-render modal dengan state terbaru */
      });
    });
  }

  render();
}
