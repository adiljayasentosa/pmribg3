/* =========================================================
   PAGES/PEMBINA.JS
   Dashboard satu halaman khusus role Pembina.
   Read-only: tidak menyediakan CRUD administrasi.
   ========================================================= */

function _pembinaEsc(value) {
  return String(value ?? "—")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function _pembinaActiveMembers() {
  return AppState.anggota.filter(a =>
    String(a.statusKeanggotaan || a.status || "Aktif").trim().toLowerCase() === "aktif"
  );
}

function _pembinaUpcomingActivities(limit = 4) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return [...AppState.kegiatan]
    .filter(k => k.tanggal && new Date(k.tanggal) >= today && String(k.status || "").toLowerCase() !== "selesai")
    .sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)))
    .slice(0, limit);
}

function _pembinaAttendanceSummary() {
  const records = Array.isArray(AppState.presensiHistory) ? AppState.presensiHistory : [];
  if (!records.length) return { total: 0, hadir: 0, rate: 0 };
  const hadir = records.filter(p => p.hadir || String(p.status || "").toLowerCase() === "hadir").length;
  return { total: records.length, hadir, rate: Math.round((hadir / records.length) * 100) };
}

function _pembinaLatestActivities(limit = 5) {
  return [...AppState.kegiatan]
    .filter(k => k.tanggal)
    .sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)))
    .slice(0, limit);
}

function _pembinaInventoryAttention() {
  const items = Array.isArray(AppState.inventaris) ? AppState.inventaris : [];
  const keywords = /(rusak|habis|kurang|perlu|servis|perbaikan|hilang|buruk)/i;
  return items.filter(item => keywords.test(String(item.status || "")) || keywords.test(String(item.kondisi || ""))).slice(0, 4);
}

function _pembinaFinanceSummary() {
  const rows = Array.isArray(AppState.keuangan) ? AppState.keuangan : [];
  const masuk = rows.filter(t => t.jenis === "Masuk").reduce((s, t) => s + (+t.jumlah || 0), 0);
  const keluar = rows.filter(t => t.jenis === "Keluar").reduce((s, t) => s + (+t.jumlah || 0), 0);
  return { masuk, keluar, saldo: Math.max(0, masuk - keluar) };
}

function _pembinaStrukturSummary() {
  const struktur = Array.isArray(AppState.strukturPengurus) ? AppState.strukturPengurus : [];
  const jabatanTerisi = struktur.filter(j => Array.isArray(j.anggota) && j.anggota.length).length;
  const totalJabatan = struktur.length;
  const pj = struktur.filter(j => String(j.role_id || "").startsWith("pj_")).reduce((n, j) => n + (j.anggota?.length || 0), 0);
  const pembimbing = struktur.find(j => j.role_id === "pembimbing");
  return { jabatanTerisi, totalJabatan, pj, pembimbing };
}

