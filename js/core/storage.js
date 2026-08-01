/* =========================================================
   STORAGE.JS — [F8.0 — Migrasi ke ImageKit]
   =========================================================
   SATU helper dipakai oleh SEMUA form yang mengunggah gambar
   (Poster, Video-thumbnail, Artikel-cover, Dokumentasi cover
   & galeri). Tidak ada kode upload lain yang ditulis terpisah
   di halaman manapun — sesuai instruksi.

   [F8.0] Backend upload dipindah dari Firebase Storage (project
   masih Spark/free plan) ke ImageKit. KONTRAK FUNGSI PUBLIK
   (uploadImage, uploadMultipleImages, deleteImage, replaceImage,
   compressImage, initUploadWidget) TIDAK BERUBAH SAMA SEKALI —
   supaya js/pages/konten-admin.js dan keempat form (Poster/
   Video/Artikel/Dokumentasi) nol perubahan.

   Alur upload (browser → ImageKit langsung, sesuai arsitektur
   yang diminta):
     1. fetch GET /api/imagekit-auth  → server hitung signature
        pakai IMAGEKIT_PRIVATE_KEY (privateKey TIDAK PERNAH
        dikirim ke browser — lihat api/imagekit-auth.js)
     2. Browser POST file + token/expire/signature LANGSUNG ke
        upload.imagekit.io (XMLHttpRequest, supaya progress asli
        & bisa dibatalkan — fetch() tidak punya progress event)
     3. ImageKit balas {url, fileId} → url disimpan ke Firestore,
        fileId disimpan sebagai "path" (field lama, cuma
        maknanya bergeser jadi "handle untuk hapus")

   Kompresi (Canvas API murni: resize, WebP bila didukung,
   target 300–700 KB) SAMA SEKALI TIDAK BERUBAH — tidak
   bergantung ke Firebase maupun ImageKit.

   Mode Demo (FIREBASE_ENABLED=false): tetap pakai
   URL.createObjectURL() (blob lokal), TIDAK memanggil ImageKit
   sama sekali — konsisten dengan pola dual-mode yang sudah ada
   di seluruh app ini (content-db.js, dst).

   Struktur folder ImageKit (SENGAJA flat, sesuai instruksi
   "jangan buat struktur folder kompleks"):
     article-covers/  posters/  documentations/  avatars/  thumbnails/
   ========================================================= */

const STORAGE_FOLDER_VALID = ["article-covers", "posters", "documentations", "avatars", "thumbnails"];

function _cekFolderStorage(folder) {
  if (!STORAGE_FOLDER_VALID.includes(folder)) {
    throw new Error(`[StorageHelper] Folder tidak dikenal: "${folder}". Gunakan salah satu: ${STORAGE_FOLDER_VALID.join(", ")}`);
  }
}

function _slugifyNamaFile(nama) {
  return nama.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/-+/g, "-");
}

/* ---------- Deteksi dukungan WebP (sekali saja, di-cache) ---------- */
let _dukungWebPCache = null;
function _dukungWebP() {
  if (_dukungWebPCache !== null) return _dukungWebPCache;
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  _dukungWebPCache = c.toDataURL("image/webp").indexOf("image/webp") === 5;
  return _dukungWebPCache;
}

/* ─────────────────────────────────────────────────────────
   COMPRESS IMAGE — resize + compress + WebP (bila didukung).
   Target 300–700 KB sesuai instruksi. Canvas API murni, tidak
   ada library eksternal.
───────────────────────────────────────────────────────── */
async function compressImage(file, opts = {}) {
  const { maxDimensi = 1920, targetMaxKB = 700, kualitasAwal = 0.85 } = opts;
  if (!file.type || !file.type.startsWith("image/")) return file;

  const gambar = await _muatSebagaiImage(file);
  let { width, height } = gambar;
  if (width > maxDimensi || height > maxDimensi) {
    const skala = maxDimensi / Math.max(width, height);
    width = Math.round(width * skala);
    height = Math.round(height * skala);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  canvas.getContext("2d").drawImage(gambar, 0, 0, width, height);
  if (gambar.close) gambar.close();

  const mime = _dukungWebP() ? "image/webp" : "image/jpeg";
  let kualitas = kualitasAwal;
  let blob = await _canvasKeBlob(canvas, mime, kualitas);

  let percobaan = 0;
  while (blob.size > targetMaxKB * 1024 && kualitas > 0.35 && percobaan < 6) {
    kualitas -= 0.12;
    blob = await _canvasKeBlob(canvas, mime, kualitas);
    percobaan++;
  }

  const namaBaru = file.name.replace(/\.[^.]+$/, "") + (mime === "image/webp" ? ".webp" : ".jpg");
  return new File([blob], namaBaru, { type: mime });
}

function _muatSebagaiImage(file) {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file).catch(() => _muatViaImgTag(file));
  }
  return _muatViaImgTag(file);
}
function _muatViaImgTag(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => { resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(objUrl); reject(new Error("Gagal membaca gambar.")); };
    img.src = objUrl;
  });
}
function _canvasKeBlob(canvas, mime, kualitas) {
  return new Promise((resolve) => canvas.toBlob(resolve, mime, kualitas));
}

