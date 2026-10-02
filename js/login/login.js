/* =========================================================
   AUTH PAGE LOGIC — v1.1.58
   Login menggunakan username + password.
   Role ditentukan dari profil Firebase/Firestore, bukan pilihan user.
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  initAuth(
    () => { window.location.href = "dashboard.html"; },
    () => { /* belum login */ }
  );

  const form = document.getElementById("login-form");
  const errEl = document.getElementById("login-error");
  const errMsg = document.getElementById("login-error-msg");
  const btnSubmit = document.getElementById("btn-login");
  const password = document.getElementById("input-password");

  document.getElementById("btn-toggle-password")?.addEventListener("click", (e) => {
    const btn = e.currentTarget;
    const visible = password.type === "text";
    password.type = visible ? "password" : "text";
    btn.textContent = visible ? "◉" : "◌";
    btn.setAttribute("aria-label", visible ? "Tampilkan password" : "Sembunyikan password");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("input-username").value.trim();
    const pass = password.value;
    if (!username || !pass) return showError("Mohon isi username dan password.");

    clearError();
    btnSubmit.disabled = true;
    btnSubmit.textContent = "Memeriksa…";

    if (FIREBASE_ENABLED) await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    const result = await login(username, pass);

    if (result.ok) {
      try { await logActivity("Login", "Login berhasil"); } catch (_) {}
      btnSubmit.textContent = "✓ Berhasil!";
      setTimeout(() => (window.location.href = "dashboard.html"), 350);
    } else {
      showError(result.message || "Login gagal.");
      btnSubmit.disabled = false;
      btnSubmit.textContent = "Login";
    }
  });

  function showError(msg) {
    if (errMsg) errMsg.textContent = msg;
    errEl.style.display = "flex";
  }
  function clearError() { errEl.style.display = "none"; if (errMsg) errMsg.textContent = ""; }

  document.getElementById("btn-lupa-password")?.addEventListener("click", async () => {
    if (!FIREBASE_ENABLED) return showError("Reset password tersedia setelah aplikasi terhubung ke Firebase.");
    const username = (document.getElementById("input-username").value || prompt("Masukkan username akunmu:") || "").trim().toLowerCase();
    if (!username) return;
    try {
      const lookup = await fetch("/api/auth", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({action:'lookup',username}) });
      const data = await lookup.json().catch(()=>({}));
      if (!lookup.ok || !data.email) throw new Error("Username tidak ditemukan.");
      await firebase.auth().sendPasswordResetEmail(data.email);
      errEl.className = "alert";
      showError("Tautan reset password sudah dikirim ke email terdaftar.");
    } catch (_) {
      errEl.className = "alert alert-danger";
      showError("Gagal mengirim reset password. Pastikan username sudah benar.");
    }
  });
});
