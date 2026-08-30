/* =========================================================
   DASHBOARD.JS — v4 Bootstrap (Fase 3 — modularisasi)
   =========================================================
   File ini KHUSUS bertugas sebagai bootstrap:
   - initAuth()               → verifikasi sesi login
   - DB.init()                → muat data awal ke AppState
   - DB.initListeners()       → aktifkan realtime listener Firestore
   - render halaman aktif     → via objek PAGES
   - router menu (sidebar)    → navigateTo()

   Seluruh render function dan event handler per halaman sudah
   dipindahkan ke js/pages/*.js. Helper lintas halaman (pasangSearch,
   statCard, _jalankanSimpan) dipindahkan ke js/core/state.js.

   TIDAK ADA perubahan logika dari versi sebelumnya — murni
   pemindahan lokasi kode. Perilaku aplikasi identik.
   ========================================================= */

/* ─────────────────────────────────────────────────────────
   INIT — Firebase Auth check, muat data, pasang listener
───────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {

  /* Tampilan loading awal saat Firebase memverifikasi token */
  _setLoadingState(true);

  initAuth(
    async (user) => {
      /* Muat data ke AppState */
      await DB.init();

      /* Pasang handler re-render ke AppState listener */
      setReRenderHandler(() => {
        const halaman = location.hash.replace("#","") || "beranda";
        if (PAGES[halaman]) {
          document.getElementById("content-area").innerHTML = "";
          PAGES[halaman].render(document.getElementById("content-area"), user);
        }
      });

      /* Aktifkan real-time listener (Firestore) */
      DB.initListeners();

      /* Mulai dashboard */
      _initDashboard(user);
      _setLoadingState(false);
    },
    () => { window.location.href = "login.html"; }
  );
});

function _setLoadingState(loading) {
  const el = document.getElementById("content-area");
  if (!el) return;
  if (loading) {
    /* [F5.1 — UI Polish] Sebelumnya spinner (ikon berputar). Diganti
       skeleton shimmer sesuai spek F5.1 ("tanpa spinner"). Ini SATU-
       SATUNYA jeda loading async yang nyata di app (menunggu auth +
       DB.init() sebelum halaman pertama dirender) — begitu selesai,
       _initDashboard() → navigateTo() menimpa isi ini dengan halaman
       sungguhan lewat alur yang SAMA PERSIS seperti sebelumnya.
       Bentuk skeleton dipilih berdasar location.hash — cara baca yang
       SAMA dengan yang dipakai navigateTo() untuk `initPage` — supaya
       bentuknya mendekati halaman yang akan benar-benar muncul. */
    const halamanTujuan = location.hash.replace("#", "") || "beranda";
    el.innerHTML = skeletonUntukHalaman(halamanTujuan);
  }
}

