/* =========================================================
   PAGES/AKTIVITAS-SISTEM.JS
   Audit log admin. Read-only, tidak mengubah data aktivitas.
   ========================================================= */
function _auditEsc(v){return String(v??"—").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");}
function _auditDate(v){try{const d=v?.toDate?v.toDate():new Date(v);return isNaN(d)?"—":d.toLocaleString("id-ID",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});}catch{return"—";}}

async function renderAktivitasSistem(el,user){
  if(user?.role!=="admin"){el.innerHTML=`<div class="alert alert-danger" style="display:flex">Akses hanya untuk Admin.</div>`;return;}
  el.innerHTML=`<div class="page-head"><div><h1>Aktivitas Sistem</h1><p class="page-sub">Riwayat aktivitas penting pengguna di website.</p></div><span class="badge badge-gray" id="audit-count">Memuat…</span></div><div class="card"><div class="audit-toolbar"><div class="search-bar"><span class="search-icon">⌕</span><input id="audit-search" type="search" placeholder="Cari user, aktivitas, atau detail…"></div><select id="audit-role"><option value="">Semua Role</option><option value="admin">Admin</option><option value="ketua">Ketua</option><option value="wakil">Wakil</option><option value="sekretaris">Sekretaris</option><option value="bendahara">Bendahara</option><option value="pj">PJ Divisi</option><option value="pembina">Pembina</option><option value="anggota">Anggota</option></select><select id="audit-activity"><option value="">Semua Aktivitas</option></select><input id="audit-date" type="date" aria-label="Filter tanggal"></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Waktu</th><th>User</th><th>Role</th><th>Aktivitas</th><th>Detail</th></tr></thead><tbody id="audit-body"><tr><td colspan="5" style="text-align:center;padding:28px;color:var(--ink-soft)">Memuat aktivitas…</td></tr></tbody></table></div></div>`;
  const body=document.getElementById("audit-body"),search=document.getElementById("audit-search"),role=document.getElementById("audit-role"),activity=document.getElementById("audit-activity"),date=document.getElementById("audit-date"),count=document.getElementById("audit-count");
  let rows=[];
  try{
    if(!FIREBASE_ENABLED){rows=[];}else{
      const snap=await firebase.firestore().collection("aktivitasSistem").orderBy("createdAt","desc").limit(100).get();
      rows=snap.docs.map(d=>({id:d.id,...d.data()}));
    }
  }catch(e){console.error("[PMR] Gagal memuat aktivitas sistem:",e);body.innerHTML=`<tr><td colspan="5"><div class="alert alert-danger" style="display:flex;margin:12px">Gagal memuat aktivitas: ${_auditEsc(e.message||"permission denied")}</div></td></tr>`;return;}
  const activityNames=[...new Set(rows.map(r=>r.activity).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),"id"));
  activityNames.forEach(a=>{const o=document.createElement("option");o.value=a;o.textContent=a;activity.appendChild(o);});
  function draw(){
    const q=(search.value||"").trim().toLowerCase(),rv=role.value,av=activity.value,dv=date.value;
    const filtered=rows.filter(r=>{const d=r.createdAt?.toDate?r.createdAt.toDate():new Date(r.createdAt);const dateKey=isNaN(d)?"":d.toISOString().slice(0,10);return(!q||[r.userName,r.role,r.activity,r.detail].some(v=>String(v||"").toLowerCase().includes(q)))&&(!rv||r.role===rv)&&(!av||r.activity===av)&&(!dv||dateKey===dv);});
    count.textContent=`${filtered.length} aktivitas`;
    body.innerHTML=filtered.length?filtered.map(r=>`<tr><td style="white-space:nowrap">${_auditEsc(_auditDate(r.createdAt))}</td><td><strong>${_auditEsc(r.userName)}</strong><br><small>${_auditEsc(r.userId||"").slice(0,14)}</small></td><td><span class="badge badge-gray">${_auditEsc((ROLES[r.role]?.label)||r.role||"—")}</span></td><td><strong>${_auditEsc(r.activity)}</strong></td><td>${_auditEsc(r.detail||"—")}</td></tr>`).join(""):"<tr><td colspan=\"5\" style=\"text-align:center;padding:28px;color:var(--ink-soft)\">Tidak ada aktivitas yang cocok.</td></tr>";
  }
  [search,role,activity,date].forEach(x=>x?.addEventListener(x.tagName==="INPUT"?"input":"change",draw));draw();
}
