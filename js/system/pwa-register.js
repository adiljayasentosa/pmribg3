/* =========================================================
   PWA-REGISTER.JS
   Phase 1: Registrasi SW + Install Prompt
   Phase 2: Update Checker + Snackbar, Indikator Online/Offline,
            Indikator Data dari Cache, guard visual upload offline
   =========================================================
   File ini TIDAK menyentuh Firebase/Firestore/Auth/ImageKit sama
   sekali — hanya mendengarkan event & menampilkan UI tambahan.
   Semua UI di sini di-inject lewat JS (style + DOM), supaya TIDAK
   perlu menambah <link>/<script> baru ke 8 file HTML lagi.
   ========================================================= */

(function () {
  /* ── Style bersama untuk semua UI Phase 2 di file ini ── */
  const style = document.createElement("style");
  style.textContent = `
    #pmr-snackbar{
      position:fixed; left:50%; bottom:20px; transform:translate(-50%,0);
      background:#1f1f1f; color:#fff; padding:12px 16px; border-radius:10px;
      display:flex; align-items:center; gap:12px; font-size:0.92rem;
      box-shadow:0 6px 20px rgba(0,0,0,.25); z-index:150; max-width:92vw;
    }
    #pmr-snackbar button{
      background:#C8102E; color:#fff; border:none; border-radius:6px;
      padding:6px 12px; font-size:0.85rem; cursor:pointer; white-space:nowrap;
    }
    #pmr-net-badge{
      position:fixed; right:12px; bottom:12px; z-index:140;
      font-size:0.75rem; padding:4px 10px; border-radius:999px;
      background:#e8e8e8; color:#444; box-shadow:0 2px 6px rgba(0,0,0,.15);
      display:flex; align-items:center; gap:6px; transition:opacity .2s;
    }
    #pmr-net-badge.pmr-online{ background:#e6f7ec; color:#1a7a3f; }
    #pmr-net-badge.pmr-offline{ background:#fdeceb; color:#b3261e; }
    #pmr-net-badge .pmr-dot{ width:7px; height:7px; border-radius:50%; background:currentColor; }
    /* Nonaktifkan visual widget upload saat offline (Phase 2) — logic
       blokir sebenarnya tetap ada di js/core/storage.js sebagai jaring
       pengaman; ini cuma indikasi visual instan tanpa menunggu klik. */
    body.pmr-offline .upload-dropzone{ opacity:.5; pointer-events:none; }
  `;
  document.head.appendChild(style);

  /* =====================================================
     1) REGISTRASI SERVICE WORKER (Phase 1)
     ===================================================== */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").then((registration) => {
        _pasangUpdateChecker(registration);
      }).catch((err) => {
        console.warn("[PWA] Registrasi service worker gagal:", err);
      });
    });

    // Reload otomatis SEKALI saat SW baru resmi mengambil alih kontrol
    // (dipicu setelah user klik "Refresh" di snackbar).
    let sudahReload = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (sudahReload) return;
      sudahReload = true;
      window.location.reload();
    });
  }

  /* =====================================================
     2) UPDATE CHECKER + SNACKBAR (Phase 2)
     ===================================================== */
  function _pasangUpdateChecker(registration) {
    // Kasus: ada SW versi baru yang SUDAH menunggu (mis. ter-update saat
    // tab ini tidak aktif / sesi sebelumnya belum di-refresh).
    if (registration.waiting) {
      _tampilkanSnackbarUpdate(registration.waiting);
    }

    // Kasus: SW baru mulai proses install SAAT halaman ini terbuka.
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        // "installed" + sudah ada controller aktif = ini update, BUKAN
        // instalasi pertama kali (yang tidak butuh snackbar).
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          _tampilkanSnackbarUpdate(worker);
        }
      });
    });
  }

  function _tampilkanSnackbarUpdate(waitingWorker) {
    if (document.getElementById("pmr-snackbar")) return; // sudah tampil
    const bar = document.createElement("div");
    bar.id = "pmr-snackbar";
    bar.innerHTML = `<span>Versi terbaru tersedia</span>`;
    const btn = document.createElement("button");
    btn.textContent = "Refresh";
    btn.addEventListener("click", () => {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
      btn.disabled = true;
      btn.textContent = "Memuat…";
    });
    bar.appendChild(btn);
    document.body.appendChild(bar);
  }

  /* =====================================================
     3) INDIKATOR ONLINE / OFFLINE (Phase 2)
     ===================================================== */
  function _buatBadge() {
    let badge = document.getElementById("pmr-net-badge");
    if (badge) return badge;
    badge = document.createElement("div");
    badge.id = "pmr-net-badge";
    badge.innerHTML = `<span class="pmr-dot"></span><span class="pmr-label"></span>`;
    document.body.appendChild(badge);
    return badge;
  }

  function _perbaruiStatusJaringan() {
    const online = navigator.onLine;
    const badge = _buatBadge();
    badge.classList.toggle("pmr-online", online);
    badge.classList.toggle("pmr-offline", !online);
    badge.querySelector(".pmr-label").textContent = online ? "Online" : "Offline";
    document.body.classList.toggle("pmr-offline", !online);
  }

  window.addEventListener("online", _perbaruiStatusJaringan);
  window.addEventListener("offline", _perbaruiStatusJaringan);
  window.addEventListener("DOMContentLoaded", _perbaruiStatusJaringan);
  // Kalau script ini load setelah DOMContentLoaded (mis. dari cache):
  if (document.readyState !== "loading") _perbaruiStatusJaringan();

  /* =====================================================
     4) INDIKATOR "DATA DARI CACHE" (Phase 2)
     Didengarkan dari js/core/firebase-db.js — hanya aktif di
     dashboard.html karena hanya file itu yang dispatch event ini.
     ===================================================== */
  let timeoutLabelCache = null;
  window.addEventListener("pmr:firestore-cache-status", (event) => {
    const badge = _buatBadge();
    const label = badge.querySelector(".pmr-label");
    if (event.detail && event.detail.fromCache) {
      label.textContent = "Data dari cache (offline)";
      clearTimeout(timeoutLabelCache);
      timeoutLabelCache = setTimeout(_perbaruiStatusJaringan, 4000);
    }
  });

  /* =====================================================
     5) INSTALL PROMPT (Phase 1)
     ===================================================== */
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    window.__pmrInstallPrompt = event;
  });

  window.addEventListener("appinstalled", () => {
    window.__pmrInstallPrompt = null;
  });
})();
