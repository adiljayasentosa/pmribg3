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
      <div class="card-title">Backup & Restore Data</div>
      <p style="margin-top:0;color:var(--ink-soft);font-size:0.85rem">
        Backup menyimpan data sistem dalam JSON versi terkontrol. Restore hanya bisa dilakukan
        oleh admin, selalu diawali preview perubahan, dan membutuhkan sesi admin yang masih baru.
        Sebelum restore, sistem akan membuat backup kondisi saat ini agar bisa disimpan sebagai
        cadangan darurat. Password akun Firebase <strong>tidak</strong> ikut dipulihkan.
      </p>
      ${FIREBASE_ENABLED ? `
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          <button class="btn btn-primary btn-sm" id="btn-download-backup">⬇ Download Backup</button>
          <button class="btn btn-outline btn-sm" id="btn-restore-backup">↶ Restore Backup</button>
          <input type="file" id="input-restore-backup" accept="application/json,.json" hidden>
        </div>
        <div id="backup-status" style="margin-top:10px;font-size:0.85rem"></div>
        <div id="restore-preview" style="display:none;margin-top:12px"></div>
      ` : `
        <div class="alert alert-info" style="display:flex">
          Backup & Restore butuh Firebase aktif — tidak tersedia di Mode Demo.
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
  document.getElementById("btn-restore-backup")?.addEventListener("click", () =>
    document.getElementById("input-restore-backup")?.click());
  document.getElementById("input-restore-backup")?.addEventListener("change", (e) =>
    _pilihFileRestore(e.target.files?.[0]));
}

/* ─────────────────────────────────────────────────────────
   BACKUP DATA (F4.5) — admin-only, diverifikasi server
   (api/backup-verify.js). Client HANYA mengirim ID Token &
   memicu download; TIDAK pernah membaca Firestore langsung
   untuk keperluan backup (supaya proteksi admin-only benar-
   benar di server, bukan cuma disembunyikan di UI — lihat
   catatan Phase 1/2).
───────────────────────────────────────────────────────── */
async function _parseApiJson(res, label = "Permintaan") {
  const raw = await res.text();
  let data = null;
  if (raw.trim()) {
    try { data = JSON.parse(raw); }
    catch (_) {
      const preview = raw.replace(/\s+/g, " ").slice(0, 220);
      throw new Error(`${label} mengembalikan respons tidak valid (HTTP ${res.status}).${preview ? ` Respons: ${preview}` : ""}`);
    }
  }
  if (!res.ok) {
    throw new Error(data?.error || `${label} gagal (HTTP ${res.status}).`);
  }
  if (data === null) throw new Error(`${label} gagal: server mengembalikan respons kosong (HTTP ${res.status}).`);
  return data;
}

async function _ambilBackupServer() {
  const idToken = await firebase.auth().currentUser.getIdToken();
  const res = await fetch("/api/backup-verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken })
  });
  const data = await _parseApiJson(res, "Backup");
  return { data, idToken };
}

function _downloadJson(data, prefix) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const d = new Date();
  const p = n => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  a.href = url;
  a.download = `${prefix}-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function _jalankanDownloadBackup({ silent = false, prefix = "backup-pmr-wira-unit" } = {}) {
  const btn = document.getElementById("btn-download-backup");
  const status = document.getElementById("backup-status");
  if (!btn && !silent) return null;
  const teksAsli = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = "Memproses…"; }
  if (status) { status.style.color = "var(--ink-soft)"; status.textContent = "Memverifikasi & mengambil data…"; }

  try {
    const { data } = await _ambilBackupServer();
    _downloadJson(data, prefix);
    if (status) { status.style.color = "var(--success)"; status.textContent = "Backup berhasil dibuat & diunduh."; }
    if (!silent) tampilToast("Backup berhasil dibuat & diunduh.", "success");
    return data;
  } catch (e) {
    console.error("[PMR] Backup error:", e);
    if (status) { status.style.color = "var(--danger)"; status.textContent = "Gagal: " + e.message; }
    if (!silent) tampilToast("Gagal membuat backup: " + e.message, "danger");
    throw e;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = teksAsli; }
  }
}

