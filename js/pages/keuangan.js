/* =========================================================
   PAGES/KEUANGAN.JS
   =========================================================
   [F4.4] Fitur 1 — Update Sistem Keuangan. Halaman ini sekarang
   2 tab:
     - Buku Kas         : daftar transaksi (fitur asli, tidak
                           berubah perilaku) + proteksi entri
                           bersumber iuran (lihat _rowKas).
     - Pembayaran Iuran : status bayar bulanan per anggota +
                           rekap otomatis, sinkron ke Buku Kas
                           lewat DB.iuran (js/core/firebase-db.js).

   RBAC edit dipertahankan PERSIS seperti versi sebelum F4.4:
   canEdit = admin & bendahara SAJA (lebih sempit dari
   ROLE_AKSES_KEUANGAN yang dipakai di level fetch data — itu
   sudah benar sejak awal, keduanya memang beda lapisan).

   Rekap Pembayaran (_hitungRekapIuran) SENGAJA fungsi global
   (bukan tersembunyi di dalam renderKeuangan) supaya bisa dipakai
   ULANG oleh report-engine.js untuk laporan Keuangan (Fitur 1.D:
   "Gunakan engine F4.3, jangan membuat engine baru") — satu
   sumber kebenaran untuk rekap, dipakai baik oleh halaman ini
   maupun Report Engine.
   ========================================================= */

let _iuranBulanTerpilih = new Date().getMonth() + 1;
let _iuranTahunTerpilih = new Date().getFullYear();

/**
 * Hitung rekap pembayaran iuran untuk satu bulan/tahun.
 * Anggota TANPA record iuran dianggap "Belum Bayar" (default
 * implisit — lihat komentar desain di DB.iuran, firebase-db.js).
 */
function _hitungRekapIuran(bulan, tahun) {
  const baris = AppState.anggota
    .filter(a => a.status === "Aktif")
    .map(a => {
      const rec = AppState.iuran.find(r => r.anggotaId === a.id && r.bulan === bulan && r.tahun === tahun);
      return { ...a, statusIuran: rec ? rec.status : "Belum Bayar", nominalIuran: rec ? rec.nominal : 0 };
    })
    .sort((a,b) => a.nama.localeCompare(b.nama));

  const sudahBayar = baris.filter(b => b.statusIuran !== "Belum Bayar");
  const totalPemasukan = sudahBayar.reduce((s,b) => s + b.nominalIuran, 0);
  const jumlahBelum = baris.length - sudahBayar.length;

  return {
    baris,
    totalAnggota:    baris.length,
    jumlahSudahBayar: sudahBayar.length,
    jumlahBelumBayar: jumlahBelum,
    persentase:      baris.length ? Math.round((sudahBayar.length / baris.length) * 100) : 0,
    totalPemasukan,
    totalTunggakan:  jumlahBelum * (AppState.nominalIuranStandar || 0)
  };
}

/* ─────────────────────────────────────────────────────────
   RENDER UTAMA — 2 tab
───────────────────────────────────────────────────────── */
function renderKeuangan(el, user) {
  const canEdit = ["admin","bendahara"].includes(user.role);

  el.innerHTML = `
  <div class="page-head">
    <div><h1>Keuangan</h1><p class="page-sub">Buku kas &amp; pembayaran iuran PMR</p></div>
  </div>
  <div class="tab-bar">
    <button class="tab-btn active" id="tab-buku-kas">Buku Kas</button>
    <button class="tab-btn" id="tab-pembayaran-iuran">Pembayaran Iuran</button>
  </div>
  <div id="tab-content-keuangan"></div>`;

  function tampilTab(tab) {
    document.getElementById("tab-buku-kas").classList.toggle("active", tab === "kas");
    document.getElementById("tab-pembayaran-iuran").classList.toggle("active", tab === "iuran");
    if (tab === "kas") _renderTabBukuKas(el, user, canEdit);
    else _renderTabPembayaranIuran(el, user, canEdit);
  }
  document.getElementById("tab-buku-kas").addEventListener("click", () => tampilTab("kas"));
  document.getElementById("tab-pembayaran-iuran").addEventListener("click", () => tampilTab("iuran"));
  tampilTab("kas");
}

