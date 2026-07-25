/* =========================================================
   CONTENT-DB.JS — [F6.0 — Konten Publik]                    BARU
   =========================================================
   Lapisan data KHUSUS untuk 4 collection baru: artikel, video,
   poster, dokumentasi. SENGAJA file terpisah dari
   js/core/firebase-db.js — TIDAK menyentuh AppState atau DB{}
   yang sudah ada, supaya nol risiko regresi ke dashboard internal.

   Dipakai oleh:
     - Landing page (index.html)               → fetchLatest()
     - Halaman publik /artikel /video /poster
       /dokumentasi (list + detail)             → fetchAll(), fetchBySlug()
     - Dashboard internal (Manajemen Konten)    → create()/update()/remove()

   Mode DEMO   (FIREBASE_ENABLED=false): baca/tulis ke array
               DUMMY_KONTEN_PUBLIK di memori (js/data-dummy.js).
   Mode FIREBASE (FIREBASE_ENABLED=true): Firestore asli, dengan
               publish=true + orderBy(tanggal desc) + limit — sesuai
               instruksi "LANDING DATA SOURCE".

   Ditulis generik per `koleksi` (nama collection) supaya menambah
   jenis konten baru nanti (mis. "pengumuman") tidak perlu helper
   baru — cukup panggil fungsi yang sama dengan nama koleksi lain.
   ========================================================= */

const KOLEKSI_KONTEN_VALID = ["artikel", "video", "poster", "dokumentasi"];

function _cekKoleksi(koleksi) {
  if (!KOLEKSI_KONTEN_VALID.includes(koleksi)) {
    throw new Error(`[ContentDB] Koleksi tidak dikenal: ${koleksi}`);
  }
}

/* Salinan in-memory utk Mode Demo, supaya create/update/delete
   terasa nyata selama sesi (hilang saat refresh — sama seperti
   perilaku Mode Demo di firebase-db.js). */
let _demoStore = null;
function _demoData(koleksi) {
  if (!_demoStore) {
    _demoStore = JSON.parse(JSON.stringify(DUMMY_KONTEN_PUBLIK));
  }
  return _demoStore[koleksi];
}

function _urutTerbaru(list) {
  return [...list].sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
}

const ContentDB = {

  /** 3 (atau n) item terbaru yang publish=true — dipakai Landing. */
  async fetchLatest(koleksi, n = 3) {
    _cekKoleksi(koleksi);
    if (!FIREBASE_ENABLED) {
      return _urutTerbaru(_demoData(koleksi).filter(x => x.publish)).slice(0, n);
    }
    try {
      const snap = await firebase.firestore().collection(koleksi)
        .where("publish", "==", true)
        .orderBy("tanggal", "desc")
        .limit(n)
        .get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.error(`[ContentDB] Gagal memuat '${koleksi}' (fetchLatest):`, e);
      return [];
    }
  },

  /** Semua item publish=true — dipakai halaman daftar publik.
   *  Parameter `opts` sengaja disiapkan untuk future filter/paginasi
   *  (kategori, page, pageSize) tanpa perlu ubah signature nanti. */
  async fetchAll(koleksi, opts = {}) {
    _cekKoleksi(koleksi);
    const { kategori = null } = opts;
    if (!FIREBASE_ENABLED) {
      let list = _urutTerbaru(_demoData(koleksi).filter(x => x.publish));
      if (kategori) list = list.filter(x => x.kategori === kategori);
      return list;
    }
    try {
      let q = firebase.firestore().collection(koleksi).where("publish", "==", true);
      if (kategori) q = q.where("kategori", "==", kategori);
      const snap = await q.orderBy("tanggal", "desc").get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.error(`[ContentDB] Gagal memuat '${koleksi}' (fetchAll):`, e);
      return [];
    }
  },

  /** Satu item berdasar slug — dipakai halaman detail publik. */
  async fetchBySlug(koleksi, slug) {
    _cekKoleksi(koleksi);
    if (!FIREBASE_ENABLED) {
      return _demoData(koleksi).find(x => x.slug === slug && x.publish) || null;
    }
    try {
      const snap = await firebase.firestore().collection(koleksi)
        .where("slug", "==", slug).where("publish", "==", true).limit(1).get();
      return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
    } catch (e) {
      console.error(`[ContentDB] Gagal memuat '${koleksi}' (fetchBySlug):`, e);
      return null;
    }
  },

  /** Semua item TERMASUK draft (publish=false) — dipakai Dashboard
   *  internal (Manajemen Konten), bukan halaman publik. */
  async fetchAllUntukAdmin(koleksi) {
    _cekKoleksi(koleksi);
    if (!FIREBASE_ENABLED) {
      return _urutTerbaru(_demoData(koleksi));
    }
    try {
      const snap = await firebase.firestore().collection(koleksi).orderBy("tanggal", "desc").get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.error(`[ContentDB] Gagal memuat '${koleksi}' (fetchAllUntukAdmin):`, e);
      return [];
    }
  },

  /** Ambil beberapa koleksi sekaligus secara paralel — dipakai
   *  Landing page ("Gunakan Promise.all()" sesuai instruksi). */
  async fetchLatestBanyak(daftarKoleksi, n = 3) {
    const hasil = await Promise.all(daftarKoleksi.map(k => this.fetchLatest(k, n)));
    return Object.fromEntries(daftarKoleksi.map((k, i) => [k, hasil[i]]));
  },

  async create(koleksi, data) {
    _cekKoleksi(koleksi);
    if (!FIREBASE_ENABLED) {
      const id = koleksi[0] + Date.now();
      _demoData(koleksi).unshift({ id, ...data });
      return id;
    }
    const ref = await firebase.firestore().collection(koleksi).add({
      ...data,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return ref.id;
  },

  async update(koleksi, id, data) {
    _cekKoleksi(koleksi);
    if (!FIREBASE_ENABLED) {
      const list = _demoData(koleksi);
      const idx = list.findIndex(x => x.id === id);
      if (idx > -1) list[idx] = { ...list[idx], ...data };
      return;
    }
    await firebase.firestore().collection(koleksi).doc(id).update(data);
  },

  async remove(koleksi, id) {
    _cekKoleksi(koleksi);
    if (!FIREBASE_ENABLED) {
      const list = _demoData(koleksi);
      const idx = list.findIndex(x => x.id === id);
      if (idx > -1) list.splice(idx, 1);
      return;
    }
    await firebase.firestore().collection(koleksi).doc(id).delete();
  }
};
