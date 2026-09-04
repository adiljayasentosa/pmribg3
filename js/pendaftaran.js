/* =========================================================
   PENDAFTARAN ANGGOTA PMR — public registration flow
   4 langkah: Data Diri -> Alamat -> KTA & Dokumen -> Konfirmasi
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registration-form');
  const panels = [...document.querySelectorAll('.registration-panel')];
  const indicators = [...document.querySelectorAll('[data-step-indicator]')];
  const prev = document.getElementById('reg-prev');
  const next = document.getElementById('reg-next');
  const submit = document.getElementById('reg-submit');
  const errorEl = document.getElementById('registration-error');
  let step = 1;

  function esc(v) {
    return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }
  function showError(msg) { errorEl.textContent = msg; errorEl.style.display = 'block'; errorEl.scrollIntoView({behavior:'smooth',block:'nearest'}); }
  function clearError() { errorEl.textContent = ''; errorEl.style.display = 'none'; }

  function currentPanel() { return panels.find(p => Number(p.dataset.step) === step); }
  function validCurrentStep() {
    clearError();
    const fields = [...currentPanel().querySelectorAll('input,select,textarea')].filter(x => x.type !== 'file' && x.id !== 'reg-honeypot');
    for (const field of fields) {
      if (!field.checkValidity()) { field.reportValidity(); return false; }
    }
    if (step === 3) {
      const drive = document.getElementById('reg-drive').value.trim();
      if (!/^https:\/\/(drive\.google\.com|docs\.google\.com)\//i.test(drive)) {
        showError('Link Google Drive wajib berupa link drive.google.com atau docs.google.com.');
        return false;
      }
    }
    return true;
  }

  function updateUI() {
    panels.forEach(p => p.classList.toggle('active', Number(p.dataset.step) === step));
    indicators.forEach(i => {
      const n = Number(i.dataset.stepIndicator);
      i.classList.toggle('active', n === step);
      i.classList.toggle('done', n < step);
    });
    prev.style.display = step > 1 ? '' : 'none';
    next.style.display = step < 4 ? '' : 'none';
    submit.style.display = step === 4 ? '' : 'none';
    if (step === 4) buildSummary();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function value(id) { return document.getElementById(id)?.value?.trim() || ''; }
  function buildSummary() {
    const rows = [
      ['Nama', value('reg-nama')], ['NIK', value('reg-nik')], ['Kelas', value('reg-kelas')],
      ['Tempat, Tanggal Lahir', `${value('reg-tempat')}, ${value('reg-tanggal')}`],
      ['Agama', value('reg-agama')], ['Jenis Kelamin', value('reg-gender')], ['No Handphone', value('reg-hp')],
      ['Golongan Darah', value('reg-darah')], ['Divisi', value('reg-divisi')],
      ['Alamat', `${value('reg-alamat')}, ${value('reg-desa')}, ${value('reg-kec')}, ${value('reg-kab')}, ${value('reg-provinsi')}`],
      ['Unit PMI Kab/Kota', value('reg-unit-pmi')], ['Nomor Induk PMR', value('reg-ni') || 'Akan ditentukan pengurus'],
      ['Foto KTA', 'Melalui link Google Drive'], ['Link Google Drive', value('reg-drive')]
    ];
    document.getElementById('registration-summary').innerHTML = rows.map(([k,v]) => `<div class="registration-summary-row"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('');
  }

  next.addEventListener('click', () => { if (!validCurrentStep()) return; step = Math.min(4, step + 1); updateUI(); });
  prev.addEventListener('click', () => { clearError(); step = Math.max(1, step - 1); updateUI(); });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (step !== 4) return;
    if (!validCurrentStep()) return;
    clearError();
    submit.disabled = true; submit.textContent = 'Mengirim…';
    try {
      const payload = {
        nama:value('reg-nama'), nik:value('reg-nik'), nomorInduk:value('reg-ni'), kelas:value('reg-kelas'),
        tempatLahir:value('reg-tempat'), tanggalLahir:value('reg-tanggal'), agama:value('reg-agama'),
        jenisKelamin:value('reg-gender'), noHandphone:value('reg-hp'), golonganDarah:value('reg-darah'),
        provinsi:value('reg-provinsi'), kabKota:value('reg-kab'), kecamatan:value('reg-kec'),
        desaKelurahan:value('reg-desa'), alamat:value('reg-alamat'), unitPmiKabKota:value('reg-unit-pmi'),
        divisi:value('reg-divisi'), foto:'', linkDrive:value('reg-drive'),
        website:value('reg-honeypot')
      };
      const resp = await fetch('/api/pendaftaran', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const raw = await resp.text();
      let data = {}; try { data = raw ? JSON.parse(raw) : {}; } catch { throw new Error('Server mengembalikan respons yang tidak valid.'); }
      if (!resp.ok) throw new Error(data.error || `Pendaftaran gagal (${resp.status}).`);
      localStorage.setItem('pmr_last_registration', data.id || '');
      window.location.href = 'pendaftaran-selesai.html';
    } catch (err) {
      showError(err.message || 'Pendaftaran gagal.');
      submit.disabled = false; submit.textContent = 'Kirim Pendaftaran';
    }
  });

  updateUI();
});