/* ─────────────────────────────────────────────────────────
   TAB 1 — BUKU KAS (fitur asli, perilaku tidak berubah —
   ditambah proteksi terhadap entri bersumber iuran)
───────────────────────────────────────────────────────── */
function _renderTabBukuKas(el, user, canEdit) {
  const c = document.getElementById("tab-content-keuangan");
  const masuk  = AppState.keuangan.filter(t=>t.jenis==="Masuk").reduce((s,t)=>s+t.jumlah,0);
  const keluar = AppState.keuangan.filter(t=>t.jenis==="Keluar").reduce((s,t)=>s+t.jumlah,0);
  const saldo  = AppState.ringkasan.kasSaldo;

  c.innerHTML = `
  <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:16px">
    <button class="btn btn-outline btn-sm" id="btn-print-kas">🖨 Cetak</button>
    ${canEdit?`<button class="btn btn-primary btn-sm" id="btn-tambah-kas">+ Catat Transaksi</button>`:""}
  </div>
  <div class="grid grid-3" style="margin-bottom:24px">
    <div class="card stat-card">
      <div class="stat-icon" style="background:var(--success-bg);color:var(--success)">
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
        </svg>
      </div>
      <div class="stat-value" style="color:var(--success)">${formatRupiah(masuk)}</div>
      <div class="stat-label">Total Pemasukan</div>
    </div>
    <div class="card stat-card">
      <div class="stat-icon" style="background:var(--danger-bg);color:var(--danger)">
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"/>
        </svg>
      </div>
      <div class="stat-value" style="color:var(--danger)">${formatRupiah(keluar)}</div>
      <div class="stat-label">Total Pengeluaran</div>
    </div>
    <div class="card stat-card">
      <div class="stat-icon">
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
        </svg>
      </div>
      <div class="stat-value">${formatRupiah(saldo)}</div>
      <div class="stat-label">Saldo Kas</div>
    </div>
  </div>
  <div class="card">
    <div class="table-toolbar">
      <div class="search-bar">
        <svg class="search-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input id="search-kas" type="search" placeholder="Cari uraian, jenis…">
      </div>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Tanggal</th><th>Uraian</th><th>Jenis</th><th>Jumlah</th>${canEdit?"<th>Aksi</th>":""}</tr></thead>
        <tbody id="tb-kas"></tbody>
      </table>
    </div>
  </div>`;

  const rowKas = t => `<tr>
    <td>${formatTanggal(t.tanggal)}</td>
    <td>${t.uraian}${t.sumber==="iuran"?` <span class="badge badge-info" title="Otomatis dari Pembayaran Iuran — kelola di tab Pembayaran Iuran">Iuran</span>`:""}</td>
    <td>${statusBadge(t.jenis)}</td>
    <td style="font-weight:600;color:${t.jenis==="Masuk"?"var(--success)":"var(--danger)"}">
      ${t.jenis==="Masuk"?"+":"-"} ${formatRupiah(t.jumlah)}
    </td>
    ${canEdit?`<td><div style="display:flex;gap:6px">
      <button class="btn btn-ghost btn-sm btn-edit-kas" data-id="${t.id}" title="Edit" aria-label="Edit transaksi ${t.uraian}">✏</button>
      <button class="btn btn-ghost btn-sm btn-hapus-kas" data-id="${t.id}" title="Hapus" aria-label="Hapus transaksi ${t.uraian}" style="color:var(--danger)">🗑</button>
    </div></td>`:""}
  </tr>`;

  renderTable(document.getElementById("tb-kas"), AppState.keuangan, rowKas);
  pasangSearch("search-kas","tb-kas",AppState.keuangan,rowKas,["uraian","jenis"]);

  document.getElementById("tb-kas")?.addEventListener("click", e => {
    const id = e.target.closest("[data-id]")?.dataset.id;
    if (!id) return;
    const t = AppState.keuangan.find(x=>x.id===id);

    /* [F4.4] Entri bersumber iuran TIDAK BOLEH diedit/dihapus langsung
       dari sini — itu akan membuat record di collection `iuran` desync
       dari transaksi kas-nya (status pembayaran tetap tercatat "Lunas"
       padahal transaksinya sudah diubah/hilang). Arahkan ke tab yang
       benar, di mana perubahan status SELALU menyinkronkan keduanya
       lewat DB.iuran (satu batch write). */
    if (t?.sumber === "iuran") {
      tampilToast("Transaksi ini dari Pembayaran Iuran — ubah statusnya di tab Pembayaran Iuran.", "default");
      return;
    }

    if (e.target.closest(".btn-edit-kas"))
      bukaFormKas(t, ()=>renderKeuangan(el,user));
    if (e.target.closest(".btn-hapus-kas")) {
      Modal.konfirmasi(`Hapus transaksi <strong>${t?.uraian}</strong>?`, async ()=>{
        await DB.keuangan.hapus(id);
        if (!FIREBASE_ENABLED) renderKeuangan(el,user);
        tampilToast("Transaksi dihapus.","default");
      });
    }
  });

  document.getElementById("btn-tambah-kas")?.addEventListener("click",()=>bukaFormKas(null,()=>renderKeuangan(el,user)));
  document.getElementById("btn-print-kas")?.addEventListener("click",()=>window.print());
}

