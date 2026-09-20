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
    <button class="tab-btn active" id="tab-scan">📷 Scan KTA</button>
    <button class="tab-btn" id="tab-input">Input Presensi</button>
    <button class="tab-btn" id="tab-rekap">Rekap Bulanan</button>
  </div>
  <div id="tab-content"></div>`;

  function tampilTab(tab) {
    document.getElementById("tab-scan").classList.toggle("active", tab==="scan");
    document.getElementById("tab-input").classList.toggle("active", tab==="input");
    document.getElementById("tab-rekap").classList.toggle("active", tab==="rekap");
    if (tab==="scan") renderTabScan();
    else if (tab==="input") renderTabInput();
    else renderTabRekap();
  }
  document.getElementById("tab-scan").addEventListener("click", ()=>tampilTab("scan"));
  document.getElementById("tab-input").addEventListener("click", ()=>tampilTab("input"));
  document.getElementById("tab-rekap").addEventListener("click", ()=>tampilTab("rekap"));
  tampilTab("scan");
}


/* ─────────────────────────────────────────────────────────
   SCAN KTA — presensi berbasis QR KTA
   QR KTA menggunakan URL kta-member.html?kta=<token>.
   Scanner mengambil parameter kta sebagai token dan mempertahankan fallback NIN untuk kompatibilitas.
───────────────────────────────────────────────────────── */
let _ktaScanStream = null;
let _ktaScanTimer = null;
let _ktaScanBusy = false;

function _stopKtaScanner() {
  if (_ktaScanTimer) { clearTimeout(_ktaScanTimer); _ktaScanTimer = null; }
  if (_ktaScanStream) {
    _ktaScanStream.getTracks().forEach(t => t.stop());
    _ktaScanStream = null;
  }
  const video = document.getElementById("kta-scan-video");
  if (video) { try { video.pause(); } catch (_) {} video.srcObject = null; }
  _ktaScanBusy = false;
}

function _extractKtaIdentifier(raw) {
  const text = String(raw || "").trim();
  if (!text) return { type: "unknown", value: "" };
  try {
    const url = new URL(text, location.origin);
    const token = url.searchParams.get("kta");
    const nin = url.searchParams.get("nin") || url.searchParams.get("nomorInduk");
    if (token) return { type: "token", value: token, nin: nin || "" };
  } catch (_) {}
  return { type: "nin", value: text };
}

function _findAnggotaByKtaPayload(raw) {
  const parsed = _extractKtaIdentifier(raw);
  let anggota = null;
  if (parsed.type === "token") {
    anggota = AppState.anggota.find(a => String(a.ktaToken || "") === String(parsed.value));
    if (anggota && parsed.nin && String(anggota.nomorInduk || "") !== String(parsed.nin)) anggota = null;
  } else {
    anggota = AppState.anggota.find(a => String(a.nomorInduk || "") === String(parsed.value));
  }
  return { anggota, parsed };
}

async function _catatPresensiScan(anggota, tanggal) {
  const existing = AppState.presensiHistory.find(p =>
    String(p.anggotaId) === String(anggota.id) && p.tanggal === tanggal
  );
  if (existing && getStatusPresensi(existing) === "hadir") {
    return { duplicate: true };
  }
  await DB.presensi.tambahSatu({
    anggotaId: String(anggota.id),
    tanggal,
    status: "hadir",
    hadir: true,
    ket: "Scan KTA"
  });
  return { duplicate: false };
}

function _renderScanResult(anggota, message, tone="success") {
  const box = document.getElementById("kta-scan-result");
  if (!box) return;
  const isOk = tone === "success";
  box.innerHTML = anggota ? `
    <div class="kta-scan-result-card ${isOk ? "is-success" : "is-warning"}">
      <div class="kta-scan-avatar">${getInisial(anggota.nama)}</div>
      <div class="kta-scan-result-main">
        <div class="kta-scan-result-title">${escapeHtml(anggota.nama || "Anggota")}</div>
        <div class="kta-scan-result-meta">NIN ${escapeHtml(anggota.nomorInduk || "—")} · ${escapeHtml(anggota.kelas || "—")}</div>
        <div class="kta-scan-result-message">${escapeHtml(message)}</div>
      </div>
    </div>` : `<div class="kta-scan-empty ${tone}">${escapeHtml(message)}</div>`;
}

async function _startKtaScanner() {
  const video = document.getElementById("kta-scan-video");
  const status = document.getElementById("kta-scan-status");
  const btn = document.getElementById("btn-kta-start");
  const stopBtn = document.getElementById("btn-kta-stop");
  const cameraBox = document.querySelector(".kta-camera-box");
  if (!video || !status) return;
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    status.textContent = "Kamera membutuhkan HTTPS dan dukungan browser.";
    _renderScanResult(null, "Buka website melalui HTTPS untuk menggunakan scanner.", "danger");
    return;
  }
  if (!("BarcodeDetector" in window)) {
    status.textContent = "Scanner QR native tidak tersedia di browser ini.";
    _renderScanResult(null, "Browser ini belum mendukung BarcodeDetector. Coba Chrome Android.", "danger");
    return;
  }
  try {
    const detector = new BarcodeDetector({ formats: ["qr_code"] });
    _ktaScanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    video.srcObject = _ktaScanStream;
    await video.play();
    btn.disabled = true;
    btn.innerHTML = "📷 Kamera Aktif";
    if (stopBtn) stopBtn.hidden = false;
    if (cameraBox) cameraBox.classList.add("is-active");
    status.textContent = "Arahkan kamera ke QR KTA…";
    _ktaScanBusy = false;

    const loop = async () => {
      if (!_ktaScanStream || !video.srcObject) return;
      try {
        const codes = await detector.detect(video);
        if (codes.length && !_ktaScanBusy) {
          _ktaScanBusy = true;
          const raw = codes[0].rawValue || "";
          const { anggota, parsed } = _findAnggotaByKtaPayload(raw);
          const tanggal = document.getElementById("kta-scan-tanggal")?.value || new Date().toISOString().split("T")[0];
          if (!anggota) {
            _renderScanResult(null, parsed.type === "token" ? "QR KTA tidak cocok dengan data anggota." : "NIN tidak ditemukan di data anggota.", "danger");
            status.textContent = "QR ditolak. Coba KTA yang terdaftar.";
          } else if (String(anggota.statusKeanggotaan || anggota.status || "Aktif").toLowerCase() !== "aktif") {
            _renderScanResult(anggota, "Anggota tidak berstatus Aktif. Presensi ditolak.", "danger");
            status.textContent = "Anggota tidak aktif.";
          } else if (!String(anggota.nomorInduk || "").trim()) {
            _renderScanResult(anggota, "Data NIN anggota kosong. Presensi ditolak.", "danger");
            status.textContent = "NIN anggota belum tersedia.";
          } else {
            try {
              const result = await _catatPresensiScan(anggota, tanggal);
              if (result.duplicate) {
                _renderScanResult(anggota, `Sudah tercatat Hadir pada ${tanggal}.`, "warning");
                status.textContent = "Scan duplikat.";
              } else {
                _renderScanResult(anggota, `Hadir tercatat · ${tanggal}`, "success");
                status.textContent = "Presensi berhasil dicatat.";
              }
            } catch (err) {
              _renderScanResult(anggota, err?.message || "Gagal menyimpan presensi.", "danger");
              status.textContent = "Gagal menyimpan.";
            }
          }
          setTimeout(() => { _ktaScanBusy = false; }, 1400);
        }
      } catch (err) {
        console.warn("[PMR] QR scanner:", err);
      }
      _ktaScanTimer = setTimeout(loop, 180);
    };
    loop();
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = "📷 Mulai Scan";
    if (stopBtn) stopBtn.hidden = true;
    if (cameraBox) cameraBox.classList.remove("is-active");
    _stopKtaScanner();
    status.textContent = "Kamera tidak dapat dibuka.";
    _renderScanResult(null, err?.name === "NotAllowedError" ? "Izin kamera ditolak. Izinkan kamera untuk halaman ini." : (err?.message || "Gagal membuka kamera."), "danger");
  }
}

function renderTabScan() {
  _stopKtaScanner();
  const c = document.getElementById("tab-content");
  const tanggalHari = new Date().toISOString().split("T")[0];
  c.innerHTML = `
    <div class="card kta-scan-card">
      <div class="kta-scan-head">
        <div>
          <div class="card-title">Scan KTA untuk Presensi</div>
          <p class="page-sub">Scan QR pada KTA. NIN/identitas QR wajib cocok dengan data anggota yang terdaftar dan berstatus Aktif.</p>
        </div>
        <div class="field" style="margin:0"><label>Tanggal</label><input type="date" id="kta-scan-tanggal" value="${tanggalHari}"></div>
      </div>
      <div class="kta-scan-grid">
        <div class="kta-camera-box">
          <video id="kta-scan-video" playsinline muted></video>
          <div class="kta-scan-frame" aria-hidden="true"></div>
          <div id="kta-scan-status" class="kta-scan-status">Tekan tombol untuk membuka kamera.</div>
        </div>
        <div class="kta-scan-side">
          <div class="kta-scan-info"><strong>Alur</strong><span>QR KTA → validasi anggota → Hadir → Firebase</span></div>
          <button class="btn btn-primary" id="btn-kta-start">📷 Mulai Scan</button>
          <button class="btn btn-outline" id="btn-kta-stop" type="button" hidden>⏹ Hentikan Kamera</button>
          <div id="kta-scan-result" class="kta-scan-result"><div class="kta-scan-empty">Belum ada hasil scan.</div></div>
          <div class="kta-scan-note">Scan kedua pada anggota yang sama di tanggal yang sama tidak membuat presensi baru.</div>
        </div>
      </div>
    </div>`;
  document.getElementById("btn-kta-start")?.addEventListener("click", _startKtaScanner);
  document.getElementById("btn-kta-stop")?.addEventListener("click", () => {
    _stopKtaScanner();
    const status = document.getElementById("kta-scan-status");
    const btn = document.getElementById("btn-kta-start");
    const box = document.querySelector(".kta-camera-box");
    if (status) status.textContent = "Kamera dihentikan.";
    if (box) box.classList.remove("is-active");
    if (btn) { btn.disabled = false; btn.innerHTML = "📷 Mulai Scan"; }
    const stopBtn = document.getElementById("btn-kta-stop");
    if (stopBtn) stopBtn.hidden = true;
  });
}

function renderTabInput() {
  const c = document.getElementById("tab-content");
  const tanggalHari = new Date().toISOString().split("T")[0];
  const anggota = anggotaAktifSorted(AppState.anggota);

  /* Muat data presensi yang sudah tersimpan untuk tanggal hari ini (jika ada).
     Jika belum ada data → semua checkbox unchecked (bukan acak). */
  const presensiHariIni = AppState.presensiHistory.filter(p => p.tanggal === tanggalHari);
  const anggotaList = anggota.map(a => {
    const p = presensiHariIni.find(px => px.anggotaId === a.id);
    return { ...a, status: p ? getStatusPresensi(p) : "hadir", ket: p ? (p.ket || "") : "" };
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
        <thead><tr><th>#</th><th>Nama</th><th>Kelas</th><th>Status</th><th>Keterangan</th></tr></thead>
        <tbody>
          ${anggotaList.map((a,i)=>`<tr>
            <td>${i+1}</td>
            <td><div style="display:flex;align-items:center;gap:8px">
              <div class="avatar" style="width:28px;height:28px;font-size:0.65rem">${getInisial(a.nama)}</div>${a.nama}
            </div></td>
            <td>${a.kelas}</td>
            <td><div class="status-checks" data-id="${a.id}">
              ${Object.keys(PRESENSI_STATUS_META).map(st=>`<label class="status-check"><input type="checkbox" data-status="${st}" ${a.status===st?"checked":""}><span>${PRESENSI_STATUS_META[st].label}</span></label>`).join("")}
            </div></td>
            <td><input type="text" class="ket-input" data-id="${a.id}" value="${a.ket}"
              placeholder="Opsional" style="border:1px solid var(--gray-300);border-radius:6px;padding:5px 10px;font-size:0.82rem;width:160px">
            </td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
  </div>`;

  c.querySelectorAll(".status-checks").forEach(group => {
    group.querySelectorAll("input[type=checkbox]").forEach(box => {
      box.addEventListener("change", ()=>{
        if (box.checked) {
          group.querySelectorAll("input[type=checkbox]").forEach(other => { if (other !== box) other.checked = false; });
        } else if (!group.querySelector("input[type=checkbox]:checked")) {
          const hadir = group.querySelector('input[data-status="hadir"]'); if (hadir) hadir.checked = true;
        }
      });
    });
  });

  document.getElementById("btn-simpan-presensi")?.addEventListener("click", async ()=>{
    const tanggal = document.getElementById("presensi-tanggal").value;
    if (!tanggal) { tampilToast("Pilih tanggal terlebih dahulu.","danger"); return; }

    const rows = anggotaList.map(a => {
      const status = c.querySelector(`.status-checks[data-id="${a.id}"] input[type="checkbox"]:checked`)?.dataset.status || "hadir";
      return {
        anggotaId: a.id,
        tanggal,
        status,
        hadir: status === "hadir", /* field lama dipertahankan utk kompatibilitas ringkasan Beranda & Detail Anggota */
        ket:   c.querySelector(`.ket-input[data-id="${a.id}"]`)?.value || ""
      };
    });

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
  return anggotaAktifSorted(AppState.anggota).map(a => {
    const riwayat = AppState.presensiHistory.filter(p=>p.anggotaId===a.id);
    const hadir   = riwayat.filter(p=>getStatusPresensi(p)==="hadir").length;
    const alpha   = riwayat.filter(p=>getStatusPresensi(p)==="alpha").length;
    const sakit   = riwayat.filter(p=>getStatusPresensi(p)==="sakit").length;
    const izin    = riwayat.filter(p=>getStatusPresensi(p)==="izin").length;
    const pct     = jumlahPtm ? Math.round(hadir/jumlahPtm*100) : 0;
    return {...a, hadir, alpha, sakit, izin, pct};
  }).sort(compareAnggotaKelasNama);
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
        <thead><tr><th>Nama</th><th>Kelas</th><th>Hadir</th><th>Alpha</th><th>Sakit</th><th>Izin</th><th>% Kehadiran</th></tr></thead>
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
      <td style="color:var(--warning);font-weight:600">${r.sakit}</td>
      <td style="color:var(--info);font-weight:600">${r.izin}</td>
      <td><span style="font-weight:700;color:${warna}">${r.pct}%</span>${bar}</td>
    </tr>`;
  };
  renderTable(document.getElementById("tb-rekap"), rekapData, rowRekap);
  pasangSearch("search-rekap","tb-rekap",rekapData,rowRekap,["nama","kelas"]);
}
