/* =========================================================
   DASHBOARD.JS — v4 Bootstrap (Fase 3 — modularisasi)
   =========================================================
   File ini KHUSUS bertugas sebagai bootstrap:
   - initAuth()               → verifikasi sesi login
   - DB.init()                → muat data awal ke AppState
   - DB.initListeners()       → aktifkan realtime listener Firestore
   - render halaman aktif     → via objek PAGES
   - router menu (sidebar)    → navigateTo()

   Seluruh render function dan event handler per halaman sudah
   dipindahkan ke js/pages/*.js. Helper lintas halaman (pasangSearch,
   statCard, _jalankanSimpan) dipindahkan ke js/core/state.js.

   TIDAK ADA perubahan logika dari versi sebelumnya — murni
   pemindahan lokasi kode. Perilaku aplikasi identik.
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
    /* F3.3: tambah class "spin-icon" agar ikon benar-benar berputar
       selama proses autentikasi & pengambilan data — sebelumnya ikon
       ini statis dan terkesan seperti aplikasi freeze/macet. */
    el.innerHTML = `<div class="empty-state">
      <div class="empty-icon spin-icon">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
      </div>
      <p class="empty-title">Menyiapkan dashboard…</p>
      <p class="empty-desc">Menghubungkan ke server dan memuat data terbaru.</p>
    </div>`;
  }
}

/* ─────────────────────────────────────────────────────────
   PAGES — Registry router. render() masing-masing entry
   didefinisikan di js/pages/*.js (dimuat sebelum file ini).
───────────────────────────────────────────────────────── */
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
    presensi:   { title:"Presensi",     render:renderPresensi   },
    piket:      { title:"Piket",        render:renderPiket      },
    upacara:    { title:"Petugas Upacara", render:renderUpacara },
    keuangan:   { title:"Keuangan",     render:renderKeuangan   },
    inventaris: { title:"Inventaris",   render:renderInventaris },
    laporan:    { title:"Laporan",      render:renderLaporan    },
    pengurus:   { title:"Pengurus",     render:renderPengurus   },
    pengaturan: { title:"Pengaturan",   render:renderPengaturan },
    profilsaya: { title:"Profil Saya",  render:renderProfilSaya }
  };

  /* ── F3.2: Sidebar khusus role "anggota" ──
     Hanya mengubah tampilan sidebar JIKA role adalah anggota.
     Untuk semua role lain, blok ini tidak dieksekusi sama sekali —
     sidebar tetap identik seperti sebelum F3.2. */
  if (user.role === "anggota") {
    const sembunyikanUntukAnggota = ["anggota", "presensi", "keuangan", "pengaturan"];
    sembunyikanUntukAnggota.forEach(page => {
      const link = document.querySelector(`.sidebar-link[data-page="${page}"]`);
      if (link) link.style.display = "none";
    });
    const linkProfil = document.querySelector('.sidebar-link[data-page="profilsaya"]');
    if (linkProfil) linkProfil.style.display = "";
  }

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
