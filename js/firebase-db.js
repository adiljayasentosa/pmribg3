/* =========================================================
   FIREBASE-DB.JS — Abstraction Layer
   Menyediakan AppState (runtime store) dan DB (CRUD).

   Mode DEMO (FIREBASE_ENABLED=false):
     Semua operasi langsung mutasi AppState — data hilang saat refresh,
     tapi aplikasi 100% fungsional untuk uji coba.

   Mode FIREBASE (FIREBASE_ENABLED=true):
     CRUD ditulis ke Firestore, listener real-time memperbarui AppState,
     lalu memanggil _reRenderPage() agar tampilan selalu sinkron.
   ========================================================= */

/* ─────────────────────────────────────────────────────────
   AppState — mirror runtime dari DUMMY_DATA.
   Render functions membaca AppState (bukan DUMMY_DATA).
   Semua ID disimpan sebagai STRING agar kompatibel dengan
   Firestore document IDs.
───────────────────────────────────────────────────────── */
const AppState = {
  periode:          "2025/2026",
  ringkasan:        {},
  anggota:          [],
  kegiatan:         [],
  keuangan:         [],
  presensiHistory:  [],
  strukturPengurus: [],
  guru:             []
};

/* Salin DUMMY_DATA ke AppState (ID dikonversi ke string) */
function _seedAppStateFromDummy() {
  AppState.periode  = DUMMY_DATA.periode;
  AppState.ringkasan = { ...DUMMY_DATA.ringkasan };
  AppState.anggota  = DUMMY_DATA.anggota.map(a => ({ ...a, id: String(a.id) }));
  AppState.kegiatan = DUMMY_DATA.kegiatan.map(k => ({ ...k, id: String(k.id) }));
  AppState.keuangan = DUMMY_DATA.keuangan.map(t => ({ ...t, id: String(t.id) }));
  AppState.presensiHistory = DUMMY_DATA.presensiHistory.map(p => ({
    ...p, anggotaId: String(p.anggotaId)
  }));
  AppState.strukturPengurus = JSON.parse(JSON.stringify(DUMMY_DATA.strukturPengurus))
    .map(jabatan => ({
      ...jabatan,
      /* FIX BUG #1: ID di data-dummy adalah number (8, 101, dst).
         dataset.id dari DOM selalu string. Tanpa konversi ini,
         find(a => a.id === chipEl.dataset.id) selalu gagal karena
         8 === "8" → false, membuat semua modal pengurus tidak muncul. */
      anggota: jabatan.anggota.map(a => ({ ...a, id: String(a.id) }))
    }));
  AppState.guru = [...DUMMY_DATA.guru];
  _hitungRingkasan();
}

/* Hitung ulang ringkasan dari data yang ada */
function _hitungRingkasan() {
  const aktif   = AppState.anggota.filter(a => a.status === "Aktif").length;
  const saldo   = AppState.keuangan.reduce((s, t) => t.jenis === "Masuk" ? s + t.jumlah : s - t.jumlah, 0);
  const berjalan= AppState.kegiatan.filter(k => k.status === "Terjadwal").length;
  const total   = AppState.presensiHistory.length;
  const hadir   = AppState.presensiHistory.filter(p => p.hadir).length;
  const rata    = total ? Math.round((hadir / total) * 100) : 0;

  AppState.ringkasan = {
    totalAnggota:    AppState.anggota.length,
    anggotaAktif:    aktif,
    kasSaldo:        Math.max(0, saldo),
    programBerjalan: berjalan,
    kehadiranRata:   rata
  };
}

/* Fungsi re-render halaman aktif (dipanggil oleh listener) */
let _reRenderPage = () => {};
function setReRenderHandler(fn) { _reRenderPage = fn; }