/* ─────────────────────────────────────────────────────────
   PAGES — Registry router. render() masing-masing entry
   didefinisikan di js/pages/*.js (dimuat sebelum file ini).
───────────────────────────────────────────────────────── */
function renderPersetujuanAnggota(el, user) {
  const allowed = ["admin","ketua","wakil","sekretaris"].includes(user.role);
  if (!allowed) { el.innerHTML = `<div class="empty-state"><p>Akses hanya untuk pengurus yang berwenang.</p></div>`; return; }
  const pending = AppState.anggota.filter(a => (a.statusAkun || "active") === "pending");
  el.innerHTML = `<div class="page-head"><div><h1>Persetujuan Anggota PMR</h1><p class="page-sub">Kelola pendaftaran yang menunggu aktivasi.</p></div></div><div class="card"><div class="table-wrap"><table class="data-table"><thead><tr><th>Nama</th><th>Nomor Induk</th><th>Jabatan</th><th>Aksi</th></tr></thead><tbody>${pending.length ? pending.map(a=>`<tr><td>${a.nama}</td><td>${a.nomorInduk||"—"}</td><td>${a.jabatan||"Anggota"}</td><td><button class="btn btn-primary btn-sm" data-approve="${a.id}">Setujui</button> <button class="btn btn-ghost btn-sm" data-reject="${a.id}">Tolak</button></td></tr>`).join("") : `<tr><td colspan="4" style="text-align:center;color:var(--ink-soft)">Tidak ada pendaftaran yang menunggu.</td></tr>`}</tbody></table></div></div>`;
  el.querySelectorAll("[data-approve]").forEach(btn=>btn.addEventListener("click", async()=>{ await DB.anggota.update(btn.dataset.approve,{statusAkun:"active",statusKeanggotaan:"Aktif"}); if(!FIREBASE_ENABLED) renderPersetujuanAnggota(el,user); tampilToast("Anggota disetujui.","success"); }));
  el.querySelectorAll("[data-reject]").forEach(btn=>btn.addEventListener("click", async()=>{ await DB.anggota.update(btn.dataset.reject,{statusAkun:"rejected"}); if(!FIREBASE_ENABLED) renderPersetujuanAnggota(el,user); tampilToast("Pendaftaran ditolak.","default"); }));
}

