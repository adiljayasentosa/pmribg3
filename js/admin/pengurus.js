/* =========================================================
   PAGES/PENGURUS.JS
   Diekstrak dari dashboard.js (Fase 3 — modularisasi).
   F3.2: ditambah mode view-only khusus role "anggota".
   Untuk role lain, _pengurusReadOnly tetap false (default) —
   seluruh output HTML identik 100% dengan versi F3.1.
   ========================================================= */

/* ─────────────────────────────────────────────────────────
   PENGURUS
───────────────────────────────────────────────────────── */
function cariJabatan(roleId) {
  return AppState.strukturPengurus.find(j => j.role_id === roleId);
}
let _pengurusIdCounter = 9100;
function idBaruPengurus() { return _pengurusIdCounter++; }

/* F3.2: flag view-only. Dibaca oleh kartuJabatan()/chipOrang() tanpa
   perlu mengubah signature fungsi tersebut di banyak tempat pemanggilan
   (gambarStrukturPengurus dipanggil ulang dari _simpanDanGambar juga). */
let _pengurusReadOnly = false;

function renderPengurus(el, user) {
  _pengurusReadOnly = user && user.role === "anggota";

  el.innerHTML = `
  <div class="page-head">
    <div><h1>Pengurus PMR</h1><p class="page-sub">Masa Bakti ${AppState.periode}</p></div>
    ${_pengurusReadOnly ? "" : `<button class="btn btn-outline btn-sm" id="btn-kosongkan-jabatan">↺ Kosongkan Semua Jabatan</button>`}
  </div>
  <div id="pengurus-container"></div>`;

  if (!_pengurusReadOnly) {
    document.getElementById("btn-kosongkan-jabatan").addEventListener("click", () => {
      Modal.konfirmasi(
        "Kosongkan seluruh jabatan pengurus? Semua nama akan dihapus dari jabatannya. Jabatan dan struktur organisasi tetap ada.",
        async () => {
          /* Kosongkan array anggota di setiap jabatan — struktur jabatan dipertahankan.
             Berguna saat pergantian periode kepengurusan. */
          const strukturKosong = AppState.strukturPengurus.map(jabatan => ({
            ...jabatan,
            anggota: []
          }));
          try {
            await DB.pengurus.simpanStruktur(strukturKosong);
            gambarStrukturPengurus();
            tampilToast("Semua jabatan berhasil dikosongkan.", "success");
          } catch(e) {
            console.error("[PMR] Gagal kosongkan jabatan:", e);
            tampilToast("Gagal mengosongkan jabatan. Coba lagi.", "danger");
          }
        }
      );
    });
  }
  gambarStrukturPengurus();
}

function gambarStrukturPengurus() {
  const c = document.getElementById("pengurus-container");
  if (!c) return;
  c.innerHTML = `
    <div class="pengurus-section">${kartuJabatan(cariJabatan("pembimbing"))}</div>
    <div class="pengurus-section pengurus-row-2">
      ${kartuJabatan(cariJabatan("ketua"))}
      ${kartuJabatan(cariJabatan("wakil"))}
    </div>
    <div class="pengurus-section">${kartuJabatan(cariJabatan("sekretaris"))}</div>
    <div class="pengurus-section">${kartuJabatan(cariJabatan("bendahara"))}</div>
    <div class="pengurus-section-label">Penanggung Jawab Divisi</div>
    <div class="pengurus-section pengurus-grid-pj">
      ${AppState.strukturPengurus.filter(j=>j.role_id.startsWith("pj_")).map(kartuJabatan).join("")}
    </div>`;
  pasangEventPengurus(c);
}

function kartuJabatan(item) {
  if (!item) return "";
  const penuh = item.anggota.length >= item.maks;
  const chips = item.anggota.length
    ? item.anggota.map(a=>chipOrang(item.role_id, a)).join("")
    : `<div class="person-chip-empty">
        <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.5v15m7.5-7.5h-15"/>
        </svg>Belum terisi</div>`;
  return `
  <div class="card pengurus-card" data-role="${item.role_id}">
    <div class="card-title">${item.jabatan}
      <span class="badge ${penuh?"badge-success":"badge-gray"}">${item.anggota.length}/${item.maks}</span>
    </div>
    <div class="jabatan-anggota-grid">${chips}</div>
    ${(!penuh && !_pengurusReadOnly)?`<button class="btn btn-ghost btn-sm btn-tambah-pengurus" data-role="${item.role_id}">+ Tambah ${item.jabatan}</button>`:""}
  </div>`;
}

