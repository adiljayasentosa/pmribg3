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

    /* [P0 HOTFIX] Sesi HARUS selalu LOCAL, apa pun status checkbox
       "Ingat saya". Sebelumnya kode ini men-set SESSION persistence
       kalau checkbox tidak dicentang (dan checkbox tidak dicentang
       secara default di login.html) — SESSION tidak bertahan saat
       proses TWA di-kill & dibuka ulang oleh Android, jadi user yang
       tidak sengaja mencentang "Ingat saya" ter-logout sendiri setiap
       kali reopen app. Ini melanggar aturan P0: "Logout harus jadi
       satu-satunya aksi yang menghapus autentikasi". Checkbox "Ingat
       saya" dibiarkan ada di UI (tidak redesign), tapi sudah tidak
       memengaruhi persistence lagi. */
    if (FIREBASE_ENABLED) {
      await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    }

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

  /* [F6.0] Lupa Password — pakai fitur bawaan Firebase Auth
     (sendPasswordResetEmail), pola email sama seperti login()
     di auth.js ({username}@pmr-smkibg3.app). Tidak mengubah
     Authentication yang sudah ada, hanya memanggil API tambahan. */
  document.getElementById("btn-lupa-password")?.addEventListener("click", async () => {
    if (!FIREBASE_ENABLED) {
      showError("Reset password tersedia setelah aplikasi terhubung ke Firebase.");
      return;
    }
    const username = (document.getElementById("input-username").value || prompt("Masukkan username akunmu:") || "").trim().toLowerCase();
    if (!username) return;
    try {
      await firebase.auth().sendPasswordResetEmail(`${username}@pmr-smkibg3.app`);
      errEl.className = "alert";
      showError("Tautan reset password sudah dikirim. Silakan cek email terdaftar akunmu.");
    } catch (e) {
      showError("Gagal mengirim reset password. Pastikan username sudah benar.");
    }
  });

  /* ── Demo: isi otomatis ── */
  document.getElementById("demo-fill")?.addEventListener("click", () => {
    document.getElementById("input-username").value = selectedRole;
    document.getElementById("input-password").value =
      selectedRole === "sekretaris" ? "sekre123" :
      selectedRole === "bendahara"  ? "bendahara123" :
      `${selectedRole}123`;
  });
});
