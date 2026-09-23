/* =========================================================
   ACTIVITY LOG — Admin only
   ========================================================= */

async function renderActivityLog(el, user) {
  if (user?.role !== "admin") {
    el.innerHTML = `<div class="alert alert-danger" style="display:flex">Akses hanya untuk Admin.</div>`;
    return;
  }

  el.innerHTML = `
    <div class="page-head">
      <div><h1>Aktivitas Sistem</h1><p class="page-sub">Riwayat tindakan penting yang tercatat di web.</p></div>
    </div>
    <div class="card activity-log-card">
      <div class="table-toolbar activity-log-toolbar">
        <div class="search-bar"><span class="search-icon">⌕</span><input id="activity-search" placeholder="Cari aktivitas atau user..."></div>
        <select id="activity-role-filter"><option value="">Semua User</option><option value="admin">Admin</option><option value="ketua">Ketua</option><option value="wakil">Wakil</option><option value="sekretaris">Sekretaris</option><option value="bendahara">Bendahara</option><option value="pj">PJ Divisi</option><option value="pembina">Pembina</option><option value="anggota">Anggota</option></select>
        <select id="activity-type-filter"><option value="">Semua Aktivitas</option><option value="Login">Login</option><option value="Catatan Pembina">Catatan Pembina</option><option value="Persetujuan Anggota">Persetujuan Anggota</option><option value="Data Anggota">Data Anggota</option><option value="Kegiatan">Kegiatan</option><option value="Presensi">Presensi</option><option value="Keuangan">Keuangan</option><option value="Inventaris">Inventaris</option><option value="Backup">Backup</option></select>
      </div>
      <div id="activity-log-status" class="activity-log-status">Memuat aktivitas…</div>
      <div class="table-wrap"><table class="data-table"><thead><tr><th>Waktu</th><th>User</th><th>Role</th><th>Aktivitas</th><th>Detail</th></tr></thead><tbody id="activity-log-body"></tbody></table></div>
    </div>`;

  let logs = [];
  try {
    const snap = await firebase.firestore().collection("activityLogs").orderBy("createdAt", "desc").limit(200).get();
    logs = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  } catch (e) {
    document.getElementById("activity-log-status").textContent = "Gagal memuat aktivitas: " + (e.message || "akses ditolak");
    return;
  }

  const roleFilter = document.getElementById("activity-role-filter");
  const typeFilter = document.getElementById("activity-type-filter");
  const search = document.getElementById("activity-search");
  const status = document.getElementById("activity-log-status");
  const body = document.getElementById("activity-log-body");

  function render() {
    const q = String(search.value || "").trim().toLowerCase();
    const role = roleFilter.value;
    const type = typeFilter.value;
    const rows = logs.filter(x => {
      const hay = `${x.nama||""} ${x.role||""} ${x.activity||""} ${x.detail||""}`.toLowerCase();
      return (!q || hay.includes(q)) && (!role || x.role === role) && (!type || String(x.activity||"").includes(type));
    });
    status.textContent = `${rows.length} aktivitas ditampilkan · ${logs.length} tersimpan di 200 aktivitas terbaru`;
    body.innerHTML = rows.length ? rows.map(x => `<tr>
      <td style="white-space:nowrap">${_activityEsc(_formatActivityTime(x.createdAt))}</td>
      <td><strong>${_activityEsc(x.nama)}</strong></td>
      <td>${_activityEsc((ROLES[x.role]?.label || x.role || "—"))}</td>
      <td><span class="badge badge-gray">${_activityEsc(x.activity)}</span></td>
      <td>${_activityEsc(x.detail || "—")}</td>
    </tr>`).join("") : `<tr><td colspan="5" style="text-align:center;padding:26px;color:var(--ink-soft)">Belum ada aktivitas yang cocok.</td></tr>`;
  }
  [search, roleFilter, typeFilter].forEach(x => x?.addEventListener("input", render));
  render();
}
