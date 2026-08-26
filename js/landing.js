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
     Pembina dipisahkan dari bagan struktur agar hierarki publik jelas.
     ========================================================= */
  const landingPengurus = document.getElementById("landing-pengurus-grid");
  const landingPembina = document.getElementById("landing-pembina-grid");
  if (landingPengurus || landingPembina) {
    const escapeHtml = (value) => String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");

    const inisial = (nama) => String(nama || "?")
      .trim().split(/\s+/).filter(Boolean).slice(0, 2)
      .map(k => k[0]).join("").toUpperCase() || "?";

    const orangHtml = (orang, compact = false) => `
      <div class="org-tree-person${compact ? " org-tree-person-compact" : ""}">
        <div class="org-tree-avatar">${escapeHtml(inisial(orang.nama))}</div>
        <div class="org-tree-role">${escapeHtml(orang.jabatan)}</div>
        <div class="org-tree-name">${escapeHtml(orang.nama)}</div>
      </div>`;

    const renderChip = (orang) => `
      <article class="pembina-card">
        <div class="pembina-card-accent" aria-hidden="true"></div>
        <div class="pembina-card-icon" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21a8 8 0 0 0-16 0"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
        <div class="pembina-card-copy">
          <div class="pembina-card-label">${escapeHtml(orang.jabatan || "Pembina PMR")}</div>
          <div class="pembina-card-name">${escapeHtml(orang.nama)}</div>
          <div class="pembina-card-desc">Mendampingi dan membina kegiatan PMR WIRA UNIT.</div>
        </div>
      </article>`;

    const renderPengurusPublik = (data) => {
      const jabatan = Array.isArray(data?.jabatan) ? data.jabatan : [];
      const normalized = jabatan.map(item => ({
        roleId: String(item?.role_id || ""),
        jabatan: String(item?.jabatan || "Jabatan"),
        anggota: Array.isArray(item?.anggota) ? item.anggota.filter(a => a && a.nama) : []
      }));

      const pembimbing = normalized.find(item => item.roleId === "pembimbing");
      if (landingPembina) {
        const people = pembimbing?.anggota || [];
        landingPembina.innerHTML = people.length
          ? people.map(renderChip).join("")
          : `<p class="org-empty">Data pembina belum tersedia.</p>`;
      }

      if (!landingPengurus) return;

      const byRole = (roleId) => normalized.find(item => item.roleId === roleId);
      const people = (item) => (item?.anggota || []).map(a => ({
        nama: a.nama,
        jabatan: item.jabatan
      }));

      const ketua = people(byRole("ketua"));
      const wakil = people(byRole("wakil"));
      const sekretaris = people(byRole("sekretaris"));
      const bendahara = people(byRole("bendahara"));

      const pjGroups = normalized
        .filter(item => item.roleId.startsWith("pj_") && item.anggota?.length)
        .map(item => ({
          roleId: item.roleId,
          jabatan: item.jabatan,
          anggota: people(item)
        }));

      if (!ketua.length && !wakil.length && !sekretaris.length && !bendahara.length && !pjGroups.length) {
        landingPengurus.innerHTML = `<div class="org-tree-empty"><strong>Struktur pengurus belum tersedia</strong><span>Susunan kepengurusan akan segera diperbarui.</span></div>`;
        return;
      }

      const coreGroup = (label, peopleList, modifier = "") => peopleList.length ? `
        <div class="org-tree-core-group ${modifier}">
          <div class="org-tree-core-label">${escapeHtml(label)}</div>
          <div class="org-tree-core-members">
            ${peopleList.map(orang => orangHtml(orang, true)).join("")}
          </div>
        </div>` : "";

      const pjGroup = (group) => `
        <section class="org-tree-pj-group" aria-label="${escapeHtml(group.jabatan)}">
          <div class="org-tree-pj-branch" aria-hidden="true"></div>
          <div class="org-tree-pj-label">${escapeHtml(group.jabatan)}</div>
          <div class="org-tree-pj-members">
            ${group.anggota.map(orang => orangHtml(orang, true)).join("")}
          </div>
        </section>`;

      landingPengurus.innerHTML = `
        ${ketua[0] ? `
          <div class="org-tree-level org-tree-level-top">
            ${orangHtml(ketua[0])}
          </div>` : ""}

        ${(wakil.length || sekretaris.length || bendahara.length) ? `
          <div class="org-tree-main-connector" aria-hidden="true"></div>
          <div class="org-tree-level org-tree-level-core">
            ${coreGroup("Wakil Ketua", wakil, "org-tree-core-wakil")}
            ${coreGroup("Sekretaris", sekretaris, "org-tree-core-sekretaris")}
            ${coreGroup("Bendahara", bendahara, "org-tree-core-bendahara")}
          </div>` : ""}

        ${pjGroups.length ? `
          <div class="org-tree-pj-connector" aria-hidden="true">
            <span></span>
          </div>
          <div class="org-tree-pj-heading">
            <span>Bidang Penanggung Jawab</span>
            <small>Setiap bidang dikelompokkan agar mudah dibaca.</small>
          </div>
          <div class="org-tree-pj-groups">
            ${pjGroups.map(pjGroup).join("")}
          </div>` : ""}`;
    };

    if (typeof FIREBASE_ENABLED !== "undefined" && FIREBASE_ENABLED && window.firebase?.firestore) {
      firebase.firestore().collection("pengurus").doc("struktur").get()
        .then(snap => renderPengurusPublik(snap.exists ? snap.data() : null))
        .catch(err => {
          console.error("[PMR] Gagal mengambil struktur pengurus publik:", err);
          if (landingPengurus) landingPengurus.innerHTML = `<div class="org-tree-empty"><strong>Struktur pengurus belum dapat dimuat</strong><span>Silakan coba muat ulang halaman.</span></div>`;
          if (landingPembina) landingPembina.innerHTML = `<p class="org-empty">Data pembina belum dapat dimuat.</p>`;
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
