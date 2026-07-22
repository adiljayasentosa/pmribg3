/* =========================================================
   PAGES/INVENTARIS.JS (F4.0 — Modul Inventaris PMR)
   =========================================================
   Mengikuti pola CRUD standar proyek ini (lihat keuangan.js
   sebagai referensi terdekat): render + form modal + search
   + filter + sort, tanpa collection terpisah per kategori.

   RBAC (sesuai kesepakatan, cocok dengan Firestore Rules):
     Read          : semua role (admin,ketua,wakil,sekretaris,
                     bendahara,pj,anggota) — transparansi aset
     Create/Update : admin, ketua, wakil, pj
     Delete        : admin, ketua saja (lebih ketat dari edit)
   ========================================================= */

const KATEGORI_INVENTARIS = [
  "Obat", "Alat Pertolongan Pertama", "APD",
  "Evakuasi", "Logistik", "Administrasi", "Lainnya"
];
const KONDISI_INVENTARIS = ["Baik", "Rusak Ringan", "Rusak Berat", "Perlu Diganti"];

/* Urutan prioritas untuk sort "Kondisi Terburuk Dulu" — barang yang
   paling butuh perhatian tampil di atas. */
const _URUTAN_KONDISI = { "Rusak Berat": 0, "Perlu Diganti": 1, "Rusak Ringan": 2, "Baik": 3 };