function bukaFormKas(data, onSimpan) {
  const isEdit = !!data;
  Modal.buka({
    judul:isEdit?"Edit Transaksi":"Catat Transaksi Baru",
    konten:`
      <div class="field">
        <label>Uraian</label>
        <input id="f-uraian" type="text" value="${data?.uraian||""}" placeholder="Keterangan transaksi">
      </div>
      <div class="grid grid-2">
        <div class="field">
          <label>Jenis</label>
          <select id="f-jenis">
            <option ${data?.jenis==="Masuk"?"selected":""}>Masuk</option>
            <option ${data?.jenis==="Keluar"?"selected":""}>Keluar</option>
          </select>
        </div>
        <div class="field">
          <label>Jumlah (Rp)</label>
          <input id="f-jumlah" type="number" value="${data?.jumlah||""}" placeholder="0">
        </div>
        <div class="field" style="grid-column:1/-1">
          <label>Tanggal</label>
          <input id="f-tgl-kas" type="date" value="${data?.tanggal||""}">
        </div>
      </div>`,
    aksi:[
      {label:"Batal",kelas:"btn-ghost",id:"m-batal-kas",onClick:()=>Modal.tutup()},
      {label:isEdit?"Simpan":"Catat",kelas:"btn-primary",id:"m-simpan-kas",onClick:()=>{
        const uraian = document.getElementById("f-uraian").value.trim();
        const jumlah = +document.getElementById("f-jumlah").value;
        if (!uraian || !jumlah) { tampilToast("Uraian dan jumlah tidak boleh kosong.","danger"); return; }
        const payload = {
          uraian, jumlah, jenis:document.getElementById("f-jenis").value,
          tanggal:document.getElementById("f-tgl-kas").value || new Date().toISOString().split("T")[0]
        };
        _jalankanSimpan("m-simpan-kas", async ()=>{
          if (isEdit) await DB.keuangan.update(data.id, payload);
          else await DB.keuangan.tambah(payload);
          Modal.tutup();
          if (!FIREBASE_ENABLED) onSimpan?.();
          tampilToast(isEdit?"Transaksi diperbarui.":"Transaksi dicatat.","success");
        });
      }}
    ]
  });
}

