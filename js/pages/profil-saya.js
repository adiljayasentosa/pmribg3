/* =========================================================
   PAGES/PROFIL-SAYA.JS (F3.2 — Halaman baru)
   =========================================================
   Khusus untuk role "anggota" (shared login). Karena satu akun
   dipakai bersama banyak siswa, halaman ini menyediakan pemilih
   profil (disimpan di localStorage per-browser, TIDAK menyentuh
   Firestore/AppState) agar anggota bisa melihat data dirinya
   sendiri dari collection `anggota` yang memang bisa mereka baca.

   Konflik yang perlu diketahui (lihat audit F3.2):
   Firestore Rules melarang role "anggota" membaca collection
   `presensi` — sehingga "Persentase Kehadiran" tidak bisa
   dihitung dari data asli. Bagian ini ditampilkan sebagai
   placeholder informatif, bukan angka palsu atau error teknis.
   ========================================================= */

const PROFIL_SAYA_KEY = "pmr_profil_saya_id";

function renderProfilSaya(el) {
  const idTersimpan = localStorage.getItem(PROFIL_SAYA_KEY);
  const profil = idTersimpan ? AppState.anggota.find(a => a.id === idTersimpan) : null;

  if (!profil) {
    _renderPemilihProfil(el);
    return;
  }

  _renderTampilanProfil(el, profil);
}

/* ─────────────────────────────────────────────────────────
   Tampilan: belum memilih profil → pencarian nama
───────────────────────────────────────────────────────── */
function _renderPemilihProfil(el) {
  el.innerHTML = `
  <div class="page-head">
    <div><h1>Profil Saya</h1><p class="page-sub">Pilih namamu untuk melihat data diri</p></div>
  </div>
  <div class="card" style="max-width:520px">
    <div class="card-title">🙋 Siapa Kamu?</div>
    <p style="font-size:0.88rem;color:var(--ink-soft);margin-bottom:16px">
      Akun ini digunakan bersama oleh seluruh anggota PMR. Pilih namamu di bawah
      untuk melihat data profil dan informasi keanggotaanmu.
    </p>
    <div class="search-bar" style="margin-bottom:14px">
      <svg class="search-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
      </svg>
      <input id="cari-profil-saya" type="search" placeholder="Ketik namamu…" autocomplete="off">
    </div>
    <div id="daftar-profil-saya" style="display:flex;flex-direction:column;gap:6px;max-height:320px;overflow-y:auto"></div>
  </div>`;

  const daftarEl = document.getElementById("daftar-profil-saya");

  function tampilkanDaftar(query = "") {
    const q = query.toLowerCase().trim();
    const hasil = q
      ? AppState.anggota.filter(a => a.nama.toLowerCase().includes(q))
      : AppState.anggota;

    if (hasil.length === 0) {
      daftarEl.innerHTML = `<div class="empty-state" style="padding:20px"><p>Nama tidak ditemukan.</p></div>`;
      return;
    }

    daftarEl.innerHTML = hasil.map(a => `
      <button class="btn btn-ghost btn-block pilih-profil-btn" data-id="${a.id}"
        style="justify-content:flex-start;gap:12px;padding:10px 12px;border-radius:var(--radius-sm);text-align:left">
        <div class="avatar" style="width:32px;height:32px;font-size:0.7rem;flex-shrink:0">${getInisial(a.nama)}</div>
        <div>
          <div style="font-weight:600;font-size:0.88rem">${a.nama}</div>
          <div style="font-size:0.75rem;color:var(--ink-soft)">${a.kelas} · ${a.divisi}</div>
        </div>
      </button>`).join("");

    daftarEl.querySelectorAll(".pilih-profil-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        localStorage.setItem(PROFIL_SAYA_KEY, btn.dataset.id);
        renderProfilSaya(el);
        tampilToast("Profil dipilih. Selamat datang!", "success");
      });
    });
  }

  tampilkanDaftar();
  document.getElementById("cari-profil-saya").addEventListener("input", (e) => tampilkanDaftar(e.target.value));
}

/* ─────────────────────────────────────────────────────────
   Tampilan: profil sudah dipilih → data diri lengkap
───────────────────────────────────────────────────────── */
function _renderTampilanProfil(el, profil) {
  el.innerHTML = `
  <div class="page-head">
    <div><h1>Profil Saya</h1><p class="page-sub">Informasi keanggotaan PMR</p></div>
    <button class="btn btn-outline btn-sm" id="btn-ganti-profil">🔄 Ganti Profil</button>
  </div>

  <div class="card" style="max-width:640px">
    <div class="detail-hero">
      <div class="avatar" style="width:54px;height:54px;font-size:1.2rem">${getInisial(profil.nama)}</div>
      <div>
        <div class="detail-nama">${profil.nama}</div>
        <div class="detail-kelas">${profil.kelas} · ${profil.divisi}</div>
      </div>
    </div>

    <div class="detail-info-grid">
      <div class="detail-info-item">
        <div class="lbl">Status Keanggotaan</div>
        <div class="val">${statusBadge(profil.status)}</div>
      </div>
      <div class="detail-info-item">
        <div class="lbl">Bergabung Sejak</div>
        <div class="val">${profil.bergabung ? formatTanggal(profil.bergabung) : "—"}</div>
      </div>
      <div class="detail-info-item">
        <div class="lbl">Kelas</div>
        <div class="val">${profil.kelas || "—"}</div>
      </div>
      <div class="detail-info-item">
        <div class="lbl">Divisi</div>
        <div class="val">${profil.divisi || "—"}</div>
      </div>
    </div>

    <div style="margin-top:18px;padding:16px;background:var(--gray-100);border-radius:var(--radius-md)">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
        <span style="font-size:1.1rem">📊</span>
        <strong style="font-size:0.9rem">Persentase Kehadiran</strong>
      </div>
      <p style="font-size:0.82rem;color:var(--ink-soft);margin:0">
        Data kehadiran individual belum tersedia untuk akun Anggota saat ini.
        Hubungi Sekretaris atau PJ Divisimu untuk informasi kehadiran terbaru.
      </p>
    </div>
  </div>`;

  document.getElementById("btn-ganti-profil").addEventListener("click", () => {
    Modal.konfirmasi("Ganti ke profil lain? Kamu perlu memilih nama lagi.", () => {
      localStorage.removeItem(PROFIL_SAYA_KEY);
      renderProfilSaya(el);
    });
  });
}
