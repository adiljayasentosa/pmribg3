/* =========================================================
   PAGES/BERANDA.JS
   Diekstrak dari dashboard.js (Fase 3.1 — modularisasi).
   F3.2: ditambah renderBerandaAnggota() untuk role "anggota".
   F3.3: Beranda pengurus dirombak agar informatif — Quick
   Actions per role, Aktivitas Terbaru (gabungan kegiatan +
   keuangan dari data yang sudah ada), Kegiatan Mendatang
   yang benar-benar difilter, dan stat card yang disembunyikan
   (bukan menampilkan 0 palsu) untuk role tanpa akses RBAC.

   Tidak ada collection Firestore baru, tidak ada dependency
   baru, tidak ada perubahan pada Firebase/Rules/RBAC/AppState.
   Seluruh data berasal dari AppState yang sudah ada.
   ========================================================= */

/* ─────────────────────────────────────────────────────────
   Helper bersama — dipakai baik oleh Beranda Pengurus
   maupun Beranda Anggota, supaya logika filter "kegiatan
   mendatang" tidak terduplikasi di dua tempat.
───────────────────────────────────────────────────────── */
function _kegiatanTerjadwalMendatang(limit = 4) {
  const sekarang = new Date().toISOString().split("T")[0];
  return AppState.kegiatan
    .filter(k => k.status === "Terjadwal" && k.tanggal >= sekarang)
    .sort((a,b) => a.tanggal.localeCompare(b.tanggal))
    .slice(0, limit);
}

/* =========================================================
   F4.2 — REMINDER & NOTIFICATION CENTER
   =========================================================
   Fungsi MURNI (tidak menyentuh DOM) — dipanggil inline di
   renderBerandaPengurus/renderBerandaAnggota, jadi otomatis
   dihitung ulang setiap kali AppState berubah lewat mekanisme
   _reRenderPage() yang sudah ada sejak F3.1. Tidak ada state,
   cache, atau collection Firestore baru — sesuai keputusan
   desain final F4.2 (Alternatif A).

   Sumber: Kegiatan, Piket, Inventaris, Presensi — SEMUA dari
   AppState yang sudah ada. RBAC per-sumber mengikuti persis
   RBAC baca collection yang sudah berlaku (bukan aturan baru).
   ========================================================= */

const PRIORITAS_REMINDER = { critical: 0, warning: 1, info: 2, success: 3 };
const IKON_REMINDER = { critical: "🔴", warning: "⚠️", info: "ℹ️", success: "✅" };

/**
 * Hitung seluruh reminder untuk user yang sedang login.
 * @param {object} user - { nama, username, role }
 * @returns {Array} daftar reminder sudah terurut (prioritas → tanggal terdekat)
 */