/* ─────────────────────────────────────────────────────────
   DB — objek utama yang dipakai dashboard.js
───────────────────────────────────────────────────────── */
const DB = {
  _listeners: [],

  /* ── Init: muat data awal ── */
  async init() {
    if (!FIREBASE_ENABLED) {
      _seedAppStateFromDummy();
      return;
    }
    const fdb = firebase.firestore();
    /* Muat semua koleksi sekali sebelum listener aktif */
    const [
      snapAnggota, snapKegiatan, snapKeuangan,
      snapPresensi, snapPengurus
    ] = await Promise.all([
      fdb.collection("anggota").orderBy("nama").get(),
      fdb.collection("kegiatan").orderBy("tanggal", "desc").get(),
      fdb.collection("keuangan").orderBy("tanggal", "desc").get(),
      fdb.collection("presensi").get(),
      fdb.collection("pengurus").doc("struktur").get()
    ]);

    AppState.anggota  = snapAnggota.docs.map(d => ({ id: d.id, ...d.data() }));
    AppState.kegiatan = snapKegiatan.docs.map(d => ({ id: d.id, ...d.data() }));
    AppState.keuangan = snapKeuangan.docs.map(d => ({ id: d.id, ...d.data() }));
    AppState.presensiHistory = snapPresensi.docs.map(d => ({ id: d.id, ...d.data() }));
    if (snapPengurus.exists) {
      const data = snapPengurus.data();
      /* FIX: saat load dari Firestore, ID di dalam anggota[] bisa berupa
         number (data lama sebelum patch) atau string. chipEl.dataset.id
         dari DOM selalu string, sehingga find(a => a.id === idLama) gagal
         jika a.id masih number. Normalisasi ke string di sini agar
         konsisten dengan mode demo dan mencegah modal tidak muncul. */
      AppState.strukturPengurus = (data.jabatan || []).map(jabatan => ({
        ...jabatan,
        anggota: (jabatan.anggota || []).map(a => ({ ...a, id: String(a.id) }))
      }));
      AppState.periode = data.periode || "2025/2026";
    }
    AppState.guru = DUMMY_DATA.guru; /* guru tetap dari config lokal */
    _hitungRingkasan();
  },

  /* ── Real-time listeners ── */
  initListeners() {
    if (!FIREBASE_ENABLED) return; /* demo mode: tidak perlu listener */
    const fdb = firebase.firestore();

    this._listeners.push(
      fdb.collection("anggota").orderBy("nama").onSnapshot(snap => {
        AppState.anggota = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        _hitungRingkasan(); _reRenderPage();
      }),
      fdb.collection("kegiatan").orderBy("tanggal", "desc").onSnapshot(snap => {
        AppState.kegiatan = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        _hitungRingkasan(); _reRenderPage();
      }),
      fdb.collection("keuangan").orderBy("tanggal", "desc").onSnapshot(snap => {
        AppState.keuangan = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        _hitungRingkasan(); _reRenderPage();
      }),
      fdb.collection("presensi").onSnapshot(snap => {
        AppState.presensiHistory = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        _hitungRingkasan(); _reRenderPage();
      })
    );
  },

  stopListeners() {
    this._listeners.forEach(unsub => unsub());
    this._listeners = [];
  },

  /* ──────────────────── ANGGOTA ──────────────────── */
  anggota: {
    async tambah(data) {
      if (!FIREBASE_ENABLED) {
        const id = String(Math.max(0, ...AppState.anggota.map(a => +a.id || 0)) + 1);
        AppState.anggota.push({ id, ...data });
        AppState.anggota.sort((a,b) => a.nama.localeCompare(b.nama));
        _hitungRingkasan();
        return id;
      }
      const ref = await firebase.firestore().collection("anggota").add(data);
      return ref.id;
    },
    async update(id, data) {
      if (!FIREBASE_ENABLED) {
        const idx = AppState.anggota.findIndex(a => a.id === id);
        if (idx !== -1) AppState.anggota[idx] = { ...AppState.anggota[idx], ...data };
        _hitungRingkasan();
        return;
      }
      await firebase.firestore().collection("anggota").doc(id).update(data);
    },
    async hapus(id) {
      if (!FIREBASE_ENABLED) {
        AppState.anggota = AppState.anggota.filter(a => a.id !== id);
        _hitungRingkasan();
        return;
      }
      await firebase.firestore().collection("anggota").doc(id).delete();
    }
  },

  /* ──────────────────── KEGIATAN ──────────────────── */
  kegiatan: {
    async tambah(data) {
      if (!FIREBASE_ENABLED) {
        const id = String(Math.max(0, ...AppState.kegiatan.map(k => +k.id || 0)) + 1);
        AppState.kegiatan.unshift({ id, ...data });
        _hitungRingkasan();
        return id;
      }
      const ref = await firebase.firestore().collection("kegiatan").add(data);
      return ref.id;
    },
    async update(id, data) {
      if (!FIREBASE_ENABLED) {
        const idx = AppState.kegiatan.findIndex(k => k.id === id);
        if (idx !== -1) AppState.kegiatan[idx] = { ...AppState.kegiatan[idx], ...data };
        _hitungRingkasan();
        return;
      }
      await firebase.firestore().collection("kegiatan").doc(id).update(data);
    },
    async hapus(id) {
      if (!FIREBASE_ENABLED) {
        AppState.kegiatan = AppState.kegiatan.filter(k => k.id !== id);
        _hitungRingkasan();
        return;
      }
      await firebase.firestore().collection("kegiatan").doc(id).delete();
    }
  },

  /* ──────────────────── KEUANGAN ──────────────────── */
  keuangan: {
    async tambah(data) {
      if (!FIREBASE_ENABLED) {
        const id = String(Math.max(0, ...AppState.keuangan.map(t => +t.id || 0)) + 1);
        AppState.keuangan.unshift({ id, ...data });
        _hitungRingkasan();
        return id;
      }
      const ref = await firebase.firestore().collection("keuangan").add(data);
      return ref.id;
    },
    async update(id, data) {
      if (!FIREBASE_ENABLED) {
        const idx = AppState.keuangan.findIndex(t => t.id === id);
        if (idx !== -1) AppState.keuangan[idx] = { ...AppState.keuangan[idx], ...data };
        _hitungRingkasan();
        return;
      }
      await firebase.firestore().collection("keuangan").doc(id).update(data);
    },
    async hapus(id) {
      if (!FIREBASE_ENABLED) {
        AppState.keuangan = AppState.keuangan.filter(t => t.id !== id);
        _hitungRingkasan();
        return;
      }
      await firebase.firestore().collection("keuangan").doc(id).delete();
    }
  },

  /* ──────────────────── PRESENSI ──────────────────── */
  presensi: {
    /**
     * Simpan/perbarui baris presensi untuk satu pertemuan.
     * @param {Array} rows  [{anggotaId, tanggal, hadir, ket}]
     * @param {string} tanggal  ISO date string (dipakai sebagai partition key)
     */
    async simpan(rows, tanggal) {
      if (!FIREBASE_ENABLED) {
        /* Hapus data lama pertemuan tanggal tsb lalu tambah baru */
        AppState.presensiHistory = AppState.presensiHistory.filter(p => p.tanggal !== tanggal);
        rows.forEach(r => AppState.presensiHistory.push(r));
        _hitungRingkasan();
        return;
      }
      const fdb = firebase.firestore();
      const batch = fdb.batch();
      /* Hapus presensi lama untuk tanggal ini */
      const snap = await fdb.collection("presensi").where("tanggal", "==", tanggal).get();
      snap.docs.forEach(d => batch.delete(d.ref));
      /* Tulis baris baru */
      rows.forEach(r => {
        const ref = fdb.collection("presensi").doc();
        batch.set(ref, r);
      });
      await batch.commit();
    }
  },

  /* ──────────────────── PENGURUS ──────────────────── */
  pengurus: {
    async simpanStruktur(strukturBaru) {
      AppState.strukturPengurus = strukturBaru;
      if (!FIREBASE_ENABLED) return;
      await firebase.firestore().collection("pengurus").doc("struktur").set({
        periode: AppState.periode,
        jabatan: strukturBaru,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  }
};

/* ─────────────────────────────────────────────────────────
   SEED — Isi Firestore dengan data awal (panggil dari setup.html)
   Hanya berjalan jika FIREBASE_ENABLED = true.
───────────────────────────────────────────────────────── */
async function seedFirestore(onProgress) {
  if (!FIREBASE_ENABLED) {
    onProgress?.("FIREBASE_ENABLED masih false. Aktifkan dulu di firebase-config.js.", "warn");
    return;
  }
  const fdb = firebase.firestore();
  const log = (msg, tipe="ok") => onProgress?.(msg, tipe);

  try {
    /* Anggota */
    log("Menambahkan data anggota…");
    const batchA = fdb.batch();
    DUMMY_DATA.anggota.forEach(a => {
      const { id, ...data } = a;
      batchA.set(fdb.collection("anggota").doc(String(id)), data);
    });
    await batchA.commit();
    log(`✓ ${DUMMY_DATA.anggota.length} anggota ditambahkan.`);

    /* Kegiatan */
    log("Menambahkan data kegiatan…");
    const batchK = fdb.batch();
    DUMMY_DATA.kegiatan.forEach(k => {
      const { id, ...data } = k;
      batchK.set(fdb.collection("kegiatan").doc(String(id)), data);
    });
    await batchK.commit();
    log(`✓ ${DUMMY_DATA.kegiatan.length} kegiatan ditambahkan.`);

    /* Keuangan */
    log("Menambahkan data keuangan…");
    const batchKeu = fdb.batch();
    DUMMY_DATA.keuangan.forEach(t => {
      const { id, ...data } = t;
      batchKeu.set(fdb.collection("keuangan").doc(String(id)), data);
    });
    await batchKeu.commit();
    log(`✓ ${DUMMY_DATA.keuangan.length} transaksi ditambahkan.`);

    /* Presensi */
    log("Menambahkan data presensi…");
    const batchP = fdb.batch();
    DUMMY_DATA.presensiHistory.forEach((p, i) => {
      batchP.set(fdb.collection("presensi").doc(String(i + 1)), {
        ...p, anggotaId: String(p.anggotaId)
      });
    });
    await batchP.commit();
    log(`✓ ${DUMMY_DATA.presensiHistory.length} data presensi ditambahkan.`);

    /* Struktur Pengurus */
    log("Menyimpan struktur pengurus…");
    await fdb.collection("pengurus").doc("struktur").set({
      periode: DUMMY_DATA.periode,
      jabatan: DUMMY_DATA.strukturPengurus,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    log("✓ Struktur pengurus disimpan.");

    log("✓ Seed selesai! Semua data berhasil dimasukkan ke Firestore.", "done");
  } catch(err) {
    log("✗ Error saat seed: " + err.message, "error");
    console.error(err);
  }
}