function chipOrang(roleId, a) {
  return `
  <div class="person-chip" data-role="${roleId}" data-id="${a.id}">
    <div class="avatar">${getInisial(a.nama)}</div>
    <div class="person-chip-name">${a.nama}</div>
    ${_pengurusReadOnly ? "" : `<div class="person-chip-actions">
      <button class="chip-icon-btn btn-ganti-orang" title="Ganti" aria-label="Ganti orang di jabatan ini">✏</button>
      <button class="chip-icon-btn btn-pindah-jabatan" title="Pindah Jabatan" aria-label="Pindah jabatan">⇄</button>
      <button class="chip-icon-btn danger btn-hapus-orang" title="Hapus" aria-label="Hapus dari jabatan">✕</button>
    </div>`}
  </div>`;
}

function pasangEventPengurus(container) {
  container.addEventListener("click", e => {
    if (e.target.closest(".btn-tambah-pengurus")) bukaModalTambahPengurus(e.target.closest(".btn-tambah-pengurus").dataset.role);
    if (e.target.closest(".btn-ganti-orang"))   bukaModalGantiOrang(e.target.closest(".person-chip"));
    if (e.target.closest(".btn-pindah-jabatan")) bukaModalPindahJabatan(e.target.closest(".person-chip"));
    if (e.target.closest(".btn-hapus-orang"))   bukaKonfirmasiHapusPengurus(e.target.closest(".person-chip"));
  });
}

async function _simpanDanGambar() {
  /* Pastikan semua ID tetap string sebelum disimpan */
  AppState.strukturPengurus.forEach(jabatan => {
    jabatan.anggota = jabatan.anggota.map(a => ({ ...a, id: String(a.id) }));
  });
  try {
    await DB.pengurus.simpanStruktur(AppState.strukturPengurus);
    /* Render ulang hanya jika simpan berhasil */
    gambarStrukturPengurus();
  } catch(e) {
    console.error("[PMR] Gagal simpan struktur pengurus:", e);
    tampilToast("Gagal menyimpan perubahan. Periksa koneksi dan coba lagi.", "danger");
    /* Tidak memanggil gambarStrukturPengurus() — tampilan tetap menunjukkan
       kondisi sebelumnya agar user tahu perubahan belum tersimpan. */
  }
}

function bukaModalTambahPengurus(roleId) {
  const item = cariJabatan(roleId);
  if (!item) return;
  if (item.anggota.length >= item.maks) {
    tampilToast(`Jabatan "${item.jabatan}" sudah penuh (maks ${item.maks} orang).`,"danger"); return;
  }
  Modal.buka({
    judul:`Tambah ${item.jabatan}`,
    konten:`<div class="field">
      <label>Nama Lengkap</label>
      <input type="text" id="f-tambah-nama" placeholder="Ketik nama lengkap…" autocomplete="off">
      <div class="field-hint">Bisa diisi siapa saja — pengurus bisa berganti kapan saja.</div>
    </div>`,
    aksi:[
      {label:"Batal",kelas:"btn-ghost",id:"m-batal-tambah",onClick:()=>Modal.tutup()},
      {label:"Tambah",kelas:"btn-primary",id:"m-simpan-tambah",onClick:async ()=>{
        const nama = document.getElementById("f-tambah-nama").value.trim();
        if (!nama) { tampilToast("Nama tidak boleh kosong.","danger"); return; }
        const itemTerbaru = cariJabatan(roleId);
        if (itemTerbaru.anggota.length >= itemTerbaru.maks) {
          tampilToast(`Jabatan "${itemTerbaru.jabatan}" sudah penuh.`,"danger"); Modal.tutup(); return;
        }
        itemTerbaru.anggota.push({id:String(idBaruPengurus()), nama});
        Modal.tutup();
        await _simpanDanGambar();
        tampilToast(`${nama} ditambahkan sebagai ${itemTerbaru.jabatan}.`,"success");
      }}
    ]
  });
}

