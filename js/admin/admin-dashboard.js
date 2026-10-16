/* =========================================================
   ADMIN DASHBOARD — one-page system overview
   Fokus: kesehatan sistem, Firebase usage, activity, users.
   Hak edit tetap mengikuti role/RBAC pada modul masing-masing.
   ========================================================= */

function _adminDashEsc(v) {
  return String(v ?? "—").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

function _adminDashNum(v) {
  return Number(v || 0).toLocaleString("id-ID");
}

function _adminDashRoleLabel(role) {
  return ROLES?.[role]?.label || role || "—";
}

async function renderAdminDashboard(el, user) {
  if (!user || user.role !== "admin") {
    el.innerHTML = `<div class="alert alert-danger" style="display:flex">Dashboard Admin hanya dapat diakses oleh akun Admin.</div>`;
    return;
  }

  const r = AppState.ringkasan || {};
  const activeMembers = Number(r.anggotaAktif || 0);
  const totalMembers = Number(r.totalAnggota || AppState.anggota?.length || 0);
  const upcoming = Array.isArray(AppState.kegiatan) ? AppState.kegiatan.filter(k => new Date(k.tanggal) >= new Date()).length : 0;
  const kas = Number(r.kasSaldo || 0);
  const hadir = Number(r.kehadiranRata || 0);

  el.innerHTML = `
    <div class="admin-dashboard-page">
      <section class="admin-dashboard-hero">
        <div>
          <div class="admin-dashboard-eyebrow">SYSTEM ADMINISTRATION · PMR WIRA UNIT</div>
          <h1>Selamat datang, ${_adminDashEsc(user.nama)} 👋</h1>
          <p>Monitor kondisi sistem, penggunaan Firebase, aktivitas pengguna, dan data organisasi dari satu halaman.</p>
        </div>
        <div class="admin-dashboard-status"><span></span><strong>Sistem Online</strong><small>${new Date().toLocaleString("id-ID", {dateStyle:"medium", timeStyle:"short"})}</small></div>
      </section>

      <section class="admin-dashboard-stat-grid">
        <div class="card admin-dashboard-stat"><span class="admin-dash-icon">👥</span><strong id="admin-total-users">${_adminDashNum(totalMembers)}</strong><span>Total anggota</span><small>${_adminDashNum(activeMembers)} aktif</small></div>
        <div class="card admin-dashboard-stat"><span class="admin-dash-icon">📅</span><strong>${_adminDashNum(upcoming)}</strong><span>Kegiatan mendatang</span><small>${_adminDashNum(AppState.kegiatan?.length || 0)} kegiatan tercatat</small></div>
        <div class="card admin-dashboard-stat"><span class="admin-dash-icon">💰</span><strong>${formatRupiah(kas)}</strong><span>Saldo kas</span><small>Ringkasan organisasi</small></div>
        <div class="card admin-dashboard-stat"><span class="admin-dash-icon">✓</span><strong>${_adminDashNum(hadir)}%</strong><span>Rata-rata hadir</span><small>Dari data presensi</small></div>
      </section>

      <section class="admin-dashboard-grid admin-dashboard-grid-main">
        <div class="card admin-dashboard-card admin-usage-card">
          <div class="admin-dashboard-card-head"><div><h2>Penggunaan Firebase</h2><p>Firestore · 24 jam terakhir</p></div><span class="admin-live-dot">● Real-time</span></div>
          <div class="admin-usage-grid">
            <div><span>Reads</span><strong id="admin-usage-reads">—</strong><small>dokumen dibaca</small></div>
            <div><span>Writes</span><strong id="admin-usage-writes">—</strong><small>dokumen ditulis</small></div>
            <div><span>Deletes</span><strong id="admin-usage-deletes">—</strong><small>dokumen dihapus</small></div>
            <div><span>Connections</span><strong id="admin-usage-connections">—</strong><small>koneksi aktif</small></div>
          </div>
          <div class="admin-usage-note" id="admin-usage-note">Memuat metrik Cloud Monitoring…</div>
        </div>

        <div class="card admin-dashboard-card">
          <div class="admin-dashboard-card-head"><div><h2>Aktivitas Terbaru</h2><p>Aktivitas yang tercatat di sistem</p></div><button class="btn btn-outline btn-sm" id="admin-view-all-activity">Lihat Semua</button></div>
          <div id="admin-latest-activity" class="admin-latest-activity"><div class="empty-state" style="padding:24px 8px"><p>Memuat aktivitas…</p></div></div>
        </div>
      </section>

      <section class="admin-dashboard-grid admin-dashboard-grid-secondary">
        <div class="card admin-dashboard-card">
          <div class="admin-dashboard-card-head"><div><h2>Status Sistem</h2><p>Layanan utama PMR WIRA UNIT</p></div></div>
          <div class="admin-system-status">
            <div><span class="status-dot online"></span><b>Firebase Authentication</b><small>Online</small></div>
            <div><span class="status-dot online"></span><b>Firestore Database</b><small>Online</small></div>
            <div><span class="status-dot online"></span><b>API Registration</b><small>Online</small></div>
            <div><span class="status-dot online"></span><b>Frontend / Vercel</b><small>Online</small></div>
          </div>
        </div>
        <div class="card admin-dashboard-card">
          <div class="admin-dashboard-card-head"><div><h2>Pengguna</h2><p>Ringkasan role akun</p></div><button class="btn btn-outline btn-sm" id="admin-view-users">Kelola Pengguna</button></div>
          <div class="admin-role-grid" id="admin-role-grid">
            <div><strong>—</strong><span>Admin</span></div><div><strong>—</strong><span>Pembina</span></div><div><strong>—</strong><span>Pengurus</span></div><div><strong>${_adminDashNum(totalMembers)}</strong><span>Anggota</span></div>
          </div>
        </div>
      </section>

      <section class="card admin-dashboard-card admin-dashboard-actions">
        <div><h2>Administrasi Sistem</h2><p>Shortcut ke area yang memang dapat dikelola Admin.</p></div>
        <div class="admin-action-grid">
          <button class="btn btn-outline" data-admin-go="aktivitas-sistem">Log Aktivitas</button>
          <button class="btn btn-outline" data-admin-go="anggota">Data Anggota</button>
          <button class="btn btn-outline" data-admin-go="pengurus">Pengurus</button>
          <button class="btn btn-outline" data-admin-go="pengaturan">Pengaturan Sistem</button>
        </div>
      </section>
    </div>`;

  document.querySelectorAll("[data-admin-go]").forEach(btn => btn.addEventListener("click", () => {
    document.querySelector(`.sidebar-link[data-page="${btn.dataset.adminGo}"]`)?.click();
  }));
  document.getElementById("admin-view-all-activity")?.addEventListener("click", () => document.querySelector('.sidebar-link[data-page="aktivitas-sistem"]')?.click());
  document.getElementById("admin-view-users")?.addEventListener("click", () => document.querySelector('.sidebar-link[data-page="anggota"]')?.click());

  const renderActivity = async () => {
    const wrap = document.getElementById("admin-latest-activity");
    if (!wrap || !FIREBASE_ENABLED) return;
    try {
      const snap = await firebase.firestore().collection("activityLogs").orderBy("createdAt", "desc").limit(6).get();
      const logs = snap.docs.map(d => ({id:d.id,...d.data()}));
      wrap.innerHTML = logs.length ? logs.map(x => `<div class="admin-activity-row"><span class="admin-activity-icon">${x.role === "admin" ? "⚙" : x.role === "pembina" ? "👁" : x.role === "anggota" ? "✓" : "✎"}</span><div><strong>${_adminDashEsc(x.nama || "Pengguna")}</strong><p>${_adminDashEsc(x.activity || "Aktivitas")}${x.detail ? ` · ${_adminDashEsc(x.detail)}` : ""}</p><small>${_adminDashEsc(_formatActivityTime(x.createdAt))} · ${_adminDashEsc(_adminDashRoleLabel(x.role))}</small></div></div>`).join("") : `<div class="empty-state" style="padding:24px 8px"><p class="empty-title">Belum ada aktivitas</p><p class="empty-desc">Aktivitas pengguna akan muncul setelah ada tindakan yang tercatat.</p></div>`;
    } catch (e) {
      wrap.innerHTML = `<div class="alert alert-danger" style="display:flex">Gagal memuat aktivitas.</div>`;
    }
  };
  renderActivity();

  const roleGrid = document.getElementById("admin-role-grid");

  const loadUsage = async () => {
    const note = document.getElementById("admin-usage-note");
    try {
      const current = firebase.auth().currentUser;
      if (!current) throw new Error("Sesi admin tidak ditemukan.");
      const token = await current.getIdToken();
      const resp = await fetch("/api/auth", {method:"POST", headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`}, body:JSON.stringify({action:"admin-usage", idToken:token}), cache:"no-store"});
      const data = await resp.json().catch(()=>({}));
      if (!resp.ok) throw new Error(data.error || `Gagal mengambil metrik (${resp.status}).`);
      document.getElementById("admin-usage-reads").textContent = _adminDashNum(data.reads);
      document.getElementById("admin-usage-writes").textContent = _adminDashNum(data.writes);
      document.getElementById("admin-usage-deletes").textContent = _adminDashNum(data.deletes);
      document.getElementById("admin-usage-connections").textContent = _adminDashNum(data.activeConnections);
      document.getElementById("admin-total-users").textContent = _adminDashNum(data.totalUsers);
      if (roleGrid && data.roleCounts) {
        roleGrid.innerHTML = [
          [data.roleCounts.admin,"Admin"],[data.roleCounts.pembina,"Pembina"],[data.roleCounts.pengurus,"Pengurus"],[totalMembers,"Anggota"]
        ].map(([n,label])=>`<div><strong>${_adminDashNum(n)}</strong><span>${label}</span></div>`).join("");
      }
      if (note) note.textContent = `Data Cloud Monitoring · diperbarui ${_adminDashEsc(data.updatedAt || "baru saja")}. Metrik dapat terlambat beberapa menit.`;
    } catch (e) {
      if (note) note.textContent = "Metrik Firebase belum tersedia dari Cloud Monitoring. Dashboard tetap dapat digunakan.";
    }
  };
  loadUsage();
}