function _hitungReminder(user) {
  const list = [];
  const sekarang = new Date().toISOString().split("T")[0];
  const besokDate = new Date(); besokDate.setDate(besokDate.getDate() + 1);
  const besok = besokDate.toISOString().split("T")[0];

  /* ── 1. KEGIATAN — semua role (kegiatan = read universal sejak F3.1) ── */
  AppState.kegiatan.forEach(k => {
    if (k.status === "Dibatalkan") return;
    if (k.tanggal === sekarang && k.status === "Terjadwal") {
      list.push({ prioritas:"info", teks:`Hari ini ada kegiatan "${k.nama}"`, tanggal:k.tanggal, goto:"kegiatan" });
    } else if (k.tanggal === besok && k.status === "Terjadwal") {
      list.push({ prioritas:"info", teks:`Besok ada kegiatan "${k.nama}"`, tanggal:k.tanggal, goto:"kegiatan" });
    } else if (k.tanggal < sekarang && k.status === "Terjadwal") {
      list.push({ prioritas:"warning", teks:`Kegiatan "${k.nama}" sudah lewat tapi belum ditandai selesai`, tanggal:k.tanggal, goto:"kegiatan" });
    }
  });

  /* ── 2. PIKET — semua role (piket = read universal sejak F4.1).
     Match "user = petugas" dilakukan BY NAMA (keputusan final F4.2,
     lihat audit poin 4) — tidak ada field anggotaId di akun login,
     jadi ini heuristik yang disengaja, bukan bug. */
  AppState.piket.forEach(p => {
    if (p.status === "Dibatalkan") return;
    const sayaPetugas = (p.petugas || []).some(pt => pt.nama === user.nama);
    if (p.tanggal === sekarang) {
      list.push({
        prioritas: sayaPetugas ? "critical" : "info",
        teks: sayaPetugas ? "Hari ini kamu bertugas piket" : `Hari ini ada jadwal piket (${p.lokasi||"—"})`,
        tanggal: p.tanggal, goto:"piket"
      });
    } else if (p.tanggal === besok) {
      list.push({
        prioritas: sayaPetugas ? "warning" : "info",
        teks: sayaPetugas ? "Besok kamu bertugas piket" : `Besok ada jadwal piket (${p.lokasi||"—"})`,
        tanggal: p.tanggal, goto:"piket"
      });
    }
  });

  /* ── 3. INVENTARIS — semua role (inventaris = read universal sejak F4.0) ── */
  const rusakBerat = AppState.inventaris.filter(x => x.kondisi === "Rusak Berat");
  const perluDiganti = AppState.inventaris.filter(x => x.kondisi === "Perlu Diganti");
  if (rusakBerat.length > 0) {
    list.push({ prioritas:"critical", teks:`${rusakBerat.length} barang dalam kondisi Rusak Berat`, tanggal:sekarang, goto:"inventaris" });
  }
  if (perluDiganti.length > 0) {
    list.push({ prioritas:"warning", teks:`${perluDiganti.length} barang perlu diganti`, tanggal:sekarang, goto:"inventaris" });
  }

  /* ── 4. PRESENSI belum dibuat — RBAC-gated, SAMA PERSIS dengan
     ROLE_AKSES_PRESENSI di core/firebase-db.js (dibaca sebagai
     referensi, tidak diubah). Granularitas per-tanggal (bukan
     per-kegiatan) — keputusan final F4.2 poin 3. */
  const bolehLihatPresensi = ["admin","ketua","wakil","sekretaris","pj"].includes(user.role);
  if (bolehLihatPresensi) {
    const tanggalKegiatanLewat = [...new Set(
      AppState.kegiatan.filter(k => k.tanggal < sekarang && k.status !== "Dibatalkan").map(k => k.tanggal)
    )];
    const tanggalAdaPresensi = new Set(AppState.presensiHistory.map(p => p.tanggal));
    tanggalKegiatanLewat.forEach(tgl => {
      if (!tanggalAdaPresensi.has(tgl)) {
        list.push({ prioritas:"warning", teks:`Presensi kegiatan tanggal ${formatTanggal(tgl)} belum dibuat`, tanggal:tgl, goto:"presensi" });
      }
    });
  }

  /* ── Sort: prioritas dulu (Critical→Warning→Info→Success),
     lalu dalam prioritas sama urutkan tanggal TERDEKAT dari hari ini
     (baik yang akan datang maupun yang baru lewat) — keputusan final F4.2. */
  list.sort((a, b) => {
    if (PRIORITAS_REMINDER[a.prioritas] !== PRIORITAS_REMINDER[b.prioritas]) {
      return PRIORITAS_REMINDER[a.prioritas] - PRIORITAS_REMINDER[b.prioritas];
    }
    const jarakA = Math.abs(new Date(a.tanggal) - new Date(sekarang));
    const jarakB = Math.abs(new Date(b.tanggal) - new Date(sekarang));
    return jarakA - jarakB;
  });

  /* Empty state positif — bukan panel kosong tanpa penjelasan */
  if (list.length === 0) {
    list.push({ prioritas:"success", teks:"Tidak ada pengingat penting saat ini — semua terkendali!", tanggal:sekarang, goto:null });
  }

  return list;
}

