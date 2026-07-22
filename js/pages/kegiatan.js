/* =========================================================
   PAGES/KEGIATAN.JS
   Diekstrak dari dashboard.js (Fase 3 — modularisasi).
   F3.2: ditambah dropdown filter status khusus role "anggota".
   Untuk role lain, markup & perilaku 100% identik dengan F3.1.
   ========================================================= */

/* ─────────────────────────────────────────────────────────
   KEGIATAN
───────────────────────────────────────────────────────── */
function renderKegiatan(el, user) {
  const canEdit = ["admin","ketua","wakil","pj"].includes(user.role);
  const isAnggota = user.role === "anggota";

  el.innerHTML = `
  <div class="page-head">
    <div><h1>Kegiatan</h1><p class="page-sub">Program PMR masa bakti ${AppState.periode}</p></div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-outline btn-sm" id="btn-print-kegiatan">🖨 Cetak</button>
      ${canEdit?`<button class="btn btn-primary btn-sm" id="btn-tambah-kegiatan">+ Kegiatan Baru</button>`:""}
    </div>
  </div>
  <div class="card">
    <div class="table-toolbar">
      <div class="search-bar">
        <svg class="search-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input id="search-kegiatan" type="search" placeholder="Cari nama, PJ, lokasi…">
      </div>
      ${isAnggota ? `
      <select id="filter-status-kegiatan" style="padding:9px 14px;border:1.5px solid var(--gray-300);border-radius:var(--radius-pill);background:var(--gray-100);font-size:0.85rem">
        <option value="">Semua Status</option>
        <option value="Terjadwal">Terjadwal</option>
        <option value="Selesai">Selesai</option>
        <option value="Dibatalkan">Dibatalkan</option>
      </select>` : ""}
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>#</th><th>Nama</th><th>Tanggal</th><th>Lokasi</th><th>PJ</th><th>Peserta</th><th>Status</th>${canEdit?"<th>Aksi</th>":""}</tr></thead>
        <tbody id="tb-kegiatan"></tbody>
      </table>
    </div>
  </div>`;

  /* FIX BUG #2: sama seperti renderAnggota — pakai index dari Array.map */
  const rowKegiatan = (k, i) => `<tr>
    <td>${i + 1}</td>
    <td><strong>${k.nama}</strong></td>
    <td style="white-space:nowrap">${formatTanggal(k.tanggal)}</td>
    <td>${k.lokasi||"—"}</td><td>${k.pj||"—"}</td>
    <td>${k.peserta||0} orang</td>
    <td>${statusBadge(k.status)}</td>
    ${canEdit?`<td><div style="display:flex;gap:6px">
      <button class="btn btn-ghost btn-sm btn-edit-kegiatan" data-id="${k.id}" title="Edit" aria-label="Edit ${k.nama}">✏</button>
      <button class="btn btn-ghost btn-sm btn-hapus-kegiatan" data-id="${k.id}" title="Hapus" aria-label="Hapus ${k.nama}" style="color:var(--danger)">🗑</button>
    </div></td>`:""}
  </tr>`;

  renderTable(document.getElementById("tb-kegiatan"), AppState.kegiatan, rowKegiatan);

  if (isAnggota) {
    /* F3.2: filter gabungan search + status, khusus anggota.
       Tidak memakai pasangSearch() generik karena perlu menggabungkan
       dua kriteria sekaligus (teks & status) — role lain tetap pakai
       pasangSearch() standar seperti F3.1 (lihat blok else di bawah). */
    const inputSearch = document.getElementById("search-kegiatan");
    const selectStatus = document.getElementById("filter-status-kegiatan");
    const terapkanFilter = () => {
      const q = inputSearch.value.toLowerCase().trim();
      const statusPilihan = selectStatus.value;
      const hasil = AppState.kegiatan.filter(k => {
        const cocokTeks = !q || ["nama","pj","lokasi","status"].some(kol => String(k[kol]||"").toLowerCase().includes(q));
        const cocokStatus = !statusPilihan || k.status === statusPilihan;
        return cocokTeks && cocokStatus;
      });
      renderTable(document.getElementById("tb-kegiatan"), hasil, rowKegiatan);
    };
    inputSearch.addEventListener("input", terapkanFilter);
    selectStatus.addEventListener("change", terapkanFilter);
  } else {
    pasangSearch("search-kegiatan","tb-kegiatan",AppState.kegiatan,rowKegiatan,["nama","pj","lokasi","status"]);
  }

  document.getElementById("tb-kegiatan")?.addEventListener("click", e => {
    const id = e.target.closest("[data-id]")?.dataset.id;
    if (!id) return;
    if (e.target.closest(".btn-edit-kegiatan"))
      bukaFormKegiatan(AppState.kegiatan.find(x=>x.id===id), ()=>renderKegiatan(el,user));
    if (e.target.closest(".btn-hapus-kegiatan")) {
      const k = AppState.kegiatan.find(x=>x.id===id);
      Modal.konfirmasi(`Hapus kegiatan <strong>${k?.nama}</strong>?`, async () => {
        await DB.kegiatan.hapus(id);
        if (!FIREBASE_ENABLED) renderKegiatan(el,user);
        tampilToast("Kegiatan dihapus.","default");
      });
    }
  });

  document.getElementById("btn-tambah-kegiatan")?.addEventListener("click",()=>bukaFormKegiatan(null,()=>renderKegiatan(el,user)));
  document.getElementById("btn-print-kegiatan")?.addEventListener("click",()=>window.print());
}

