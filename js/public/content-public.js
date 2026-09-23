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
  panah: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>`,
  jam: `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`
};

/* [Redesign] Estimasi waktu baca — dihitung MURNI di client dari teks
   ringkasan yang sudah ada (bukan field baru di Firestore, bukan
   perubahan skema data). ~200 kata/menit, dibulatkan, minimal 1 menit. */
function _estimasiBaca(teks) {
  const jumlahKata = (teks || "").trim().split(/\s+/).filter(Boolean).length;
  const menit = Math.max(1, Math.round(jumlahKata / 200));
  return `${menit} min baca`;
}

const _KONFIG_TIPE = {
  artikel:     { label: "Artikel",     labelSatuan: "artikel",     ph: _IKON.dokumen, tombolDetail: "Lihat Selengkapnya", chipSemua: "Semua" },
  video:       { label: "Video",       labelSatuan: "video",       ph: _IKON.gambar,  tombolDetail: "Tonton",             chipSemua: "Semua" },
  poster:      { label: "Poster",      labelSatuan: "poster",      ph: _IKON.gambar,  tombolDetail: "Lihat",              chipSemua: "Semua" },
  dokumentasi: { label: "Dokumentasi", labelSatuan: "dokumentasi", ph: _IKON.gambar,  tombolDetail: "Lihat Galeri",       chipSemua: "Semua Kegiatan" }
};

function _slugDariUrl() {
  return new URLSearchParams(location.search).get("slug");
}

/* [F7.0] Tampilkan <img> asli bila ada URL (hasil upload Firebase
   Storage), atau ikon flat placeholder bila belum ada gambar —
   "Jangan gunakan placeholder merah polos... jika gambar tersedia
   gunakan gambar asli sebagai thumbnail." */
function _thumbHTML(url, ikonFallback) {
  return url ? `<img src="${url}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover"/>` : ikonFallback;
}

/* [F7.0] Bangun src iframe embed dari URL YouTube mentah (watch?v=,
   youtu.be/, atau embed/ — semua bentuk diterima di form admin). */
function _ytEmbedSrc(url) {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{6,})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : (url.includes("youtube.com/embed") ? url : null);
}

/* ---------- Kartu daftar per tipe ---------- */
function _kartuArtikel(item) {
  return `<article class="article-card">
    <div class="ph-thumb">${_thumbHTML(item.coverImage, _IKON.dokumen)}</div>
    <div class="article-card-body">
      <div class="article-meta"><span class="badge badge-red">${item.kategori}</span><span>${formatTanggal(item.tanggal)}</span></div>
      <h3>${item.judul}</h3>
      <p>${item.ringkasan}</p>
      <div class="article-card-foot">
        <span class="read-time">${_IKON.jam} ${_estimasiBaca(item.ringkasan)}</span>
        <a href="artikel.html?slug=${item.slug}" class="btn btn-outline btn-sm">Lihat Selengkapnya →</a>
      </div>
    </div>
  </article>`;
}
function _kartuVideo(item) {
  const thumb = item.thumbnailUrl || (_idYtDariItem(item) ? `https://img.youtube.com/vi/${_idYtDariItem(item)}/hqdefault.jpg` : "");
  return `<div class="video-card">
    <a href="video.html?slug=${item.slug}" aria-label="${item.judul}">
      <div class="ph-thumb">
        ${_thumbHTML(thumb, "")}
        <div class="video-play">${_IKON.play}</div>
        <span class="video-duration">${item.durasi || ""}</span>
      </div>
    </a>
    <div class="video-card-body">
      <div class="article-meta"><span class="badge badge-red">${item.kategori}</span><span>${formatTanggal(item.tanggal)}</span></div>
      <h3>${item.judul}</h3>
      <a href="video.html?slug=${item.slug}" class="btn btn-outline btn-sm">Tonton →</a>
    </div>
  </div>`;
}
function _idYtDariItem(item) { return _idYoutubeDariUrlPublik(item.videoUrl); }
function _idYoutubeDariUrlPublik(url) {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{6,})/);
  return m ? m[1] : null;
}
function _kartuPoster(item) {
  const gambar = item.imageUrl || item.gambarUrl; // fallback field lama
  return `<div class="poster-card">
    <a href="poster.html?slug=${item.slug}" aria-label="${item.judul}">
      <div class="ph-thumb">${_thumbHTML(gambar, _IKON.gambar)}</div>
    </a>
    <div class="poster-card-body">
      <span class="badge badge-red">${item.kategori}</span>
      <h3>${item.judul}</h3>
      <a href="poster.html?slug=${item.slug}" class="btn btn-outline btn-sm btn-block">Lihat</a>
    </div>
  </div>`;
}
/* [FIX — Dokumentasi: thumbnail & jumlah foto tidak muncul]
   Dipakai bersama oleh _kartuDokumentasi() dan _renderDetailDokumentasi()
   supaya SATU sumber kebenaran untuk resolusi nama field — tidak ada
   duplikasi logika fallback di dua tempat.

   Field standar project ini adalah `coverImage` (cover) dan `images`
   (array galeri) — itu yang dipakai konten-admin.js saat menyimpan.
   Fungsi ini menambahkan fallback ke variasi nama field lama/tidak
   konsisten (photos, foto, gambar, media, imageUrls, dst.) supaya data
   lama tetap tampil tanpa perlu migrasi database. */
