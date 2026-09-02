/* =========================================================
   MEMBER-PORTAL.JS — Portal khusus role ANGGOTA
   Satu halaman, satu tombol Pengaturan. Tidak mengubah KTA publik.
   ========================================================= */

function _memberEscape(v) {
  return String(v ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
}

function _memberFoto(a, cls="member-avatar") {
  const url = String(a?.foto || "").trim();
  if (!url) return `<div class="${cls} member-avatar-fallback">${_memberEscape(getInisial(a?.nama || "Anggota"))}</div>`;
  return `<div class="${cls}"><img src="${_memberEscape(url)}" alt="Foto ${_memberEscape(a?.nama || "anggota")}" onerror="this.style.display='none';this.parentElement.classList.add('member-avatar-fallback');this.parentElement.insertAdjacentText('beforeend', '${_memberEscape(getInisial(a?.nama || "Anggota"))}')"></div>`;
}

function _memberCurrentData(user) {
  const uid = (FIREBASE_ENABLED && firebase.auth().currentUser) ? firebase.auth().currentUser.uid : "";
  const anggotaId = String(user?.anggotaId || "");
  return AppState.anggota.find(a =>
    (anggotaId && String(a.id) === anggotaId) ||
    (uid && String(a.authUid || "") === uid) ||
    (user?.username && String(a.nomorInduk || "").toLowerCase() === String(user.username).toLowerCase()) ||
    (user?.nama && String(a.nama || "").toLowerCase() === String(user.nama).toLowerCase())
  ) || (FIREBASE_ENABLED ? null : AppState.anggota.find(a => a.statusKeanggotaan === "Aktif") || AppState.anggota[0]);
}

function _memberStatus(a) {
  return String(a?.statusKeanggotaan || a?.status || "Aktif").trim().toLowerCase();
}
function _memberIsActive(a) { return _memberStatus(a) === "aktif"; }
function _memberIsAlumni(a) { return _memberStatus(a) === "alumni"; }
function _memberPortalAccess(a) { return _memberIsActive(a) || _memberIsAlumni(a); }

function _memberPresensiStats(a) {
  const rows = AppState.presensiHistory.filter(p => String(p.anggotaId) === String(a.id));
  const hadir = rows.filter(p => getStatusPresensi(p) === "hadir").length;
  const sakit = rows.filter(p => getStatusPresensi(p) === "sakit").length;
  const izin = rows.filter(p => getStatusPresensi(p) === "izin").length;
  const alpha = rows.filter(p => getStatusPresensi(p) === "alpha").length;
  const total = rows.length;
  return {hadir,sakit,izin,alpha,total,pct:total?Math.round(hadir/total*100):0};
}

function _memberIuran(a) {
  const now = new Date();
  const bulan = now.getMonth()+1, tahun = now.getFullYear();
  const rec = AppState.iuran.find(r => String(r.anggotaId) === String(a.id) && +r.bulan === bulan && +r.tahun === tahun);
  const n = typeof _normalisasiIuranRecord === "function" ? _normalisasiIuranRecord(rec, AppState.nominalIuranStandar || 5000) : {target:AppState.nominalIuranStandar||5000,totalDibayar:rec?.totalDibayar||0,sisa:0,status:rec?.status||"Belum Bayar"};
  return {...n, bulan, tahun};
}

function _memberJadwalSaya(list, nama, id) {
  return list.filter(x => (x.petugas || []).some(p => String(p.id) === String(id) || String(p.nama).toLowerCase() === String(nama).toLowerCase()))
    .filter(x => x.status !== "Dibatalkan")
    .sort((a,b)=>String(a.tanggal).localeCompare(String(b.tanggal)))
    .slice(0,3);
}

function renderMemberPortal(el, user) {
  document.body.classList.add("member-portal-mode");
  const a = _memberCurrentData(user);
  if (!a) {
    el.innerHTML = `<div class="member-portal-empty"><h1>Data anggota belum ditemukan</h1><p>Hubungi admin untuk menghubungkan akun dengan data anggota.</p></div>`;
    return;
  }
  const active = _memberIsActive(a);
  const alumni = _memberIsAlumni(a);
  const portalAccess = active || alumni;
  const stats = _memberPresensiStats(a);
  const iuran = active ? _memberIuran(a) : null;
  const kta = AppState.memberKta || {};
  const kegiatan = AppState.kegiatan.filter(k=>k.status !== "Dibatalkan" && String(k.tanggal) >= new Date().toISOString().slice(0,10)).sort((x,y)=>String(x.tanggal).localeCompare(String(y.tanggal))).slice(0,3);
  const piketSaya = active ? _memberJadwalSaya(AppState.piket, a.nama, a.id) : [];
  const upacaraSaya = active ? _memberJadwalSaya(AppState.upacara, a.nama, a.id) : [];
  const statusClass = active ? "active" : (alumni ? "alumni" : "inactive");
  const photo = _memberFoto(a);

  el.innerHTML = `
    <div class="member-portal">
      <header class="member-portal-head">
        <div class="member-brand"><div class="member-brand-mark">✚</div><div><strong>PMR WIRA UNIT</strong><span>SMK IBG 3</span></div></div>
        <button class="member-settings-btn" id="member-settings" aria-label="Pengaturan" title="Pengaturan">⚙️</button>
      </header>

      <section class="member-hero">
        <div class="member-hero-copy"><span class="member-eyebrow">PORTAL ANGGOTA</span><h1>Halo, ${_memberEscape(a.nama)} 👋</h1><p>Semua informasi PMR kamu dalam satu tempat.</p></div>
        <div class="member-profile-card">${photo}<div class="member-profile-info"><strong>${_memberEscape(a.nama)}</strong><span>NI: ${_memberEscape(a.nomorInduk || "—")}</span><span>${_memberEscape(a.kelas || "—")} · ${_memberEscape(a.divisi || "—")}</span></div><span class="member-status ${statusClass}"><i></i>${active?"Aktif":(alumni?"Alumni":"Tidak Aktif")}</span></div>
      </section>

      ${active ? `
      <section class="member-grid member-top-grid">
        <article class="member-card member-kta-card"><div><span class="member-card-kicker">KTA DIGITAL</span><h2>Kartu Tanda Anggota</h2><p>Tampilkan KTA dan QR verifikasi kamu.</p></div><button class="member-action" id="member-open-kta">Buka KTA <span>›</span></button></article>
        <article class="member-card member-presensi-card"><div class="member-card-title"><div><span class="member-card-kicker">PRESENSI SAYA</span><h2>${stats.pct}%</h2></div><div class="member-ring" style="--pct:${stats.pct}%"><span>${stats.hadir}</span></div></div><p>${stats.total} catatan · ${stats.hadir} Hadir · ${stats.izin} Izin · ${stats.sakit} Sakit · ${stats.alpha} Alpha</p></article>
        <article class="member-card member-iuran-card"><div><span class="member-card-kicker">IURAN BULAN INI</span><h2>${formatBulanTahun(iuran.bulan,iuran.tahun)}</h2><p>${formatRupiah(iuran.totalDibayar || 0)} dari ${formatRupiah(iuran.target || 0)}</p></div><span class="member-payment ${iuran.status === "Lunas" ? "paid" : "unpaid"}">${_memberEscape(iuran.status)}</span></article>
      </section>
      <section class="member-section"><div class="member-section-head"><div><span class="member-card-kicker">JADWAL</span><h2>Kegiatan Terdekat</h2></div></div><div class="member-list">${kegiatan.length ? kegiatan.map(k=>`<div class="member-list-row"><div class="member-list-icon">📅</div><div><strong>${_memberEscape(k.nama)}</strong><span>${formatTanggal(k.tanggal)} · ${_memberEscape(k.lokasi||"Lokasi belum ditentukan")}</span></div></div>`).join("") : `<div class="member-empty-inline">Belum ada kegiatan terjadwal.</div>`}</div></section>
      <section class="member-grid member-duty-grid"><article class="member-card"><div class="member-section-head"><h2>Piket Saya</h2></div>${piketSaya.length?piketSaya.map(p=>`<div class="member-duty-row"><strong>${formatTanggal(p.tanggal)}</strong><span>${_memberEscape(p.lokasi||"—")}</span></div>`).join(""):`<div class="member-empty-inline">Belum ada jadwal piket.</div>`}</article><article class="member-card"><div class="member-section-head"><h2>Petugas Upacara</h2></div>${upacaraSaya.length?upacaraSaya.map(p=>`<div class="member-duty-row"><strong>${formatTanggal(p.tanggal)}</strong><span>${_memberEscape(p.lokasi||p.keterangan||"—")}</span></div>`).join(""):`<div class="member-empty-inline">Belum ada jadwal upacara.</div>`}</article></section>
      ` : alumni ? `
      <section class="member-grid member-top-grid">
        <article class="member-card member-kta-card"><div><span class="member-card-kicker">KTA DIGITAL</span><h2>Kartu Tanda Anggota</h2><p>KTA tetap dapat dilihat sebagai identitas alumni.</p></div><button class="member-action" id="member-open-kta">Buka KTA <span>›</span></button></article>
        <article class="member-card"><span class="member-card-kicker">RIWAYAT KEANGGOTAAN</span><h2>Alumni PMR</h2><p>Bergabung: ${_memberEscape(a.bergabung || "—")}</p><span class="member-payment paid">Alumni</span></article>
      </section>
      <section class="member-section"><div class="member-section-head"><div><span class="member-card-kicker">INFORMASI</span><h2>Kegiatan PMR</h2></div></div><div class="member-list">${kegiatan.length ? kegiatan.map(k=>`<div class="member-list-row"><div class="member-list-icon">📅</div><div><strong>${_memberEscape(k.nama)}</strong><span>${formatTanggal(k.tanggal)} · ${_memberEscape(k.lokasi||"—")}</span></div></div>`).join("") : `<div class="member-empty-inline">Belum ada kegiatan terjadwal.</div>`}</div></section>
      ` : `
      <section class="member-inactive-panel"><div class="member-lock">🔒</div><div><h2>Akun tidak aktif</h2><p>Akses portal operasional dinonaktifkan. Data historis tetap tersimpan dan dapat dikelola oleh pengurus.</p></div></section>
      `}
      <footer class="member-footer">PMR WIRA UNIT · SMK IBG 3 · © ${new Date().getFullYear()}</footer>
    </div>`;

  document.getElementById("member-settings")?.addEventListener("click", ()=>_memberSettingsModal(user,a));
  document.getElementById("member-open-kta")?.addEventListener("click", ()=>_memberKtaModal(a,kta));
}

function _memberSettingsModal(user,a) {
  const rc = ROLES[user.role] || {label:"Anggota PMR"};
  Modal.buka({judul:"Pengaturan", ukuran:"modal-sm", konten:`
    <div class="member-settings-profile">${_memberFoto(a,"member-settings-avatar")}<div><strong>${_memberEscape(a.nama)}</strong><span>${_memberEscape(user.username||a.nomorInduk||"—")}</span><span>${rc.label}</span></div></div>
    <div class="member-settings-actions"><button class="btn btn-outline" id="member-profile-settings">👤 Profil Saya</button><button class="btn btn-ghost" id="member-logout">↪ Keluar</button></div>
    <p class="member-settings-note">Perubahan data keanggotaan dilakukan oleh pengurus.</p>`, aksi:[{label:"Tutup",kelas:"btn-primary",id:"member-settings-close",onClick:()=>Modal.tutup()}]});
  document.getElementById("member-profile-settings")?.addEventListener("click",()=>{Modal.tutup(); _memberProfileModal(a);});
  document.getElementById("member-logout")?.addEventListener("click",()=>logout());
}
function _memberProfileModal(a) {
  Modal.buka({judul:"Profil Saya", ukuran:"modal-sm", konten:`<div class="member-profile-detail">${_memberFoto(a,"member-detail-avatar")}<h3>${_memberEscape(a.nama)}</h3><p><b>NI</b> ${_memberEscape(a.nomorInduk||"—")}</p><p><b>Kelas</b> ${_memberEscape(a.kelas||"—")}</p><p><b>Divisi</b> ${_memberEscape(a.divisi||"—")}</p><p><b>Status</b> ${_memberEscape(a.statusKeanggotaan||a.status||"—")}</p></div>`,aksi:[{label:"Tutup",kelas:"btn-primary",id:"member-detail-close",onClick:()=>Modal.tutup()}]});
}
function _memberKtaModal(a,kta) {
  const token = String(kta?.ktaToken || a?.ktaToken || "");
  const publicUrl = token ? `kta-member.html?token=${encodeURIComponent(token)}` : "";
  Modal.buka({judul:"KTA Digital", ukuran:"modal-sm", konten:`<div class="member-kta-preview"><div class="member-kta-mini"><div class="member-kta-red">✚ PMR WIRA UNIT</div>${_memberFoto(a,"member-kta-photo")}<h3>${_memberEscape(a.nama)}</h3><p>${_memberEscape(a.nomorInduk||"—")}</p><span>${_memberEscape(a.kelas||"—")} · ${_memberEscape(a.divisi||"—")}</span></div>${publicUrl?`<a class="btn btn-primary" href="${_memberEscape(publicUrl)}" target="_blank" rel="noopener">Buka Verifikasi KTA</a>`:`<div class="alert alert-info" style="display:flex">KTA belum terhubung.</div>`}</div>`,aksi:[{label:"Tutup",kelas:"btn-ghost",id:"member-kta-close",onClick:()=>Modal.tutup()}]});
}
