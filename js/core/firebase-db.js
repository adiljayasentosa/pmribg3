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
   PEMETAAN AKSES COLLECTION PER ROLE
   Harus tetap sinkron dengan Firestore Security Rules yang
   sudah dipublish. Ini BUKAN pengganti Rules — hanya mencegah
   client mengirim request yang sudah pasti ditolak, sehingga
   DB.init()/initListeners() tidak gagal karena satu collection
   yang memang di luar wewenang role tersebut.

   anggota      : anggota, kegiatan, pengurus
   bendahara    : anggota, kegiatan, pengurus, keuangan
   sekretaris   : anggota, kegiatan, pengurus, presensi
   pj           : anggota, kegiatan, pengurus, presensi
   admin/ketua/wakil : semua collection
───────────────────────────────────────────────────────── */
const ROLE_AKSES_KEUANGAN = ['admin', 'ketua', 'wakil', 'bendahara'];
const ROLE_AKSES_PRESENSI = ['admin', 'ketua', 'wakil', 'sekretaris', 'pj'];

/**
 * Fetch satu collection dengan error handling untuk kegagalan
 * OPERASIONAL (koneksi putus, timeout, dsb) — BUKAN untuk
 * melewati atau menyembunyikan permission-denied.
 *
 * Pertahanan RBAC tetap dilakukan SEBELUM fungsi ini dipanggil,
 * lewat pengecekan ROLE_AKSES_* di init()/initListeners(). Jika
 * fungsi ini sampai menangkap permission-denied, itu adalah bug
 * nyata (role-check tidak sinkron dengan Rules) dan errornya
 * tetap dicetak jelas ke console — tidak didiamkan.
 */
async function _fetchAman(fetchFn, namaCollection) {
  try {
    const snap = await fetchFn();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) {
    console.error(`[PMR] Gagal memuat collection '${namaCollection}':`, e);
    return [];
  }
}