function bukaModalGantiOrang(chipEl) {
  if (!chipEl) return;
  const roleId = chipEl.dataset.role;
  const idLama = chipEl.dataset.id;
  const item   = cariJabatan(roleId);
  const orangLama = item?.anggota.find(a=>a.id===idLama);
  if (!item||!orangLama) return;
  Modal.buka({
    judul:`Ganti ${item.jabatan}`,
    konten:`<div class="field">
      <label>Nama Pengganti</label>
      <input type="text" id="f-ganti-nama" value="${orangLama.nama}" placeholder="Ketik nama lengkap…" autocomplete="off">
      <div class="field-hint">Ketik nama baru untuk menggantikan ${orangLama.nama}.</div>
    </div>`,
    aksi:[
      {label:"Batal",kelas:"btn-ghost",id:"m-batal-ganti",onClick:()=>Modal.tutup()},
      {label:"Simpan",kelas:"btn-primary",id:"m-simpan-ganti",onClick:async ()=>{
        const namaBaru = document.getElementById("f-ganti-nama").value.trim();
        if (!namaBaru) { tampilToast("Nama tidak boleh kosong.","danger"); return; }
        const itemT = cariJabatan(roleId);
        const idx = itemT.anggota.findIndex(a=>a.id===idLama);
        if (idx===-1) { Modal.tutup(); return; }
        const namaLama = itemT.anggota[idx].nama;
        itemT.anggota[idx] = {id:idLama, nama:namaBaru};
        Modal.tutup();
        await _simpanDanGambar();
        tampilToast(`${itemT.jabatan}: ${namaLama} → ${namaBaru}.`,"success");
      }}
    ]
  });
}

function bukaModalPindahJabatan(chipEl) {
  if (!chipEl) return;
  const roleAsal = chipEl.dataset.role;
  const id       = chipEl.dataset.id;
  const itemAsal = cariJabatan(roleAsal);
  const orang    = itemAsal?.anggota.find(a=>a.id===id);
  if (!orang) return;

  const tujuanList = AppState.strukturPengurus.filter(j => j.role_id !== roleAsal);
  if (tujuanList.length===0) { tampilToast("Tidak ada jabatan tujuan.","danger"); return; }

  Modal.buka({
    judul:`Pindah Jabatan — ${orang.nama}`,
    konten:`<p style="margin-top:0">Saat ini: <strong>${itemAsal.jabatan}</strong>.</p>
    <div class="field">
      <label>Pindah ke</label>
      <select id="f-pindah-tujuan">
        ${tujuanList.map(t=>`<option value="${t.role_id}" ${t.anggota.length>=t.maks?"disabled":""}>
          ${t.jabatan} (${t.anggota.length}/${t.maks}${t.anggota.length>=t.maks?" — penuh":""})
        </option>`).join("")}
      </select>
    </div>`,
    aksi:[
      {label:"Batal",kelas:"btn-ghost",id:"m-batal-pindah",onClick:()=>Modal.tutup()},
      {label:"Pindahkan",kelas:"btn-primary",id:"m-simpan-pindah",onClick:async ()=>{
        const roleTujuan = document.getElementById("f-pindah-tujuan").value;
        const itemTujuan = cariJabatan(roleTujuan);
        if (!itemTujuan||itemTujuan.anggota.length>=itemTujuan.maks) {
          tampilToast("Jabatan tujuan sudah penuh.","danger"); return;
        }
        cariJabatan(roleAsal).anggota = cariJabatan(roleAsal).anggota.filter(a=>a.id!==id);
        itemTujuan.anggota.push({id:orang.id, nama:orang.nama});
        Modal.tutup();
        await _simpanDanGambar();
        tampilToast(`${orang.nama} dipindah ke ${itemTujuan.jabatan}.`,"success");
      }}
    ]
  });
}

function bukaKonfirmasiHapusPengurus(chipEl) {
  if (!chipEl) return;
  const roleId = chipEl.dataset.role;
  const id     = chipEl.dataset.id;
  const item   = cariJabatan(roleId);
  const orang  = item?.anggota.find(a=>a.id===id);
  if (!orang) return;
  Modal.konfirmasi(`Hapus <strong>${orang.nama}</strong> dari <strong>${item.jabatan}</strong>?`, async ()=>{
    cariJabatan(roleId).anggota = cariJabatan(roleId).anggota.filter(a=>a.id!==id);
    await _simpanDanGambar();
    tampilToast(`${orang.nama} dihapus dari ${item.jabatan}.`,"default");
  });
}
