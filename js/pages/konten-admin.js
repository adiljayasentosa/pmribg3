/* =========================================================
   PAGES/KONTEN-ADMIN.JS — [F6.0 — Konten Publik]            BARU
   =========================================================
   Manajemen Artikel/Video/Poster/Dokumentasi di Dashboard
   Internal. SATU modul generik dipakai utk 4 halaman sidebar
   (bukan 4 file terpisah) — parameter `tipe` menentukan kolom,
   field form, dan collection yang dipakai.

   Mengikuti pola CRUD yang SUDAH ADA di project ini (lihat
   inventaris.js) — page-head, stat card, table-toolbar, modal
   form, tombol Aksi — supaya terasa satu design system yang
   sama. Beda satu hal: data diambil async lewat ContentDB
   (bukan AppState yang sudah di-load sinkron sejak awal),
   karena 4 collection ini sengaja TIDAK dimuat DB.init() —
   jadi nol dampak ke waktu boot dashboard yang sudah ada.

   RBAC (defense-in-depth, PERSIS sama dengan firestore.rules):
     Lihat (termasuk draft) : admin, ketua, wakil, sekretaris,
                              bendahara, pj  (anggota pakai
                              halaman publik saja, bukan menu ini)
     Tambah/Edit/Hapus      : admin (semua) ATAU
                              pj YANG divisinya == pjDivisi item
   ========================================================= */

const _DIVISI_PJ_OPSI = ["Humas & Publikasi", "Dokumentasi", "Pendidikan & Pelatihan"];

const _KONTEN_ADMIN_KONFIG = {
  artikel:     { label: "Artikel",     kategoriOpsi: ["Kesehatan", "Kemanusiaan", "Kesiapsiagaan"] },
  video:       { label: "Video",       kategoriOpsi: ["Tutorial", "Dokumentasi"] },
  poster:      { label: "Poster",      kategoriOpsi: ["Kesehatan", "Pertolongan Pertama"] },
  dokumentasi: { label: "Dokumentasi", kategoriOpsi: [] }
};

function _bolehKelolaItemKonten(user, item) {
  if (user.role === "admin") return true;
  if (user.role === "pj" && user.divisi && item.pjDivisi === user.divisi) return true;
  return false;
}
function _bolehTambahKonten(user) {
  return user.role === "admin" || user.role === "pj";
}

