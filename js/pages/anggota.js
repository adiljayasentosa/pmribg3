/* =========================================================
   PAGES/ANGGOTA.JS
   Diekstrak dari dashboard.js (Fase 3 — modularisasi).
   Tidak ada perubahan logika, hanya pemindahan lokasi.
   ========================================================= */

/* ─────────────────────────────────────────────────────────
   ANGGOTA
───────────────────────────────────────────────────────── */
function renderAnggota(el, user) {
  const canEdit = ["admin","ketua","sekretaris"].includes(user.role);
  el.innerHTML = `
  <div class="page-head">
    <div><h1>Data Anggota</h1><p class="page-sub">${AppState.anggota.length} anggota terdaftar</p></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-outline btn-sm" id="btn-print-anggota">🖨 Cetak</button>
      ${canEdit?`<button class="btn btn-primary btn-sm" id="btn-tambah-anggota">+ Tambah Anggota</button>`:""}
    </div>
  </div>
  <div class="card">
    <div class="table-toolbar">
      <div class="search-bar">
        <svg class="search-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input id="search-anggota" type="search" placeholder="Cari nama, kelas, divisi…">
      </div>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>#</th><th>Nama</th><th>Kelas</th><th>Divisi</th><th>Status</th><th>Aksi</th></tr></thead>
        <tbody id="tb-anggota"></tbody>
      </table>
    </div>
  </div>`;

  /* FIX BUG #2: rowAnggota menerima (item, index) dari Array.map di renderTable.
     Sebelumnya 'let no = 1' di-share sebagai closure — counter tidak pernah reset
     antara render awal dan setiap panggilan pasangSearch, sehingga nomor urut
     terus naik setiap kali user mengetik di search bar. */
  const rowAnggota = (a, i) => `<tr>
    <td>${i + 1}</td>
    <td><div style="display:flex;align-items:center;gap:10px">
      <div class="avatar" style="width:32px;height:32px;font-size:0.7rem">${getInisial(a.nama)}</div>
      <strong>${a.nama}</strong>
    </div></td>
    <td>${a.kelas}</td><td>${a.divisi}</td><td>${statusBadge(a.status)}</td>
    <td><div style="display:flex;gap:6px">
      <button class="btn btn-ghost btn-sm btn-detail-anggota" data-id="${a.id}" title="Detail" aria-label="Lihat detail ${a.nama}">👁</button>
      ${canEdit?`<button class="btn btn-ghost btn-sm btn-edit-anggota" data-id="${a.id}" title="Edit" aria-label="Edit ${a.nama}">✏</button>
      <button class="btn btn-ghost btn-sm btn-hapus-anggota" data-id="${a.id}" title="Hapus" aria-label="Hapus ${a.nama}" style="color:var(--danger)">🗑</button>`:""}
    </div></td>
  </tr>`;

  renderTable(document.getElementById("tb-anggota"), AppState.anggota, rowAnggota);
  pasangSearch("search-anggota","tb-anggota", AppState.anggota, rowAnggota, ["nama","kelas","divisi","status"]);

  document.getElementById("tb-anggota").addEventListener("click", e => {
    const id = e.target.closest("[data-id]")?.dataset.id;
    if (!id) return;
    if (e.target.closest(".btn-detail-anggota")) {
      bukaDetailAnggota(AppState.anggota.find(x => x.id === id));
    }
    if (e.target.closest(".btn-edit-anggota") && canEdit) {
      bukaFormAnggota(AppState.anggota.find(x => x.id === id), () => renderAnggota(el, user));
    }
    if (e.target.closest(".btn-hapus-anggota") && canEdit) {
      const a = AppState.anggota.find(x => x.id === id);
      Modal.konfirmasi(`Hapus anggota <strong>${a?.nama}</strong>?`, async () => {
        await DB.anggota.hapus(id);
        if (!FIREBASE_ENABLED) renderAnggota(el, user);
        tampilToast("Anggota dihapus.", "default");
      });
    }
  });

  document.getElementById("btn-tambah-anggota")?.addEventListener("click", () =>
    bukaFormAnggota(null, () => renderAnggota(el, user)));
  document.getElementById("btn-print-anggota")?.addEventListener("click", () => window.print());
}