/* ─────────────────────────────────────────────────────────
   UPLOAD / DELETE / REPLACE — [F8.0] backend ImageKit
───────────────────────────────────────────────────────── */

/** Simulasi progress halus di Mode Demo supaya UX widget tetap konsisten
 *  (progress bar, dsb.) walau tanpa upload sungguhan. */
function _simulasiProgress(onProgress, dibatalkanFn) {
  return new Promise((resolve) => {
    let p = 0;
    const iv = setInterval(() => {
      if (dibatalkanFn?.()) { clearInterval(iv); resolve(); return; }
      p = Math.min(100, p + 20 + Math.random() * 20);
      onProgress?.(Math.round(p));
      if (p >= 100) { clearInterval(iv); resolve(); }
    }, 90);
  });
}

/* [FIX — HTTP 400 ImageKit] SEBELUMNYA parameter otentikasi (token,
 * signature, expire) di-cache selama ±10 menit dan dipakai ULANG untuk
 * banyak file sekaligus (mis. galeri Dokumentasi lewat
 * uploadMultipleImages()) maupun saat retry setelah upload gagal.
 *
 * Ini yang menyebabkan HTTP 400 dari ImageKit: parameter `token` di
 * Upload API ImageKit bersifat SEKALI PAKAI (single-use) — dipakai
 * ImageKit untuk mencegah request yang sama diproses dua kali. Begitu
 * satu file berhasil/gagal upload dengan token tertentu, token itu
 * "terpakai", dan file KEDUA yang memakai token cache yang sama akan
 * ditolak ImageKit dengan 400 Bad Request. (Sumber: dokumentasi resmi
 * ImageKit — "If you send a token that has been used before, you'll
 * get a validation error" / "Even if your previous request resulted in
 * an error, you should always send a new token".)
 *
 * Perbaikan: SELALU minta token/signature/expire BARU dari
 * /api/imagekit-auth untuk SETIAP percobaan upload — tidak ada cache
 * sama sekali. Endpoint ini ringan (hanya hitung HMAC di server, tidak
 * ada I/O ke database), jadi memanggilnya per-file tidak jadi masalah
 * performa, dan ini justru satu-satunya cara yang sesuai spesifikasi
 * resmi ImageKit. */
async function _ambilAuthImageKit() {
  const resp = await fetch("/api/imagekit-auth");
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `Gagal mengambil otentikasi ImageKit (status ${resp.status}).`);
  }
  return resp.json();
}

/** Upload satu file langsung ke ImageKit lewat XMLHttpRequest (bukan
 *  fetch — supaya dapat progress asli via xhr.upload.onprogress dan
 *  bisa dibatalkan via xhr.abort()). Return { promise, cancel }. */