/* ─────────────────────────────────────────────────────────
   RENDER UTAMA
───────────────────────────────────────────────────────── */
function renderInventaris(el, user) {
  const canEdit   = ["admin","ketua","wakil","pj"].includes(user.role);
  const canDelete = ["admin","ketua"].includes(user.role);

  const total       = AppState.inventaris.length;
  const totalItem   = AppState.inventaris.reduce((s,x) => s + (+x.jumlah || 0), 0);
  const rusak       = AppState.inventaris.filter(x => x.kondisi === "Rusak Ringan" || x.kondisi === "Rusak Berat").length;
  const perluGanti  = AppState.inventaris.filter(x => x.kondisi === "Perlu Diganti").length;

  el.innerHTML = `
  <div class="page-head">
    <div><h1>Inventaris</h1><p class="page-sub">Data aset & perlengkapan PMR</p></div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-outline btn-sm" id="btn-print-inventaris">🖨 Cetak</button>
      ${canEdit?`<button class="btn btn-primary btn-sm" id="btn-tambah-inventaris">+ Tambah Barang</button>`:""}
    </div>
  </div>

  <div class="grid grid-4" style="margin-bottom:24px">
    ${statCard("Total Barang", total, "jenis terdaftar", "neutral",
      `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>`)}
    ${statCard("Total Item", totalItem, "unit keseluruhan", "neutral",
      `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>`)}
    ${statCard("Barang Rusak", rusak, "ringan + berat", "neutral",
      `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 9v2m0 4h.01M4.93 4.93l14.14 14.14M12 2a10 10 0 100 20 10 10 0 000-20z"/>`)}
    ${statCard("Perlu Diganti", perluGanti, "butuh tindak lanjut", "neutral",
      `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>`)}
  </div>

  <div class="card">
    <div class="table-toolbar">
      <div class="search-bar">
        <svg class="search-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input id="search-inventaris" type="search" placeholder="Cari nama, lokasi…">
      </div>
      <select id="filter-kategori-inventaris" style="padding:9px 14px;border:1.5px solid var(--gray-300);border-radius:var(--radius-pill);background:var(--gray-100);font-size:0.85rem">
        <option value="">Semua Kategori</option>
        ${KATEGORI_INVENTARIS.map(k => `<option value="${k}">${k}</option>`).join("")}
      </select>
      <select id="filter-kondisi-inventaris" style="padding:9px 14px;border:1.5px solid var(--gray-300);border-radius:var(--radius-pill);background:var(--gray-100);font-size:0.85rem">
        <option value="">Semua Kondisi</option>
        ${KONDISI_INVENTARIS.map(k => `<option value="${k}">${k}</option>`).join("")}
      </select>
      <select id="sort-inventaris" style="padding:9px 14px;border:1.5px solid var(--gray-300);border-radius:var(--radius-pill);background:var(--gray-100);font-size:0.85rem">
        <option value="nama-asc">Nama (A-Z)</option>
        <option value="nama-desc">Nama (Z-A)</option>
        <option value="jumlah-desc">Jumlah Terbanyak</option>
        <option value="jumlah-asc">Jumlah Tersedikit</option>
        <option value="kondisi-prioritas">Kondisi Terburuk Dulu</option>
      </select>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr><th>#</th><th>Nama Barang</th><th>Kategori</th><th>Jumlah</th><th>Kondisi</th><th>Lokasi</th>${(canEdit||canDelete)?"<th>Aksi</th>":""}</tr>
        </thead>
        <tbody id="tb-inventaris"></tbody>
      </table>
    </div>
  </div>`;

  const rowInventaris = (x, i) => `<tr>
    <td>${i + 1}</td>
    <td><strong>${x.nama}</strong>${x.keterangan ? `<div style="font-size:0.75rem;color:var(--ink-soft);margin-top:2px">${x.keterangan}</div>` : ""}</td>
    <td>${x.kategori}</td>
    <td>${x.jumlah} ${x.satuan||""}</td>
    <td>${statusBadge(x.kondisi)}</td>
    <td>${x.lokasi||"—"}</td>
    ${(canEdit||canDelete)?`<td><div style="display:flex;gap:6px">
      ${canEdit?`<button class="btn btn-ghost btn-sm btn-edit-inventaris" data-id="${x.id}" title="Edit" aria-label="Edit ${x.nama}">✏</button>`:""}
      ${canDelete?`<button class="btn btn-ghost btn-sm btn-hapus-inventaris" data-id="${x.id}" title="Hapus" aria-label="Hapus ${x.nama}" style="color:var(--danger)">🗑</button>`:""}
    </div></td>`:""}
  </tr>`;

  /* Filter + sort gabungan, mengikuti pola yang sudah dipakai di
     kegiatan.js (F3.2) — search generik pasangSearch() tidak cukup
     karena perlu menggabungkan 3 kriteria sekaligus (teks, kategori,
     kondisi) plus sorting. */
  function terapkanFilterSort() {
    const q          = document.getElementById("search-inventaris").value.toLowerCase().trim();
    const kategoriF  = document.getElementById("filter-kategori-inventaris").value;
    const kondisiF   = document.getElementById("filter-kondisi-inventaris").value;
    const sortF      = document.getElementById("sort-inventaris").value;

    let hasil = AppState.inventaris.filter(x => {
      const cocokTeks = !q || ["nama","lokasi"].some(kol => String(x[kol]||"").toLowerCase().includes(q));
      const cocokKategori = !kategoriF || x.kategori === kategoriF;
      const cocokKondisi  = !kondisiF || x.kondisi === kondisiF;
      return cocokTeks && cocokKategori && cocokKondisi;
    });

    switch (sortF) {
      case "nama-asc":          hasil.sort((a,b) => a.nama.localeCompare(b.nama)); break;
      case "nama-desc":         hasil.sort((a,b) => b.nama.localeCompare(a.nama)); break;
      case "jumlah-desc":       hasil.sort((a,b) => (+b.jumlah||0) - (+a.jumlah||0)); break;
      case "jumlah-asc":        hasil.sort((a,b) => (+a.jumlah||0) - (+b.jumlah||0)); break;
      case "kondisi-prioritas": hasil.sort((a,b) => (_URUTAN_KONDISI[a.kondisi] ?? 9) - (_URUTAN_KONDISI[b.kondisi] ?? 9)); break;
    }

    renderTable(document.getElementById("tb-inventaris"), hasil, rowInventaris);
  }

  terapkanFilterSort();
  document.getElementById("search-inventaris").addEventListener("input", terapkanFilterSort);
  document.getElementById("filter-kategori-inventaris").addEventListener("change", terapkanFilterSort);
  document.getElementById("filter-kondisi-inventaris").addEventListener("change", terapkanFilterSort);
  document.getElementById("sort-inventaris").addEventListener("change", terapkanFilterSort);

  document.getElementById("tb-inventaris")?.addEventListener("click", e => {
    const id = e.target.closest("[data-id]")?.dataset.id;
    if (!id) return;
    if (e.target.closest(".btn-edit-inventaris") && canEdit) {
      bukaFormInventaris(AppState.inventaris.find(x => x.id === id), () => renderInventaris(el, user));
    }
    if (e.target.closest(".btn-hapus-inventaris") && canDelete) {
      const x = AppState.inventaris.find(item => item.id === id);
      Modal.konfirmasi(`Hapus barang <strong>${x?.nama}</strong> dari inventaris?`, async () => {
        await DB.inventaris.hapus(id);
        if (!FIREBASE_ENABLED) renderInventaris(el, user);
        tampilToast("Barang dihapus dari inventaris.", "default");
      });
    }
  });

  document.getElementById("btn-tambah-inventaris")?.addEventListener("click", () =>
    bukaFormInventaris(null, () => renderInventaris(el, user)));
  document.getElementById("btn-print-inventaris")?.addEventListener("click", () => window.print());
}

/* ─────────────────────────────────────────────────────────
   MODAL FORM — Tambah/Edit Barang
───────────────────────────────────────────────────────── */
function bukaFormInventaris(data, onSimpan) {
  const isEdit = !!data;

  Modal.buka({
    judul: isEdit ? "Edit Barang" : "Tambah Barang Baru",
    konten: `
      <div class="grid grid-2">
        <div class="field" style="grid-column:1/-1">
          <label>Nama Barang</label>
          <input id="f-nama-inv" type="text" value="${data?.nama||""}" placeholder="Contoh: Kasa Steril">
        </div>
        <div class="field">
          <label>Kategori</label>
          <select id="f-kategori-inv">
            ${KATEGORI_INVENTARIS.map(k => `<option ${data?.kategori===k?"selected":""}>${k}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Kondisi</label>
          <select id="f-kondisi-inv">
            ${KONDISI_INVENTARIS.map(k => `<option ${data?.kondisi===k?"selected":""}>${k}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Jumlah</label>
          <input id="f-jumlah-inv" type="number" min="0" value="${data?.jumlah??""}" placeholder="0">
        </div>
        <div class="field">
          <label>Satuan</label>
          <input id="f-satuan-inv" type="text" value="${data?.satuan||""}" placeholder="pcs / box / unit">
        </div>
        <div class="field" style="grid-column:1/-1">
          <label>Lokasi Penyimpanan</label>
          <input id="f-lokasi-inv" type="text" value="${data?.lokasi||""}" placeholder="Contoh: Lemari P3K Ruang UKS">
        </div>
        <div class="field" style="grid-column:1/-1">
          <label>Keterangan <span style="color:var(--ink-soft);font-weight:400">(opsional)</span></label>
          <input id="f-keterangan-inv" type="text" value="${data?.keterangan||""}" placeholder="Catatan tambahan">
        </div>
      </div>
      <div id="form-inventaris-err" class="alert alert-danger" style="display:none;margin-top:8px"></div>`,
    aksi: [
      { label:"Batal", kelas:"btn-ghost", id:"m-batal-inv", onClick:()=>Modal.tutup() },
      { label: isEdit?"Simpan":"Tambah", kelas:"btn-primary", id:"m-simpan-inv", onClick:()=>{
        const nama   = document.getElementById("f-nama-inv").value.trim();
        const jumlah = document.getElementById("f-jumlah-inv").value;
        if (!nama) {
          const err = document.getElementById("form-inventaris-err");
          err.textContent = "Nama barang tidak boleh kosong."; err.style.display = "flex"; return;
        }
        if (jumlah === "" || +jumlah < 0) {
          const err = document.getElementById("form-inventaris-err");
          err.textContent = "Jumlah harus diisi dengan angka 0 atau lebih."; err.style.display = "flex"; return;
        }
        const payload = {
          nama,
          kategori: document.getElementById("f-kategori-inv").value,
          kondisi:  document.getElementById("f-kondisi-inv").value,
          jumlah:   +jumlah,
          satuan:   document.getElementById("f-satuan-inv").value.trim(),
          lokasi:   document.getElementById("f-lokasi-inv").value.trim(),
          keterangan: document.getElementById("f-keterangan-inv").value.trim()
        };
        _jalankanSimpan("m-simpan-inv", async () => {
          if (isEdit) await DB.inventaris.update(data.id, payload);
          else await DB.inventaris.tambah(payload);
          Modal.tutup();
          if (!FIREBASE_ENABLED) onSimpan?.();
          tampilToast(isEdit ? "Data barang diperbarui." : "Barang baru ditambahkan.", "success");
        });
      }}
    ]
  });
}
