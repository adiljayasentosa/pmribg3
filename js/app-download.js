/* =========================================================
   APP-DOWNLOAD.JS — Public Pages Enhancement (Phase 3)
   =========================================================
   Section promosi + download APK di Beranda publik.
   TIDAK menyentuh Firebase/Firestore/Auth/Service Worker/Hero/
   Dashboard — murni UI tambahan yang berdiri sendiri.
   ========================================================= */

/* ── Konfigurasi: ganti URL ini kalau link Google Drive berubah ── */
const APK_DOWNLOAD_URL = "https://drive.google.com/file/d/1mP91n7SFD7JNSr5EvVfzQrKTb0hi91nP/view?usp=drivesdk";

document.addEventListener("DOMContentLoaded", () => {
  const btnDownload = document.getElementById("btn-app-download");
  const btnOpenWebsite = document.getElementById("btn-app-open-website");

  btnDownload?.addEventListener("click", () => {
    if (typeof Modal === "undefined") {
      // fallback jaring pengaman kalau Modal.js entah kenapa tidak termuat
      window.open(APK_DOWNLOAD_URL, "_blank");
      return;
    }
    Modal.buka({
      judul: "Cara Install Aplikasi",
      konten: `
        <ol class="app-install-steps">
          <li>Download APK.</li>
          <li>Buka file APK yang sudah diunduh.</li>
          <li>Jika Android meminta izin, aktifkan "Install aplikasi dari sumber ini".</li>
          <li>Install aplikasi.</li>
          <li>Selesai — buka aplikasi PMR WIRA dari layar utama.</li>
        </ol>
      `,
      aksi: [
        { label: "Tutup", kelas: "btn-ghost", id: "modal-install-tutup", onClick: () => Modal.tutup() },
        {
          label: "Download Sekarang", kelas: "btn-primary", id: "modal-install-download",
          onClick: () => window.open(APK_DOWNLOAD_URL, "_blank")
        }
      ]
    });
  });

  btnOpenWebsite?.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  /* Reveal-on-scroll — scoped hanya ke elemen berclass .app-reveal
     di dalam #app-download, tidak memengaruhi section lain. */
  const revealTargets = document.querySelectorAll("#app-download .app-reveal");
  if (revealTargets.length && "IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealTargets.forEach((el) => revealObserver.observe(el));
  } else {
    revealTargets.forEach((el) => el.classList.add("is-visible"));
  }
});