/**
 * Render panel Notification Center + pasang klik-navigasi.
 * Dipanggil setelah el.innerHTML di-set (butuh elemen #panel-reminder ada di DOM).
 */
function _renderPanelReminder(reminderList) {
  const wrap = document.getElementById("panel-reminder");
  if (!wrap) return;

  const MAKS_TAMPIL = 6;
  const tampil = reminderList.slice(0, MAKS_TAMPIL);
  const sisa = reminderList.length - tampil.length;

  wrap.innerHTML = `
    <div class="reminder-list">
      ${tampil.map((r, i) => `
        <div class="reminder-item ${r.prioritas}" ${r.goto ? `data-goto="${r.goto}" data-idx="${i}"` : ""}>
          <span class="reminder-icon">${IKON_REMINDER[r.prioritas]}</span>
          <span class="reminder-text">${r.teks}</span>
        </div>`).join("")}
    </div>
    ${sisa > 0 ? `<div class="reminder-more">+ ${sisa} pengingat lainnya</div>` : ""}`;

  wrap.querySelectorAll(".reminder-item[data-goto]").forEach(item => {
    item.addEventListener("click", () => {
      const goto = item.dataset.goto;
      location.hash = goto;
      document.querySelector(`.sidebar-link[data-page="${goto}"]`)?.click();
    });
  });
}

/* ─────────────────────────────────────────────────────────
   BERANDA — router per-role
───────────────────────────────────────────────────────── */
function renderBeranda(el, user) {
  if (user && user.role === "anggota") {
    renderBerandaAnggota(el, user);
    return;
  }
  renderBerandaPengurus(el, user);
}

