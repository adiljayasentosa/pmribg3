/* =========================================================
   UTILITIES
   Fungsi pembantu yang dipakai lintas modul.
   ========================================================= */

/** Format angka ke Rupiah: 2450000 → "Rp 2.450.000" */
function formatRupiah(angka) {
  return "Rp " + Number(angka).toLocaleString("id-ID");
}

/** Format tanggal ISO ke Indonesia: "2026-07-04" → "4 Juli 2026" */
function formatTanggal(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

/** Ambil inisial dari nama: "Raka Pratama" → "RP" */
function getInisial(nama) {
  return nama
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/**
 * Buat badge HTML berdasarkan status teks.
 * status: "Aktif" | "Tidak Aktif" | "Selesai" | "Terjadwal" | ...
 */
function statusBadge(status) {
  const map = {
    "Aktif":       "badge-success",
    "Tidak Aktif": "badge-gray",
    "Selesai":     "badge-success",
    "Terjadwal":   "badge-info",
    "Menunggu":    "badge-warning",
    "Dibatalkan":  "badge-gray",
    "Masuk":       "badge-success",
    "Keluar":      "badge-red"
  };
  const cls = map[status] || "badge-gray";
  return `<span class="badge ${cls}">${status}</span>`;
}

/**
 * Tampilkan toast notifikasi.
 * @param {string} pesan
 * @param {"default"|"success"|"danger"} tipe
 * @param {number} durasi  ms sebelum menghilang
 */
function tampilToast(pesan, tipe = "default", durasi = 3000) {
  let stack = document.getElementById("toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.id = "toast-stack";
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }

  const el = document.createElement("div");
  el.className = "toast " + (tipe !== "default" ? tipe : "");
  el.textContent = pesan;
  stack.appendChild(el);

  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transition = "opacity 0.3s";
    setTimeout(() => el.remove(), 350);
  }, durasi);
}

/**
 * Render baris tabel dari array data.
 * @param {HTMLElement} tbody  — elemen <tbody>
 * @param {Array}       rows   — array objek data
 * @param {Function}    rowFn  — fn(item) → HTML string satu <tr>
 */
function renderTable(tbody, rows, rowFn) {
  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="99"><div class="empty-state">
      <svg class="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
      </svg>
      <p>Belum ada data.</p>
    </div></td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map((item, index) => rowFn(item, index)).join("");
}

/** Helper: cegah aksi default form & balikin data FormData sebagai object */
function getFormValues(formEl) {
  formEl.addEventListener("submit", (e) => e.preventDefault(), { once: true });
  return Object.fromEntries(new FormData(formEl));
}
