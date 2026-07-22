/* =========================================================
   PAGES/PENGATURAN.JS
   Diekstrak dari dashboard.js (Fase 3 — modularisasi).
   Tidak ada perubahan logika, hanya pemindahan lokasi.
   ========================================================= */

/* ─────────────────────────────────────────────────────────
   PENGATURAN
───────────────────────────────────────────────────────── */
function renderPengaturan(el, user) {
  const rc = ROLES[user.role]||{label:user.role,badge:"badge-gray"};
  el.innerHTML = `
  <div class="page-head">
    <div><h1>Pengaturan</h1><p class="page-sub">Preferensi akun · ${FIREBASE_ENABLED?"🔴 Firebase aktif":"📦 Mode Demo"}</p></div>
  </div>
  <div class="grid grid-2">
    <div class="card">
      <div class="card-title">Profil Akun</div>
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
        <div class="avatar" style="width:52px;height:52px;font-size:1.1rem">${getInisial(user.nama)}</div>
        <div><div style="font-weight:700">${user.nama}</div><span class="badge ${rc.badge}">${rc.label}</span></div>
      </div>
      <div class="field"><label>Nama Lengkap</label><input type="text" id="pref-nama" value="${user.nama}"></div>
      <div class="field">
        <label>Username</label>
        <input type="text" value="${user.username}" disabled style="opacity:.6;cursor:not-allowed">
        <div class="field-hint">Username tidak dapat diubah.</div>
      </div>
      <button class="btn btn-primary btn-sm" id="btn-simpan-profil">Simpan Perubahan</button>
    </div>
    <div class="card">
      <div class="card-title">Ubah Password</div>
      <div class="field"><label>Password Lama</label><input type="password" id="pw-lama" placeholder="••••••••"></div>
      <div class="field"><label>Password Baru</label><input type="password" id="pw-baru" placeholder="••••••••"></div>
      <div class="field"><label>Konfirmasi</label><input type="password" id="pw-konfirm" placeholder="••••••••"></div>
      <div id="pw-error" class="alert alert-danger" style="display:none"></div>
      <button class="btn btn-primary btn-sm" id="btn-ubah-pw">Ubah Password</button>
    </div>
  </div>`;

  document.getElementById("btn-simpan-profil")?.addEventListener("click",()=>
    tampilToast(FIREBASE_ENABLED?"Update profil akan tersedia via Firebase.":"Profil diperbarui (demo).","success"));
  document.getElementById("btn-ubah-pw")?.addEventListener("click",()=>{
    const baru=document.getElementById("pw-baru").value;
    const konfirm=document.getElementById("pw-konfirm").value;
    const err=document.getElementById("pw-error");
    if (baru!==konfirm){err.textContent="Password baru tidak cocok.";err.style.display="flex";return;}
    err.style.display="none";
    tampilToast(FIREBASE_ENABLED?"Ubah password via Firebase Auth.":"Password diubah (demo).","success");
  });
}