/* ─────────────────────────────────────────────────────────
   AppState — runtime store seluruh aplikasi.
   Render functions membaca AppState, bukan langsung ke Firestore.
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
  guru:             [],
  inventaris:       [],
  piket:            [],
  upacara:          [],   /* F4.4 Fitur 2 */
  iuran:            [],   /* F4.4 Fitur 1 — hanya menyimpan status "Lunas"/"Khusus";
                              absennya record untuk (anggotaId,bulan,tahun) berarti
                              "Belum Bayar" (default implisit, lihat DB.iuran) */
  nominalIuranStandar: 5000 /* F4.4 Fitur 1 — default, bisa diubah admin/bendahara
                                lewat DB.iuran.setNominalStandar() */
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
  AppState.nominalIuranStandar = DUMMY_DATA.nominalIuranStandar || 5000; /* F4.4 */
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

  /* ── Init: muat data awal (role-aware) ── */
  async init() {
    if (!FIREBASE_ENABLED) {
      _seedAppStateFromDummy();
      return;
    }

    const fdb  = firebase.firestore();
    const role = getCurrentUser()?.role || 'none';

    /* Group 1: anggota, kegiatan, pengurus, inventaris, piket, upacara —
       boleh dibaca SEMUA role yang sudah login. Upacara (F4.4) masuk
       grup ini dengan alasan sama seperti Piket (transparansi jadwal). */
    const [snapAnggota, snapKegiatan, snapPengurus, snapInventaris, snapPiket, snapUpacara] = await Promise.all([
      fdb.collection("anggota").orderBy("nama").get(),
      fdb.collection("kegiatan").orderBy("tanggal", "desc").get(),
      fdb.collection("pengurus").doc("struktur").get(),
      fdb.collection("inventaris").orderBy("nama").get(),
      fdb.collection("piket").orderBy("tanggal", "desc").get(),
      fdb.collection("upacara").orderBy("tanggal", "desc").get()
    ]);

    AppState.anggota    = snapAnggota.docs.map(d => ({ id: d.id, ...d.data() }));
    AppState.kegiatan   = snapKegiatan.docs.map(d => ({ id: d.id, ...d.data() }));
    AppState.inventaris = snapInventaris.docs.map(d => ({ id: d.id, ...d.data() }));
    AppState.piket      = snapPiket.docs.map(d => ({ id: d.id, ...d.data() }));
    AppState.upacara    = snapUpacara.docs.map(d => ({ id: d.id, ...d.data() }));

    if (snapPengurus.exists) {
      const data = snapPengurus.data();
      /* Normalisasi ID ke string agar konsisten dengan DOM dataset.id */
      AppState.strukturPengurus = (data.jabatan || []).map(jabatan => ({
        ...jabatan,
        anggota: (jabatan.anggota || []).map(a => ({ ...a, id: String(a.id) }))
      }));
      AppState.periode = data.periode || "2025/2026";
      /* Guru disimpan di dokumen pengurus/struktur agar bisa dikelola
         tanpa deploy ulang. Kosong jika belum diisi admin. */
      AppState.guru = (data.guru || []).map(g => ({ ...g, id: String(g.id) }));
    }

    /* Group 2: keuangan, iuran — HANYA di-fetch jika role diizinkan Rules.
       "iuran" (F4.4) sengaja disatukan tier-nya dengan "keuangan" karena
       ini data finansial per-anggota, bukan data umum seperti presensi.

       [F4.4 / audit Rules] Dokumen "_pengaturan" di dalam collection
       "iuran" menyimpan nominalIuranStandar — SENGAJA di collection ini
       (bukan pengurus/struktur seperti percobaan awal) karena Rules
       pengurus/struktur hanya izinkan admin+ketua menulis, sedangkan
       nominal iuran harus bisa diubah bendahara juga. Menaruhnya di
       collection "iuran" membuat RBAC-nya otomatis ikut tier iuran
       (admin+bendahara) tanpa melonggarkan Rules pengurus. Dokumen ini
       DIFILTER dari AppState.iuran (bukan data pembayaran sungguhan). */
    const [keuanganData, iuranSnapData] = await Promise.all([
      ROLE_AKSES_KEUANGAN.includes(role)
        ? _fetchAman(() => fdb.collection("keuangan").orderBy("tanggal", "desc").get(), "keuangan")
        : [],
      ROLE_AKSES_KEUANGAN.includes(role)
        ? _fetchAman(() => fdb.collection("iuran").get(), "iuran")
        : []
    ]);
    AppState.keuangan = keuanganData;
    const pengaturanIuran = iuranSnapData.find(d => d.id === "_pengaturan");
    AppState.nominalIuranStandar = pengaturanIuran?.nominalStandar || 5000;
    AppState.iuran = iuranSnapData.filter(d => d.id !== "_pengaturan");

    /* Group 3: presensi — sama, hanya di-fetch untuk role yang diizinkan. */
    AppState.presensiHistory = ROLE_AKSES_PRESENSI.includes(role)
      ? await _fetchAman(
          () => fdb.collection("presensi").get(),
          "presensi"
        )
      : [];

    _hitungRingkasan();
  },

  /* ── Real-time listeners (role-aware) ── */
  initListeners() {
    if (!FIREBASE_ENABLED) return; /* demo mode: tidak perlu listener */
    const fdb  = firebase.firestore();
    const role = getCurrentUser()?.role || 'none';

    /* anggota, kegiatan, inventaris — boleh di-listen SEMUA role yang login */
    this._listeners.push(
      fdb.collection("anggota").orderBy("nama").onSnapshot(snap => {
        AppState.anggota = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        _hitungRingkasan(); _reRenderPage();
      }),
      fdb.collection("kegiatan").orderBy("tanggal", "desc").onSnapshot(snap => {
        AppState.kegiatan = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        _hitungRingkasan(); _reRenderPage();
      }),
      fdb.collection("inventaris").orderBy("nama").onSnapshot(snap => {
        AppState.inventaris = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        _reRenderPage();
      }),
      fdb.collection("piket").orderBy("tanggal", "desc").onSnapshot(snap => {
        AppState.piket = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        _reRenderPage();
      }),
      fdb.collection("upacara").orderBy("tanggal", "desc").onSnapshot(snap => {
        AppState.upacara = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        _reRenderPage();
      })
    );

    /* keuangan, iuran — listener HANYA dipasang jika role diizinkan Rules.
       Tidak memasang listener yang akan ditolak lebih baik daripada
       memasang lalu menangkap errornya — onSnapshot yang gagal
       permission akan terus retry di background jika tetap dipasang. */
    if (ROLE_AKSES_KEUANGAN.includes(role)) {
      this._listeners.push(
        fdb.collection("keuangan").orderBy("tanggal", "desc").onSnapshot(snap => {
          AppState.keuangan = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          _hitungRingkasan(); _reRenderPage();
        }),
        fdb.collection("iuran").onSnapshot(snap => {
          const semua = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          const pengaturan = semua.find(d => d.id === "_pengaturan");
          AppState.nominalIuranStandar = pengaturan?.nominalStandar || 5000;
          AppState.iuran = semua.filter(d => d.id !== "_pengaturan");
          _reRenderPage();
        })
      );
    }

    /* presensi — sama, hanya untuk role yang diizinkan */
    if (ROLE_AKSES_PRESENSI.includes(role)) {
      this._listeners.push(
        fdb.collection("presensi").onSnapshot(snap => {
          AppState.presensiHistory = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          _hitungRingkasan(); _reRenderPage();
        })
      );
    }
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

  /* ──────────────────── INVENTARIS (F4.0) ──────────────────── */
  inventaris: {
    async tambah(data) {
      if (!FIREBASE_ENABLED) {
        const id = String(Math.max(0, ...AppState.inventaris.map(x => +x.id || 0)) + 1);
        AppState.inventaris.push({ id, ...data });
        AppState.inventaris.sort((a,b) => a.nama.localeCompare(b.nama));
        return id;
      }
      const ref = await firebase.firestore().collection("inventaris").add(data);
      return ref.id;
    },
    async update(id, data) {
      if (!FIREBASE_ENABLED) {
        const idx = AppState.inventaris.findIndex(x => x.id === id);
        if (idx !== -1) AppState.inventaris[idx] = { ...AppState.inventaris[idx], ...data };
        return;
      }
      await firebase.firestore().collection("inventaris").doc(id).update(data);
    },
    async hapus(id) {
      if (!FIREBASE_ENABLED) {
        AppState.inventaris = AppState.inventaris.filter(x => x.id !== id);
        return;
      }
      await firebase.firestore().collection("inventaris").doc(id).delete();
    }
  },

  /* ──────────────────── PIKET (F4.1) ──────────────────── */
  piket: {
    async tambah(data) {
      if (!FIREBASE_ENABLED) {
        const id = String(Math.max(0, ...AppState.piket.map(x => +x.id || 0)) + 1);
        AppState.piket.unshift({ id, ...data });
        return id;
      }
      const ref = await firebase.firestore().collection("piket").add(data);
      return ref.id;
    },
    async update(id, data) {
      if (!FIREBASE_ENABLED) {
        const idx = AppState.piket.findIndex(x => x.id === id);
        if (idx !== -1) AppState.piket[idx] = { ...AppState.piket[idx], ...data };
        return;
      }
      await firebase.firestore().collection("piket").doc(id).update(data);
    },
    async hapus(id) {
      if (!FIREBASE_ENABLED) {
        AppState.piket = AppState.piket.filter(x => x.id !== id);
        return;
      }
      await firebase.firestore().collection("piket").doc(id).delete();
    }
  },

  /* ──────────────────── PETUGAS UPACARA (F4.4 Fitur 2) ────────────────────
     Sengaja MIRROR PERSIS DB.piket di atas — konsep & bentuk dokumen sama,
     cuma nama collection berbeda. Tidak digabung jadi satu fungsi generik
     karena keduanya sudah sesederhana mungkin (3 method CRUD lurus) —
     "reusable" yang berarti di sini ada di ALGORITMA rotasinya (lihat
     js/core/rotation-engine.js), bukan di lapisan CRUD/Firestore-nya yang
     memang tipis dan sudah identik dengan pola collection lain di file ini
     (anggota, kegiatan, inventaris, piket). Memaksakan abstraksi CRUD
     generik untuk 2 pemakai saja hanya menambah lapisan tanpa mengurangi
     duplikasi yang berarti. */
  upacara: {
    async tambah(data) {
      if (!FIREBASE_ENABLED) {
        const id = String(Math.max(0, ...AppState.upacara.map(x => +x.id || 0)) + 1);
        AppState.upacara.unshift({ id, ...data });
        return id;
      }
      const ref = await firebase.firestore().collection("upacara").add(data);
      return ref.id;
    },
    async update(id, data) {
      if (!FIREBASE_ENABLED) {
        const idx = AppState.upacara.findIndex(x => x.id === id);
        if (idx !== -1) AppState.upacara[idx] = { ...AppState.upacara[idx], ...data };
        return;
      }
      await firebase.firestore().collection("upacara").doc(id).update(data);
    },
    async hapus(id) {
      if (!FIREBASE_ENABLED) {
        AppState.upacara = AppState.upacara.filter(x => x.id !== id);
        return;
      }
      await firebase.firestore().collection("upacara").doc(id).delete();
    }
  },

  /* ──────────────────── IURAN / PEMBAYARAN BULANAN (F4.4 Fitur 1) ────────────────────
     Desain: record iuran HANYA dibuat untuk status "Lunas"/"Khusus".
     Absennya record untuk (anggotaId,bulan,tahun) berarti "Belum Bayar"
     secara implisit — tidak perlu menulis N record kosong tiap bulan
     untuk semua anggota. Rekap Pembayaran (keuangan.js) membaca "Belum
     Bayar" sebagai default saat tidak menemukan record.

     SINKRONISASI KE BUKU KAS (Fitur 1.C): setiap kali status diset ke
     Lunas/Khusus, SATU transaksi "Masuk" dibuat/diperbarui otomatis di
     collection keuangan, ditandai `sumber:"iuran"` (lihat keuangan.js —
     entri berlabel ini diblokir dari edit/hapus langsung di tab Buku
     Kas, supaya tidak pernah desync dari record iuran-nya). Kedua tulis
     (iuran + keuangan) dilakukan dalam SATU batch Firestore agar atomic
     — pola yang sama dengan DB.presensi.simpan() di atas. */
  iuran: {
    async setStatus({ anggotaId, anggotaNama, bulan, tahun, status, nominal }) {
      const existing = AppState.iuran.find(r =>
        r.anggotaId === anggotaId && r.bulan === bulan && r.tahun === tahun);
      const uraian = `Iuran Bulanan — ${anggotaNama} — ${formatBulanTahun(bulan, tahun)}`;
      const dataKeuangan = {
        tanggal: new Date().toISOString().split("T")[0],
        uraian, jenis: "Masuk", jumlah: nominal, sumber: "iuran"
      };

      if (!FIREBASE_ENABLED) {
        if (existing) {
          await DB.keuangan.update(existing.keuanganId, dataKeuangan);
          const idx = AppState.iuran.findIndex(r => r.id === existing.id);
          AppState.iuran[idx] = { ...existing, status, nominal };
        } else {
          const keuanganId = await DB.keuangan.tambah(dataKeuangan);
          const id = String(Math.max(0, ...AppState.iuran.map(x => +x.id || 0)) + 1);
          AppState.iuran.push({ id, anggotaId, bulan, tahun, status, nominal, keuanganId });
        }
        return;
      }

      const fdb = firebase.firestore();
      const batch = fdb.batch();
      if (existing) {
        batch.update(fdb.collection("keuangan").doc(existing.keuanganId), dataKeuangan);
        batch.update(fdb.collection("iuran").doc(existing.id), { status, nominal });
      } else {
        const refKeuangan = fdb.collection("keuangan").doc();
        batch.set(refKeuangan, dataKeuangan);
        const refIuran = fdb.collection("iuran").doc();
        batch.set(refIuran, { anggotaId, bulan, tahun, status, nominal, keuanganId: refKeuangan.id });
      }
      await batch.commit();
    },

    /** Kembalikan ke "Belum Bayar" (implisit) — hapus record iuran DAN
     *  transaksi keuangan terkait sekaligus, supaya Buku Kas tidak pernah
     *  menyisakan entri "hantu" yang sudah tidak berlaku lagi. */
    async batalkan(anggotaId, bulan, tahun) {
      const existing = AppState.iuran.find(r =>
        r.anggotaId === anggotaId && r.bulan === bulan && r.tahun === tahun);
      if (!existing) return;

      if (!FIREBASE_ENABLED) {
        await DB.keuangan.hapus(existing.keuanganId);
        AppState.iuran = AppState.iuran.filter(r => r.id !== existing.id);
        return;
      }
      const fdb = firebase.firestore();
      const batch = fdb.batch();
      batch.delete(fdb.collection("keuangan").doc(existing.keuanganId));
      batch.delete(fdb.collection("iuran").doc(existing.id));
      await batch.commit();
    },

    /* [F4.4 / audit Rules] Nominal iuran standar disimpan sebagai
       dokumen sentinel "_pengaturan" DI DALAM collection "iuran"
       (BUKAN pengurus/struktur — percobaan awal sebelum audit Rules
       menemukan itu akan gagal permission-denied untuk bendahara,
       karena Rules pengurus/struktur hanya izinkan admin+ketua
       menulis). Collection "iuran" sudah punya Rules create/update
       admin+bendahara — cocok persis dengan siapa yang boleh mengubah
       nominal ini di UI (lihat canEdit di keuangan.js). */
    async setNominalStandar(nominal) {
      AppState.nominalIuranStandar = nominal;
      if (!FIREBASE_ENABLED) return;
      await firebase.firestore().collection("iuran").doc("_pengaturan")
        .set({ nominalStandar: nominal }, { merge: true });
    }
  },

  /* ──────────────────── PENGURUS ──────────────────── */
  pengurus: {
    async simpanStruktur(strukturBaru) {
      AppState.strukturPengurus = strukturBaru;
      if (!FIREBASE_ENABLED) return;
      /* {merge:true} WAJIB — doc ini juga menyimpan `guru`. Tanpa
         merge:true, .set() akan MENIMPA HABIS seluruh dokumen dan
         menghapus field itu setiap kali struktur pengurus disimpan.
         (nominalIuranStandar F4.4 TIDAK lagi disimpan di doc ini —
         lihat DB.iuran.setNominalStandar(), dipindah karena RBAC.) */
      await firebase.firestore().collection("pengurus").doc("struktur").set({
        periode: AppState.periode,
        jabatan: strukturBaru,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
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

    /* [F4.4] Pengaturan Iuran — disimpan di iuran/_pengaturan (BUKAN
       pengurus/struktur), lihat komentar DB.iuran.setNominalStandar(). */
    log("Menyimpan pengaturan nominal iuran…");
    await fdb.collection("iuran").doc("_pengaturan").set({
      nominalStandar: DUMMY_DATA.nominalIuranStandar || 5000
    });
    log("✓ Pengaturan iuran disimpan.");

    log("✓ Seed selesai! Semua data berhasil dimasukkan ke Firestore.", "done");
  } catch(err) {
    log("✗ Error saat seed: " + err.message, "error");
    console.error(err);
  }
}