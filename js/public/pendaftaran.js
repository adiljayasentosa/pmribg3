/* =========================================================
   PENDAFTARAN ANGGOTA PMR — v1.1.59
   Step 1: buat akun pribadi Firebase Auth
   Step 2: lengkapi data anggota lalu kirim pendaftaran
   KTA tidak lagi membuat akun.
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  const form=document.getElementById('registration-form');
  const panels=[...document.querySelectorAll('.registration-panel')];
  const progress=[...document.querySelectorAll('[data-progress]')];
  const prev=document.getElementById('reg-prev'), next=document.getElementById('reg-next'), submit=document.getElementById('reg-submit');
  const errorEl=document.getElementById('registration-error');
  let step=1, accountCreated=false, accountUid=null;

  const value=id=>document.getElementById(id)?.value?.trim()||'';
  function showError(msg){errorEl.textContent=msg;errorEl.style.display='flex';errorEl.scrollIntoView({behavior:'smooth',block:'nearest'});}
  function clearError(){errorEl.textContent='';errorEl.style.display='none';}
  function currentPanel(){return panels.find(p=>Number(p.dataset.step)===step)}

  function validateStep(){
    clearError();
    const panel=currentPanel();
    if(step===2 && !accountCreated){showError('Akun belum dibuat. Kembali ke tahap pertama dan simpan akun terlebih dahulu.');return false;}
    const fields=[...panel.querySelectorAll('input,select,textarea')];
    for(const f of fields){
      if(f.type==='radio') continue;
      if(!f.checkValidity()){f.reportValidity();return false;}
    }
    if(step===2 && !document.querySelector('input[name="jenisKelamin"]:checked')){showError('Pilih jenis kelamin terlebih dahulu.');return false;}
    if(step===2 && value('reg-nik') && !/^\d{5,20}$/.test(value('reg-nik'))){showError('NIK/NISN harus berupa angka 5–20 digit.');return false;}
    return true;
  }

  function updateUI(){
    panels.forEach(p=>p.classList.toggle('active',Number(p.dataset.step)===step));
    progress.forEach(p=>{const n=Number(p.dataset.progress);p.classList.toggle('active',n===step);p.classList.toggle('done',n<step)});
    prev.style.display=step>1?'':'none';
    next.style.display=step===1?'':'none';
    submit.style.display=step===2?'':'none';
    if(step===2) document.getElementById('reg-nama')?.focus();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  document.getElementById('toggle-reg-password')?.addEventListener('click',e=>{
    const input=document.getElementById('reg-password'), visible=input.type==='text'; input.type=visible?'password':'text'; e.currentTarget.innerHTML=visible?'<svg class="eye-icon" viewBox="0 0 24 24" focusable="false"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>':'<svg class="eye-icon" viewBox="0 0 24 24" focusable="false"><path d="M3 3l18 18"/><path d="M10.6 5.2A10.7 10.7 0 0 1 12 5c6 0 9.5 7 9.5 7a18.4 18.4 0 0 1-3.1 3.8M6.1 6.1C3.7 8.1 2.5 12 2.5 12s3.5 7 9.5 7c1.1 0 2.1-.2 3-.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  });

  next.addEventListener('click',async()=>{
    if(!validateStep())return;
    if(!FIREBASE_ENABLED){showError('Pendaftaran akun memerlukan koneksi Firebase.');return;}
    next.disabled=true;next.textContent='Menyimpan…';
    try{
      const email=value('reg-email').toLowerCase(), username=value('reg-username').toLowerCase(), password=value('reg-password');
      const cred=await firebase.auth().createUserWithEmailAndPassword(email,password);
      accountUid=cred.user.uid;
      const token=await cred.user.getIdToken(true);
      const resp=await fetch('/api/register-account',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token,username,email,nama:value('reg-nama')})});
      const data=await resp.json().catch(()=>({}));
      if(!resp.ok)throw new Error(data.error||`Gagal membuat profil akun (${resp.status}).`);
      accountCreated=true;
      step=2;updateUI();
    }catch(err){
      try{if(firebase.auth().currentUser && accountUid)await firebase.auth().currentUser.delete();}catch(_){ }
      accountUid=null;accountCreated=false;showError(err?.code==='auth/email-already-in-use'?'Email tersebut sudah terdaftar. Gunakan email lain.':err.message||'Gagal membuat akun.');
    }finally{next.disabled=false;next.textContent='Simpan Akun';}
  });

  prev.addEventListener('click',()=>{clearError();step=1;updateUI();});

  form.addEventListener('submit',async e=>{
    e.preventDefault(); if(step!==2||!validateStep())return;
    const current=firebase.auth().currentUser; if(!current){showError('Sesi akun tidak ditemukan. Ulangi pendaftaran dari awal.');return;}
    submit.disabled=true;submit.textContent='Mengirim…';clearError();
    try{
      const token=await current.getIdToken(true);
      const gender=document.querySelector('input[name="jenisKelamin"]:checked')?.value||'';
      const payload={
        idToken:token, authUid:current.uid, nama:value('reg-nama'), username:value('reg-username').toLowerCase(), email:value('reg-email').toLowerCase(),
        nik:value('reg-nik'), kelas:value('reg-kelas'), jurusan:value('reg-jurusan'), tempatLahir:value('reg-tempat'), tanggalLahir:value('reg-tanggal'), agama:value('reg-agama'), jenisKelamin:gender,
        noHandphone:value('reg-hp'), golonganDarah:value('reg-darah'), alamat:value('reg-alamat'), divisi:value('reg-divisi'), fotoDrive:value('reg-foto-drive')
      };
      const resp=await fetch('/api/pendaftaran',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const data=await resp.json().catch(()=>({}));
      if(!resp.ok)throw new Error(data.error||`Pendaftaran gagal (${resp.status}).`);
      localStorage.setItem('pmr_last_registration',data.id||'');
      await firebase.auth().signOut();
      window.location.href='pendaftaran-selesai.html';
    }catch(err){showError(err.message||'Pendaftaran gagal.');submit.disabled=false;submit.textContent='Kirim Pendaftaran';}
  });

  updateUI();
});
