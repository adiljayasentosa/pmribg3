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
  const isAdmin = user.role === "admin";
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
    ${isAdmin ? `
    <div class="card" style="grid-column:span 2">
      <div class="card-title">Backup Data</div>
      <p style="margin-top:0;color:var(--ink-soft);font-size:0.85rem">
        Unduh salinan seluruh data penting sistem (anggota, kegiatan, keuangan, presensi,
        piket, petugas upacara, inventaris, pengurus, artikel, video, poster, dokumentasi,
        dan daftar akun) dalam satu file JSON. Tidak menyertakan password/credential apa pun.
        Fitur ini khusus admin — diverifikasi ulang oleh server, bukan hanya disembunyikan di
        tampilan (lihat <code>api/backup-verify.js</code>).
      </p>
      ${FIREBASE_ENABLED ? `
        <button class="btn btn-primary btn-sm" id="btn-download-backup">⬇ Download Backup</button>
        <div id="backup-status" style="margin-top:10px;font-size:0.85rem"></div>
      ` : `
        <div class="alert alert-info" style="display:flex">
          Backup Data butuh Firebase aktif — tidak tersedia di Mode Demo.
        </div>
      `}
    </div>` : ""}
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

  document.getElementById("btn-download-backup")?.addEventListener("click", () => _jalankanDownloadBackup());
}

/* ─────────────────────────────────────────────────────────
   BACKUP DATA (F4.5) — admin-only, diverifikasi server
   (api/backup-verify.js). Client HANYA mengirim ID Token &
   memicu download; TIDAK pernah membaca Firestore langsung
   untuk keperluan backup (supaya proteksi admin-only benar-
   benar di server, bukan cuma disembunyikan di UI — lihat
   catatan Phase 1/2).
───────────────────────────────────────────────────────── */
async function _jalankanDownloadBackup() {
  const btn = document.getElementById("btn-download-backup");
  const status = document.getElementById("backup-status");
  if (!btn) return;
  const teksAsli = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Memproses…";
  if (status) { status.style.color = "var(--ink-soft)"; status.textContent = "Memverifikasi & mengambil data…"; }

  try {
    const idToken = await firebase.auth().currentUser.getIdToken();
    const res = await fetch("/api/backup-verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `Gagal (HTTP ${res.status}).`);

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    const d    = new Date();
    const p    = n => String(n).padStart(2, "0");
    a.href = url;
    a.download = `backup-pmr-wira-unit-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    if (status) { status.style.color = "var(--success)"; status.textContent = "Backup berhasil diunduh."; }
    tampilToast("Backup berhasil dibuat & diunduh.", "success");
  } catch (e) {
    console.error("[PMR] Backup error:", e);
    if (status) { status.style.color = "var(--danger)"; status.textContent = "Gagal: " + e.message; }
    tampilToast("Gagal membuat backup: " + e.message, "danger");
  } finally {
    btn.disabled = false;
    btn.textContent = teksAsli;
  }
}