function bukaDetailAnggota(a) {
  if (!a) return;
  const riwayat = AppState.presensiHistory.filter(p => p.anggotaId === a.id);
  const hadir   = riwayat.filter(p => p.hadir).length;
  const pct     = riwayat.length ? Math.round(hadir/riwayat.length*100) : 0;
  const warna   = pct>=80?"var(--success)":pct>=60?"var(--warning)":"var(--danger)";

  Modal.buka({
    judul:"Detail Anggota", ukuran:"modal-lg",
    konten:`
      <div class="detail-hero">
        <div class="avatar">${getInisial(a.nama)}</div>
        <div><div class="detail-nama">${a.nama}</div><div class="detail-kelas">${a.kelas} · ${a.divisi}</div></div>
      </div>
      <div class="detail-info-grid" style="margin-top:0">
        <div class="detail-info-item"><div class="lbl">Status</div><div class="val">${statusBadge(a.status)}</div></div>
        <div class="detail-info-item"><div class="lbl">Bergabung</div><div class="val">${a.bergabung?formatTanggal(a.bergabung):"—"}</div></div>
        <div class="detail-info-item"><div class="lbl">Divisi</div><div class="val">${a.divisi||"—"}</div></div>
        <div class="detail-info-item"><div class="lbl">Kehadiran</div>
          <div class="val" style="color:${warna}">${pct}%
            <span style="font-size:0.78rem;font-weight:400;color:var(--ink-soft)">(${hadir}/${riwayat.length} pertemuan)</span>
          </div>
        </div>
      </div>
      <div style="font-weight:700;font-size:0.85rem;margin:14px 0 10px">Riwayat Presensi</div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Tanggal</th><th>Status</th><th>Keterangan</th></tr></thead>
          <tbody>${riwayat.length===0
            ?`<tr><td colspan="3" style="text-align:center;color:var(--ink-soft)">Belum ada data.</td></tr>`
            :riwayat.map(p=>`<tr>
              <td>${formatTanggal(p.tanggal)}</td>
              <td>${p.hadir?'<span class="badge badge-success">Hadir</span>':'<span class="badge badge-gray">Alpha</span>'}</td>
              <td>${p.ket||"—"}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>`,
    aksi:[{label:"Tutup",kelas:"btn-primary",id:"modal-tutup-detail",onClick:()=>Modal.tutup()}]
  });
}

function bukaFormAnggota(data, onSimpan) {
  const isEdit = !!data;
  const divisiList = ["Pertolongan Pertama","Kesehatan Remaja","Kepemimpinan","Bakti Masyarakat"];

  Modal.buka({
    judul: isEdit?"Edit Anggota":"Tambah Anggota Baru",
    konten:`
      <div class="grid grid-2">
        <div class="field" style="grid-column:1/-1">
          <label>Nama Lengkap</label>
          <input id="f-nama" type="text" value="${data?.nama||""}" placeholder="Nama lengkap">
        </div>
        <div class="field">
          <label>Kelas</label>
          <input id="f-kelas" type="text" value="${data?.kelas||""}" placeholder="Contoh: XI TKJ 1">
        </div>
        <div class="field">
          <label>Divisi</label>
          <select id="f-divisi">
            ${divisiList.map(d=>`<option ${data?.divisi===d?"selected":""}>${d}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Status</label>
          <select id="f-status">
            <option ${data?.status==="Aktif"?"selected":""}>Aktif</option>
            <option ${data?.status==="Tidak Aktif"?"selected":""}>Tidak Aktif</option>
          </select>
        </div>
      </div>
      <div id="form-anggota-err" class="alert alert-danger" style="display:none;margin-top:8px"></div>`,
    aksi:[
      {label:"Batal",kelas:"btn-ghost",id:"m-batal-anggota",onClick:()=>Modal.tutup()},
      {label:isEdit?"Simpan":"Tambah",kelas:"btn-primary",id:"m-simpan-anggota",onClick:()=>{
        const nama = document.getElementById("f-nama").value.trim();
        if (!nama) {
          const err = document.getElementById("form-anggota-err");
          err.textContent="Nama tidak boleh kosong."; err.style.display="flex"; return;
        }
        const payload = {
          nama, kelas:document.getElementById("f-kelas").value.trim(),
          divisi:document.getElementById("f-divisi").value,
          status:document.getElementById("f-status").value,
          bergabung: data?.bergabung || new Date().toISOString().split("T")[0]
        };
        _jalankanSimpan("m-simpan-anggota", async () => {
          if (isEdit) await DB.anggota.update(data.id, payload);
          else await DB.anggota.tambah(payload);
          Modal.tutup();
          if (!FIREBASE_ENABLED) onSimpan?.();
          tampilToast(isEdit?"Data anggota diperbarui.":"Anggota baru ditambahkan.", "success");
        });
      }}
    ]
  });
}