function _uploadKeImageKit(file, folder, onProgress) {
  let xhr = null;
  let dibatalkan = false;
  const kontrol = { cancel: () => { dibatalkan = true; xhr?.abort(); } };

  kontrol.promise = (async () => {
    const auth = await _ambilAuthImageKit();
    if (dibatalkan) throw new Error("DIBATALKAN");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("fileName", _slugifyNamaFile(file.name));
    formData.append("folder", `/${folder}`);
    formData.append("useUniqueFileName", "true");
    formData.append("publicKey", auth.publicKey);
    formData.append("signature", auth.signature);
    formData.append("expire", auth.expire);
    formData.append("token", auth.token);

    return new Promise((resolve, reject) => {
      xhr = new XMLHttpRequest();
      xhr.open("POST", "https://upload.imagekit.io/api/v1/files/upload");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            /* `path` dipakai sebagai handle utk deleteImage() nanti —
               di ImageKit itu adalah fileId (BUKAN url/filePath). */
            resolve({ url: data.url, path: data.fileId });
          } catch (e) { reject(new Error("Respons ImageKit tidak valid.")); }
        } else {
          /* [FIX] Sebelumnya pesan error hanya "status 400" tanpa alasan
             — sekarang ambil field `message` dari body respons ImageKit
             (format resminya: {"message": "...", "help": "..."}) supaya
             penyebab pastinya (signature salah, token dipakai ulang,
             file terlalu besar, dst.) langsung terlihat di Console. */
          let pesan = `Upload ke ImageKit gagal (status ${xhr.status}).`;
          try {
            const body = JSON.parse(xhr.responseText);
            if (body?.message) pesan += ` Pesan dari ImageKit: "${body.message}"`;
          } catch (_) { /* respons bukan JSON, pakai pesan default di atas */ }
          console.error(`[StorageHelper] ${pesan}`, xhr.responseText);
          reject(new Error(pesan));
        }
      };
      xhr.onerror = () => reject(new Error("Koneksi ke ImageKit gagal."));
      xhr.onabort = () => reject(new Error("DIBATALKAN"));
      xhr.send(formData);
    });
  })();

  return kontrol;
}

/** Upload satu gambar. Return { promise, cancel } — bukan Promise
 *  langsung — supaya pemanggil bisa membatalkan upload yang sedang
 *  berjalan (tombol "Batal" di widget). */
function uploadImage(file, folder, opts = {}) {
  _cekFolderStorage(folder);
  const { onProgress, compress = true } = opts;
  let dibatalkan = false;
  const kontrolLuar = { cancel: () => { dibatalkan = true; } };

  kontrolLuar.promise = (async () => {
    const fileFinal = compress ? await compressImage(file) : file;
    if (dibatalkan) throw new Error("DIBATALKAN");

    if (!FIREBASE_ENABLED) {
      await _simulasiProgress(onProgress, () => dibatalkan);
      if (dibatalkan) throw new Error("DIBATALKAN");
      return { url: URL.createObjectURL(fileFinal), path: `demo-${Date.now()}-${_slugifyNamaFile(fileFinal.name)}` };
    }

    const kontrolDalam = _uploadKeImageKit(fileFinal, folder, onProgress);
    kontrolLuar.cancel = kontrolDalam.cancel;
    return kontrolDalam.promise;
  })();

  return kontrolLuar;
}

/** Upload banyak gambar sekaligus (mis. galeri Dokumentasi).
 *  Progress agregat (rata-rata semua file) + progress per-file. */
function uploadMultipleImages(files, folder, opts = {}) {
  const { onProgress, compress = true } = opts;
  const daftar = Array.from(files);
  const progressPerFile = new Array(daftar.length).fill(0);

  const kontrols = daftar.map((file, i) => uploadImage(file, folder, {
    compress,
    onProgress: (p) => {
      progressPerFile[i] = p;
      const agregat = Math.round(progressPerFile.reduce((a, b) => a + b, 0) / daftar.length);
      onProgress?.(agregat, i, p);
    }
  }));

  return {
    cancel: () => kontrols.forEach(k => k.cancel()),
    promise: Promise.all(kontrols.map(k => k.promise))
  };
}

/** Hapus satu file. `pathAtauUrl` di sini adalah fileId ImageKit
 *  (lihat komentar di _uploadKeImageKit) — bukan URL. Panggil lewat
 *  api/imagekit-delete.js karena Delete API ImageKit wajib private
 *  key, tidak boleh dipanggil langsung dari browser. */
async function deleteImage(pathAtauUrl) {
  if (!pathAtauUrl || !FIREBASE_ENABLED) return; // blob: URL lokal di Mode Demo tak perlu dihapus dari server
  if (pathAtauUrl.startsWith("blob:") || pathAtauUrl.startsWith("http") || pathAtauUrl.startsWith("demo-")) {
    /* URL lama (mis. dari data sebelum migrasi F8.0) atau path Mode
       Demo — tidak ada fileId ImageKit yang bisa dihapus, lewati
       dengan aman daripada gagal/error ke pengguna. */
    return;
  }
  try {
    const resp = await fetch("/api/imagekit-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId: pathAtauUrl })
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      console.warn("[StorageHelper] Gagal menghapus file di ImageKit:", err.error || resp.status);
    }
  } catch (e) {
    console.warn("[StorageHelper] Gagal menghapus file (mungkin sudah tidak ada):", e.message);
  }
}

