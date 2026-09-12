/* =========================================================
   CS BOT — PMR WIRA UNIT SMK IBG 3
   Frontend ringan. API key tidak pernah dikirim ke browser.
   ========================================================= */
(function initCsBot(){
  if (document.getElementById('pmr-csbot-root')) return;

  const style = document.createElement('style');
  style.textContent = `
    #pmr-csbot-root{position:fixed;right:18px;bottom:18px;z-index:9999;font-family:inherit}
    #pmr-csbot-toggle{border:0;border-radius:999px;padding:11px 16px;background:var(--primary,#b91c1c);color:#fff;font-weight:700;box-shadow:0 8px 25px rgba(0,0,0,.16);cursor:pointer}
    #pmr-csbot-panel{display:none;width:min(360px,calc(100vw - 28px));height:min(520px,calc(100vh - 100px));background:#fff;border:1px solid rgba(0,0,0,.08);border-radius:18px;box-shadow:0 16px 50px rgba(0,0,0,.2);overflow:hidden;margin-bottom:10px}
    #pmr-csbot-panel.open{display:flex;flex-direction:column}
    .pmr-cs-head{padding:14px 16px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center}
    .pmr-cs-head strong{font-size:15px}.pmr-cs-head span{display:block;color:#777;font-size:11px;margin-top:2px}
    #pmr-cs-close{border:0;background:transparent;font-size:20px;cursor:pointer;color:#777}
    #pmr-cs-messages{flex:1;overflow:auto;padding:14px;background:#f7f7f8;display:flex;flex-direction:column;gap:9px}
    .pmr-cs-msg{max-width:86%;padding:9px 11px;border-radius:13px;font-size:13px;line-height:1.45;white-space:pre-wrap}
    .pmr-cs-msg.bot{background:#fff;border:1px solid #eee;align-self:flex-start}.pmr-cs-msg.user{background:#b91c1c;color:#fff;align-self:flex-end}
    .pmr-cs-form{padding:10px;border-top:1px solid #eee;display:flex;gap:7px}.pmr-cs-form input{flex:1;min-width:0;border:1px solid #ddd;border-radius:12px;padding:9px 10px}.pmr-cs-form button{border:0;border-radius:12px;padding:0 13px;background:#b91c1c;color:#fff;font-weight:700;cursor:pointer}
    .pmr-cs-form button:disabled{opacity:.55;cursor:not-allowed}
    @media(max-width:480px){#pmr-csbot-root{right:12px;bottom:12px}}
  `;
  document.head.appendChild(style);

  const root=document.createElement('div'); root.id='pmr-csbot-root';
  root.innerHTML=`<div id="pmr-csbot-panel"><div class="pmr-cs-head"><div><strong>CS PMR</strong><span>Asisten informasi website</span></div><button id="pmr-cs-close" aria-label="Tutup">×</button></div><div id="pmr-cs-messages"><div class="pmr-cs-msg bot">Halo. Saya bisa membantu menjelaskan cara menggunakan fitur website PMR.</div></div><form class="pmr-cs-form" id="pmr-cs-form"><input id="pmr-cs-input" maxlength="1000" placeholder="Tulis pertanyaan…" autocomplete="off"><button id="pmr-cs-send" type="submit">Kirim</button></form></div><button id="pmr-csbot-toggle" type="button">💬 CS PMR</button>`;
  document.body.appendChild(root);

  const panel=root.querySelector('#pmr-csbot-panel'), msgs=root.querySelector('#pmr-cs-messages'), form=root.querySelector('#pmr-cs-form'), input=root.querySelector('#pmr-cs-input'), send=root.querySelector('#pmr-cs-send');
  root.querySelector('#pmr-csbot-toggle').onclick=()=>{panel.classList.toggle('open'); if(panel.classList.contains('open')) input.focus()};
  root.querySelector('#pmr-cs-close').onclick=()=>panel.classList.remove('open');

  function add(text,who){const d=document.createElement('div');d.className='pmr-cs-msg '+who;d.textContent=text;msgs.appendChild(d);msgs.scrollTop=msgs.scrollHeight;return d}
  form.addEventListener('submit',async e=>{
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