function _resolveDokumentasiMedia(item) {
  const cover =
    item.coverImage || item.imageUrl || item.gambarUrl || item.thumbnailUrl || "";
  const galeriMentah =
    item.images || item.foto || item.photos || item.gambar || item.media || item.imageUrls || [];
  const galeri = Array.isArray(galeriMentah) ? galeriMentah.filter(Boolean) : [];
  /* [FIX — "0 Foto" padahal galeri ada isinya]
     SEBELUMNYA urutannya `item.photoCount ?? ... ?? galeri.length` — itu
     bug: konten-admin.js SELALU menulis `photoCount` sebagai angka
     eksplisit (termasuk 0) saat simpan, dan `??` tidak "tembus" ke
     fallback berikutnya untuk nilai 0 (hanya untuk null/undefined).
     Jadi kalau photoCount kebetulan tersimpan 0, jumlah foto akan SELALU
     tampil 0 walau array `galeri` di atas (hasil resolusi field foto/
     images/photos/dst.) sebenarnya berisi banyak URL.
     Sekarang jumlah foto SELALU dihitung dari galeri.length dulu —
     angka yang ditampilkan jadi konsisten dengan foto yang benar-benar
     dirender di grid galeri. photoCount/jumlahFoto cuma dipakai sebagai
     jalan terakhir kalau memang tidak ada array foto yang bisa dibaca
     sama sekali (skenario data sangat lama). */
  const jumlahFoto = galeri.length > 0 ? galeri.length : (item.photoCount ?? item.jumlahFoto ?? 0);
  return { cover, galeri, jumlahFoto };
}

