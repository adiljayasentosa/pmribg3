/* =========================================================
   MODAL.JS — Komponen modal reusable
   Ekspor: Modal.buka(), Modal.tutup(), Modal.konfirmasi()
   ========================================================= */
const Modal = (() => {
  let overlayEl = null;

  function _ensureRoot() {
    if (overlayEl) return;
    const root = document.getElementById("modal-root");

    overlayEl = document.createElement("div");
    overlayEl.className = "modal-overlay";
    overlayEl.setAttribute("role", "dialog");
    overlayEl.setAttribute("aria-modal", "true");
    overlayEl.addEventListener("click", (e) => {
      if (e.target === overlayEl) tutup();
    });

    root.appendChild(overlayEl);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlayEl.classList.contains("open")) tutup();
    });
  }

  /**
   * Buka modal.
   * @param {object} cfg
   *   judul   {string}  — judul di header modal
   *   konten  {string}  — HTML isi modal-body
   *   ukuran  {string}  — "" | "modal-lg" | "modal-sm"
   *   aksi    {Array}   — [{ label, kelas, id, onClick }]
   */
  function buka({ judul = "", konten = "", ukuran = "", aksi = [] } = {}) {
    _ensureRoot();

    const aksiBtns = aksi.map((a) =>
      `<button class="btn ${a.kelas || "btn-ghost"}" id="${a.id || ""}">${a.label}</button>`
    ).join("");

    overlayEl.innerHTML = `
      <div class="modal ${ukuran}" role="document">
        <div class="modal-head">
          <h2>${judul}</h2>
          <button class="modal-close" id="modal-close-btn" aria-label="Tutup">✕</button>
        </div>
        <div class="modal-body">${konten}</div>
        ${aksi.length ? `<div class="modal-foot">${aksiBtns}</div>` : ""}
      </div>`;

    document.getElementById("modal-close-btn").addEventListener("click", tutup);

    /* Pasang onClick handler setiap tombol aksi */
    aksi.forEach((a) => {
      if (a.id && a.onClick) {
        document.getElementById(a.id)?.addEventListener("click", a.onClick);
      }
    });

    /* FIX: pastikan overlay bisa menangkap klik begitu modal dibuka.
       Inline style ini fallback jika CSS gagal/telat termuat — class
       "open" tetap sumber kebenaran utama via CSS. */
    overlayEl.style.pointerEvents = "auto";

    requestAnimationFrame(() => {
      overlayEl.classList.add("open");
      overlayEl.querySelector("input, select, textarea")?.focus();
    });
  }

  function tutup() {
    if (!overlayEl) return;
    overlayEl.classList.remove("open");

    /* FIX akar bug: nonaktifkan klik SEGERA, jangan menunggu transisi opacity.
       Sebelumnya overlay tetap pointer-events:auto (default browser) selama
       innerHTML belum dikosongkan oleh setTimeout di bawah, sehingga overlay
       transparan ini menutupi & memblokir seluruh sidebar/topbar. */
    overlayEl.style.pointerEvents = "none";

    setTimeout(() => {
      overlayEl.innerHTML = "";
    }, 220);
  }

  /**
   * Dialog konfirmasi sederhana.
   * @param {string}   pesan   — pertanyaan yang ditampilkan
   * @param {Function} onYa    — callback jika user klik "Ya"
   */
  function konfirmasi(pesan, onYa) {
    buka({
      judul: "Konfirmasi",
      ukuran: "modal-sm",
      konten: `<p style="margin:0;font-size:0.95rem">${pesan}</p>`,
      aksi: [
        { label: "Batal", kelas: "btn-ghost", id: "modal-batal", onClick: tutup },
        {
          label: "Ya, Lanjutkan", kelas: "btn-primary", id: "modal-ya",
          onClick: () => { tutup(); onYa(); }
        }
      ]
    });
  }

  return { buka, tutup, konfirmasi };
})();

/* =========================================================
   PROTEKSI TAMBAHAN — Auto-recovery overlay macet
   Jika terjadi error JS tak terduga saat modal sedang
   berjalan (mis. callback onClick melempar exception
   sebelum sempat memanggil Modal.tutup()), overlay bisa
   tertinggal dalam kondisi "open" tanpa pernah ditutup.
   Listener ini menjadi jaring pengaman: begitu ada error,
   paksa nonaktifkan pointer-events overlay supaya sidebar
   tidak pernah benar-benar freeze permanen.
   ========================================================= */
window.addEventListener("error", () => {
  const ov = document.querySelector(".modal-overlay");
  if (ov) {
    ov.classList.remove("open");
    ov.style.pointerEvents = "none";
  }
});


/* =========================================================
   NOTIFIKASI IN-APP
   ========================================================= */
const Notif = (() => {
  const _items = [];
  let _dropdownEl = null;
  let _badgeEl = null;
  let _btnEl = null;

  function init(btnId, dropdownId, badgeId) {
    _btnEl      = document.getElementById(btnId);
    _dropdownEl = document.getElementById(dropdownId);
    _badgeEl    = document.getElementById(badgeId);

    if (!_btnEl || !_dropdownEl) return;

    _btnEl.addEventListener("click", (e) => {
      e.stopPropagation();
      _dropdownEl.classList.toggle("open");
      if (_dropdownEl.classList.contains("open")) render();
    });

    document.addEventListener("click", () => {
      _dropdownEl?.classList.remove("open");
    });

    /* Buat notif dari kegiatan yang < 7 hari lagi — baca dari AppState */
    const sekarang = new Date();
    (AppState.kegiatan || []).forEach((k) => {
      const selisih = Math.ceil((new Date(k.tanggal) - sekarang) / (1000 * 60 * 60 * 24));
      if (selisih >= 0 && selisih <= 7) {
        tambah(`Kegiatan "${k.nama}" ${selisih === 0 ? "hari ini!" : `${selisih} hari lagi`}`, false);
      }
    });

    tambah("Selamat datang di dashboard PMR!", true);
    updateBadge();
  }

  function tambah(pesan, dibaca = false) {
    _items.unshift({ pesan, dibaca, waktu: new Date() });
  }

  function updateBadge() {
    if (!_badgeEl) return;
    const belumBaca = _items.filter((i) => !i.dibaca).length;
    _badgeEl.textContent = belumBaca;
    _badgeEl.style.display = belumBaca > 0 ? "flex" : "none";
  }

  function render() {
    if (!_dropdownEl) return;
    _dropdownEl.querySelector(".notif-list").innerHTML = _items.length === 0
      ? `<div class="notif-item" style="color:var(--ink-soft)">Tidak ada notifikasi.</div>`
      : _items.map((item) => `
          <div class="notif-item">
            <div class="notif-dot ${item.dibaca ? "read" : ""}"></div>
            <div>
              <div>${item.pesan}</div>
              <div class="notif-item-meta">${item.waktu.toLocaleTimeString("id-ID", { hour:"2-digit", minute:"2-digit" })}</div>
            </div>
          </div>`).join("");

    /* Tandai semua sudah dibaca */
    _items.forEach((i) => (i.dibaca = true));
    updateBadge();
  }

  return { init, tambah, updateBadge };
})();