async function renderKta(el, user) {
  const allowed = ["admin","ketua","wakil","sekretaris"].includes(user.role);
  if (!allowed) { el.innerHTML = `<div class="empty-state"><p>Akses hanya untuk pengurus yang berwenang.</p></div>`; return; }

  if (FIREBASE_ENABLED) {
    try {
      const fdb = firebase.firestore();
      await Promise.all(AppState.anggota.map(async a => {
        try { const snap = await fdb.collection("kta").doc(a.id).get(); if (snap.exists) Object.assign(a, snap.data()); } catch (_) {}
      }));
    } catch (_) {}
  }

  const active = AppState.anggota
    .filter(a => (a.statusAkun || "active") === "active")
    .sort((a,b) => String(a.nama||"").localeCompare(String(b.nama||""), "id", {sensitivity:"base"}));

  el.innerHTML = `
    <div class="page-head kta-head">
      <div><h1>KTA PMR</h1><p class="page-sub">Generate KTA dari data anggota aktif. Kelas, jabatan, divisi, dan foto dapat diperbarui dari data anggota tanpa membuat ulang QR.</p></div>
      <div class="kta-head-actions"><button class="btn btn-primary btn-sm" id="btn-kta-generate-all">⇩ Generate Semua</button></div>
    </div>
    <div class="card kta-info-card">
      <div class="kta-info-grid">
        <div><strong>${active.length}</strong><span>Anggota aktif</span></div>
        <div><strong>${active.filter(a=>a.authUid).length}</strong><span>Akun anggota</span></div>
        <div><strong>${active.filter(a=>a.authUid && a.ktaToken).length}</strong><span>KTA siap akses</span></div>
      </div>
    </div>
    <div class="card kta-list-card">
      <div class="table-toolbar"><div class="search-bar"><span class="search-icon">⌕</span><input id="search-kta" type="search" placeholder="Cari nama atau NI…"></div></div>
      <div class="table-wrap kta-table-wrap">
        <table class="data-table kta-table"><thead><tr><th>Nama</th><th>NI</th><th>Kelas</th><th>Jabatan</th><th>Akun</th><th>KTA</th><th>Aksi</th></tr></thead>
        <tbody id="kta-list-body"></tbody></table>
      </div>
    </div>`;

  const body = document.getElementById('kta-list-body');
  const qInput = document.getElementById('search-kta');

  function draw() {
    const q = (qInput?.value || '').trim().toLowerCase();
    const rows = active.filter(a => !q || [a.nama,a.nomorInduk,a.kelas,a.jabatan,a.divisi].some(v=>String(v||'').toLowerCase().includes(q)));
    body.innerHTML = rows.length ? rows.map(a=>`<tr>
      <td><div class="kta-name-cell"><div class="avatar" style="width:34px;height:34px;font-size:.72rem">${getInisial(a.nama)}</div><strong>${escapeHtmlKta(a.nama)}</strong></div></td>
      <td>${escapeHtmlKta(a.nomorInduk||'—')}</td><td>${escapeHtmlKta(a.kelas||'—')}</td><td>${escapeHtmlKta(a.jabatan||'Anggota')}</td>
      <td>${a.authUid ? '<span class="badge badge-success">Siap</span>' : '<span class="badge badge-gray">Belum</span>'}</td>
      <td>${a.ktaToken ? '<span class="badge badge-success">Siap</span>' : '<span class="badge badge-gray">Belum</span>'}</td>
      <td><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn btn-outline btn-sm" data-kta-preview="${a.id}">Preview</button><button class="btn btn-primary btn-sm" data-kta-account="${a.id}">${a.authUid?'Kelola Akun':'Buat Akun'}</button></div></td>
    </tr>`).join('') : '<tr><td colspan="7" style="text-align:center;color:var(--ink-soft)">Tidak ada anggota yang cocok.</td></tr>';
  }
  draw();
  qInput?.addEventListener('input', draw);

  body.addEventListener('click', async e => {
    const preview = e.target.closest('[data-kta-preview]');
    const account = e.target.closest('[data-kta-account]');
    if (preview) await previewKta(active.find(a=>a.id===preview.dataset.ktaPreview));
    if (account) await kelolaAkunKta(active.find(a=>a.id===account.dataset.ktaAccount), user);
  });
  document.getElementById('btn-kta-generate-all')?.addEventListener('click', async()=>{
    const ready = active.filter(a => a.authUid && a.ktaToken);
    const skipped = active.filter(a => !a.authUid || !a.ktaToken);
    if (!ready.length) return tampilToast('Belum ada KTA siap. Buat akun anggota terlebih dahulu.', 'error');
    if (!window.JSZip) return tampilToast('Library ZIP belum termuat. Muat ulang halaman lalu coba lagi.', 'error');
    const zip = new JSZip();
    const status = Modal.buka({judul:'Generate Semua KTA', konten:`<p id="kta-batch-status">Menyiapkan ${ready.length} KTA…</p><div class="progress-bar" style="height:8px;background:#eee;border-radius:99px;overflow:hidden"><div id="kta-batch-progress" style="height:100%;width:0%;background:var(--primary);transition:width .2s"></div></div><p id="kta-batch-skip" style="font-size:.82rem;color:var(--ink-soft);margin-top:10px">${skipped.length ? skipped.length+' anggota dilewati karena akun/KTA belum siap.' : 'Semua anggota aktif siap.'}</p>`, aksi:[{label:'Batal',kelas:'btn-outline',id:'btn-kta-batch-cancel',onClick:()=>Modal.tutup()}]});
    try {
      for (let i=0;i<ready.length;i++) {
        const a=ready[i];
        const canvas=await buildKtaCanvas(a,`${location.origin}/kta-member.html?kta=${encodeURIComponent(a.ktaToken)}`);
        const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));
        zip.file(`KTA-${safeFile(a.nomorInduk||a.nama)}-depan.png`,blob);
        const backCanvas=await buildKtaBackCanvas(a,`${location.origin}/kta-member.html?kta=${encodeURIComponent(a.ktaToken)}`);
        const back=await new Promise(r=>backCanvas.toBlob(r,'image/png'));
        zip.file(`KTA-${safeFile(a.nomorInduk||a.nama)}-belakang.png`,back);
        const pct=Math.round((i+1)/ready.length*100); const st=document.getElementById('kta-batch-status'); const pr=document.getElementById('kta-batch-progress'); if(st)st.textContent=`Memproses ${i+1}/${ready.length}: ${a.nama}`; if(pr)pr.style.width=pct+'%';
      }
      const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE'}); const link=document.createElement('a'); link.href=URL.createObjectURL(blob); link.download=`KTA-PMR-${new Date().toISOString().slice(0,10)}.zip`; link.click(); setTimeout(()=>URL.revokeObjectURL(link.href),3000); Modal.tutup(); tampilToast(`ZIP KTA selesai: ${ready.length} anggota${skipped.length?' · '+skipped.length+' dilewati':''}.`,'success');
    } catch(err) { Modal.tutup(); tampilToast('Generate KTA gagal: '+err.message,'error'); }
  });
}