function renderPembina(el, user) {
  if (user?.role !== "pembina") {
    el.innerHTML = `<div class="alert alert-danger" style="display:flex">Halaman ini khusus untuk akun Pembina.</div>`;
    return;
  }

  const active = _pembinaActiveMembers();
  const total = AppState.anggota.length;
  const inactive = Math.max(0, total - active.length);
  const upcoming = _pembinaUpcomingActivities();
  const latest = _pembinaLatestActivities();
  const attendance = _pembinaAttendanceSummary();
  const finance = _pembinaFinanceSummary();
  const structure = _pembinaStrukturSummary();
  const attention = _pembinaInventoryAttention();

  const kelasX = active.filter(a => /^X\b/i.test(String(a.kelas || "").trim())).length;
  const currentPeriod = AppState.periode || "2025/2026";

  el.innerHTML = `
    <div class="pembina-page">
      <section class="pembina-hero">
        <div>
          <div class="pembina-eyebrow">LIMITED EDITION · PEMBINA PMR</div>
          <h1>Selamat datang, ${_pembinaEsc(user.nama)} 👋</h1>
          <p>Masa Bakti ${_pembinaEsc(currentPeriod)} · Ruang pemantauan PMR WIRA UNIT SMK IBG 3</p>
        </div>
        <button type="button" class="btn btn-outline btn-sm pembina-logout" id="btn-pembina-logout">Keluar</button>
      </section>

      <section class="pembina-stat-grid" aria-label="Ringkasan PMR">
        <div class="card pembina-stat-card"><span class="pembina-stat-icon">👥</span><strong>${active.length}</strong><span>Anggota aktif</span><small>${inactive} tidak aktif dari ${total} total</small></div>
        <div class="card pembina-stat-card"><span class="pembina-stat-icon">📅</span><strong>${upcoming.length}</strong><span>Kegiatan terdekat</span><small>${AppState.kegiatan.length} kegiatan tercatat</small></div>
        <div class="card pembina-stat-card"><span class="pembina-stat-icon">✓</span><strong>${attendance.rate}%</strong><span>Kehadiran tercatat</span><small>${attendance.total} record presensi</small></div>
        <div class="card pembina-stat-card"><span class="pembina-stat-icon">🌱</span><strong>${kelasX}</strong><span>Anggota kelas X aktif</span><small>Indikator regenerasi awal</small></div>
      </section>

      <section class="pembina-grid pembina-grid-main">
        <div class="card pembina-section-card">
          <div class="pembina-section-head"><div><h2>Kegiatan Terdekat</h2><p>Agenda yang perlu diketahui Pembina.</p></div><span class="pembina-count">${upcoming.length}</span></div>
          ${upcoming.length ? `<div class="pembina-list">${upcoming.map(k => `
            <div class="pembina-list-item">
              <div class="pembina-date"><strong>${_pembinaEsc(new Date(k.tanggal).getDate())}</strong><span>${_pembinaEsc(new Date(k.tanggal).toLocaleDateString("id-ID", {month:"short"}))}</span></div>
              <div><strong>${_pembinaEsc(k.nama)}</strong><p>${_pembinaEsc(k.lokasi || "Lokasi belum ditentukan")} · ${_pembinaEsc(k.pj || "PJ belum ditentukan")}</p></div>
            </div>`).join("")}</div>` : `<div class="pembina-empty">Belum ada kegiatan mendatang.</div>`}
        </div>

        <div class="card pembina-section-card">
          <div class="pembina-section-head"><div><h2>Kondisi Organisasi</h2><p>Gambaran singkat yang relevan untuk pemantauan.</p></div></div>
          <div class="pembina-mini-grid">
            <div><strong>${structure.jabatanTerisi}/${structure.totalJabatan}</strong><span>Jabatan terisi</span></div>
            <div><strong>${structure.pj}</strong><span>PJ divisi aktif</span></div>
            <div><strong>${finance.saldo ? formatRupiah(finance.saldo) : "Rp 0"}</strong><span>Saldo kas</span></div>
            <div><strong>${attention.length}</strong><span>Inventaris perlu perhatian</span></div>
          </div>
          <div class="pembina-note"><strong>Pembina terdaftar</strong><span>${_pembinaEsc(structure.pembimbing?.anggota?.[0]?.nama || user.nama)}</span></div>
        </div>
      </section>

      <section class="pembina-grid">
        <div class="card pembina-section-card">
          <div class="pembina-section-head"><div><h2>Presensi</h2><p>Ringkasan record presensi yang tersedia.</p></div></div>
          <div class="pembina-attendance">
            <div class="pembina-attendance-ring"><strong>${attendance.rate}%</strong><span>Hadir</span></div>
            <div class="pembina-attendance-copy"><strong>${attendance.hadir} dari ${attendance.total}</strong><span>record tercatat sebagai hadir</span><small>Angka ini mengikuti data presensi yang tersimpan, bukan prediksi kehadiran.</small></div>
          </div>
        </div>

        <div class="card pembina-section-card">
          <div class="pembina-section-head"><div><h2>Keuangan</h2><p>Ringkasan kas, tanpa akses edit.</p></div></div>
          <div class="pembina-finance-row"><div><span>Pemasukan tercatat</span><strong>${formatRupiah(finance.masuk)}</strong></div><div><span>Pengeluaran tercatat</span><strong>${formatRupiah(finance.keluar)}</strong></div><div class="pembina-finance-total"><span>Saldo</span><strong>${formatRupiah(finance.saldo)}</strong></div></div>
        </div>
      </section>

      <section class="pembina-grid">
        <div class="card pembina-section-card">
          <div class="pembina-section-head"><div><h2>Perkembangan Terbaru</h2><p>Kegiatan terakhir yang tercatat di sistem.</p></div></div>
          ${latest.length ? `<div class="pembina-timeline">${latest.map(k => `<div class="pembina-timeline-item"><span></span><div><strong>${_pembinaEsc(k.nama)}</strong><p>${formatTanggal(k.tanggal)} · ${_pembinaEsc(k.status || "Tanpa status")}</p></div></div>`).join("")}</div>` : `<div class="pembina-empty">Belum ada kegiatan tercatat.</div>`}
        </div>

        <div class="card pembina-section-card">
          <div class="pembina-section-head"><div><h2>Inventaris</h2><p>Hal yang mungkin perlu diperhatikan.</p></div></div>
          ${attention.length ? `<div class="pembina-list compact">${attention.map(item => `<div class="pembina-list-item compact"><span class="pembina-list-dot">!</span><div><strong>${_pembinaEsc(item.nama || item.barang || "Barang")}</strong><p>${_pembinaEsc(item.status || item.kondisi || "Perlu diperiksa")}</p></div></div>`).join("")}</div>` : `<div class="pembina-ok"><span>✓</span><div><strong>Tidak ada perhatian khusus</strong><p>Belum ada item inventaris yang terdeteksi perlu perhatian dari data yang tersedia.</p></div></div>`}
        </div>
      </section>

      <section class="pembina-appreciation">
        <div><span class="pembina-eyebrow">SPECIAL ACCESS</span><h2>Ruang khusus Pembina</h2><p>Dashboard ini dibuat sebagai tampilan pemantauan satu halaman. Data utama tetap dikelola oleh pengurus sesuai kewenangannya.</p></div>
        <div class="pembina-appreciation-mark">✚</div>
      </section>
    </div>`;

  document.getElementById("btn-pembina-logout")?.addEventListener("click", () => {
    Modal.konfirmasi("Yakin ingin keluar dari sesi Pembina?", () => {
      DB.stopListeners();
      logout();
    });
  });
}