function _formatRestoreSummary(result) {
  const rows = Object.entries(result.summary || {}).map(([nama, x]) => `
    <tr>
      <td>${nama}</td><td>${x.current}</td><td>${x.backup}</td>
      <td>${x.added}</td><td>${x.updated}</td><td>${x.deleted}</td>
    </tr>`).join("");
  return `
    <div class="alert alert-warning" style="display:flex;flex-direction:column;gap:6px">
      <strong>Preview Restore</strong>
      <span>${result.documentCount} dokumen akan diselaraskan. Tambah: <b>${result.totals.added}</b> · Ubah: <b>${result.totals.updated}</b> · Hapus: <b>${result.totals.deleted}</b>.</span>
      <span>Restore penuh menghapus dokumen di collection yang tidak ada pada backup. Operasi lintas collection tidak atomik.</span>
    </div>
    <div style="overflow:auto;margin-top:8px">
      <table style="width:100%;border-collapse:collapse;font-size:.82rem">
        <thead><tr><th>Collection</th><th>Saat ini</th><th>Backup</th><th>Tambah</th><th>Ubah</th><th>Hapus</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
      <button class="btn btn-danger btn-sm" id="btn-confirm-restore">⚠ Restore Data Ini</button>
      <button class="btn btn-outline btn-sm" id="btn-cancel-restore">Batal</button>
    </div>`;
}

async function _pilihFileRestore(file) {
  const input = document.getElementById("input-restore-backup");
  const status = document.getElementById("backup-status");
  const preview = document.getElementById("restore-preview");
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) {
    tampilToast("File backup terlalu besar. Batas lokal 8 MB.", "danger");
    if (input) input.value = "";
    return;
  }

  try {
    if (status) { status.style.color = "var(--ink-soft)"; status.textContent = "Membaca & memvalidasi backup…"; }
    const backup = JSON.parse(await file.text());
    if (!backup?.collections || typeof backup.collections !== "object") throw new Error("Format backup tidak dikenali.");

    /* Safety first: kondisi Firestore saat ini dibuatkan backup terpisah
       dan diunduh sebelum preview/restore dilanjutkan. */
    if (status) status.textContent = "Membuat safety backup sebelum restore…";
    await _jalankanDownloadBackup({ silent: true, prefix: "safety-before-restore-pmr" });

    const idToken = await firebase.auth().currentUser.getIdToken();
    if (status) status.textContent = "Menghitung perubahan restore…";
    const res = await fetch("/api/backup-restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, action: "preview", backup })
    });
    const result = await _parseApiJson(res, "Preview restore");

    if (preview) {
      preview.innerHTML = _formatRestoreSummary(result);
      preview.style.display = "block";
      preview.querySelector("#btn-cancel-restore")?.addEventListener("click", () => {
        preview.style.display = "none";
        preview.innerHTML = "";
      });
      preview.querySelector("#btn-confirm-restore")?.addEventListener("click", async () => {
        await _konfirmasiRestore(backup, result.confirmToken);
      });
    }
    if (status) { status.style.color = "var(--success)"; status.textContent = "Preview restore siap. Safety backup sudah diunduh."; }
  } catch (e) {
    console.error("[PMR] Restore preview error:", e);
    if (status) { status.style.color = "var(--danger)"; status.textContent = "Restore gagal: " + e.message; }
    tampilToast("Restore tidak dilanjutkan: " + e.message, "danger");
  } finally {
    if (input) input.value = "";
  }
}

async function _konfirmasiRestore(backup, confirmToken) {
  const status = document.getElementById("backup-status");
  const preview = document.getElementById("restore-preview");
  if (!confirm("Restore akan MENYELARASKAN data Firestore dengan backup dan menghapus dokumen yang tidak ada di backup. Safety backup sudah dibuat. Lanjutkan?")) return;

  try {
    if (status) { status.style.color = "var(--ink-soft)"; status.textContent = "Menjalankan restore… jangan tutup halaman."; }
    const idToken = await firebase.auth().currentUser.getIdToken();
    const res = await fetch("/api/backup-restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, action: "restore", backup, confirmToken })
    });
    const result = await _parseApiJson(res, "Restore");

    if (preview) { preview.style.display = "none"; preview.innerHTML = ""; }
    if (status) { status.style.color = "var(--success)"; status.textContent = `Restore selesai. ${result.written} dokumen ditulis, ${result.deleted} dokumen dihapus.`; }
    tampilToast("Restore berhasil. Halaman akan dimuat ulang.", "success");
    setTimeout(() => window.location.reload(), 1200);
  } catch (e) {
    console.error("[PMR] Restore error:", e);
    if (status) { status.style.color = "var(--danger)"; status.textContent = "Restore gagal: " + e.message; }
    tampilToast("Restore gagal: " + e.message, "danger");
  }
}