function escapeHtmlKta(v) {
  return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

async function kelolaAkunKta(a, adminUser) {
  if (!a) return;
  if (a.authUid) {
    Modal.buka({judul:'Akun KTA', konten:`<div class="kta-account-note"><strong>${escapeHtmlKta(a.nama)}</strong><p>Akun anggota sudah terhubung. Username: <code>${escapeHtmlKta(a.nomorInduk||'—')}</code></p><p>Password tidak dapat ditampilkan kembali. Jika perlu reset, gunakan proses reset akun yang akan ditambahkan pada tahap berikutnya.</p></div>`, aksi:[{label:'Tutup',kelas:'btn-primary',id:'modal-tutup-kta-akun',onClick:()=>Modal.tutup()}]});
    return;
  }
  if (!a.nomorInduk) return tampilToast('NI wajib diisi sebelum membuat akun KTA.','error');
  Modal.buka({judul:'Buat Akun Anggota', konten:`<p>Akun akan dibuat untuk <strong>${escapeHtmlKta(a.nama)}</strong>.</p><div class="kta-credential-warning">Username: <strong>${escapeHtmlKta(a.nomorInduk)}</strong><br>Password awal dibuat acak oleh sistem dan hanya ditampilkan sekali.</div><p style="color:var(--ink-soft);font-size:.84rem">Setelah akun dibuat, QR KTA dapat diverifikasi publik. Login hanya diperlukan untuk membuka KTA/profil milik anggota sendiri.</p>`, aksi:[{label:'Buat Akun',kelas:'btn-primary',id:'btn-confirm-create-kta-account',onClick:async()=>{const btn=document.getElementById('btn-confirm-create-kta-account'); if(btn) btn.disabled=true; try { const token=await firebase.auth().currentUser.getIdToken(true); const r=await fetch('/api/kta-account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token,anggotaId:a.id})}); const data=await r.json(); if(!r.ok) throw new Error(data.error||'Gagal membuat akun.'); await DB.anggota.update(a.id,{authUid:data.uid,statusAkun:'active'}); a.authUid=data.uid; a.ktaToken=data.ktaToken; Modal.tutup(); tampilToast(`Akun dibuat. Password awal: ${data.temporaryPassword}`,'success'); } catch(err){ if(btn) btn.disabled=false; tampilToast(err.message,'error'); }}}]});
}

async function previewKta(a, fromAll=false) {
  if (!a) return;
  const hasPhoto = !!String(a.foto||'').trim();
  const token = a.ktaToken || `member-${a.id}`;
  const target = `${location.origin}/kta-member.html?kta=${encodeURIComponent(token)}`;
  Modal.buka({judul:`Preview KTA · ${escapeHtmlKta(a.nama)}`, ukuran:'modal-xl', konten:`
    <div class="kta-preview-wrap">
      <div class="kta-preview-card"><div class="kta-preview-label">DEPAN</div><canvas id="kta-front-canvas" width="993" height="1536"></canvas></div>
      <div class="kta-preview-card"><div class="kta-preview-label">BELAKANG</div><canvas id="kta-back-canvas" width=993 height=1536 class="kta-preview-img"></canvas></div>
    </div>
    <div class="kta-meta"><strong>${escapeHtmlKta(a.nama)}</strong> · ${escapeHtmlKta(a.nomorInduk||'—')} · ${escapeHtmlKta(a.kelas||'—')} · ${escapeHtmlKta(a.jabatan||'Anggota')} · ${escapeHtmlKta(a.divisi||'—')}<br><span>${hasPhoto?'Foto ditemukan dan akan ditempatkan ke template.':'Foto belum diisi, generator menggunakan placeholder.'}</span></div>`, aksi:[{label:'Unduh Depan PNG',kelas:'btn-outline',id:'btn-kta-download-front',onClick:()=>downloadCanvasPng(document.getElementById('kta-front-canvas'),`KTA-${safeFile(a.nomorInduk||a.nama)}-depan.png`)},{label:'Unduh Belakang',kelas:'btn-outline',id:'btn-kta-download-back',onClick:async()=>{const c=await buildKtaBackCanvas(a,target);downloadCanvasPng(c,`KTA-${safeFile(a.nomorInduk||a.nama)}-belakang.png`)}},{label:'Tutup',kelas:'btn-primary',id:'modal-tutup-kta-preview',onClick:()=>Modal.tutup()}]});
  setTimeout(async()=>{await renderKtaCanvas(a,target); await renderKtaBackCanvas(a,target);},0);
}

function safeFile(v){return String(v||'KTA').replace(/[^a-z0-9_-]+/gi,'_').slice(0,80)}
function downloadCanvasPng(canvas,name){if(!canvas)return; const a=document.createElement('a'); a.href=canvas.toDataURL('image/png'); a.download=name; a.click();}
function downloadImage(src,name){const a=document.createElement('a');a.href=src;a.download=name;a.click();}

async function buildKtaCanvas(a,target) {
  const canvas=document.createElement('canvas'); canvas.width=993; canvas.height=1536; const ctx=canvas.getContext('2d');
  const bg=await loadKtaImage('assets/kta-front-template.png'); ctx.drawImage(bg,0,0,993,1536);
  const px=245,py=438,pw=505,ph=532; ctx.save();ctx.beginPath();ctx.rect(px,py,pw,ph);ctx.clip(); const photo=await tryLoadKtaPhoto(a.foto); if(photo){const scale=Math.max(pw/photo.width,ph/photo.height),w=photo.width*scale,h=photo.height*scale;ctx.drawImage(photo,px+(pw-w)/2,py+(ph-h)/2,w,h);}else{ctx.fillStyle='#d9edf7';ctx.fillRect(px,py,pw,ph);ctx.fillStyle='#fff';ctx.font='bold 54px Inter, Arial';ctx.textAlign='center';ctx.fillText('FOTO',px+pw/2,py+ph/2);ctx.font='28px Inter, Arial';ctx.fillText('Belum tersedia',px+pw/2,py+ph/2+48);}ctx.restore();
  ctx.textAlign='center';ctx.fillStyle='#fff';ctx.font='52px Inter, Arial';fitText(ctx,a.nama||'Nama Anggota PMR',496,1080,820,52);ctx.font='34px Inter, Arial';ctx.fillText(a.nomorInduk||'NOMOR INDUK',496,1150);
  try{const box=document.createElement('div');box.style.cssText='position:fixed;left:-99999px;top:-99999px;background:#fff;padding:8px';document.body.appendChild(box);new QRCode(box,{text:target,width:180,height:180,colorDark:'#000',colorLight:'#fff',correctLevel:QRCode.CorrectLevel.M});await new Promise(r=>setTimeout(r,40));const q=box.querySelector('canvas')||box.querySelector('img');if(q){if(q.tagName==='IMG')await waitImg(q);ctx.drawImage(q,48,1310,170,170);}box.remove();}catch(e){console.warn('[KTA] QR gagal:',e);}
  return canvas;
}
async function renderKtaCanvas(a,target){const canvas=await buildKtaCanvas(a,target);const host=document.getElementById('kta-front-canvas');if(!host)return;host.getContext('2d').drawImage(canvas,0,0);}
async function buildKtaBackCanvas(a,target){
  const canvas=document.createElement('canvas'); canvas.width=993; canvas.height=1536; const ctx=canvas.getContext('2d');
  const bg=await loadKtaImage('assets/kta-back-template.png'); ctx.drawImage(bg,0,0,993,1536);
  try{
    const box=document.createElement('div'); box.style.cssText='position:fixed;left:-99999px;top:-99999px;background:#fff;padding:8px'; document.body.appendChild(box);
    new QRCode(box,{text:target,width:210,height:210,colorDark:'#000',colorLight:'#fff',correctLevel:QRCode.CorrectLevel.M});
    await new Promise(r=>setTimeout(r,40));
    const q=box.querySelector('canvas')||box.querySelector('img');
    if(q){if(q.tagName==='IMG')await waitImg(q); ctx.drawImage(q,391,785,210,210);}
    box.remove();
  }catch(e){console.warn('[KTA] QR belakang gagal:',e);}
  return canvas;
}
async function renderKtaBackCanvas(a,target){const canvas=await buildKtaBackCanvas(a,target);const host=document.getElementById('kta-back-canvas');if(!host)return;host.getContext('2d').drawImage(canvas,0,0);}

function fitText(ctx,text,x,y,maxW,size){let s=size;ctx.font=`${s}px Inter, Arial`;while(ctx.measureText(text).width>maxW&&s>22){s-=1;ctx.font=`${s}px Inter, Arial`;}ctx.fillText(text,x,y)}
function loadKtaImage(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src;});}
function waitImg(img){return img.complete?Promise.resolve():new Promise(r=>{img.onload=r;img.onerror=r;});}
async function tryLoadKtaPhoto(src){if(!src)return null;let url=String(src).trim();try{if(url.includes('drive.google.com')&&url.includes('/file/d/')){const m=url.match(/\/file\/d\/([^/]+)/);if(m)url=`https://drive.google.com/thumbnail?id=${m[1]}&sz=w1200`;} const i=new Image();i.crossOrigin='anonymous';await new Promise((res)=>{i.onload=res;i.onerror=()=>res();i.src=url;setTimeout(res,5000)});return i.naturalWidth?i:null;}catch{return null}}

let PAGES = {};

function _initDashboard(user) {
  /* ── Info user di sidebar/topbar ── */
  const roleConf = ROLES[user.role] || { label:user.role, badge:"badge-gray" };
  document.querySelectorAll(".js-user-name").forEach(el => el.textContent = user.nama);
  document.querySelectorAll(".js-user-role").forEach(el => {
    el.textContent = roleConf.label;
    el.className = "badge " + roleConf.badge;
  });
  document.querySelectorAll(".js-user-avatar").forEach(el => el.textContent = getInisial(user.nama));

  /* ── Sidebar toggle (mobile) ── */
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebar-overlay");
  function openSidebar()  { sidebar.classList.add("open"); overlay.classList.add("open"); document.body.style.overflow="hidden"; }
  function closeSidebar() { sidebar.classList.remove("open"); overlay.classList.remove("open"); document.body.style.overflow=""; }
  document.querySelectorAll(".js-sidebar-toggle").forEach(btn => btn.addEventListener("click", () =>
    sidebar.classList.contains("open") ? closeSidebar() : openSidebar()
  ));
  overlay.addEventListener("click", closeSidebar);

  /* ── Toggle Expanded ↔ Mini (desktop) ──
     Murni preferensi tampilan lokal, disimpan di localStorage supaya
     state-nya dipertahankan saat pindah halaman maupun reload. Tidak
     menyentuh Firebase/Firestore sama sekali. */
  const btnCollapse = document.getElementById("btn-collapse-sidebar");
  if (btnCollapse) {
    if (localStorage.getItem("pmr_sidebar_collapsed") === "1") {
      sidebar.classList.add("collapsed");
      btnCollapse.setAttribute("aria-label", "Perluas sidebar");
      btnCollapse.title = "Perluas sidebar";
    }
    btnCollapse.addEventListener("click", () => {
      const isCollapsed = sidebar.classList.toggle("collapsed");
      localStorage.setItem("pmr_sidebar_collapsed", isCollapsed ? "1" : "0");
      const label = isCollapsed ? "Perluas sidebar" : "Ciutkan sidebar";
      btnCollapse.setAttribute("aria-label", label);
      btnCollapse.title = label;
    });
  }

  /* ── Navigasi SPA-lite ── */
  const contentArea = document.getElementById("content-area");
  const navLinks    = document.querySelectorAll(".sidebar-link[data-page]");
  const topbarTitle = document.getElementById("topbar-title");

  PAGES = {
    beranda:    { title:"Beranda",      render:renderBeranda    },
    anggota:    { title:"Data Anggota", render:renderAnggota    },
    "persetujuan-anggota": { title:"Persetujuan Anggota PMR", render:renderPersetujuanAnggota },
    kta:        { title:"KTA PMR", render:renderKta },
    kegiatan:   { title:"Kegiatan",     render:renderKegiatan   },
    presensi:   { title:"Presensi",     render:renderPresensi   },
    piket:      { title:"Piket",        render:renderPiket      },
    upacara:    { title:"Petugas Upacara", render:renderUpacara },
    keuangan:   { title:"Keuangan",     render:renderKeuangan   },
    inventaris: { title:"Inventaris",   render:renderInventaris },
    laporan:    { title:"Laporan",      render:renderLaporan    },
    pengurus:   { title:"Pengurus",     render:renderPengurus   },
    /* [F6.0] Manajemen Konten Publik — BARU, murni ditambahkan,
       tidak menyentuh entri di atas maupun di bawah. */
    "konten-artikel":     { title:"Manajemen Artikel",     render:(el,user)=>renderKontenAdmin(el,user,"artikel") },
    "konten-video":       { title:"Manajemen Video",       render:(el,user)=>renderKontenAdmin(el,user,"video") },
    "konten-poster":      { title:"Manajemen Poster",      render:(el,user)=>renderKontenAdmin(el,user,"poster") },
    "konten-dokumentasi": { title:"Manajemen Dokumentasi", render:(el,user)=>renderKontenAdmin(el,user,"dokumentasi") },
    pengaturan: { title:"Pengaturan",   render:renderPengaturan },
    profilsaya: { title:"Profil Saya",  render:renderProfilSaya }
  };

  /* ── F3.2: Sidebar khusus role "anggota" ──
     Hanya mengubah tampilan sidebar JIKA role adalah anggota.
     Untuk semua role lain, blok ini tidak dieksekusi sama sekali —
     sidebar tetap identik seperti sebelum F3.2. */
  /* ── RBAC navigasi: menu Anggota/Persetujuan/KTA hanya untuk
     admin, ketua, wakil, sekretaris. Rendering page tetap melakukan
     pengecekan permission sebagai lapisan kedua. */
  const roleKelolaAnggota = ["admin","ketua","wakil","sekretaris"].includes(user.role);
  if (!roleKelolaAnggota) {
    ["persetujuan-anggota","kta"].forEach(page => {
      document.querySelectorAll(`.sidebar-link[data-page="${page}"]`).forEach(link => {
        link.style.display = "none";
      });
    });
  }

  if (user.role === "anggota") {
    const sembunyikanUntukAnggota = [
      "anggota", "persetujuan-anggota", "kta", "presensi", "keuangan", "pengaturan",
      /* [F6.0] Manajemen Konten Publik bukan untuk role anggota —
         mereka melihat konten lewat halaman publik (artikel.html dst),
         sama seperti pengunjung umum. */
      "konten-artikel", "konten-video", "konten-poster", "konten-dokumentasi"
    ];
    /* querySelectorAll (bukan querySelector) — beberapa data-page kini
       punya 2 elemen (sidebar + shortcut Bottom Navigation mobile),
       keduanya harus ikut disembunyikan untuk role "anggota". */
    sembunyikanUntukAnggota.forEach(page => {
      document.querySelectorAll(`.sidebar-link[data-page="${page}"]`).forEach(link => {
        link.style.display = "none";
      });
    });

    const linkProfil = document.querySelector('.sidebar-link[data-page="profilsaya"]');
    if (linkProfil) linkProfil.style.display = "";

    /* [RBAC NAV — ANGGOTA] Bottom nav memakai slot yang sama, tetapi
       shortcut yang tidak relevan diganti dengan halaman yang memang
       boleh dilihat anggota:
       - Anggota  → Pengurus (view-only)
       - Presensi → Profil Saya
       Keuangan tetap disembunyikan untuk anggota. */
    const bottomPengurus = document.querySelector('.bottom-nav .bottom-nav-link[data-page="anggota"]');
    if (bottomPengurus) {
      bottomPengurus.href = "#pengurus";
      bottomPengurus.dataset.page = "pengurus";
      bottomPengurus.querySelector(".bottom-nav-label")?.replaceChildren(document.createTextNode("Pengurus"));
      bottomPengurus.style.display = "";
    }

    const bottomProfil = document.querySelector('.bottom-nav .bottom-nav-link[data-page="presensi"]');
    if (bottomProfil) {
      bottomProfil.href = "#profilsaya";
      bottomProfil.dataset.page = "profilsaya";
      bottomProfil.querySelector(".bottom-nav-label")?.replaceChildren(document.createTextNode("Profil Saya"));
      bottomProfil.style.display = "";
    }
  }

  function navigateTo(pageId) {
    /* Route guard lapis UI: akun anggota tidak boleh membuka halaman
       administrasi hanya dengan mengetik hash secara manual. Firestore
       Rules tetap menjadi lapisan keamanan utama. */
    if (user.role === "anggota") {
      const halamanAnggota = new Set([
        "beranda", "kegiatan", "piket", "upacara", "inventaris",
        "pengurus", "profilsaya"
      ]);
      if (!halamanAnggota.has(pageId)) pageId = "beranda";
    }

    const page = PAGES[pageId];
    if (!page) return;
    navLinks.forEach(a => a.classList.toggle("active", a.dataset.page === pageId));
    topbarTitle.textContent = page.title;
    contentArea.innerHTML = "";
    page.render(contentArea, user);
    closeSidebar();
    history.replaceState(null, "", "#" + pageId);
  }

  navLinks.forEach(a => a.addEventListener("click", e => { e.preventDefault(); navigateTo(a.dataset.page); }));

  const initPage = (location.hash.replace("#","") in PAGES) ? location.hash.replace("#","") : "beranda";
  navigateTo(initPage);

  /* ── Notifikasi ── */
  Notif.init("btn-notif", "notif-dropdown", "notif-badge");

  /* ── Logout ── */
  document.getElementById("btn-logout").addEventListener("click", () => {
    Modal.konfirmasi("Yakin ingin keluar dari sesi ini?", () => {
      DB.stopListeners();
      logout();
    });
  });

  /* ── Mode indikator ── */
  if (!FIREBASE_ENABLED) {
    const bar = document.createElement("div");
    bar.id = "demo-bar";
    bar.innerHTML = `
      <div style="position:fixed;bottom:0;left:0;right:0;
        background:var(--warning-bg);border-top:1px solid var(--warning);
        padding:6px 20px;font-size:0.75rem;color:var(--warning);
        display:flex;align-items:center;justify-content:center;gap:8px;z-index:30">
        <strong>MODE DEMO</strong> — Data tidak disimpan ke server.
        Aktifkan Firebase di <code>js/firebase-config.js</code> untuk mode produksi.
      </div>`;
    document.body.appendChild(bar);
  }
}
