/* =========================================================
   DASHBOARD.JS — v3 Firebase-ready
   Menggunakan AppState (bukan DUMMY_DATA langsung).
   CRUD memanggil DB.anggota/kegiatan/keuangan/presensi.
   ID selalu STRING agar kompatibel dengan Firestore doc IDs.
   ========================================================= */

/* ─────────────────────────────────────────────────────────
   INIT — Firebase Auth check, muat data, pasang listener
───────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {

  /* Tampilan loading awal saat Firebase memverifikasi token */
  _setLoadingState(true);

  initAuth(
    async (user) => {
      /* Muat data ke AppState */
      await DB.init();

      /* Pasang handler re-render ke AppState listener */
      setReRenderHandler(() => {
        const halaman = location.hash.replace("#","") || "beranda";
        if (PAGES[halaman]) {
          document.getElementById("content-area").innerHTML = "";
          PAGES[halaman].render(document.getElementById("content-area"), user);
        }
      });

      /* Aktifkan real-time listener (Firestore) */
      DB.initListeners();

      /* Mulai dashboard */
      _initDashboard(user);
      _setLoadingState(false);
    },
    () => { window.location.href = "login.html"; }
  );
});

function _setLoadingState(loading) {
  const el = document.getElementById("content-area");
  if (!el) return;
  if (loading) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-icon">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
      </div>
      <p>Memuat dashboard…</p>
    </div>`;
  }
}

let PAGES = {};

function _initDashboard(user) {
  /* ── Info user di sidebar/topbar ── */
  const roleConf = ROLES[user.role] || { label:user.role, badge:"badge-gray" };
  document.querySelectorAll(".js-user-name").forEach(el => el.textContent = user.nama);
  document.querySelectorAll(".js-user-role").forEach(el => {
    el.textContent = roleConf.label;
    el.className = "badge " + roleConf.badge;
  });
  document.querySelectorAll(".js-user-avatar").forEach(el => el.textContent = getInisial(user.nama));

  /* ── Sidebar toggle (mobile) ── */
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebar-overlay");
  function openSidebar()  { sidebar.classList.add("open"); overlay.classList.add("open"); document.body.style.overflow="hidden"; }
  function closeSidebar() { sidebar.classList.remove("open"); overlay.classList.remove("open"); document.body.style.overflow=""; }
  document.querySelectorAll(".js-sidebar-toggle").forEach(btn => btn.addEventListener("click", () =>
    sidebar.classList.contains("open") ? closeSidebar() : openSidebar()
  ));
  overlay.addEventListener("click", closeSidebar);

  /* ── Navigasi SPA-lite ── */
  const contentArea = document.getElementById("content-area");
  const navLinks    = document.querySelectorAll(".sidebar-link[data-page]");
  const topbarTitle = document.getElementById("topbar-title");

  PAGES = {
    beranda:    { title:"Beranda",      render:renderBeranda    },
    anggota:    { title:"Data Anggota", render:renderAnggota    },
    kegiatan:   { title:"Kegiatan",     render:renderKegiatan   },
    keuangan:   { title:"Keuangan",     render:renderKeuangan   },
    presensi:   { title:"Presensi",     render:renderPresensi   },
    pengurus:   { title:"Pengurus",     render:renderPengurus   },
    pengaturan: { title:"Pengaturan",   render:renderPengaturan }
  };

  function navigateTo(pageId) {
    const page = PAGES[pageId];
    if (!page) return;
    navLinks.forEach(a => a.classList.toggle("active", a.dataset.page === pageId));
    topbarTitle.textContent = page.title;
    contentArea.innerHTML = "";
    page.render(contentArea, user);
    closeSidebar();
    history.replaceState(null, "", "#" + pageId);
  }

  navLinks.forEach(a => a.addEventListener("click", e => { e.preventDefault(); navigateTo(a.dataset.page); }));

  const initPage = (location.hash.replace("#","") in PAGES) ? location.hash.replace("#","") : "beranda";
  navigateTo(initPage);

  /* ── Notifikasi ── */
  Notif.init("btn-notif", "notif-dropdown", "notif-badge");

  /* ── Logout ── */
  document.getElementById("btn-logout").addEventListener("click", () => {
    Modal.konfirmasi("Yakin ingin keluar dari sesi ini?", () => {
      DB.stopListeners();
      logout();
    });
  });

  /* ── Mode indikator ── */
  if (!FIREBASE_ENABLED) {
    const bar = document.createElement("div");
    bar.id = "demo-bar";
    bar.innerHTML = `
      <div style="position:fixed;bottom:0;left:0;right:0;
        background:var(--warning-bg);border-top:1px solid var(--warning);
        padding:6px 20px;font-size:0.75rem;color:var(--warning);
        display:flex;align-items:center;justify-content:center;gap:8px;z-index:30">
        <strong>MODE DEMO</strong> — Data tidak disimpan ke server.
        Aktifkan Firebase di <code>js/firebase-config.js</code> untuk mode produksi.
      </div>`;
    document.body.appendChild(bar);
  }
}

/* ─────────────────────────────────────────────────────────
   HELPER
───────────────────────────────────────────────────────── */
function pasangSearch(inputId, tbodyId, data, rowFn, kolom) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.addEventListener("input", () => {
    const q = input.value.toLowerCase().trim();
    const filtered = q
      ? data.filter(d => kolom.some(k => String(d[k]||"").toLowerCase().includes(q)))
      : data;
    renderTable(document.getElementById(tbodyId), filtered, rowFn);
  });
}

function statCard(label, value, delta, dir, svgPath) {
  return `<div class="card stat-card">
    <div class="stat-icon">
      <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">${svgPath}</svg>
    </div>
    <div class="stat-value">${value}</div>
    <div class="stat-label">${label}</div>
    <div class="stat-delta ${dir}">${dir==="up"?"▲":"▼"} ${delta}</div>
  </div>`;
}

/* Tombol simpan: loading state + pesan mode */
async function _jalankanSimpan(btnId, fn) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const teks = btn.textContent;
  btn.disabled = true;
  btn.textContent = FIREBASE_ENABLED ? "Menyimpan…" : "Memproses…";
  try { await fn(); }
  catch(e) {
    console.error("[PMR] Simpan error:", e);
    tampilToast("Terjadi kesalahan: " + e.message, "danger");
    btn.disabled = false;
    btn.textContent = teks;
  }
}

/* ─────────────────────────────────────────────────────────
   BERANDA
───────────────────────────────────────────────────────── */
function renderBeranda(el) {
  const r = AppState.ringkasan;
  el.innerHTML = `
  <div class="page-head">
    <div>
      <h1>Selamat Datang 👋</h1>
      <p class="page-sub">Masa Bakti ${AppState.periode} · ${FIREBASE_ENABLED ? "🔴 Live Firestore" : "📦 Mode Demo"}</p>
    </div>
  </div>
  <div class="grid grid-4" style="margin-bottom:24px">
    ${statCard("Anggota Aktif", r.anggotaAktif, "dari "+r.totalAnggota+" total", "up",
      `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>`)}
    ${statCard("Saldo Kas", formatRupiah(r.kasSaldo), "per hari ini", "up",
      `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z"/>`)}
    ${statCard("Program Berjalan", r.programBerjalan, "kegiatan aktif", "up",
      `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>`)}
    ${statCard("Rata-rata Hadir", r.kehadiranRata+"%", "bulan ini", "up",
      `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>`)}
  </div>
  <div class="grid grid-2">
    <div class="card">
      <div class="card-title">Kegiatan Mendatang</div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Kegiatan</th><th>Tanggal</th><th>Status</th></tr></thead>
          <tbody id="tb-kegiatan-beranda"></tbody>
        </table>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Transaksi Terakhir</div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Uraian</th><th>Jenis</th><th>Jumlah</th></tr></thead>
          <tbody id="tb-kas-beranda"></tbody>
        </table>
      </div>
    </div>
  </div>`;

  renderTable(document.getElementById("tb-kegiatan-beranda"), AppState.kegiatan, k =>
    `<tr><td>${k.nama}</td><td style="white-space:nowrap">${formatTanggal(k.tanggal)}</td><td>${statusBadge(k.status)}</td></tr>`);
  renderTable(document.getElementById("tb-kas-beranda"), AppState.keuangan.slice(0,4), t =>
    `<tr><td>${t.uraian}</td><td>${statusBadge(t.jenis)}</td><td style="white-space:nowrap;font-weight:600">${formatRupiah(t.jumlah)}</td></tr>`);
}

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
      <button class="btn btn-ghost btn-sm btn-detail-anggota" data-id="${a.id}" title="Detail">👁</button>
      ${canEdit?`<button class="btn btn-ghost btn-sm btn-edit-anggota" data-id="${a.id}" title="Edit">✏</button>
      <button class="btn btn-ghost btn-sm btn-hapus-anggota" data-id="${a.id}" title="Hapus" style="color:var(--danger)">🗑</button>`:""}
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
        <div class="detail-info-item"><div class="lbl">No. HP</div><div class="val">${a.noHp||"—"}</div></div>
        <div class="detail-info-item"><div class="lbl">Bergabung</div><div class="val">${a.bergabung?formatTanggal(a.bergabung):"—"}</div></div>
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
          <label>No. HP</label>
          <input id="f-hp" type="text" value="${data?.noHp||""}" placeholder="08xxxxxxxxxx">
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
          noHp:document.getElementById("f-hp").value.trim(),
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

/* ─────────────────────────────────────────────────────────
   KEGIATAN
───────────────────────────────────────────────────────── */
function renderKegiatan(el, user) {
  const canEdit = ["admin","ketua","wakil","pj"].includes(user.role);
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
      <button class="btn btn-ghost btn-sm btn-edit-kegiatan" data-id="${k.id}">✏</button>
      <button class="btn btn-ghost btn-sm btn-hapus-kegiatan" data-id="${k.id}" style="color:var(--danger)">🗑</button>
    </div></td>`:""}
  </tr>`;

  renderTable(document.getElementById("tb-kegiatan"), AppState.kegiatan, rowKegiatan);
  pasangSearch("search-kegiatan","tb-kegiatan",AppState.kegiatan,rowKegiatan,["nama","pj","lokasi","status"]);

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

/* ─────────────────────────────────────────────────────────
   KEUANGAN
───────────────────────────────────────────────────────── */
function renderKeuangan(el, user) {
  const canEdit = ["admin","bendahara"].includes(user.role);
  const masuk  = AppState.keuangan.filter(t=>t.jenis==="Masuk").reduce((s,t)=>s+t.jumlah,0);
  const keluar = AppState.keuangan.filter(t=>t.jenis==="Keluar").reduce((s,t)=>s+t.jumlah,0);
  const saldo  = AppState.ringkasan.kasSaldo;

  el.innerHTML = `
  <div class="page-head">
    <div><h1>Keuangan</h1><p class="page-sub">Laporan kas PMR</p></div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-outline btn-sm" id="btn-print-kas">🖨 Cetak</button>
      ${canEdit?`<button class="btn btn-primary btn-sm" id="btn-tambah-kas">+ Catat Transaksi</button>`:""}
    </div>
  </div>
  <div class="grid grid-3" style="margin-bottom:24px">
    <div class="card stat-card">
      <div class="stat-icon" style="background:var(--success-bg);color:var(--success)">
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
        </svg>
      </div>
      <div class="stat-value" style="color:var(--success)">${formatRupiah(masuk)}</div>
      <div class="stat-label">Total Pemasukan</div>
    </div>
    <div class="card stat-card">
      <div class="stat-icon" style="background:var(--danger-bg);color:var(--danger)">
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"/>
        </svg>
      </div>
      <div class="stat-value" style="color:var(--danger)">${formatRupiah(keluar)}</div>
      <div class="stat-label">Total Pengeluaran</div>
    </div>
    <div class="card stat-card">
      <div class="stat-icon">
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
        </svg>
      </div>
      <div class="stat-value">${formatRupiah(saldo)}</div>
      <div class="stat-label">Saldo Kas</div>
    </div>
  </div>
  <div class="card">
    <div class="table-toolbar">
      <div class="search-bar">
        <svg class="search-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input id="search-kas" type="search" placeholder="Cari uraian, jenis…">
      </div>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Tanggal</th><th>Uraian</th><th>Jenis</th><th>Jumlah</th>${canEdit?"<th>Aksi</th>":""}</tr></thead>
        <tbody id="tb-kas"></tbody>
      </table>
    </div>
  </div>`;

  const rowKas = t => `<tr>
    <td>${formatTanggal(t.tanggal)}</td><td>${t.uraian}</td>
    <td>${statusBadge(t.jenis)}</td>
    <td style="font-weight:600;color:${t.jenis==="Masuk"?"var(--success)":"var(--danger)"}">
      ${t.jenis==="Masuk"?"+":"-"} ${formatRupiah(t.jumlah)}
    </td>
    ${canEdit?`<td><div style="display:flex;gap:6px">
      <button class="btn btn-ghost btn-sm btn-edit-kas" data-id="${t.id}">✏</button>
      <button class="btn btn-ghost btn-sm btn-hapus-kas" data-id="${t.id}" style="color:var(--danger)">🗑</button>
    </div></td>`:""}
  </tr>`;

  renderTable(document.getElementById("tb-kas"), AppState.keuangan, rowKas);
  pasangSearch("search-kas","tb-kas",AppState.keuangan,rowKas,["uraian","jenis"]);

  document.getElementById("tb-kas")?.addEventListener("click", e => {
    const id = e.target.closest("[data-id]")?.dataset.id;
    if (!id) return;
    if (e.target.closest(".btn-edit-kas"))
      bukaFormKas(AppState.keuangan.find(x=>x.id===id), ()=>renderKeuangan(el,user));
    if (e.target.closest(".btn-hapus-kas")) {
      const t = AppState.keuangan.find(x=>x.id===id);
      Modal.konfirmasi(`Hapus transaksi <strong>${t?.uraian}</strong>?`, async ()=>{
        await DB.keuangan.hapus(id);
        if (!FIREBASE_ENABLED) renderKeuangan(el,user);
        tampilToast("Transaksi dihapus.","default");
      });
    }
  });

  document.getElementById("btn-tambah-kas")?.addEventListener("click",()=>bukaFormKas(null,()=>renderKeuangan(el,user)));
  document.getElementById("btn-print-kas")?.addEventListener("click",()=>window.print());
}

function bukaFormKas(data, onSimpan) {
  const isEdit = !!data;
  Modal.buka({
    judul:isEdit?"Edit Transaksi":"Catat Transaksi Baru",
    konten:`
      <div class="field">
        <label>Uraian</label>
        <input id="f-uraian" type="text" value="${data?.uraian||""}" placeholder="Keterangan transaksi">
      </div>
      <div class="grid grid-2">
        <div class="field">
          <label>Jenis</label>
          <select id="f-jenis">
            <option ${data?.jenis==="Masuk"?"selected":""}>Masuk</option>
            <option ${data?.jenis==="Keluar"?"selected":""}>Keluar</option>
          </select>
        </div>
        <div class="field">
          <label>Jumlah (Rp)</label>
          <input id="f-jumlah" type="number" value="${data?.jumlah||""}" placeholder="0">
        </div>
        <div class="field" style="grid-column:1/-1">
          <label>Tanggal</label>
          <input id="f-tgl-kas" type="date" value="${data?.tanggal||""}">
        </div>
      </div>`,
    aksi:[
      {label:"Batal",kelas:"btn-ghost",id:"m-batal-kas",onClick:()=>Modal.tutup()},
      {label:isEdit?"Simpan":"Catat",kelas:"btn-primary",id:"m-simpan-kas",onClick:()=>{
        const uraian = document.getElementById("f-uraian").value.trim();
        const jumlah = +document.getElementById("f-jumlah").value;
        if (!uraian || !jumlah) { tampilToast("Uraian dan jumlah tidak boleh kosong.","danger"); return; }
        const payload = {
          uraian, jumlah, jenis:document.getElementById("f-jenis").value,
          tanggal:document.getElementById("f-tgl-kas").value || new Date().toISOString().split("T")[0]
        };
        _jalankanSimpan("m-simpan-kas", async ()=>{
          if (isEdit) await DB.keuangan.update(data.id, payload);
          else await DB.keuangan.tambah(payload);
          Modal.tutup();
          if (!FIREBASE_ENABLED) onSimpan?.();
          tampilToast(isEdit?"Transaksi diperbarui.":"Transaksi dicatat.","success");
        });
      }}
    ]
  });
}

/* ─────────────────────────────────────────────────────────
   PRESENSI
───────────────────────────────────────────────────────── */
function renderPresensi(el) {
  el.innerHTML = `
  <div class="page-head">
    <div><h1>Presensi</h1><p class="page-sub">Input & rekap kehadiran</p></div>
  </div>
  <div class="tab-bar">
    <button class="tab-btn active" id="tab-input">Input Presensi</button>
    <button class="tab-btn" id="tab-rekap">Rekap Bulanan</button>
  </div>
  <div id="tab-content"></div>`;

  function tampilTab(tab) {
    document.getElementById("tab-input").classList.toggle("active", tab==="input");
    document.getElementById("tab-rekap").classList.toggle("active", tab==="rekap");
    if (tab==="input") renderTabInput();
    else renderTabRekap();
  }
  document.getElementById("tab-input").addEventListener("click", ()=>tampilTab("input"));
  document.getElementById("tab-rekap").addEventListener("click", ()=>tampilTab("rekap"));
  tampilTab("input");
}

function renderTabInput() {
  const c = document.getElementById("tab-content");
  const tanggalHari = new Date().toISOString().split("T")[0];
  const anggota = AppState.anggota;
  const dummy = anggota.map(a => ({
    ...a, hadir:Math.random()>0.2, ket:""
  }));

  c.innerHTML = `
  <div class="card">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px">
      <div class="field" style="margin:0">
        <label>Tanggal Pertemuan</label>
        <input type="date" id="presensi-tanggal" value="${tanggalHari}" style="width:auto">
      </div>
      <button class="btn btn-primary btn-sm" id="btn-simpan-presensi">💾 Simpan Presensi</button>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>#</th><th>Nama</th><th>Kelas</th><th>Hadir</th><th>Keterangan</th></tr></thead>
        <tbody>
          ${dummy.map((a,i)=>`<tr>
            <td>${i+1}</td>
            <td><div style="display:flex;align-items:center;gap:8px">
              <div class="avatar" style="width:28px;height:28px;font-size:0.65rem">${getInisial(a.nama)}</div>${a.nama}
            </div></td>
            <td>${a.kelas}</td>
            <td><label style="display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="checkbox" class="cb-hadir" data-id="${a.id}" ${a.hadir?"checked":""}
                style="accent-color:var(--pmr-red);width:17px;height:17px">
              <span class="hadir-lbl" style="font-size:0.8rem;color:${a.hadir?"var(--success)":"var(--gray-400)"}">
                ${a.hadir?"Hadir":"Alpha"}
              </span>
            </label></td>
            <td><input type="text" class="ket-input" data-id="${a.id}" value="${a.ket}"
              placeholder="—" style="border:1px solid var(--gray-300);border-radius:6px;padding:5px 10px;font-size:0.82rem;width:160px">
            </td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
  </div>`;

  c.querySelectorAll(".cb-hadir").forEach(cb => {
    cb.addEventListener("change", ()=>{
      const lbl = cb.closest("tr").querySelector(".hadir-lbl");
      lbl.textContent = cb.checked?"Hadir":"Alpha";
      lbl.style.color = cb.checked?"var(--success)":"var(--gray-400)";
    });
  });

  document.getElementById("btn-simpan-presensi")?.addEventListener("click", async ()=>{
    const tanggal = document.getElementById("presensi-tanggal").value;
    if (!tanggal) { tampilToast("Pilih tanggal terlebih dahulu.","danger"); return; }

    const rows = dummy.map(a => ({
      anggotaId: a.id,
      tanggal,
      hadir: c.querySelector(`.cb-hadir[data-id="${a.id}"]`)?.checked ?? a.hadir,
      ket:   c.querySelector(`.ket-input[data-id="${a.id}"]`)?.value || ""
    }));

    const btn = document.getElementById("btn-simpan-presensi");
    btn.disabled=true; btn.textContent="Menyimpan…";
    await DB.presensi.simpan(rows, tanggal);
    btn.disabled=false; btn.textContent="💾 Simpan Presensi";
    tampilToast("Presensi berhasil disimpan.","success");
  });
}

function renderTabRekap() {
  const c = document.getElementById("tab-content");
  const pertemuan = [...new Set(AppState.presensiHistory.map(p=>p.tanggal))].sort();
  const jumlahPtm = pertemuan.length;

  const rekapData = AppState.anggota.map(a => {
    const riwayat = AppState.presensiHistory.filter(p=>p.anggotaId===a.id);
    const hadir   = riwayat.filter(p=>p.hadir).length;
    const alpha   = riwayat.filter(p=>!p.hadir&&!p.ket).length;
    const izin    = riwayat.filter(p=>!p.hadir&&p.ket).length;
    const pct     = jumlahPtm ? Math.round(hadir/jumlahPtm*100) : 0;
    return {...a, hadir, alpha, izin, pct};
  }).sort((a,b)=>b.pct-a.pct);

  c.innerHTML = `
  <div class="card">
    <div class="card-title">Rekap Kehadiran <span class="badge badge-info">${jumlahPtm} pertemuan</span></div>
    <div class="table-toolbar">
      <div class="search-bar">
        <svg class="search-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input id="search-rekap" type="search" placeholder="Cari nama…">
      </div>
      <button class="btn btn-outline btn-sm" onclick="window.print()">🖨 Cetak</button>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Nama</th><th>Kelas</th><th>Hadir</th><th>Alpha</th><th>Izin/Sakit</th><th>% Kehadiran</th></tr></thead>
        <tbody id="tb-rekap"></tbody>
      </table>
    </div>
  </div>`;

  const rowRekap = r => {
    const warna = r.pct>=80?"var(--success)":r.pct>=60?"var(--warning)":"var(--danger)";
    const bar = `<div style="background:var(--gray-200);border-radius:4px;height:6px;width:80px;display:inline-block;vertical-align:middle;margin-left:8px">
      <div style="width:${r.pct}%;background:${warna};height:100%;border-radius:4px"></div></div>`;
    return `<tr>
      <td><div style="display:flex;align-items:center;gap:8px">
        <div class="avatar" style="width:28px;height:28px;font-size:0.65rem">${getInisial(r.nama)}</div>${r.nama}
      </div></td>
      <td>${r.kelas}</td>
      <td style="color:var(--success);font-weight:600">${r.hadir}</td>
      <td style="color:var(--danger);font-weight:600">${r.alpha}</td>
      <td style="color:var(--warning);font-weight:600">${r.izin}</td>
      <td><span style="font-weight:700;color:${warna}">${r.pct}%</span>${bar}</td>
    </tr>`;
  };
  renderTable(document.getElementById("tb-rekap"), rekapData, rowRekap);
  pasangSearch("search-rekap","tb-rekap",rekapData,rowRekap,["nama","kelas"]);
}

/* ─────────────────────────────────────────────────────────
   PENGURUS
───────────────────────────────────────────────────────── */
function cariJabatan(roleId) {
  return AppState.strukturPengurus.find(j => j.role_id === roleId);
}
let _pengurusIdCounter = 9100;
function idBaruPengurus() { return _pengurusIdCounter++; }

function renderPengurus(el) {
  el.innerHTML = `
  <div class="page-head">
    <div><h1>Pengurus PMR</h1><p class="page-sub">Masa Bakti ${AppState.periode}</p></div>
    <button class="btn btn-outline btn-sm" id="btn-reset-struktur">↺ Reset Struktur</button>
  </div>
  <div id="pengurus-container"></div>`;

  document.getElementById("btn-reset-struktur").addEventListener("click", ()=>{
    Modal.konfirmasi("Reset seluruh struktur pengurus ke data awal?", async ()=>{
      /* FIX: STRUKTUR_PENGURUS_DEFAULT berasal dari data-dummy (ID number).
         Konversi ke string agar konsisten dengan DOM dataset.id yang selalu string,
         sehingga find(a => a.id === idLama) tidak gagal setelah reset. */
      const awal = JSON.parse(JSON.stringify(STRUKTUR_PENGURUS_DEFAULT))
        .map(jabatan => ({
          ...jabatan,
          anggota: (jabatan.anggota || []).map(a => ({ ...a, id: String(a.id) }))
        }));
      await DB.pengurus.simpanStruktur(awal);
      gambarStrukturPengurus();
      tampilToast("Struktur pengurus direset.","success");
    });
  });
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
    ${!penuh?`<button class="btn btn-ghost btn-sm btn-tambah-pengurus" data-role="${item.role_id}">+ Tambah ${item.jabatan}</button>`:""}
  </div>`;
}

function chipOrang(roleId, a) {
  return `
  <div class="person-chip" data-role="${roleId}" data-id="${a.id}">
    <div class="avatar">${getInisial(a.nama)}</div>
    <div class="person-chip-name">${a.nama}</div>
    <div class="person-chip-actions">
      <button class="chip-icon-btn btn-ganti-orang" title="Ganti">✏</button>
      <button class="chip-icon-btn btn-pindah-jabatan" title="Pindah Jabatan">⇄</button>
      <button class="chip-icon-btn danger btn-hapus-orang" title="Hapus">✕</button>
    </div>
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
  /* Pastikan semua ID di anggota[] tetap string sebelum disimpan
     (idBaruPengurus() sudah return String, tapi jaga-jaga jika ada
     data lama yang masih number masuk lewat jalur lain). */
  AppState.strukturPengurus.forEach(jabatan => {
    jabatan.anggota = jabatan.anggota.map(a => ({ ...a, id: String(a.id) }));
  });
  await DB.pengurus.simpanStruktur(AppState.strukturPengurus);
  gambarStrukturPengurus();
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

/* ─────────────────────────────────────────────────────────
   PENGATURAN
───────────────────────────────────────────────────────── */
function renderPengaturan(el, user) {
  const rc = ROLES[user.role]||{label:user.role,badge:"badge-gray"};
  el.innerHTML = `
  <div class="page-head">
    <div><h1>Pengaturan</h1><p class="page-sub">Preferensi akun · ${FIREBASE_ENABLED?"🔴 Firebase aktif":"📦 Mode Demo"}</p></div>
  </div>
  <div class="grid grid-2">
    <div class="card">
      <div class="card-title">Profil Akun</div>
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
        <div class="avatar" style="width:52px;height:52px;font-size:1.1rem">${getInisial(user.nama)}</div>
        <div><div style="font-weight:700">${user.nama}</div><span class="badge ${rc.badge}">${rc.label}</span></div>
      </div>
      <div class="field"><label>Nama Lengkap</label><input type="text" id="pref-nama" value="${user.nama}"></div>
      <div class="field">
        <label>Username</label>
        <input type="text" value="${user.username}" disabled style="opacity:.6;cursor:not-allowed">
        <div class="field-hint">Username tidak dapat diubah.</div>
      </div>
      <button class="btn btn-primary btn-sm" id="btn-simpan-profil">Simpan Perubahan</button>
    </div>
    <div class="card">
      <div class="card-title">Ubah Password</div>
      <div class="field"><label>Password Lama</label><input type="password" id="pw-lama" placeholder="••••••••"></div>
      <div class="field"><label>Password Baru</label><input type="password" id="pw-baru" placeholder="••••••••"></div>
      <div class="field"><label>Konfirmasi</label><input type="password" id="pw-konfirm" placeholder="••••••••"></div>
      <div id="pw-error" class="alert alert-danger" style="display:none"></div>
      <button class="btn btn-primary btn-sm" id="btn-ubah-pw">Ubah Password</button>
    </div>
  </div>`;

  document.getElementById("btn-simpan-profil")?.addEventListener("click",()=>
    tampilToast(FIREBASE_ENABLED?"Update profil akan tersedia via Firebase.":"Profil diperbarui (demo).","success"));
  document.getElementById("btn-ubah-pw")?.addEventListener("click",()=>{
    const baru=document.getElementById("pw-baru").value;
    const konfirm=document.getElementById("pw-konfirm").value;
    const err=document.getElementById("pw-error");
    if (baru!==konfirm){err.textContent="Password baru tidak cocok.";err.style.display="flex";return;}
    err.style.display="none";
    tampilToast(FIREBASE_ENABLED?"Ubah password via Firebase Auth.":"Password diubah (demo).","success");
  });
}