function _kartuDokumentasi(item) {
  const { cover, jumlahFoto } = _resolveDokumentasiMedia(item);
  return `<div class="article-card doc-card">
    <a href="dokumentasi.html?slug=${item.slug}" aria-label="${item.judul}">
      <div class="ph-thumb">${_thumbHTML(cover, _IKON.gambar)}</div>
    </a>
    <div class="doc-card-body">
      <h3>${item.judul}</h3>
      <div class="doc-card-meta">
        <span>${_IKON.kalender} ${formatTanggal(item.tanggal)}</span>
        <span>${_IKON.gambar} ${jumlahFoto} Foto</span>
      </div>
      <a href="dokumentasi.html?slug=${item.slug}" class="btn btn-outline btn-sm">Lihat Galeri →</a>
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
  const chipWrap = document.getElementById("content-kategori-chips");
  if (!wrap) return;

  wrap.innerHTML = _skeletonKartu(tipe);

  const semua = await ContentDB.fetchAll(tipe);

  /* Kategori chip diisi dari data yang benar-benar ada — sama seperti
     select dulu (kategoriUnik), cuma dirender sebagai tombol, bukan
     <option>. */
  const kategoriUnik = [...new Set(semua.map(x => x.kategori).filter(Boolean))];
  let kategoriAktif = "";

  function renderChips() {
    if (!chipWrap) return;
    const daftar = [{ nilai: "", label: cfg.chipSemua }, ...kategoriUnik.map(k => ({ nilai: k, label: k }))];
    chipWrap.innerHTML = daftar.map(({ nilai, label }) =>
      `<button type="button" class="chip${nilai === kategoriAktif ? " chip-active" : ""}" data-kategori="${nilai}">${label}</button>`
    ).join("");
    chipWrap.querySelectorAll(".chip").forEach(btn => {
      btn.addEventListener("click", () => {
        kategoriAktif = btn.dataset.kategori;
        renderChips();
        render();
      });
    });
  }

  function render() {
    /* [Redesign] Predikat filter TIDAK berubah dari sebelumnya
       (x.kategori === kat) — hanya sumber nilai `kat` yang berubah,
       dari selectKategori.value menjadi kategoriAktif (state chip). */
    const hasil = semua.filter(x => !kategoriAktif || x.kategori === kategoriAktif);

    if (!hasil.length) {
      wrap.innerHTML = `<div class="content-empty">
        ${_IKON.dokumen}
        <p><strong>Belum ada ${cfg.labelSatuan}</strong></p>
        <p>Coba pilih kategori lain.</p>
      </div>`;
      return;
    }
    wrap.innerHTML = `<div class="grid grid-3">${hasil.map(_RENDER_KARTU[tipe]).join("")}</div>`;
  }

  renderChips();
  render();
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
  /* [F7.0] Artikel kini hanya metadata + link keluar (articleUrl).
     Fallback ke item.konten (paragraf lama) HANYA bila artikel ini
     dibuat sebelum migrasi F7.0 dan belum py articleUrl — supaya
     artikel lama tetap tampil normal, tidak rusak. */
  const punyaLinkBaru = !!item.articleUrl;
  const punyaKontenLama = !punyaLinkBaru && Array.isArray(item.konten) && item.konten.length;

  root.innerHTML = `<div class="detail-wrap">
    <a href="artikel.html" class="detail-back">← Kembali ke Artikel</a>
    <div class="detail-hero"><div class="ph-thumb" style="height:280px">${_thumbHTML(item.coverImage, _IKON.dokumen)}</div></div>
    <div class="detail-meta">
      <span class="badge badge-info">${item.kategori}</span>
      <span>${_IKON.kalender} ${formatTanggal(item.tanggal)}</span>
      ${item.penulis ? `<span>${_IKON.user} ${item.penulis}</span>` : ""}
    </div>
    <h1>${item.judul}</h1>
    <div class="detail-body">
      <p>${item.ringkasan || ""}</p>
      ${punyaKontenLama ? item.konten.map(p => `<p>${p}</p>`).join("") : ""}
    </div>
    ${punyaLinkBaru ? `
      <div class="detail-actions">
        <a href="${item.articleUrl}" target="_blank" rel="noopener" class="btn btn-primary">Baca Artikel Lengkap →</a>
      </div>` : ""}
  </div>`;
}

function _renderDetailVideo(root, item) {
  const embedSrc = _ytEmbedSrc(item.videoUrl) || _ytEmbedSrc(item.embedUrl);
  root.innerHTML = `<div class="detail-wrap">
    <a href="video.html" class="detail-back">← Kembali ke Video</a>
    <div class="video-player">
      ${embedSrc
        ? `<iframe src="${embedSrc}" allowfullscreen title="${item.judul}"></iframe>`
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
  const gambar = item.imageUrl || item.gambarUrl;
  root.innerHTML = `<div class="detail-wrap">
    <a href="poster.html" class="detail-back">← Kembali ke Poster</a>
    <div class="detail-hero"><div class="ph-thumb" style="height:420px">${_thumbHTML(gambar, _IKON.gambar)}</div></div>
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
    if (gambar) {
      const a = document.createElement("a");
      a.href = gambar; a.download = item.judul; a.target = "_blank";
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
  const { cover, galeri, jumlahFoto } = _resolveDokumentasiMedia(item);

  root.innerHTML = `<div class="detail-wrap">
    <a href="dokumentasi.html" class="detail-back">← Kembali ke Dokumentasi</a>
    <div class="detail-hero"><div class="ph-thumb" style="height:280px">${_thumbHTML(cover, _IKON.gambar)}</div></div>
    <div class="detail-meta">
      <span>${_IKON.kalender} ${formatTanggal(item.tanggal)}</span>
      <span>${_IKON.gambar} ${jumlahFoto} Foto</span>
      <span>${_IKON.user} ${item.pjDivisi}</span>
    </div>
    <h1>${item.judul}</h1>
    <div class="detail-body"><p>${item.deskripsi}</p></div>

    <h2 style="font-size:1.05rem;margin:28px 0 14px">Galeri Foto</h2>
    <div class="detail-gallery">
      ${galeri.length
        ? galeri.map(url => `<div class="ph-thumb">${_thumbHTML(url, _IKON.gambar)}</div>`).join("")
        : `<p style="grid-column:1/-1;color:var(--ink-soft);font-size:0.85rem">Galeri foto belum diunggah.</p>`}
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
