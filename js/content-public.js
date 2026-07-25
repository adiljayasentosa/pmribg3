/* =========================================================
   CONTENT-PUBLIC.JS — [F6.0]                                BARU
   =========================================================
   Satu modul dipakai oleh 4 halaman publik: artikel.html,
   video.html, poster.html, dokumentasi.html. Menentukan mode
   (daftar / detail) dari query string `?slug=`, mengambil data
   lewat ContentDB (content-db.js), dan merender kartu/tampilan
   detail sesuai tipe. Tombol Edit/Hapus SENGAJA tidak pernah
   dirender di sini — halaman publik ini murni baca (lihat brief:
   "Tombol Edit dan Hapus TIDAK BOLEH muncul pada halaman publik").
   ========================================================= */

const _IKON = {
  dokumen: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6M9 16h6"/></svg>`,
  gambar: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`,
  kalender: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`,
  user: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>`,
  download: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>`,
  share: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342a3 3 0 100-2.684m0 2.684a3 3 0 100 2.684m0-2.684L15.316 17.316m0-10.632a3 3 0 102.684 4.632 3 3 0 00-2.684-4.632zm0 10.632a3 3 0 102.684-4.632"/></svg>`,
  play: `<svg viewBox="0 0 24 24" fill="#FFFFFF"><path d="M8 5v14l11-7z"/></svg>`,
  panah: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>`
};

const _KONFIG_TIPE = {
  artikel:     { label: "Artikel",     labelSatuan: "artikel",     ph: _IKON.dokumen, tombolDetail: "Baca" },
  video:       { label: "Video",       labelSatuan: "video",       ph: _IKON.gambar,  tombolDetail: "Tonton" },
  poster:      { label: "Poster",      labelSatuan: "poster",      ph: _IKON.gambar,  tombolDetail: "Lihat" },
  dokumentasi: { label: "Dokumentasi", labelSatuan: "dokumentasi", ph: _IKON.gambar,  tombolDetail: "Lihat Selengkapnya" }
};

function _slugDariUrl() {
  return new URLSearchParams(location.search).get("slug");
}

/* ---------- Kartu daftar per tipe ---------- */
function _kartuArtikel(item) {
  return `<article class="article-card">
    <div class="ph-thumb">${item.thumbnail ? "" : _IKON.dokumen}</div>
    <div class="article-card-body">
      <div class="article-meta"><span class="badge badge-info">${item.kategori}</span><span>${formatTanggal(item.tanggal)}</span></div>
      <h3>${item.judul}</h3>
      <p>${item.ringkasan}</p>
      <a href="artikel.html?slug=${item.slug}" class="btn btn-outline btn-sm">Baca →</a>
    </div>
  </article>`;
}
function _kartuVideo(item) {
  return `<div class="video-card">
    <a href="video.html?slug=${item.slug}" aria-label="${item.judul}">
      <div class="ph-thumb">
        <div class="video-play">${_IKON.play}</div>
        <span class="video-duration">${item.durasi}</span>
      </div>
    </a>
    <div class="video-card-body">
      <div class="article-meta"><span class="badge badge-info">${item.kategori}</span><span>${formatTanggal(item.tanggal)}</span></div>
      <h3>${item.judul}</h3>
      <a href="video.html?slug=${item.slug}" class="btn btn-outline btn-sm">Tonton →</a>
    </div>
  </div>`;
}
function _kartuPoster(item) {
  return `<div class="poster-card">
    <a href="poster.html?slug=${item.slug}" aria-label="${item.judul}">
      <div class="ph-thumb">${_IKON.gambar}</div>
    </a>
    <div class="poster-card-body">
      <h3>${item.judul}</h3>
      <span class="badge badge-warning">${item.kategori}</span>
      <a href="poster.html?slug=${item.slug}" class="btn btn-outline btn-sm" style="display:block;text-align:center;margin-top:12px">Lihat</a>
    </div>
  </div>`;
}
function _kartuDokumentasi(item) {
  return `<div class="article-card doc-card">
    <a href="dokumentasi.html?slug=${item.slug}" aria-label="${item.judul}">
      <div class="ph-thumb">${_IKON.gambar}</div>
    </a>
    <div class="doc-card-body">
      <h3>${item.judul}</h3>
      <div class="doc-card-meta">
        <span>${_IKON.kalender} ${formatTanggal(item.tanggal)}</span>
        <span>${_IKON.gambar} ${item.jumlahFoto} Foto</span>
        <span>${_IKON.user} ${item.pjDivisi}</span>
      </div>
      <a href="dokumentasi.html?slug=${item.slug}" class="btn btn-outline btn-sm">Lihat Selengkapnya →</a>
    </div>
  </div>`;
}
const _RENDER_KARTU = { artikel: _kartuArtikel, video: _kartuVideo, poster: _kartuPoster, dokumentasi: _kartuDokumentasi };

/* ---------- Skeleton kartu per tipe (dipakai saat memuat) ---------- */
function _skeletonKartu(tipe, n = 6) {
  if (tipe === "video") return skVideoGrid(n);
  return `<div class="grid grid-3">${Array.from({ length: n }, () => skCard({ lines: 3 })).join("")}</div>`;
}

/* =========================================================
   HALAMAN DAFTAR
   ========================================================= */
async function initContentListPage(tipe) {
  const cfg = _KONFIG_TIPE[tipe];
  const wrap = document.getElementById("content-grid");
  const inputSearch = document.getElementById("content-search");
  const selectKategori = document.getElementById("content-kategori");
  if (!wrap) return;

  wrap.innerHTML = _skeletonKartu(tipe);

  const semua = await ContentDB.fetchAll(tipe);

  /* Isi filter kategori dari data yang benar-benar ada */
  if (selectKategori) {
    const kategoriUnik = [...new Set(semua.map(x => x.kategori).filter(Boolean))];
    kategoriUnik.forEach(k => {
      const opt = document.createElement("option");
      opt.value = k; opt.textContent = k;
      selectKategori.appendChild(opt);
    });
  }

  function render() {
    const q = (inputSearch?.value || "").toLowerCase().trim();
    const kat = selectKategori?.value || "";
    const hasil = semua.filter(x => {
      const cocokQ = !q || x.judul.toLowerCase().includes(q);
      const cocokKat = !kat || x.kategori === kat;
      return cocokQ && cocokKat;
    });

    if (!hasil.length) {
      wrap.innerHTML = `<div class="content-empty">
        ${_IKON.dokumen}
        <p><strong>Belum ada ${cfg.labelSatuan}</strong></p>
        <p>Coba ubah kata kunci pencarian atau kategori.</p>
      </div>`;
      return;
    }
    wrap.innerHTML = `<div class="grid grid-3">${hasil.map(_RENDER_KARTU[tipe]).join("")}</div>`;
  }

  render();
  inputSearch?.addEventListener("input", render);
  selectKategori?.addEventListener("change", render);
}

/* =========================================================
   HALAMAN DETAIL
   ========================================================= */
async function initContentDetailPage(tipe) {
  const root = document.getElementById("content-detail");
  if (!root) return;
  const slug = _slugDariUrl();

  root.innerHTML = `<div class="detail-wrap"><div class="skeleton-card">${skLines(5)}</div></div>`;

  if (!slug) { _tampilkanNotFound(root, tipe); return; }
  const item = await ContentDB.fetchBySlug(tipe, slug);
  if (!item) { _tampilkanNotFound(root, tipe); return; }

  document.title = `${item.judul} · PMR WIRA UNIT`;

  if (tipe === "artikel") return _renderDetailArtikel(root, item);
  if (tipe === "video") return _renderDetailVideo(root, item);
  if (tipe === "poster") return _renderDetailPoster(root, item);
  if (tipe === "dokumentasi") return _renderDetailDokumentasi(root, item);
}

function _tampilkanNotFound(root, tipe) {
  const cfg = _KONFIG_TIPE[tipe];
  root.innerHTML = `<div class="content-empty">
    ${_IKON.dokumen}
    <p><strong>${cfg.label} tidak ditemukan</strong></p>
    <p>Item mungkin belum dipublikasikan atau tautan sudah tidak berlaku.</p>
    <a href="${tipe}.html" class="btn btn-outline btn-sm" style="margin-top:14px">← Kembali ke ${cfg.label}</a>
  </div>`;
}

function _renderDetailArtikel(root, item) {
  root.innerHTML = `<div class="detail-wrap">
    <a href="artikel.html" class="detail-back">← Kembali ke Artikel</a>
    <div class="detail-hero"><div class="ph-thumb" style="height:280px">${_IKON.dokumen}</div></div>
    <div class="detail-meta">
      <span class="badge badge-info">${item.kategori}</span>
      <span>${_IKON.kalender} ${formatTanggal(item.tanggal)}</span>
      ${item.penulis ? `<span>${_IKON.user} ${item.penulis}</span>` : ""}
    </div>
    <h1>${item.judul}</h1>
    <div class="detail-body">${item.konten.map(p => `<p>${p}</p>`).join("")}</div>
  </div>`;
}

function _renderDetailVideo(root, item) {
  root.innerHTML = `<div class="detail-wrap">
    <a href="video.html" class="detail-back">← Kembali ke Video</a>
    <div class="video-player">
      ${item.embedUrl
        ? `<iframe src="${item.embedUrl}" allowfullscreen title="${item.judul}"></iframe>`
        : `<div>${_IKON.gambar}<p style="margin-top:10px">Video akan tersedia setelah diunggah oleh PJ Divisi.</p></div>`}
    </div>
    <div class="detail-meta">
      <span class="badge badge-info">${item.kategori}</span>
      <span>${_IKON.kalender} ${formatTanggal(item.tanggal)}</span>
      <span>${_IKON.user} ${item.pjDivisi}</span>
    </div>
    <h1>${item.judul}</h1>
    <div class="detail-body"><p>${item.deskripsi}</p></div>
    <div id="video-terkait"></div>
  </div>`;

  ContentDB.fetchLatest("video", 4).then(list => {
    const terkait = list.filter(v => v.slug !== item.slug).slice(0, 3);
    if (!terkait.length) return;
    document.getElementById("video-terkait").innerHTML = `
      <div class="related-wrap" style="margin-left:0;margin-right:0;padding-left:0;padding-right:0;border-top:1px solid var(--gray-200)">
        <h2>Video Terkait</h2>
        <div class="grid grid-3">${terkait.map(_kartuVideo).join("")}</div>
      </div>`;
  });
}

function _renderDetailPoster(root, item) {
  root.innerHTML = `<div class="detail-wrap">
    <a href="poster.html" class="detail-back">← Kembali ke Poster</a>
    <div class="detail-hero"><div class="ph-thumb" style="height:420px">${_IKON.gambar}</div></div>
    <div class="detail-meta">
      <span class="badge badge-warning">${item.kategori}</span>
      <span>${_IKON.kalender} ${formatTanggal(item.tanggal)}</span>
      <span>${_IKON.user} ${item.pjDivisi}</span>
    </div>
    <h1>${item.judul}</h1>
    <div class="detail-body"><p>${item.deskripsi}</p></div>
    <div class="detail-actions">
      <button id="btn-download-poster" class="btn btn-primary">${_IKON.download} Download</button>
      <button id="btn-bagikan-poster" class="btn btn-outline">${_IKON.share} Bagikan</button>
    </div>
  </div>`;

  document.getElementById("btn-download-poster")?.addEventListener("click", () => {
    if (item.gambarUrl) {
      const a = document.createElement("a");
      a.href = item.gambarUrl; a.download = item.judul;
      a.click();
    } else {
      alert("Gambar poster resolusi tinggi belum diunggah oleh PJ Divisi.");
    }
  });
  document.getElementById("btn-bagikan-poster")?.addEventListener("click", async () => {
    const url = location.href;
    if (navigator.share) {
      navigator.share({ title: item.judul, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
      alert("Tautan poster disalin ke clipboard.");
    }
  });
}

function _renderDetailDokumentasi(root, item) {
  root.innerHTML = `<div class="detail-wrap">
    <a href="dokumentasi.html" class="detail-back">← Kembali ke Dokumentasi</a>
    <div class="detail-hero"><div class="ph-thumb" style="height:280px">${_IKON.gambar}</div></div>
    <div class="detail-meta">
      <span>${_IKON.kalender} ${formatTanggal(item.tanggal)}</span>
      <span>${_IKON.gambar} ${item.jumlahFoto} Foto</span>
      <span>${_IKON.user} ${item.pjDivisi}</span>
    </div>
    <h1>${item.judul}</h1>
    <div class="detail-body"><p>${item.deskripsi}</p></div>

    <h2 style="font-size:1.05rem;margin:28px 0 14px">Galeri Foto</h2>
    <div class="detail-gallery">
      ${Array.from({ length: Math.min(item.jumlahFoto || 0, 8) }, () => `<div class="ph-thumb">${_IKON.gambar}</div>`).join("")}
    </div>

    <div id="album-terkait"></div>
  </div>`;

  if (item.albumTerkait?.length) {
    Promise.all(item.albumTerkait.map(id => ContentDB.fetchAll("dokumentasi").then(list => list.find(x => x.id === id))))
      .then(list => list.filter(Boolean))
      .then(terkait => {
        if (!terkait.length) return;
        document.getElementById("album-terkait").innerHTML = `
          <div class="related-wrap" style="margin-left:0;margin-right:0;padding-left:0;padding-right:0;border-top:1px solid var(--gray-200)">
            <h2>Album Terkait</h2>
            <div class="grid grid-3">${terkait.map(_kartuDokumentasi).join("")}</div>
          </div>`;
      });
  }
}

/* Auto-init: dipanggil dari tiap halaman lewat body[data-content-tipe] */
document.addEventListener("DOMContentLoaded", () => {
  const tipe = document.body.dataset.contentTipe;
  if (!tipe) return;
  const viewList = document.getElementById("view-list");
  const viewDetail = document.getElementById("view-detail");
  if (_slugDariUrl()) {
    if (viewList) viewList.style.display = "none";
    if (viewDetail) viewDetail.style.display = "";
    initContentDetailPage(tipe);
  } else {
    if (viewDetail) viewDetail.style.display = "none";
    if (viewList) viewList.style.display = "";
    initContentListPage(tipe);
  }
});