async function renderKontenAdmin(el, user, tipe) {
  const cfg = _KONTEN_ADMIN_KONFIG[tipe];

  el.innerHTML = `
  <div class="page-head">
    <div><h1>Manajemen ${cfg.label}</h1><p class="page-sub">Kelola ${cfg.label.toLowerCase()} yang tampil di halaman publik</p></div>
    <div id="head-aksi-konten"></div>
  </div>
  <div class="grid grid-3" style="margin-bottom:24px" id="stat-konten">
    ${skCard({ lines: 1 })}${skCard({ lines: 1 })}${skCard({ lines: 1 })}
  </div>
  <div class="card">
    <div class="table-toolbar">
      <div class="search-bar">
        <svg class="search-icon" width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input id="search-konten" type="search" placeholder="Cari judul…">
      </div>
      <select id="filter-status-konten" style="padding:9px 14px;border:1.5px solid var(--gray-300);border-radius:var(--radius-pill);background:var(--gray-100);font-size:0.85rem">
        <option value="">Semua Status</option>
        <option value="publish">Terbit</option>
        <option value="draft">Draft</option>
      </select>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Judul</th><th>Tanggal</th><th>PJ Divisi</th><th>Status</th><th>Aksi</th></tr></thead>
        <tbody id="tb-konten">${_skeletonBarisTabel(4)}</tbody>
      </table>
    </div>
  </div>`;

  const semua = await ContentDB.fetchAllUntukAdmin(tipe);
  const bisaTambah = _bolehTambahKonten(user);

  if (bisaTambah) {
    document.getElementById("head-aksi-konten").innerHTML =
      `<button class="btn btn-primary btn-sm" id="btn-tambah-konten">+ Tambah ${cfg.label}</button>`;
    document.getElementById("btn-tambah-konten").addEventListener("click", () =>
      _bukaFormKonten(tipe, cfg, null, user, () => renderKontenAdmin(el, user, tipe)));
  }

  document.getElementById("stat-konten").innerHTML = [
    statCard(`Total ${cfg.label}`, semua.length, "seluruh item", "neutral",
      `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>`),
    statCard("Terbit", semua.filter(x => x.publish).length, "tampil di publik", "neutral",
      `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>`),
    statCard("Draft", semua.filter(x => !x.publish).length, "belum ditampilkan", "neutral",
      `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>`)
  ].join("");

  const rowKonten = (x) => {
    const bolehKelola = _bolehKelolaItemKonten(user, x);
    return `<tr>
      <td><strong>${x.judul}</strong></td>
      <td style="white-space:nowrap">${formatTanggal(x.tanggal)}</td>
      <td>${x.pjDivisi || "—"}</td>
      <td>${x.publish ? `<span class="badge badge-success">Terbit</span>` : `<span class="badge badge-gray">Draft</span>`}</td>
      <td><div style="display:flex;gap:6px">
        <a href="${tipe}.html?slug=${x.slug}" target="_blank" class="btn btn-ghost btn-sm" title="Lihat halaman publik">👁</a>
        ${bolehKelola ? `<button class="btn btn-ghost btn-sm btn-edit-konten" data-id="${x.id}" title="Edit">✏</button>` : ""}
        ${bolehKelola ? `<button class="btn btn-ghost btn-sm btn-hapus-konten" data-id="${x.id}" title="Hapus" style="color:var(--danger)">🗑</button>` : ""}
      </div></td>
    </tr>`;
  };

  function terapkanFilter() {
    const q = document.getElementById("search-konten").value.toLowerCase().trim();
    const statusF = document.getElementById("filter-status-konten").value;
    const hasil = semua.filter(x => {
      const cocokQ = !q || x.judul.toLowerCase().includes(q);
      const cocokStatus = !statusF || (statusF === "publish" ? x.publish : !x.publish);
      return cocokQ && cocokStatus;
    });
    const tbody = document.getElementById("tb-konten");
    if (!hasil.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--ink-soft)">Belum ada data.</td></tr>`;
      return;
    }
    tbody.innerHTML = hasil.map(rowKonten).join("");
  }
  terapkanFilter();
  document.getElementById("search-konten").addEventListener("input", terapkanFilter);
  document.getElementById("filter-status-konten").addEventListener("change", terapkanFilter);

  document.getElementById("tb-konten").addEventListener("click", (e) => {
    const id = e.target.closest("[data-id]")?.dataset.id;
    if (!id) return;
    const item = semua.find(x => x.id === id);
    if (!item) return;
    if (e.target.closest(".btn-edit-konten")) {
      _bukaFormKonten(tipe, cfg, item, user, () => renderKontenAdmin(el, user, tipe));
    }
    if (e.target.closest(".btn-hapus-konten")) {
      Modal.konfirmasi(`Hapus <strong>${item.judul}</strong>? Item akan langsung hilang dari halaman publik.`, async () => {
        await ContentDB.remove(tipe, id);
        renderKontenAdmin(el, user, tipe);
        tampilToast(`${cfg.label} dihapus.`, "default");
      });
    }
  });
}

function _skeletonBarisTabel(n) {
  return Array.from({ length: n }, () =>
    `<tr><td colspan="5"><div class="skeleton skeleton-text w-75" style="margin:6px 0"></div></td></tr>`).join("");
}

/* [F7.0] Ambil ID video YouTube dari berbagai bentuk URL (watch?v=,
   youtu.be/, embed/) — dipakai untuk membangun URL embed pemutar DAN
   thumbnail otomatis bila PJ tidak meng-upload thumbnail sendiri. */
function _idYoutubeDariUrl(url) {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{6,})/);
  return m ? m[1] : null;
}