/* ─────────────────────────────────────────────────────────
   TAB 2 — PEMBAYARAN IURAN (F4.4 Fitur 1.A & 1.B)
───────────────────────────────────────────────────────── */
function _renderTabPembayaranIuran(el, user, canEdit) {
  const c = document.getElementById("tab-content-keuangan");
  /* [F4.4 / audit Rules] "Batalkan" memicu batch.delete() pada collection
     `keuangan` (lihat DB.iuran.batalkan) — Rules Firestore HANYA izinkan
     admin menghapus dokumen keuangan ("Audit trail dijaga: delete hanya
     admin. Ketua koreksi via update, bukan delete."). canEdit (admin+
     bendahara) TIDAK cukup di sini; kalau tombol ini tetap tampil untuk
     bendahara, klik-nya akan gagal permission-denied di Firestore
     sungguhan (baru ketahuan saat audit Rules, tidak ketahuan di mode
     demo karena demo tidak menegakkan Rules sama sekali). */
  const canHapusIuran = user.role === "admin";
  const rekap = _hitungRekapIuran(_iuranBulanTerpilih, _iuranTahunTerpilih);
  const namaBulanOpsi = Array.from({length:12}, (_,i) => i+1);

  c.innerHTML = `
  <div class="card" style="margin-bottom:20px">
    <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end">
      <div class="field" style="margin-bottom:0">
        <label>Bulan</label>
        <select id="iuran-pilih-bulan">
          ${namaBulanOpsi.map(b => `<option value="${b}" ${b===_iuranBulanTerpilih?"selected":""}>${formatBulanTahun(b, _iuranTahunTerpilih).split(" ")[0]}</option>`).join("")}
        </select>
      </div>
      <div class="field" style="margin-bottom:0">
        <label>Tahun</label>
        <input id="iuran-pilih-tahun" type="number" value="${_iuranTahunTerpilih}" style="width:100px">
      </div>
      ${canEdit ? `
        <div class="field" style="margin-bottom:0;margin-left:auto">
          <label>Nominal Iuran Standar</label>
          <div style="display:flex;gap:6px">
            <input id="iuran-nominal-standar" type="number" min="0" value="${AppState.nominalIuranStandar}" style="width:130px">
            <button class="btn btn-outline btn-sm" id="btn-simpan-nominal-standar">Simpan</button>
          </div>
        </div>` : `
        <div style="margin-left:auto;font-size:0.85rem;color:var(--ink-soft)">
          Nominal standar: <strong>${formatRupiah(AppState.nominalIuranStandar)}</strong>
        </div>`}
    </div>
  </div>

  <div class="grid grid-4" style="margin-bottom:20px">
    <div class="card stat-card">
      <div class="stat-value">${rekap.jumlahSudahBayar}/${rekap.totalAnggota}</div>
      <div class="stat-label">Sudah Membayar</div>
      <div class="stat-delta" style="color:var(--ink-soft)">${rekap.persentase}% dari anggota aktif</div>
    </div>
    <div class="card stat-card">
      <div class="stat-icon" style="background:var(--warning-bg);color:var(--warning)">
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-8.25 3h.008v.008h-.008V15z"/>
        </svg>
      </div>
      <div class="stat-value" style="color:var(--warning)">${rekap.jumlahBelumBayar}</div>
      <div class="stat-label">Belum Membayar</div>
    </div>
    <div class="card stat-card">
      <div class="stat-icon" style="background:var(--success-bg);color:var(--success)">
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
        </svg>
      </div>
      <div class="stat-value" style="color:var(--success)">${formatRupiah(rekap.totalPemasukan)}</div>
      <div class="stat-label">Pemasukan Iuran Bulan Ini</div>
    </div>
    <div class="card stat-card">
      <div class="stat-icon" style="background:var(--danger-bg);color:var(--danger)">
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"/>
        </svg>
      </div>
      <div class="stat-value" style="color:var(--danger)">${formatRupiah(rekap.totalTunggakan)}</div>
      <div class="stat-label">Total Tunggakan</div>
    </div>
  </div>

  <div class="card">
    <div class="table-toolbar">
      <div class="search-bar">
        <svg class="search-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input id="search-iuran" type="search" placeholder="Cari nama, kelas…">
      </div>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Nama</th><th>Kelas</th><th>Status</th><th>Nominal</th>${canEdit?"<th>Aksi</th>":""}</tr></thead>
        <tbody id="tb-iuran"></tbody>
      </table>
    </div>
  </div>`;

  const rowIuran = b => `<tr>
    <td><div style="display:flex;align-items:center;gap:8px">
      <div class="avatar" style="width:28px;height:28px;font-size:0.65rem">${getInisial(b.nama)}</div>${b.nama}
    </div></td>
    <td>${b.kelas}</td>
    <td>${statusBadge(b.statusIuran)}</td>
    <td>${b.nominalIuran ? formatRupiah(b.nominalIuran) : "—"}</td>
    ${canEdit?`<td><div style="display:flex;gap:6px;flex-wrap:wrap">
      <button class="btn btn-ghost btn-sm btn-tandai-lunas" data-id="${b.id}" title="Tandai sudah bayar sesuai nominal standar">✓ Lunas</button>
      <button class="btn btn-ghost btn-sm btn-nominal-khusus" data-id="${b.id}" title="Catat pembayaran dengan nominal berbeda">Rp Khusus</button>
      ${canHapusIuran && b.statusIuran!=="Belum Bayar"?`<button class="btn btn-ghost btn-sm btn-batalkan-iuran" data-id="${b.id}" title="Kembalikan ke Belum Bayar" style="color:var(--danger)">↺</button>`:""}
    </div></td>`:""}
  </tr>`;

  renderTable(document.getElementById("tb-iuran"), rekap.baris, rowIuran);
  pasangSearch("search-iuran","tb-iuran",rekap.baris,rowIuran,["nama","kelas"]);

  document.getElementById("iuran-pilih-bulan").addEventListener("change", e => {
    _iuranBulanTerpilih = +e.target.value;
    _renderTabPembayaranIuran(el, user, canEdit);
  });
  document.getElementById("iuran-pilih-tahun").addEventListener("change", e => {
    const v = +e.target.value;
    if (v >= 2000 && v <= 2100) { _iuranTahunTerpilih = v; _renderTabPembayaranIuran(el, user, canEdit); }
  });

  document.getElementById("btn-simpan-nominal-standar")?.addEventListener("click", async () => {
    const nilai = +document.getElementById("iuran-nominal-standar").value;
    if (!nilai || nilai <= 0) { tampilToast("Nominal standar harus lebih dari 0.", "danger"); return; }
    await DB.iuran.setNominalStandar(nilai);
    if (!FIREBASE_ENABLED) _renderTabPembayaranIuran(el, user, canEdit);
    tampilToast("Nominal iuran standar diperbarui.", "success");
  });

  document.getElementById("tb-iuran")?.addEventListener("click", async e => {
    const id = e.target.closest("[data-id]")?.dataset.id;
    if (!id) return;
    const a = AppState.anggota.find(x => x.id === id);
    if (!a) return;

    if (e.target.closest(".btn-tandai-lunas")) {
      await DB.iuran.setStatus({
        anggotaId:id, anggotaNama:a.nama, bulan:_iuranBulanTerpilih, tahun:_iuranTahunTerpilih,
        status:"Lunas", nominal: AppState.nominalIuranStandar
      });
      if (!FIREBASE_ENABLED) _renderTabPembayaranIuran(el, user, canEdit);
      tampilToast(`${a.nama} ditandai sudah membayar.`, "success");
    }

    if (e.target.closest(".btn-nominal-khusus")) {
      const existing = AppState.iuran.find(r => r.anggotaId===id && r.bulan===_iuranBulanTerpilih && r.tahun===_iuranTahunTerpilih);
      _bukaModalNominalKhusus(a, existing, async (nominal) => {
        await DB.iuran.setStatus({
          anggotaId:id, anggotaNama:a.nama, bulan:_iuranBulanTerpilih, tahun:_iuranTahunTerpilih,
          status:"Khusus", nominal
        });
        if (!FIREBASE_ENABLED) _renderTabPembayaranIuran(el, user, canEdit);
        tampilToast(`Pembayaran khusus ${a.nama} dicatat.`, "success");
      });
    }

    if (e.target.closest(".btn-batalkan-iuran") && canHapusIuran) {
      Modal.konfirmasi(`Kembalikan status <strong>${a.nama}</strong> ke "Belum Bayar"? Transaksi kas terkait ikut dihapus.`, async () => {
        await DB.iuran.batalkan(id, _iuranBulanTerpilih, _iuranTahunTerpilih);
        if (!FIREBASE_ENABLED) _renderTabPembayaranIuran(el, user, canEdit);
        tampilToast(`Status ${a.nama} dikembalikan ke Belum Bayar.`, "default");
      });
    }
  });
}