/** Ganti gambar: upload yang baru dulu, baru hapus yang lama SETELAH
 *  berhasil — supaya tidak ada jeda "tanpa gambar" bila upload gagal. */
function replaceImage(oldPathAtauUrl, newFile, folder, opts = {}) {
  const kontrol = uploadImage(newFile, folder, opts);
  const promiseAsli = kontrol.promise;
  kontrol.promise = promiseAsli.then(async (hasil) => {
    await deleteImage(oldPathAtauUrl);
    return hasil;
  });
  return kontrol;
}

const StorageHelper = { compressImage, uploadImage, uploadMultipleImages, deleteImage, replaceImage, STORAGE_FOLDER_VALID };

/* ─────────────────────────────────────────────────────────
   UPLOAD WIDGET — UI reusable (drag&drop, preview, progress,
   replace, delete, cancel, error). SATU implementasi dipakai
   oleh keempat form Konten Admin (Poster/Video/Artikel/
   Dokumentasi) — bukan ditulis ulang per halaman.
───────────────────────────────────────────────────────── */
function _idAcak() { return Math.random().toString(36).slice(2, 10); }

/**
 * @param {HTMLElement} container - elemen kosong tempat widget dirender
 * @param {object} opts
 *   folder     : nama folder Storage tujuan (wajib, lihat STORAGE_FOLDER_VALID)
 *   multiple   : true utk galeri (banyak gambar), false utk cover/thumbnail tunggal
 *   existingUrls: array URL gambar yang sudah ada (mode edit)
 *   onChange   : dipanggil dengan array URL terkini setiap kali berubah
 *   label      : teks ajakan di dropzone
 */
function initUploadWidget(container, opts) {
  const { folder, multiple = false, existingUrls = [], onChange, label = "Seret gambar ke sini atau klik untuk pilih" } = opts;
  _cekFolderStorage(folder);

  let items = (existingUrls || []).filter(Boolean).map((url) => ({ id: _idAcak(), url, path: null, status: "done" }));
  let replaceTargetId = null;

  function render() {
    container.innerHTML = `
      <div class="upload-dropzone" tabindex="0" role="button" aria-label="${label}">
        <input type="file" accept="image/*" ${multiple ? "multiple" : ""} hidden class="upload-input"/>
        <svg width="26" height="26" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
        <p>${label}</p>
        <span class="upload-hint">JPG / PNG / WebP — otomatis dikompres &amp; diresize (target 300–700 KB)</span>
      </div>
      ${items.length ? `<div class="upload-previews">${items.map(_itemHTML).join("")}</div>` : ""}
    `;
    _pasangEventWidget(container, folder, multiple, () => items, (i) => { items = i; }, render,
      () => replaceTargetId, (v) => { replaceTargetId = v; }, onChange);
  }

  render();
  return {
    getUrls: () => items.filter(x => x.status === "done").map(x => x.url),
    getPaths: () => items.filter(x => x.status === "done" && x.path).map(x => x.path),
    isUploading: () => items.some(x => x.status === "uploading"),
    /* [FIX — Dokumentasi 0 Foto] Sebelumnya tidak ada cara bagi kode
       pemanggil untuk tahu ada item yang gagal upload (status "error")
       — akibatnya form bisa disimpan dengan galeri/cover kosong tanpa
       peringatan apapun (lihat konten-admin.js). */
    hasError: () => items.some(x => x.status === "error")
  };
}

function _itemHTML(it) {
  return `<div class="upload-preview-item" data-id="${it.id}" data-status="${it.status}">
    <img src="${it.url}" alt=""/>
    ${it.status === "uploading" ? `
      <div class="upload-progress-overlay">
        <div class="upload-progress-bar"><div style="width:${it.progress || 0}%"></div></div>
        <button type="button" class="upload-btn-cancel" title="Batalkan upload">✕</button>
      </div>` : ""}
    ${it.status === "error" ? `<div class="upload-error-badge" title="${it.errorMsg || "Upload gagal"}">⚠ Gagal</div>` : ""}
    ${it.status === "done" ? `
      <div class="upload-item-actions">
        <button type="button" class="upload-btn-replace" title="Ganti gambar">🔄</button>
        <button type="button" class="upload-btn-remove" title="Hapus gambar">🗑</button>
      </div>` : ""}
  </div>`;
}

