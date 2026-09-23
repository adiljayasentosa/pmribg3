/* =========================================================
   CS BOT — PMR WIRA UNIT SMK IBG 3
   Tombol berada di navbar. API key tidak pernah dikirim ke browser.
   ========================================================= */
(function initCsBot(){
  if (document.getElementById('pmr-csbot-root')) return;

  const style = document.createElement('style');
  style.textContent = `
    .pmr-cs-nav-btn{width:40px;height:40px;padding:5px;border:1px solid var(--gray-200,#e5e7eb);background:var(--white,#fff);border-radius:10px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease}
    .pmr-cs-nav-btn:hover{transform:translateY(-1px);box-shadow:0 5px 16px rgba(0,0,0,.10);border-color:rgba(200,16,46,.35)}
    .pmr-cs-nav-btn img{width:26px;height:26px;display:block}.pmr-cs-nav-label{font-size:13px;font-weight:700;color:#333;white-space:nowrap}.pmr-cs-nav-btn{width:auto;min-width:40px;gap:7px}.pmr-cs-nav-btn img{flex:0 0 auto}
    #pmr-csbot-root{position:fixed;right:18px;bottom:18px;z-index:9999;font-family:inherit;pointer-events:none}
    #pmr-csbot-panel{display:none;width:min(360px,calc(100vw - 28px));height:min(520px,calc(100vh - 100px));background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:18px;box-shadow:0 16px 50px rgba(0,0,0,.2);overflow:hidden;margin-bottom:10px;pointer-events:auto}
    #pmr-csbot-panel.open{display:flex;flex-direction:column}
    .pmr-cs-head{padding:14px 16px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center}
    .pmr-cs-head-main{display:flex;align-items:center;gap:10px}.pmr-cs-head-logo{width:32px;height:32px;border-radius:9px}
    .pmr-cs-head strong{font-size:15px}.pmr-cs-head span{display:block;color:#777;font-size:11px;margin-top:2px}
    #pmr-cs-close{border:0;background:transparent;font-size:20px;cursor:pointer;color:#777}
    #pmr-cs-messages{flex:1;overflow:auto;padding:14px;background:#f7f7f8;display:flex;flex-direction:column;gap:9px}
    .pmr-cs-msg{max-width:86%;padding:9px 11px;border-radius:13px;font-size:13px;line-height:1.45;white-space:pre-wrap}
    .pmr-cs-msg.bot{background:#fff;border:1px solid #eee;align-self:flex-start}.pmr-cs-msg.user{background:#b91c1c;color:#fff;align-self:flex-end}
    .pmr-cs-form{padding:10px;border-top:1px solid #eee;display:flex;gap:7px}.pmr-cs-form input{flex:1;min-width:0;border:1px solid #ddd;border-radius:12px;padding:9px 10px}.pmr-cs-form button{border:0;border-radius:12px;padding:0 13px;background:#b91c1c;color:#fff;font-weight:700;cursor:pointer}
    .pmr-cs-form button:disabled{opacity:.55;cursor:not-allowed}
    @media(max-width:760px){.pmr-cs-nav-btn{width:40px;height:40px;padding:5px;gap:0}.pmr-cs-nav-label{display:none}}
    @media(max-width:480px){#pmr-csbot-root{right:12px;bottom:12px}}
  `;
  document.head.appendChild(style);

  const root=document.createElement('div'); root.id='pmr-csbot-root';
  root.innerHTML=`<div id="pmr-csbot-panel"><div class="pmr-cs-head"><div class="pmr-cs-head-main"><img class="pmr-cs-head-logo" src="assets/cs-bot-logo.svg" alt="Logo CS PMR"><div><strong>CS PMR</strong><span>Asisten informasi website</span></div></div><button id="pmr-cs-close" aria-label="Tutup">×</button></div><div id="pmr-cs-messages"><div class="pmr-cs-msg bot">Halo. Saya bisa membantu menjelaskan cara menggunakan fitur website PMR.</div></div><form class="pmr-cs-form" id="pmr-cs-form"><input id="pmr-cs-input" maxlength="1000" placeholder="Tulis pertanyaan…" autocomplete="off"><button id="pmr-cs-send" type="submit">Kirim</button></form></div>`;
  document.body.appendChild(root);

  function mountTrigger(container, insertBeforeFirst=false){
    if (!container || container.querySelector('.pmr-cs-nav-btn')) return false;
    const btn=document.createElement('button');
    btn.type='button'; btn.className='pmr-cs-nav-btn'; btn.setAttribute('aria-label','Buka CS PMR'); btn.title='CS PMR';
    btn.innerHTML='<img src="assets/cs-bot-logo.svg" alt="CS PMR"><span class="pmr-cs-nav-label">CS PMR</span>';
    if (insertBeforeFirst && container.firstElementChild) container.insertBefore(btn,container.firstElementChild);
    else container.appendChild(btn);
    btn.addEventListener('click',togglePanel);
    return true;
  }

  const navActions=document.querySelector('.nav-actions');
  const topbarRight=document.querySelector('.topbar-right');
  const topbarLeft=document.querySelector('.topbar-left');
  if (navActions) mountTrigger(navActions,true);
  else if (topbarRight) mountTrigger(topbarRight,true);
  else if (topbarLeft) mountTrigger(topbarLeft);
  else {
    const fallback=document.createElement('button');
    fallback.type='button'; fallback.className='pmr-cs-nav-btn'; fallback.setAttribute('aria-label','Buka CS PMR');
    fallback.innerHTML='<img src="assets/cs-bot-logo.svg" alt="CS PMR">';
    fallback.addEventListener('click',togglePanel);
    document.body.appendChild(fallback);
  }

  const panel=root.querySelector('#pmr-csbot-panel'), msgs=root.querySelector('#pmr-cs-messages'), form=root.querySelector('#pmr-cs-form'), input=root.querySelector('#pmr-cs-input'), send=root.querySelector('#pmr-cs-send');
  function togglePanel(){panel.classList.toggle('open'); if(panel.classList.contains('open')) input.focus()}
  root.querySelector('#pmr-cs-close').onclick=()=>panel.classList.remove('open');
  function add(text,who){const d=document.createElement('div');d.className='pmr-cs-msg '+who;d.textContent=text;msgs.appendChild(d);msgs.scrollTop=msgs.scrollHeight;return d}
  form.addEventListener('submit',async(e)=>{
    e.preventDefault(); const message=input.value.trim(); if(!message||send.disabled)return;
    add(message,'user'); input.value=''; send.disabled=true; input.disabled=true;
    const loading=add('Mengetik…','bot');
    try{
      const r=await fetch('/api/cs-bot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message})});
      const data=await r.json().catch(()=>({})); loading.remove(); add(r.ok&&data.ok?data.reply:(data.error||'CS Bot sedang tidak tersedia.'),'bot');
    }catch(_){loading.remove();add('CS Bot tidak dapat terhubung ke server. Periksa koneksi internet.','bot')}
    finally{send.disabled=false;input.disabled=false;input.focus()}
  });
})();