/* ─────────────────────────────────────────────────────────
   BERANDA PENGURUS (F3.3)
───────────────────────────────────────────────────────── */
function renderBerandaPengurus(el, user) {
  const r = AppState.ringkasan;

  /* ── Stat cards — hanya tampilkan yang memang boleh dibaca role ini.
     Daftar role di sini SENGAJA disamakan persis dengan ROLE_AKSES_KEUANGAN
     dan ROLE_AKSES_PRESENSI di core/firebase-db.js (tidak diubah, hanya
     dibaca sebagai referensi) — supaya kartu tidak menampilkan "Rp 0"
     atau "0%" palsu untuk role yang datanya memang tidak pernah di-fetch. */
  const bolehLihatKeuangan  = ["admin","ketua","wakil","bendahara"].includes(user.role);
  const bolehLihatPresensi  = ["admin","ketua","wakil","sekretaris","pj"].includes(user.role);

  const statCards = [
    statCard("Anggota Aktif", r.anggotaAktif, "dari "+r.totalAnggota+" total", "neutral",
      `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>`),
    statCard("Program Berjalan", r.programBerjalan, "kegiatan aktif", "neutral",
      `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>`)
  ];
  if (bolehLihatKeuangan) {
    statCards.push(statCard("Saldo Kas", formatRupiah(r.kasSaldo), "per hari ini", "neutral",
      `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z"/>`));
  }
  if (bolehLihatPresensi) {
    statCards.push(statCard("Rata-rata Hadir", r.kehadiranRata+"%", "bulan ini", "neutral",
      `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/>`));
  }

  /* ── Quick Actions — role-based, dicocokkan persis dengan permission
     CRUD yang sudah ada di masing-masing halaman (bukan daftar baru):
     - Tambah Anggota  : sama dengan canEdit di pages/anggota.js
     - Tambah Kegiatan : sama dengan canEdit di pages/kegiatan.js
     - Catat Transaksi : sama dengan canEdit di pages/keuangan.js
     - Tambah Barang   : sama dengan canEdit di pages/inventaris.js (F4.0)
     - Generate Jadwal : sama dengan canGenerate di pages/piket.js (F4.1)
     - Input Presensi  : sama dengan hak tulis presensi (Firestore Rules) */
  const aksi = [];
  if (["admin","ketua","sekretaris"].includes(user.role)) {
    aksi.push({ icon:"👤", label:"Tambah Anggota", onClick: () =>
      bukaFormAnggota(null, () => renderBeranda(el, user)) });
  }
  if (["admin","ketua","wakil","pj"].includes(user.role)) {
    aksi.push({ icon:"📅", label:"Tambah Kegiatan", onClick: () =>
      bukaFormKegiatan(null, () => renderBeranda(el, user)) });
  }
  if (["admin","bendahara"].includes(user.role)) {
    aksi.push({ icon:"💰", label:"Catat Transaksi", onClick: () =>
      bukaFormKas(null, () => renderBeranda(el, user)) });
  }
  if (["admin","ketua","wakil","pj"].includes(user.role)) {
    aksi.push({ icon:"📦", label:"Tambah Barang", onClick: () =>
      bukaFormInventaris(null, () => renderBeranda(el, user)) });
  }
  if (["admin","ketua","wakil","sekretaris","pj"].includes(user.role)) {
    aksi.push({ icon:"🗓️", label:"Generate Jadwal", onClick: () => {
      /* Navigasi lalu trigger tombol Generate di halaman Piket.
         click() bersifat sinkron dan navigateTo() me-render halaman
         secara sinkron juga (pola sama dgn Input Presensi), sehingga
         tombol #btn-generate-piket sudah pasti ada di DOM saat baris
         berikutnya dieksekusi — tidak perlu setTimeout. */
      location.hash = "piket";
      document.querySelector('.sidebar-link[data-page="piket"]')?.click();
      document.getElementById("btn-generate-piket")?.click();
    }});
  }
  if (["admin","ketua","wakil","sekretaris","pj"].includes(user.role)) {
    aksi.push({ icon:"📋", label:"Input Presensi", onClick: () => {
      location.hash = "presensi";
      document.querySelector('.sidebar-link[data-page="presensi"]')?.click();
    }});
  }

  /* ── Kegiatan Mendatang — benar-benar difilter (F3.3 fix) */
  const jadwalMendatang = _kegiatanTerjadwalMendatang(4);

  /* ── Aktivitas Terbaru — gabungan kegiatan + keuangan berdasarkan
     tanggal, tanpa membuat data/collection baru. Menggantikan kartu
     "Transaksi Terakhir" lama (F3.1) agar tidak duplikat dengan
     "Kegiatan Mendatang" — satu berorientasi masa depan, satu masa lalu. */
  const aktivitas = [
    ...AppState.kegiatan.map(k => ({ tipe:"kegiatan", judul:k.nama, tanggal:k.tanggal, sub:k.status })),
    ...AppState.keuangan.map(t => ({ tipe:"keuangan", judul:t.uraian, tanggal:t.tanggal, sub:t.jenis, jumlah:t.jumlah }))
  ].sort((a,b) => b.tanggal.localeCompare(a.tanggal)).slice(0, 5);

  /* ── Reminder — dihitung di sini agar otomatis refresh tiap
     render ulang (F4.2). Lihat _hitungReminder() di atas. */
  const reminderList = _hitungReminder(user);

  el.innerHTML = `
  <div class="page-head">
    <div>
      <h1>Selamat Datang, ${user.nama.split(" ")[0]} 👋</h1>
      <p class="page-sub">Masa Bakti ${AppState.periode} · ${FIREBASE_ENABLED ? "🔴 Live Firestore" : "📦 Mode Demo"}</p>
    </div>
  </div>

  <div class="grid grid-4" style="margin-bottom:24px">${statCards.join("")}</div>

  <div class="card reminder-panel">
    <div class="card-title">🔔 Reminder</div>
    <div id="panel-reminder"></div>
  </div>

  ${aksi.length ? `
  <div class="card" style="margin-bottom:24px">
    <div class="card-title">⚡ Aksi Cepat</div>
    <div class="grid grid-4" id="grid-quick-actions"></div>
  </div>` : ""}

  <div class="grid grid-2">
    <div class="card">
      <div class="card-title">📅 Kegiatan Mendatang</div>
      <div id="wrap-jadwal-mendatang"></div>
    </div>
    <div class="card">
      <div class="card-title">🕓 Aktivitas Terbaru</div>
      <div id="wrap-aktivitas-terbaru"></div>
    </div>
  </div>`;

  _renderPanelReminder(reminderList);

  /* Render Quick Actions (grid-4 dipakai kembali, bukan komponen baru) */
  if (aksi.length) {
    const gridAksi = document.getElementById("grid-quick-actions");
    gridAksi.innerHTML = aksi.map((a, i) => `
      <button class="quick-action-btn" data-idx="${i}" aria-label="${a.label}">
        <span class="qa-icon">${a.icon}</span>
        <span>${a.label}</span>
      </button>`).join("");
    gridAksi.querySelectorAll(".quick-action-btn").forEach(btn => {
      btn.addEventListener("click", () => aksi[+btn.dataset.idx].onClick());
    });
  }

  /* Render Kegiatan Mendatang — empty state kontekstual jika kosong */
  const wrapJadwal = document.getElementById("wrap-jadwal-mendatang");
  if (jadwalMendatang.length === 0) {
    wrapJadwal.innerHTML = `<div class="empty-state" style="padding:32px 16px">
      <div class="empty-icon" style="width:44px;height:44px">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
      </div>
      <p class="empty-title">Belum ada kegiatan terjadwal</p>
      <p class="empty-desc">Kegiatan mendatang akan muncul di sini setelah ditambahkan.</p>
    </div>`;
  } else {
    wrapJadwal.innerHTML = `<table class="data-table">
      <thead><tr><th>Kegiatan</th><th>Tanggal</th><th>Lokasi</th></tr></thead>
      <tbody>${jadwalMendatang.map(k => `<tr>
        <td><strong>${k.nama}</strong></td>
        <td style="white-space:nowrap">${formatTanggal(k.tanggal)}</td>
        <td>${k.lokasi||"—"}</td>
      </tr>`).join("")}</tbody>
    </table>`;
  }

  /* Render Aktivitas Terbaru — empty state kontekstual jika kosong */
  const wrapAktivitas = document.getElementById("wrap-aktivitas-terbaru");
  if (aktivitas.length === 0) {
    wrapAktivitas.innerHTML = `<div class="empty-state" style="padding:32px 16px">
      <div class="empty-icon" style="width:44px;height:44px">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
        </svg>
      </div>
      <p class="empty-title">Belum ada aktivitas</p>
      <p class="empty-desc">Kegiatan dan transaksi terbaru akan tampil di sini.</p>
    </div>`;
  } else {
    wrapAktivitas.innerHTML = `<div class="activity-feed">${aktivitas.map(a => `
      <div class="activity-item">
        <div class="activity-icon ${a.tipe}">${a.tipe === "kegiatan" ? "📅" : "💰"}</div>
        <div class="activity-body">
          <div class="activity-title">${a.judul}</div>
          <div class="activity-meta">
            ${formatTanggal(a.tanggal)} · ${a.tipe === "keuangan"
              ? `${a.sub} ${formatRupiah(a.jumlah)}`
              : a.sub}
          </div>
        </div>
      </div>`).join("")}</div>`;
  }
}