function _pasangEventWidget(container, folder, multiple, getItems, setItems, render, getReplaceTarget, setReplaceTargetVal, onChange) {
  const drop = container.querySelector(".upload-dropzone");
  const input = container.querySelector(".upload-input");

  drop.addEventListener("click", () => input.click());
  drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("drag-over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("drag-over"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault(); drop.classList.remove("drag-over");
    _tanganiFileWidget(e.dataTransfer.files, folder, multiple, getItems, setItems, render, getReplaceTarget, setReplaceTargetVal, onChange);
  });
  input.addEventListener("change", (e) => {
    _tanganiFileWidget(e.target.files, folder, multiple, getItems, setItems, render, getReplaceTarget, setReplaceTargetVal, onChange);
    input.value = "";
  });

  container.querySelectorAll(".upload-btn-cancel").forEach(btn => btn.addEventListener("click", (e) => {
    const id = e.target.closest("[data-id]").dataset.id;
    getItems().find(x => x.id === id)?.kontrolUpload?.cancel();
  }));
  container.querySelectorAll(".upload-btn-remove").forEach(btn => btn.addEventListener("click", async (e) => {
    const id = e.target.closest("[data-id]").dataset.id;
    const it = getItems().find(x => x.id === id);
    if (it?.path) await deleteImage(it.path);
    setItems(getItems().filter(x => x.id !== id));
    render();
    onChange?.(getItems().filter(x => x.status === "done").map(x => x.url));
  }));
  container.querySelectorAll(".upload-btn-replace").forEach(btn => btn.addEventListener("click", (e) => {
    const id = e.target.closest("[data-id]").dataset.id;
    setReplaceTargetVal(id);
    input.click();
  }));
}

function _tanganiFileWidget(fileList, folder, multiple, getItems, setItems, render, getReplaceTarget, setReplaceTargetVal, onChange) {
  const files = Array.from(fileList).filter(f => f.type.startsWith("image/"));
  if (!files.length) return;

  if (!multiple) {
    const file = files[0];
    const targetId = getReplaceTarget();
    setReplaceTargetVal(null);
    const existing = targetId ? getItems().find(x => x.id === targetId) : getItems()[0];
    const idBaru = _idAcak();
    const itemBaru = { id: idBaru, url: URL.createObjectURL(file), status: "uploading", progress: 0 };
    setItems(existing ? getItems().map(x => x.id === existing.id ? itemBaru : x) : [itemBaru]);
    render();

    const it = getItems().find(x => x.id === idBaru);
    const onProgress = (p) => { it.progress = p; _updateProgressDOM(idBaru, p); };
    const kontrol = existing?.path
      ? replaceImage(existing.path, file, folder, { onProgress })
      : uploadImage(file, folder, { onProgress });
    it.kontrolUpload = kontrol;
    kontrol.promise.then((hasil) => {
      it.url = hasil.url; it.path = hasil.path; it.status = "done";
      render();
      onChange?.(getItems().filter(x => x.status === "done").map(x => x.url));
    }).catch((err) => {
      if (err.message === "DIBATALKAN") { setItems(getItems().filter(x => x.id !== idBaru)); render(); return; }
      it.status = "error"; it.errorMsg = "Upload gagal, coba lagi."; render();
    });
  } else {
    const mulai = getItems().length;
    setItems([...getItems(), ...files.map(f => ({ id: _idAcak(), url: URL.createObjectURL(f), status: "uploading", progress: 0 }))]);
    render();
    files.forEach((file, idx) => {
      const it = getItems()[mulai + idx];
      const onProgress = (p) => { it.progress = p; _updateProgressDOM(it.id, p); };
      const kontrol = uploadImage(file, folder, { onProgress });
      it.kontrolUpload = kontrol;
      kontrol.promise.then((hasil) => {
        it.url = hasil.url; it.path = hasil.path; it.status = "done";
        render();
        onChange?.(getItems().filter(x => x.status === "done").map(x => x.url));
      }).catch((err) => {
        if (err.message === "DIBATALKAN") { setItems(getItems().filter(x => x.id !== it.id)); render(); return; }
        it.status = "error"; it.errorMsg = "Upload gagal."; render();
      });
    });
  }
}

function _updateProgressDOM(id, p) {
  const el = document.querySelector(`[data-id="${id}"] .upload-progress-bar > div`);
  if (el) el.style.width = p + "%";
}