function _bukaModalNominalKhusus(anggota, existing, onSimpan) {
  Modal.buka({
    judul: `Nominal Khusus — ${anggota.nama}`,
    konten: `
      <p style="margin-top:0;color:var(--ink-soft);font-size:0.85rem">
        Dipakai apabila pembayaran tidak sesuai nominal standar
        (${formatRupiah(AppState.nominalIuranStandar)}) — mis. dispensasi, cicilan, atau kelebihan bayar.
      </p>
      <div class="field">
        <label>Nominal Dibayar (Rp)</label>
        <input id="f-nominal-khusus" type="number" min="0" value="${existing?.nominal||""}" placeholder="Contoh: 2000">
      </div>
      <div id="err-nominal-khusus" class="alert alert-danger" style="display:none"></div>`,
    aksi: [
      { label:"Batal", kelas:"btn-ghost", id:"m-batal-nominal-khusus", onClick:()=>Modal.tutup() },
      { label:"Simpan", kelas:"btn-primary", id:"m-simpan-nominal-khusus", onClick:()=>{
        const nominal = +document.getElementById("f-nominal-khusus").value;
        if (!nominal || nominal <= 0) {
          const err = document.getElementById("err-nominal-khusus");
          err.textContent = "Nominal harus lebih dari 0."; err.style.display = "flex"; return;
        }
        _jalankanSimpan("m-simpan-nominal-khusus", async () => {
          await onSimpan(nominal);
          Modal.tutup();
        });
      }}
    ]
  });
}
