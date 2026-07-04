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
    btnLogin && (btnLogin.style.display = "none");
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
});
