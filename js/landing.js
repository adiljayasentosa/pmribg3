/* =========================================================
   LANDING PAGE LOGIC
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  /* Jika sudah login, tombol "Buka Dashboard" muncul */
  const user = getCurrentUser();
  const btnDashboard = document.getElementById("btn-hero-dashboard");
  const btnLogin = document.getElementById("btn-hero-login");

  if (user && btnDashboard) {
    btnDashboard.textContent = "Buka Dashboard";
    btnDashboard.href = "dashboard.html";
  }

  /* Mobile nav toggle */
  document.getElementById("nav-toggle")?.addEventListener("click", () => {
    document.getElementById("nav-links").classList.toggle("open");
  });

  /* Tutup nav mobile jika klik link */
  document.querySelectorAll(".nav-links a").forEach((a) =>
    a.addEventListener("click", () =>
      document.getElementById("nav-links")?.classList.remove("open")
    )
  );

  /* Scroll smooth ke anchor */
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", (e) => {
      const target = document.querySelector(anchor.getAttribute("href"));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth" });
      }
    });
  });

  /* Animasi stat counter di hero */
  const counters = document.querySelectorAll(".js-counter");
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseInt(el.dataset.target, 10);
      let current = 0;
      const step = Math.ceil(target / 30);
      const timer = setInterval(() => {
        current = Math.min(current + step, target);
        el.textContent = current + (el.dataset.suffix || "");
        if (current >= target) clearInterval(timer);
      }, 30);
      observer.unobserve(el);
    });
  }, { threshold: 0.5 });

  counters.forEach((c) => observer.observe(c));

  /* [F5.1] Accordion FAQ — interaksi baru, hanya untuk section FAQ
     yang baru ditambahkan. Tidak menyentuh logic/auth/routing lain. */
  document.querySelectorAll(".faq-q").forEach((btn) => {
    btn.addEventListener("click", () => {
      const item = btn.closest(".faq-item");
      const wasOpen = item.classList.contains("open");
      document.querySelectorAll(".faq-item.open").forEach((el) => el.classList.remove("open"));
      if (!wasOpen) item.classList.add("open");
    });
  });

  /* =========================================================
     STRUKTUR PENGURUS PUBLIK
     Satu sumber data dengan Dashboard: pengurus/struktur.
     Public page hanya membaca data terbaru; tidak ada tombol edit.
     ========================================================= */
  const landingPengurus = document.getElementById("landing-pengurus-grid");
  if (landingPengurus) {
    const escapeHtml = (value) => String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");

    const inisial = (nama) => String(nama || "?")
      .trim().split(/\s+/).filter(Boolean).slice(0, 2)
      .map(k => k[0]).join("").toUpperCase() || "?";

    const renderPengurusPublik = (data) => {
      const jabatan = Array.isArray(data?.jabatan) ? data.jabatan : [];
      const terisi = jabatan.flatMap(item =>
        (Array.isArray(item.anggota) ? item.anggota : []).map(orang => ({
          jabatan: item.jabatan,
          nama: orang.nama
        }))
      );

      if (!terisi.length) {
        landingPengurus.innerHTML = `<p style="color:var(--ink-soft)">Data pengurus belum tersedia.</p>`;
        return;
      }

      landingPengurus.innerHTML = terisi.map(orang => `
        <div class="org-chip">
          <div class="avatar" style="background:var(--pmr-red)">${escapeHtml(inisial(orang.nama))}</div>
          <div>
            <div class="org-role">${escapeHtml(orang.jabatan)}</div>
            <div class="org-name">${escapeHtml(orang.nama)}</div>
          </div>
        </div>`).join("");
    };

    if (typeof FIREBASE_ENABLED !== "undefined" && FIREBASE_ENABLED && window.firebase?.firestore) {
      firebase.firestore().collection("pengurus").doc("struktur").get()
        .then(snap => renderPengurusPublik(snap.exists ? snap.data() : null))
        .catch(err => {
          console.error("[PMR] Gagal mengambil struktur pengurus publik:", err);
          landingPengurus.innerHTML = `<p style="color:var(--ink-soft)">Data pengurus belum dapat dimuat.</p>`;
        });
    } else {
      renderPengurusPublik(null);
    }
  }

  /* =========================================================
     [F6.0] LANDING DATA SOURCE — 4 section dinamis
     =========================================================
     Hanya berjalan di halaman yang punya kontainernya (index.html).
     Pakai ContentDB.fetchLatestBanyak() → Promise.all() di baliknya
     (lihat content-db.js) supaya 4 collection diambil PARALEL,
     bukan berurutan — sesuai instruksi performa "Landing Page harus
     cepat dimuat". Skeleton ditampilkan selama proses berlangsung. */
  const gridLanding = {
    artikel:     document.getElementById("landing-artikel-grid"),
    video:       document.getElementById("landing-video-grid"),
    poster:      document.getElementById("landing-poster-grid"),
    dokumentasi: document.getElementById("landing-dokumentasi-grid")
  };
  const rendererKartu = { artikel: _kartuArtikel, video: _kartuVideo, poster: _kartuPoster, dokumentasi: _kartuDokumentasi };

  if (Object.values(gridLanding).some(Boolean)) {
    Object.entries(gridLanding).forEach(([tipe, el]) => {
      if (el) el.innerHTML = Array.from({ length: 3 }, () => skCard({ lines: 2 })).join("");
    });

    ContentDB.fetchLatestBanyak(["artikel", "video", "poster", "dokumentasi"], 3).then((hasil) => {
      Object.entries(gridLanding).forEach(([tipe, el]) => {
        if (!el) return;
        const item3 = hasil[tipe] || [];
        el.innerHTML = item3.length
          ? item3.map(rendererKartu[tipe]).join("")
          : `<p style="grid-column:1/-1;text-align:center;color:var(--ink-soft);padding:24px 0">Belum ada ${tipe} yang dipublikasikan.</p>`;
      });
    });
  }
});
