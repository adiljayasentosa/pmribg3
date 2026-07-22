/* =========================================================
   PAGES/PRESENSI.JS
   Diekstrak dari dashboard.js (Fase 3 — modularisasi).
   Tidak ada perubahan logika, hanya pemindahan lokasi.
   ========================================================= */

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

  /* Muat data presensi yang sudah tersimpan untuk tanggal hari ini (jika ada).
     Jika belum ada data → semua checkbox unchecked (bukan acak). */
  const presensiHariIni = AppState.presensiHistory.filter(p => p.tanggal === tanggalHari);
  const anggotaList = anggota.map(a => {
    const p = presensiHariIni.find(px => px.anggotaId === a.id);
    return { ...a, hadir: p ? p.hadir : false, ket: p ? (p.ket || "") : "" };
  });

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
          ${anggotaList.map((a,i)=>`<tr>
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

    const rows = anggotaList.map(a => ({
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

/**
 * Hitung jumlah pertemuan unik dari riwayat presensi.
 * Dipakai oleh renderTabRekap() dan Report Engine (F4.3 — laporan Presensi).
 */
function hitungJumlahPertemuanPresensi() {
  return new Set(AppState.presensiHistory.map(p => p.tanggal)).size;
}

/**
 * Hitung rekap kehadiran per anggota (hadir/alpha/izin/% kehadiran),
 * diurutkan dari persentase tertinggi.
 * Diekstrak dari renderTabRekap() (F4.3) SUPAYA Report Engine bisa
 * memakai persis logika yang sama, tanpa duplikasi. Tidak ada
 * perubahan hasil/perilaku dari versi sebelumnya.
 * Dipakai oleh: renderTabRekap() (di bawah), report-engine.js.
 */
function hitungRekapPresensi() {
  const jumlahPtm = hitungJumlahPertemuanPresensi();
  return AppState.anggota.map(a => {
    const riwayat = AppState.presensiHistory.filter(p=>p.anggotaId===a.id);
    const hadir   = riwayat.filter(p=>p.hadir).length;
    const alpha   = riwayat.filter(p=>!p.hadir&&!p.ket).length;
    const izin    = riwayat.filter(p=>!p.hadir&&p.ket).length;
    const pct     = jumlahPtm ? Math.round(hadir/jumlahPtm*100) : 0;
    return {...a, hadir, alpha, izin, pct};
  }).sort((a,b)=>b.pct-a.pct);
}

function renderTabRekap() {
  const c = document.getElementById("tab-content");
  const jumlahPtm  = hitungJumlahPertemuanPresensi();
  const rekapData  = hitungRekapPresensi();

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