/* ─────────────────────────────────────────────────────────
   BERANDA ANGGOTA (F3.2) — pengalaman khusus role "anggota".
   F4.2: ditambah panel Reminder (parameter `user` sekarang
   dibutuhkan untuk match nama di reminder piket). Bagian lain
   TIDAK diubah dari versi F3.2/F3.3 sebelumnya.
───────────────────────────────────────────────────────── */
function renderBerandaAnggota(el, user) {
  const jadwalTerdekat = _kegiatanTerjadwalMendatang(4);

  const pengumumanTerbaru = [...AppState.kegiatan]
    .sort((a,b) => b.tanggal.localeCompare(a.tanggal))
    .slice(0, 4);

  const totalAnggota = AppState.anggota.length;
  const reminderList = _hitungReminder(user);

  el.innerHTML = `
  <div class="page-head">
    <div>
      <h1>Halo, Anggota PMR 👋</h1>
      <p class="page-sub">Selamat datang di ruang informasi PMR WIRA UNIT · Masa Bakti ${AppState.periode}</p>
    </div>
  </div>

  <div class="grid grid-3" style="margin-bottom:24px">
    <div class="card stat-card">
      <div class="stat-icon">
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
      </div>
      <div class="stat-value">${jadwalTerdekat.length}</div>
      <div class="stat-label">Kegiatan Terdekat</div>
    </div>
    <div class="card stat-card">
      <div class="stat-icon">
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
      </div>
      <div class="stat-value">${totalAnggota}</div>
      <div class="stat-label">Total Anggota</div>
    </div>
    <div class="card stat-card">
      <div class="stat-icon" style="background:var(--gray-200);color:var(--ink-soft)">
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
        </svg>
      </div>
      <div class="stat-value" style="font-size:1rem;color:var(--ink-soft)">Lihat Profil</div>
      <div class="stat-label">Kehadiran Saya</div>
    </div>
  </div>

  <div class="card reminder-panel">
    <div class="card-title">🔔 Reminder</div>
    <div id="panel-reminder"></div>
  </div>

  <div class="grid grid-2" style="margin-bottom:24px">
    <div class="card">
      <div class="card-title">📅 Jadwal Kegiatan Terdekat</div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Kegiatan</th><th>Tanggal</th><th>Lokasi</th></tr></thead>
          <tbody id="tb-jadwal-anggota"></tbody>
        </table>
      </div>
    </div>
    <div class="card">
      <div class="card-title">📢 Pengumuman Terbaru</div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Info</th><th>Tanggal</th><th>Status</th></tr></thead>
          <tbody id="tb-pengumuman-anggota"></tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-title">Menu Cepat</div>
    <div class="grid grid-3">
      <button class="btn btn-outline btn-block quick-menu-btn" data-goto="kegiatan" style="justify-content:center;padding:16px">
        📅 Lihat Kegiatan
      </button>
      <button class="btn btn-outline btn-block quick-menu-btn" data-goto="pengurus" style="justify-content:center;padding:16px">
        👥 Struktur Pengurus
      </button>
      <button class="btn btn-outline btn-block quick-menu-btn" data-goto="profilsaya" style="justify-content:center;padding:16px">
        🙋 Profil Saya
      </button>
    </div>
  </div>`;

  _renderPanelReminder(reminderList);

  renderTable(document.getElementById("tb-jadwal-anggota"), jadwalTerdekat, k =>
    `<tr><td><strong>${k.nama}</strong></td><td style="white-space:nowrap">${formatTanggal(k.tanggal)}</td><td>${k.lokasi||"—"}</td></tr>`);

  renderTable(document.getElementById("tb-pengumuman-anggota"), pengumumanTerbaru, k =>
    `<tr><td>${k.nama}</td><td style="white-space:nowrap">${formatTanggal(k.tanggal)}</td><td>${statusBadge(k.status)}</td></tr>`);

  /* Quick Menu — navigasi lewat hash, memakai router SPA-lite yang sudah ada */
  el.querySelectorAll(".quick-menu-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      location.hash = btn.dataset.goto;
      document.querySelector(`.sidebar-link[data-page="${btn.dataset.goto}"]`)?.click();
    });
  });
}
