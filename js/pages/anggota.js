/* =========================================================
   PAGES/ANGGOTA.JS
   Diekstrak dari dashboard.js (Fase 3 — modularisasi).
   Tidak ada perubahan logika, hanya pemindahan lokasi.
   ========================================================= */

/* ─────────────────────────────────────────────────────────
   ANGGOTA
───────────────────────────────────────────────────────── */
/* [FIX — Divisi Anggota] SATU-SATUNYA sumber pilihan divisi anggota di
   seluruh project — dipakai baik oleh form Tambah/Edit maupun validator
   Import CSV, supaya keduanya tidak bisa diam-diam berbeda. Sesuai
   kebutuhan organisasi saat ini, divisi hanya ada 2. */
const DIVISI_ANGGOTA_LIST = ["Pertolongan Pertama", "Tandu"];

function renderAnggota(el, user) {
  const canEdit = ["admin","ketua","wakil","sekretaris"].includes(user.role);
  const GROUPS = ["Alumni", "XII", "XI", "X"];

  el.innerHTML = `
  <div class="page-head">
    <div><h1>Data Anggota</h1><p class="page-sub">${AppState.anggota.length} anggota terdaftar</p></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-outline btn-sm" id="btn-print-anggota">🖨 Cetak</button>
      ${canEdit?`<button class="btn btn-outline btn-sm" id="btn-import-anggota">⇧ Import Anggota</button>
      <button class="btn btn-primary btn-sm" id="btn-tambah-anggota">+ Tambah Anggota</button>`:""}
    </div>
  </div>

  <div class="card anggota-page-card">
    <div class="table-toolbar anggota-toolbar">
      <div class="search-bar">
        <svg class="search-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0z"/>
        </svg>
        <input id="search-anggota" type="search" placeholder="Cari nama, NI, kelas, divisi, jabatan…">
      </div>
    </div>

    <div class="anggota-class-tabs" role="tablist" aria-label="Kelompok anggota">
      <button class="anggota-class-tab active" data-group="all" role="tab" aria-selected="true">Semua</button>
      ${GROUPS.map(g=>`<button class="anggota-class-tab" data-group="${g}" role="tab" aria-selected="false">${g}</button>`).join("")}
    </div>

    <div id="anggota-groups" class="anggota-groups"></div>
  </div>`;

  const normalizeClass = value => {
    const v = String(value || "").trim().toUpperCase();
    if (/^ALUMNI(?:\b|\s|[-_])/i.test(v) || v === "ALUMNI") return "Alumni";
    if (/^XII(?:\b|\s|[-_])/i.test(v) || v === "XII") return "XII";
    if (/^XI(?:\b|\s|[-_])/i.test(v) || v === "XI") return "XI";
    if (/^X(?:\b|\s|[-_])/i.test(v) || v === "X") return "X";
    return "Belum ditentukan";
  };

  const sortNama = (a,b) => String(a.nama||"").localeCompare(String(b.nama||""), "id", { sensitivity:"base" });
  const rowAnggota = (a, i) => `<tr>
    <td>${i + 1}</td>
    <td><div style="display:flex;align-items:center;gap:10px">
      <div class="avatar" style="width:32px;height:32px;font-size:0.7rem">${getInisial(a.nama)}</div>
      <strong>${a.nama}</strong>
    </div></td>
    <td>${a.nomorInduk||"—"}</td>
    <td>${a.jabatan||"Anggota"}</td>
    <td>${a.kelas||"—"}</td>
    <td>${a.divisi||"—"}</td>
    <td><div style="display:flex;gap:6px">
      <button class="btn btn-ghost btn-sm btn-detail-anggota" data-id="${a.id}" title="Detail" aria-label="Lihat detail ${a.nama}">👁</button>
      ${canEdit?`<button class="btn btn-ghost btn-sm btn-edit-anggota" data-id="${a.id}" title="Edit" aria-label="Edit ${a.nama}">✏</button>
      <button class="btn btn-ghost btn-sm btn-hapus-anggota" data-id="${a.id}" title="Hapus" aria-label="Hapus ${a.nama}" style="color:var(--danger)">🗑</button>`:""}
    </div></td>
  </tr>`;

  const groupsEl = document.getElementById("anggota-groups");
  let activeGroup = "all";
  let searchTerm = "";

  function filteredData() {
    const q = searchTerm.trim().toLowerCase();
    return AppState.anggota.filter(a => {
      const group = normalizeClass(a.kelas);
      const groupMatch = activeGroup === "all" || group === activeGroup;
      if (!groupMatch) return false;
      if (!q) return true;
      return [a.nama,a.nomorInduk,a.kelas,a.divisi,a.jabatan,a.statusKeanggotaan,a.statusAkun]
        .some(v => String(v||"").toLowerCase().includes(q));
    }).sort(sortNama);
  }

  function renderGroups() {
    const rows = filteredData();
    if (!rows.length) {
      groupsEl.innerHTML = `<div class="empty-state anggota-empty"><p>Tidak ada anggota yang cocok dengan pencarian.</p></div>`;
      return;
    }

    const visibleGroups = activeGroup === "all" ? [...GROUPS, "Belum ditentukan"] : [activeGroup];
    let globalNo = 0;
    groupsEl.innerHTML = visibleGroups.map(group => {
      const members = rows.filter(a => normalizeClass(a.kelas) === group);
      if (!members.length) return "";
      const startNo = globalNo;
      const htmlRows = members.map((a,i) => rowAnggota(a, startNo + i)).join("");
      globalNo += members.length;
      return `<section class="anggota-group" data-group-section="${group}">
        <div class="anggota-group-head">
          <div><h2>${group}</h2><span>${members.length} anggota</span></div>
        </div>
        <div class="table-wrap anggota-table-wrap">
          <table class="data-table anggota-data-table">
            <thead><tr><th>#</th><th>Nama</th><th>Nomor Induk</th><th>Jabatan</th><th>Kelas</th><th>Divisi</th><th>Aksi</th></tr></thead>
            <tbody>${htmlRows}</tbody>
          </table>
        </div>
      </section>`;
    }).join("");
  }

  renderGroups();

  document.getElementById("search-anggota")?.addEventListener("input", e => {
    searchTerm = e.target.value;
    renderGroups();
  });
  document.querySelectorAll(".anggota-class-tab").forEach(btn => btn.addEventListener("click", () => {
    activeGroup = btn.dataset.group;
    document.querySelectorAll(".anggota-class-tab").forEach(b => {
      const active = b === btn;
      b.classList.toggle("active", active);
      b.setAttribute("aria-selected", active ? "true" : "false");
    });
    renderGroups();
  }));

  groupsEl.addEventListener("click", e => {
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
  document.getElementById("btn-import-anggota")?.addEventListener("click", () =>
    bukaImportAnggota(() => renderAnggota(el, user)));
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
        <div><div class="detail-nama">${a.nama}</div><div class="detail-kelas">${[a.kelas,a.divisi].filter(Boolean).join(" · ") || "—"}</div></div>
      </div>
      <div class="detail-info-grid" style="margin-top:0">
        <div class="detail-info-item"><div class="lbl">Status</div><div class="val">${statusBadge(a.statusKeanggotaan || a.status)}</div></div>
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
              <td>${presensiStatusBadgeHtml(p)}</td>
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
  const divisiList = DIVISI_ANGGOTA_LIST;

  /* [FIX — Divisi Anggota, data lama] Kalau anggota yang sedang di-edit
     masih punya nilai divisi LAMA (mis. "Kesehatan Remaja") yang sudah
     tidak ada di daftar baru, JANGAN dihilangkan dari dropdown — kalau
     tidak, begitu admin menyimpan (walau cuma ubah field lain), <select>
     otomatis jatuh ke opsi pertama dan diam-diam mengganti divisi
     anggota itu tanpa sepengetahuan admin. Nilai lama tetap ditampilkan
     apa adanya (bukan migrasi data) sampai admin sengaja menggantinya. */
  const divisiOpsi = (data?.divisi && !divisiList.includes(data.divisi))
    ? [...divisiList, data.divisi]
    : divisiList;

  Modal.buka({
    judul: isEdit?"Edit Anggota":"Tambah Anggota Baru",
    konten:`
      <div class="grid grid-2">
        <div class="field" style="grid-column:1/-1">
          <label>Nama Lengkap</label>
          <input id="f-nama" type="text" value="${data?.nama||""}" placeholder="Nama lengkap">
        </div>
        <div class="field">
          <label>Nomor Induk</label>
          <input id="f-nomor-induk" type="text" value="${data?.nomorInduk||""}" placeholder="Nomor induk anggota">
        </div>
        <div class="field">
          <label>Kelas</label>
          <input id="f-kelas" type="text" value="${data?.kelas||""}" placeholder="Contoh: XI TKJ 1">
        </div>
        <div class="field">
          <label>Jabatan</label>
          <select id="f-jabatan">
            ${["Anggota","Ketua","Wakil Ketua","Sekretaris","Bendahara","PJ Divisi"].map(j=>`<option ${data?.jabatan===j?"selected":""}>${j}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Divisi</label>
          <select id="f-divisi">
            ${divisiOpsi.map(d=>`<option ${data?.divisi===d?"selected":""}>${d}</option>`).join("")}
          </select>
        </div>
        <div class="field" style="grid-column:1/-1">
          <label>Foto KTA <span style="font-weight:400;color:var(--ink-soft)">(opsional · URL publik/data URL)</span></label>
          <input id="f-foto" type="url" value="${data?.foto||""}" placeholder="https://…">
          <small style="color:var(--ink-soft)">Untuk Google Drive, gunakan link yang dapat diakses publik. Foto hanya direferensikan, bukan disimpan di Firestore sebagai file.</small>
        </div>
        <div class="field">
          <label>Status Keanggotaan</label>
          <select id="f-status-keanggotaan">
            <option ${data?.statusKeanggotaan==="Aktif" || (!data?.statusKeanggotaan && data?.status==="Aktif")?"selected":""}>Aktif</option>
            <option ${data?.statusKeanggotaan==="Tidak Aktif" || (!data?.statusKeanggotaan && data?.status==="Tidak Aktif")?"selected":""}>Tidak Aktif</option>
            <option ${data?.statusKeanggotaan==="Alumni" || (!data?.statusKeanggotaan && data?.status==="Alumni")?"selected":""}>Alumni</option>
          </select>
        </div>
        <div class="field">
          <label>Status Akun</label>
          <select id="f-status-akun">
            ${["pending","active","rejected"].map(v=>`<option ${data?.statusAkun===v || (!data?.statusAkun && v==="active")?"selected":""}>${v}</option>`).join("")}
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
          nama,
          nomorInduk: document.getElementById("f-nomor-induk").value.trim(),
          kelas:document.getElementById("f-kelas").value.trim(),
          divisi:document.getElementById("f-divisi").value,
          foto: document.getElementById("f-foto")?.value.trim() || "",
          jabatan: document.getElementById("f-jabatan").value,
          statusKeanggotaan:document.getElementById("f-status-keanggotaan").value,
          statusAkun:document.getElementById("f-status-akun").value,
          sumberData: data?.sumberData || "admin",
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


/* ─────────────────────────────────────────────────────────
   IMPORT ANGGOTA MASSAL
   CSV UTF-8 / CSV bertanda titik koma / TSV dari Excel.
   Kolom wajib: Nama, NI. Kolom lain opsional dan punya default aman.
───────────────────────────────────────────────────────── */
function _normalisasiHeaderImport(v) {
  return String(v || "")
    .replace(/^\uFEFF/, "")
    .trim().toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function _parseCSVAnggota(text) {
  const input = String(text || "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const firstLine = input.split("\n").find(line => line.trim()) || "";
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const delimiter = tabCount > commaCount && tabCount >= semiCount ? "\t" : (semiCount > commaCount ? ";" : ",");

  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const next = input[i + 1];
    if (ch === '"') {
      if (quoted && next === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === delimiter && !quoted) {
      row.push(cell); cell = "";
    } else if (ch === "\n" && !quoted) {
      row.push(cell); rows.push(row); row = []; cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim() !== ""));
}

function _aliasHeaderImport(h) {
  const key = _normalisasiHeaderImport(h);
  const aliases = {
    nama: "nama", namalengkap: "nama", fullname: "nama", namaanggota: "nama",
    ni: "nomorInduk", nid: "nomorInduk", nomorinduk: "nomorInduk", nomorindukanggota: "nomorInduk",
    status: "statusKeanggotaan", statuskeanggotaan: "statusKeanggotaan", keanggotaan: "statusKeanggotaan",
    jabatan: "jabatan", posisi: "jabatan",
    kelas: "kelas", divisi: "divisi", foto: "foto", fotokta: "foto", sumberdata: "sumberData"
  };
  return aliases[key] || null;
}

function _normalisasiStatusImport(v) {
  const key = String(v || "").trim().toLowerCase();
  if (!key) return "Aktif";
  if (["aktif","active","a","1"].includes(key)) return "Aktif";
  if (["tidakaktif","nonaktif","inactive","tidak aktif","na","0"].includes(key.replace(/\s+/g,"")) || key === "tidak aktif") return "Tidak Aktif";
  if (["alumni","alumnus","alumna"].includes(key)) return "Alumni";
  return null;
}

function _normalisasiJabatanImport(v) {
  const key = String(v || "").trim().toLowerCase();
  if (!key) return "Anggota";
  const map = {
    anggota:"Anggota", ketua:"Ketua", "wakil ketua":"Wakil Ketua", wakil:"Wakil Ketua",
    sekretaris:"Sekretaris", sekre:"Sekretaris", bendahara:"Bendahara", "pj divisi":"PJ Divisi", pj:"PJ Divisi"
  };
  return map[key] || null;
}

function _validasiImportAnggota(rows) {
  const existing = new Set(AppState.anggota.map(a => String(a.nomorInduk || "").trim().toLowerCase()).filter(Boolean));
  const seen = new Set();
  return rows.map((r, index) => {
    const nomorInduk = String(r.nomorInduk || "").trim();
    const nama = String(r.nama || "").trim();
    const statusKeanggotaan = _normalisasiStatusImport(r.statusKeanggotaan);
    const jabatan = _normalisasiJabatanImport(r.jabatan);
    const errors = [];
    if (!nama) errors.push("Nama kosong");
    if (!nomorInduk) errors.push("NI kosong");
    const niKey = nomorInduk.toLowerCase();
    if (niKey && existing.has(niKey)) errors.push("NI sudah terdaftar");
    if (niKey && seen.has(niKey)) errors.push("NI duplikat di file");
    if (niKey) seen.add(niKey);
    if (!statusKeanggotaan) errors.push("Status harus Aktif/Tidak Aktif/Alumni");
    if (!jabatan) errors.push("Jabatan tidak dikenali");

    const divisiRaw = String(r.divisi || "").trim();
    const divisiMapImport = new Map(DIVISI_ANGGOTA_LIST.map(v => [v.toLowerCase(), v]));
    const divisi = divisiRaw ? (divisiMapImport.get(divisiRaw.toLowerCase()) || null) : "";
    if (divisiRaw && !divisi) errors.push("Divisi harus Pertolongan Pertama atau Tandu");

    const data = {
      nama, nomorInduk,
      kelas: String(r.kelas || "").trim(),
      divisi: divisi || "",
      jabatan: jabatan || "Anggota",
      statusKeanggotaan: statusKeanggotaan || "Aktif",
      statusAkun: "active",
      sumberData: "admin",
      bergabung: String(r.bergabung || "").trim() || new Date().toISOString().split("T")[0]
    };
    return { row: index + 2, data, errors };
  });
}

function _escapeImportHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));
}

function _downloadTemplateImportAnggota() {
  const csv = "\uFEFFNama,NI,Status,Jabatan,Kelas,Divisi\nAhmad,PMR001,Aktif,Anggota,XI TKJ 1,Pertolongan Pertama\nBudi,PMR002,Aktif,Ketua,XII TKJ 1,Tandu\n";
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "template-import-anggota-pmr.csv"; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* Bangun ulang tabel preview + ringkasan status dari array `hasil` saat
   ini. Dipanggil setelah parse awal, dan juga setelah import gagal
   sebagian (lihat onClick "Import Data Valid") supaya baris yang sudah
   berhasil masuk Firestore hilang dari daftar sebelum user retry. */
function _renderPreviewImportAnggota(hasil, { catatan } = {}) {
  const status = document.getElementById("import-anggota-status");
  const preview = document.getElementById("import-anggota-preview");
  if (!status || !preview) return;
  const valid = hasil.filter(x => !x.errors.length).length;
  const invalid = hasil.length - valid;
  status.innerHTML = `<strong>${hasil.length}</strong> baris tersisa · <span style="color:var(--success)">${valid} valid</span> · <span style="color:var(--danger)">${invalid} bermasalah</span>`;
  preview.innerHTML = `
    ${catatan ? `<div class="alert alert-danger" style="display:block;margin-bottom:10px">${catatan}</div>` : ""}
    <div class="table-wrap" style="max-height:330px;overflow:auto">
      <table class="data-table"><thead><tr><th>Baris</th><th>Nama</th><th>NI</th><th>Status</th><th>Jabatan</th><th>Hasil</th></tr></thead>
      <tbody>${hasil.map(x => `<tr>
        <td>${x.row}</td><td>${_escapeImportHtml(x.data.nama || "—")}</td><td>${_escapeImportHtml(x.data.nomorInduk || "—")}</td><td>${_escapeImportHtml(x.data.statusKeanggotaan)}</td><td>${_escapeImportHtml(x.data.jabatan)}</td>
        <td>${x.errors.length ? `<span class="badge badge-danger">${_escapeImportHtml(x.errors.join(", "))}</span>` : `<span class="badge badge-success">Valid</span>`}</td>
      </tr>`).join("")}</tbody></table>
    </div>
    <div style="font-size:.78rem;color:var(--ink-soft);margin-top:8px">Baris bermasalah tidak akan diimport. NI yang sudah ada di database juga otomatis ditolak agar tidak terjadi duplikat.</div>`;
}

function bukaImportAnggota(onSelesai) {
  let hasil = [];
  Modal.buka({
    judul: "Import Anggota Lama",
    ukuran: "modal-lg",
    konten: `
      <div class="alert alert-info" style="display:block;margin-bottom:14px">
        <strong>Format aman:</strong> CSV UTF-8. File dari Excel/Google Sheets bisa disimpan sebagai CSV. Kolom wajib: <strong>Nama</strong> dan <strong>NI</strong>.
        Kolom Status, Jabatan, Kelas, dan Divisi boleh kosong.
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
        <button class="btn btn-outline btn-sm" id="btn-download-template-import">↓ Download Template CSV</button>
        <label class="btn btn-primary btn-sm" for="file-import-anggota">Pilih File CSV</label>
        <input id="file-import-anggota" type="file" accept=".csv,.txt,text/csv,text/plain" style="display:none">
      </div>
      <div id="import-anggota-status" style="color:var(--ink-soft);font-size:.85rem">Belum ada file dipilih.</div>
      <div id="import-anggota-preview" style="margin-top:14px"></div>`,
    aksi: [
      {label:"Batal", kelas:"btn-ghost", id:"btn-batal-import", onClick:()=>Modal.tutup()},
      {label:"Import Data Valid", kelas:"btn-primary", id:"btn-konfirmasi-import", onClick:async()=>{
        const valid = hasil.filter(x => x.errors.length === 0).map(x => x.data);
        if (!valid.length) { tampilToast("Tidak ada data valid untuk diimport.", "default"); return; }
        const btn = document.getElementById("btn-konfirmasi-import");
        if (btn) { btn.disabled = true; btn.textContent = `Mengimport ${valid.length} data…`; }
        try {
          const hasilImport = await DB.anggota.importBatch(valid);
          Modal.tutup();
          onSelesai?.();
          tampilToast(`${hasilImport.imported} anggota berhasil diimport.`, "success");
        } catch (e) {
          console.error("[PMR] Import anggota gagal:", e);
          const sudahMasuk = e?.imported || 0;
          if (sudahMasuk > 0) {
            /* Sebagian batch sudah permanen tersimpan di Firestore sebelum
               error terjadi. Coret baris yang SUDAH masuk itu dari `hasil`
               (dalam urutan yang sama seperti saat dikirim ke importBatch)
               supaya kalau user klik "Import Data Valid" lagi, hanya sisa
               baris yang belum berhasil yang dikirim ulang — bukan
               mengulang semuanya dan membuat duplikat. */
            let dihapus = 0;
            hasil = hasil.filter(x => {
              if (x.errors.length === 0 && dihapus < sudahMasuk) { dihapus++; return false; }
              return true;
            });
            _renderPreviewImportAnggota(hasil, {
              catatan: `⚠ ${sudahMasuk} data sudah berhasil masuk sebelum proses berhenti karena error. Baris itu sudah dihapus dari daftar di bawah agar tidak dobel. Cek dulu Data Anggota, lalu tekan "Import Data Valid" lagi untuk melanjutkan sisanya bila perlu.`
            });
          }
          if (btn) { btn.disabled = false; btn.textContent = "Import Data Valid"; }
          tampilToast(sudahMasuk > 0 ? `Berhenti setelah ${sudahMasuk} data. Periksa catatan di atas tabel.` : "Import gagal. Periksa koneksi dan izin akun.", "danger");
        }
      }}
    ]
  });

  document.getElementById("btn-download-template-import")?.addEventListener("click", _downloadTemplateImportAnggota);
  document.getElementById("file-import-anggota")?.addEventListener("change", async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const status = document.getElementById("import-anggota-status");
    const preview = document.getElementById("import-anggota-preview");
    status.textContent = `Membaca ${file.name}…`;
    try {
      const text = await file.text();
      const raw = _parseCSVAnggota(text);
      if (raw.length < 2) throw new Error("File kosong atau hanya berisi header.");
      const headers = raw[0].map(_aliasHeaderImport);
      const known = headers.filter(Boolean);
      if (!headers.includes("nama") || !headers.includes("nomorInduk")) {
        throw new Error("Header wajib tidak ditemukan. Gunakan template CSV agar format tidak salah.");
      }
      const dataRows = raw.slice(1);
      if (dataRows.length > 2000) throw new Error("Maksimal 2.000 baris per import. Pecah file menjadi beberapa bagian.");
      const rows = dataRows.map(cols => {
        const obj = {};
        headers.forEach((key, i) => { if (key) obj[key] = String(cols[i] || "").trim(); });
        return obj;
      });
      hasil = _validasiImportAnggota(rows);
      _renderPreviewImportAnggota(hasil);
    } catch (err) {
      hasil = [];
      status.innerHTML = `<span style="color:var(--danger)">${err.message || "File tidak dapat dibaca."}</span>`;
      preview.innerHTML = "";
    }
    e.target.value = "";
  });
}
