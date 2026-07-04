/* =========================================================
   AUTH PAGE LOGIC — v2 (async login untuk Firebase)
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  /* Kalau sudah login, langsung ke dashboard */
  initAuth(
    () => { window.location.href = "dashboard.html"; },
    () => { /* belum login — tampilkan form */ }
  );

  let selectedRole = "ketua";

  /* ── Pilihan role ── */
  document.querySelectorAll(".role-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      document.querySelectorAll(".role-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      selectedRole = pill.dataset.role;
    });
  });

  /* ── Form submit (async) ── */
  const form    = document.getElementById("login-form");
  const errEl   = document.getElementById("login-error");
  const btnSubmit = document.getElementById("btn-login");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("input-username").value.trim();
    const password = document.getElementById("input-password").value;

    if (!username || !password) {
      showError("Mohon isi username dan password.");
      return;
    }

    errEl.style.display = "none";
    btnSubmit.disabled = true;
    btnSubmit.textContent = "Masuk…";

    const result = await login(username, password, selectedRole);

    if (result.ok) {
      btnSubmit.textContent = "✓ Berhasil!";
      setTimeout(() => (window.location.href = "dashboard.html"), 400);
    } else {
      showError(result.message || "Login gagal.");
      btnSubmit.disabled = false;
      btnSubmit.textContent = "Masuk";
    }
  });

  function showError(msg) {
    errEl.textContent = msg;
    errEl.style.display = "flex";
  }

  /* ── Demo: isi otomatis ── */
  document.getElementById("demo-fill")?.addEventListener("click", () => {
    document.getElementById("input-username").value = selectedRole;
    document.getElementById("input-password").value =
      selectedRole === "sekretaris" ? "sekre123" :
      selectedRole === "bendahara"  ? "bendahara123" :
      `${selectedRole}123`;
  });
});