/* ─────────────────────────────────────────────────────────
   MODAL FORM — field menyesuaikan tipe konten
   [F7.0] Input URL gambar manual (Poster/Dokumentasi) & textarea
   panjang (Artikel) DIHAPUS TOTAL — diganti upload widget lewat
   js/core/storage.js. SATU widget yang sama dipakai di keempat
   form (initUploadWidget), tidak ada kode upload berbeda-beda.
───────────────────────────────────────────────────────── */
function _bukaFormKonten(tipe, cfg, data, user, onSimpan) {
  const isEdit = !!data;

  const fieldEkstra = {
    artikel: `
      <div class="field" style="grid-column:1/-1">
        <label>Ringkasan</label>
        <input id="f-k-ringkasan" type="text" value="${data?.ringkasan || ""}" placeholder="Ringkasan singkat untuk kartu artikel">
      </div>
      <div class="field" style="grid-column:1/-1">
        <label>Link Artikel <span style="color:var(--ink-soft);font-weight:400">(halaman HTML internal, Google Docs, atau URL lain)</span></label>
        <input id="f-k-articleurl" type="text" value="${data?.articleUrl || ""}" placeholder="https://... atau /artikel/nama-file.html">
      </div>
      <div class="field">
        <label>Penulis</label>
        <input id="f-k-penulis" type="text" value="${data?.penulis || ""}" placeholder="Nama penulis">
      </div>
      <div class="field" style="grid-column:1/-1">
        <label>Cover Artikel</label>
        <div id="f-k-cover-widget"></div>
      </div>`,
    video: `
      <div class="field" style="grid-column:1/-1">
        <label>Deskripsi</label>
        <input id="f-k-deskripsi" type="text" value="${data?.deskripsi || ""}">
      </div>
      <div class="field" style="grid-column:1/-1">
        <label>URL YouTube</label>
        <input id="f-k-videourl" type="text" value="${data?.videoUrl || data?.embedUrl || ""}" placeholder="https://www.youtube.com/watch?v=...">
      </div>
      <div class="field">
        <label>Durasi</label>
        <input id="f-k-durasi" type="text" value="${data?.durasi || ""}" placeholder="3:45">
      </div>
      <div class="field" style="grid-column:1/-1">
        <label>Upload Thumbnail <span style="color:var(--ink-soft);font-weight:400">(opsional — kosongkan untuk pakai thumbnail YouTube otomatis)</span></label>
        <div id="f-k-thumb-widget"></div>
      </div>`,
    poster: `
      <div class="field" style="grid-column:1/-1">
        <label>Deskripsi</label>
        <input id="f-k-deskripsi" type="text" value="${data?.deskripsi || ""}">
      </div>
      <div class="field" style="grid-column:1/-1">
        <label>Upload Poster</label>
        <div id="f-k-cover-widget"></div>
      </div>`,
    dokumentasi: `
      <div class="field" style="grid-column:1/-1">
        <label>Deskripsi</label>
        <input id="f-k-deskripsi" type="text" value="${data?.deskripsi || ""}">
      </div>
      <div class="field" style="grid-column:1/-1">
        <label>Upload Cover</label>
        <div id="f-k-cover-widget"></div>
      </div>
      <div class="field" style="grid-column:1/-1">
        <label>Upload Galeri Foto <span style="color:var(--ink-soft);font-weight:400">(bisa pilih banyak sekaligus)</span></label>
        <div id="f-k-gallery-widget"></div>
      </div>`
  }[tipe];

  Modal.buka({
    judul: isEdit ? `Edit ${cfg.label}` : `Tambah ${cfg.label} Baru`,
    ukuran: "modal-lg",
    konten: `
      <div class="grid grid-2">
        <div class="field" style="grid-column:1/-1">
          <label>Judul</label>
          <input id="f-k-judul" type="text" value="${data?.judul || ""}" placeholder="Judul ${cfg.label.toLowerCase()}">
        </div>
        ${cfg.kategoriOpsi.length ? `
        <div class="field">
          <label>Kategori</label>
          <select id="f-k-kategori">
            ${cfg.kategoriOpsi.map(k => `<option ${data?.kategori === k ? "selected" : ""}>${k}</option>`).join("")}
          </select>
        </div>` : ""}
        <div class="field">
          <label>Tanggal</label>
          <input id="f-k-tanggal" type="date" value="${data?.tanggal || new Date().toISOString().slice(0, 10)}">
        </div>
        <div class="field">
          <label>PJ Divisi</label>
          <select id="f-k-pjdivisi">
            ${_DIVISI_PJ_OPSI.map(d => `<option ${data?.pjDivisi === d ? "selected" : (user.role === "pj" && user.divisi === d ? "selected" : "")}>${d}</option>`).join("")}
          </select>
        </div>
        ${fieldEkstra}
        <div class="field" style="grid-column:1/-1;display:flex;align-items:center;gap:8px;margin-top:4px">
          <input id="f-k-publish" type="checkbox" style="width:16px;height:16px;accent-color:var(--pmr-red)" ${data?.publish ? "checked" : ""}>
          <label for="f-k-publish" style="margin:0">Terbitkan (tampil di halaman publik)</label>
        </div>
      </div>
      <div id="form-konten-err" class="alert alert-danger" style="display:none;margin-top:8px"></div>`,
    aksi: [
      { label: "Batal", kelas: "btn-ghost", id: "m-batal-konten", onClick: () => Modal.tutup() },
      {
        label: isEdit ? "Simpan" : "Tambah", kelas: "btn-primary", id: "m-simpan-konten", onClick: () => {
          const judul = document.getElementById("f-k-judul").value.trim();
          const err = document.getElementById("form-konten-err");
          const tampilkanError = (msg) => { err.textContent = msg; err.style.display = "flex"; };

          if (!judul) { tampilkanError("Judul tidak boleh kosong."); return; }

          const pjDivisi = document.getElementById("f-k-pjdivisi").value;
          /* Pengaman sisi klien — pencocokan sesungguhnya tetap di
             firestore.rules (tulisKontenBaru/tulisKontenUbah). */
          if (user.role === "pj" && user.divisi !== pjDivisi) {
            tampilkanError(`Sebagai PJ Divisi ${user.divisi}, kamu hanya bisa mengelola konten dengan PJ Divisi yang sama.`);
            return;
          }

          /* [F7.0] Jangan simpan selagi ada upload yang masih berjalan */
          const widgetAktif = [widgetCover, widgetThumb, widgetGaleri].filter(Boolean);
          if (widgetAktif.some(w => w.isUploading())) {
            tampilkanError("Masih ada gambar yang sedang diunggah — tunggu sebentar lagi.");
            return;
          }

          const slugDasar = judul.toLowerCase().trim()
            .replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");

          const payload = {
            judul,
            slug: data?.slug || `${slugDasar}-${Date.now().toString(36)}`,
            tanggal: document.getElementById("f-k-tanggal").value,
            pjDivisi,
            publish: document.getElementById("f-k-publish").checked
          };
          if (cfg.kategoriOpsi.length) payload.kategori = document.getElementById("f-k-kategori").value;

          if (tipe === "artikel") {
            payload.ringkasan = document.getElementById("f-k-ringkasan").value.trim();
            payload.articleUrl = document.getElementById("f-k-articleurl").value.trim();
            payload.penulis = document.getElementById("f-k-penulis").value.trim();
            payload.coverImage = widgetCover.getUrls()[0] || data?.coverImage || "";
          }
          if (tipe === "video") {
            const videoUrl = document.getElementById("f-k-videourl").value.trim();
            payload.deskripsi = document.getElementById("f-k-deskripsi").value.trim();
            payload.durasi = document.getElementById("f-k-durasi").value.trim();
            payload.videoUrl = videoUrl;
            const idYt = _idYoutubeDariUrl(videoUrl);
            const thumbUpload = widgetThumb.getUrls()[0];
            payload.thumbnailUrl = thumbUpload || (idYt ? `https://img.youtube.com/vi/${idYt}/hqdefault.jpg` : (data?.thumbnailUrl || ""));
          }
          if (tipe === "poster") {
            payload.deskripsi = document.getElementById("f-k-deskripsi").value.trim();
            payload.imageUrl = widgetCover.getUrls()[0] || data?.imageUrl || "";
          }
          if (tipe === "dokumentasi") {
            payload.deskripsi = document.getElementById("f-k-deskripsi").value.trim();
            payload.coverImage = widgetCover.getUrls()[0] || data?.coverImage || "";
            payload.images = widgetGaleri.getUrls();
            payload.photoCount = payload.images.length;
          }

          _jalankanSimpan("m-simpan-konten", async () => {
            if (isEdit) await ContentDB.update(tipe, data.id, payload);
            else await ContentDB.create(tipe, payload);
            Modal.tutup();
            onSimpan?.();
            tampilToast(isEdit ? "Perubahan disimpan." : `${cfg.label} baru ditambahkan.`, "success");
          });
        }
      }
    ]
  });

  /* [F7.0] Widget upload dipasang SETELAH Modal.buka() supaya elemen
     kontainernya sudah ada di DOM (Modal.buka() mengisi innerHTML
     secara sinkron). SATU pemanggilan initUploadWidget() yang sama
     dipakai untuk cover di keempat tipe — tidak ada kode berbeda. */
  let widgetCover = null, widgetThumb = null, widgetGaleri = null;

  if (tipe === "artikel") {
    widgetCover = initUploadWidget(document.getElementById("f-k-cover-widget"), {
      folder: "article-covers", multiple: false,
      existingUrls: data?.coverImage ? [data.coverImage] : [],
      label: "Seret cover artikel ke sini atau klik untuk pilih"
    });
  }
  if (tipe === "video") {
    widgetThumb = initUploadWidget(document.getElementById("f-k-thumb-widget"), {
      folder: "thumbnails", multiple: false,
      existingUrls: (data?.thumbnailUrl && !data.thumbnailUrl.includes("img.youtube.com")) ? [data.thumbnailUrl] : [],
      label: "Seret thumbnail ke sini atau klik untuk pilih (opsional)"
    });
  }
  if (tipe === "poster") {
    widgetCover = initUploadWidget(document.getElementById("f-k-cover-widget"), {
      folder: "posters", multiple: false,
      existingUrls: data?.imageUrl ? [data.imageUrl] : (data?.gambarUrl ? [data.gambarUrl] : []),
      label: "Seret gambar poster ke sini atau klik untuk pilih"
    });
  }
  if (tipe === "dokumentasi") {
    widgetCover = initUploadWidget(document.getElementById("f-k-cover-widget"), {
      folder: "documentations", multiple: false,
      existingUrls: data?.coverImage ? [data.coverImage] : [],
      label: "Seret cover ke sini atau klik untuk pilih"
    });
    widgetGaleri = initUploadWidget(document.getElementById("f-k-gallery-widget"), {
      folder: "documentations", multiple: true,
      existingUrls: data?.images?.length ? data.images : (data?.foto || []),
      label: "Seret banyak foto ke sini atau klik untuk pilih"
    });
  }
}