function bukaFormKegiatan(data, onSimpan) {
  const isEdit = !!data;
  Modal.buka({
    judul:isEdit?"Edit Kegiatan":"Kegiatan Baru",
    konten:`
      <div class="grid grid-2">
        <div class="field" style="grid-column:1/-1">
          <label>Nama Kegiatan</label>
          <input id="f-nama-keg" type="text" value="${data?.nama||""}" placeholder="Nama kegiatan">
        </div>
        <div class="field">
          <label>Tanggal</label>
          <input id="f-tgl-keg" type="date" value="${data?.tanggal||""}">
        </div>
        <div class="field">
          <label>Estimasi Peserta</label>
          <input id="f-peserta-keg" type="number" value="${data?.peserta||""}" placeholder="Jumlah orang">
        </div>
        <div class="field" style="grid-column:1/-1">
          <label>Lokasi</label>
          <input id="f-lokasi-keg" type="text" value="${data?.lokasi||""}" placeholder="Lokasi kegiatan">
        </div>
        <div class="field">
          <label>Penanggung Jawab</label>
          <input id="f-pj-keg" type="text" value="${data?.pj||""}" placeholder="Nama PJ">
        </div>
        <div class="field">
          <label>Status</label>
          <select id="f-status-keg">
            ${["Terjadwal","Selesai","Dibatalkan"].map(s=>`<option ${data?.status===s?"selected":""}>${s}</option>`).join("")}
          </select>
        </div>
      </div>`,
    aksi:[
      {label:"Batal",kelas:"btn-ghost",id:"m-batal-keg",onClick:()=>Modal.tutup()},
      {label:isEdit?"Simpan":"Tambah",kelas:"btn-primary",id:"m-simpan-keg",onClick:()=>{
        const nama = document.getElementById("f-nama-keg").value.trim();
        if (!nama) { tampilToast("Nama kegiatan tidak boleh kosong.","danger"); return; }
        const payload = {
          nama, tanggal:document.getElementById("f-tgl-keg").value,
          peserta:+document.getElementById("f-peserta-keg").value||0,
          lokasi:document.getElementById("f-lokasi-keg").value.trim(),
          pj:document.getElementById("f-pj-keg").value.trim(),
          status:document.getElementById("f-status-keg").value
        };
        _jalankanSimpan("m-simpan-keg", async ()=>{
          if (isEdit) await DB.kegiatan.update(data.id, payload);
          else await DB.kegiatan.tambah(payload);
          Modal.tutup();
          if (!FIREBASE_ENABLED) onSimpan?.();
          tampilToast(isEdit?"Kegiatan diperbarui.":"Kegiatan ditambahkan.","success");
        });
      }}
    ]
  });
}
