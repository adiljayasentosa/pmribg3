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

   anggota      : anggota, kegiatan + data pribadi operasional jika Aktif
   bendahara    : anggota, kegiatan, pengurus, keuangan
   sekretaris   : anggota, kegiatan, pengurus, presensi
   pj           : anggota, kegiatan, pengurus, presensi
   admin/ketua/wakil : semua collection
───────────────────────────────────────────────────────── */
const ROLE_AKSES_KEUANGAN = ['admin', 'ketua', 'wakil', 'bendahara'];
const ROLE_AKSES_PRESENSI = ['admin', 'ketua', 'wakil', 'sekretaris', 'pj'];

/* [Phase 2 — PWA] Helper read-only: laporkan ke UI apakah snapshot
   Firestore yang baru diterima berasal dari cache lokal (offline/
   belum sinkron) atau dari server. TIDAK mengubah data/query apa pun
   — hanya membaca snap.metadata.fromCache lalu dispatch custom event
   yang didengarkan js/pwa-register.js untuk indikator UI. */
function _laporkanStatusCache(snap) {
  try {
    window.dispatchEvent(new CustomEvent("pmr:firestore-cache-status", {
      detail: { fromCache: !!(snap && snap.metadata && snap.metadata.fromCache) }
    }));
  } catch (e) { /* no-op kalau CustomEvent tidak didukung */ }
}

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

/**
 * [F4.5 — Iuran Cicilan] Normalisasi SATU record iuran (atau ketiadaannya)
 * jadi bentuk seragam {target, totalDibayar, sisa, status, riwayatPembayaran}
 * — dipakai bersama oleh DB.iuran (write) dan _hitungRekapIuran di
 * keuangan.js (read), supaya logikanya SATU sumber kebenaran, tidak
 * dobel/berisiko beda hasil.
 *
 * 3 kasus:
 *  1) rec tidak ada sama sekali → "Belum Bayar" implisit, target =
 *     nominal standar SAAT INI (bulan itu belum pernah dibuat record-nya).
 *  2) rec sudah punya field baru (totalDibayar !== undefined) → dibaca
 *     apa adanya.
 *  3) rec masih format LAMA (sebelum fitur cicilan — hanya {status,nominal})
 *     → nominal yang sudah dibayar dulu dianggap SEKALIGUS jadi target,
 *     supaya pembayaran lama yang sudah dianggap selesai oleh admin saat
 *     itu tidak tiba-tiba surut jadi "Belum Lunas" hanya gara-gara nominal
 *     standar berubah belakangan atau field baru belum ada.
 */
function _normalisasiIuranRecord(rec, targetDefault) {
  if (!rec) {
    return { target: targetDefault, totalDibayar: 0, sisa: targetDefault, status: "Belum Bayar", riwayatPembayaran: [] };
  }
  if (rec.totalDibayar !== undefined) {
    const target = rec.target ?? targetDefault;
    const totalDibayar = rec.totalDibayar;
    const sisa = Math.max(0, target - totalDibayar);
    const status = totalDibayar >= target ? "Lunas" : "Belum Lunas";
    return { target, totalDibayar, sisa, status, riwayatPembayaran: rec.riwayatPembayaran || [] };
  }
  const legacyTarget = rec.nominal || targetDefault;
  return { target: legacyTarget, totalDibayar: rec.nominal || 0, sisa: 0, status: "Lunas", riwayatPembayaran: [] };
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
  iuran:            [],   /* F4.4/F4.5 — record berisi target, totalDibayar (akumulasi
                              cicilan), status ("Lunas"/"Belum Lunas"), riwayatPembayaran;
                              absennya record untuk (anggotaId,bulan,tahun) berarti
                              "Belum Bayar" (default implisit — lihat _normalisasiIuranRecord) */
  memberKta:        {},
  nominalIuranStandar: 5000 /* F4.4 Fitur 1 — default, bisa diubah admin/bendahara
                                lewat DB.iuran.setNominalStandar() */
};

/* Normalisasi record anggota: statusKeanggotaan adalah field canonical.
   Data lama yang masih memakai `status` tetap bisa dibaca saat transisi,
   tetapi seluruh modul aplikasi setelah load menggunakan field canonical. */
function _normalisasiAnggota(a) {
  const normalized = { ...a, id: String(a.id) };
  if (!normalized.statusKeanggotaan && normalized.status) {
    normalized.statusKeanggotaan = normalized.status;
  }
  return normalized;
}

/* Salin DUMMY_DATA ke AppState (ID dikonversi ke string) */
function _seedAppStateFromDummy() {
  AppState.periode  = DUMMY_DATA.periode;
  AppState.ringkasan = { ...DUMMY_DATA.ringkasan };
  AppState.anggota  = DUMMY_DATA.anggota.map(_normalisasiAnggota);
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
  const aktif   = AppState.anggota.filter(a => a.statusKeanggotaan === "Aktif").length;
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

    /* Portal anggota: fetch hanya data yang memang dibutuhkan.
       Data operasional yang sensitif dibatasi lagi oleh Firestore Rules. */
    if (role === 'anggota') {
      const snapAnggota = await fdb.collection("anggota").orderBy("nama").get();
      AppState.anggota = snapAnggota.docs.map(d => _normalisasiAnggota({id:d.id,...d.data()}));
      const me = AppState.anggota.find(a =>
        (getCurrentUser()?.anggotaId && String(a.id) === String(getCurrentUser().anggotaId)) ||
        (firebase.auth().currentUser?.uid && String(a.authUid || '') === String(firebase.auth().currentUser.uid)) ||
        (getCurrentUser()?.username && String(a.nomorInduk || '').toLowerCase() === String(getCurrentUser().username).toLowerCase())
      );
      AppState.kegiatan = await _fetchAman(() => fdb.collection("kegiatan").orderBy("tanggal","desc").get(), "kegiatan");
      AppState.piket = []; AppState.upacara = []; AppState.presensiHistory = []; AppState.iuran = []; AppState.memberKta = {};
      if (me && String(me.statusKeanggotaan || me.status || 'Aktif').toLowerCase() === 'aktif') {
        const [piket, upacara, presensi, iuran, nominal, kta] = await Promise.all([
          _fetchAman(() => fdb.collection("piket").orderBy("tanggal","desc").get(), "piket"),
          _fetchAman(() => fdb.collection("upacara").orderBy("tanggal","desc").get(), "upacara"),
          _fetchAman(() => fdb.collection("presensi").where("anggotaId","==",String(me.id)).get(), "presensi"),
          _fetchAman(() => fdb.collection("iuran").where("anggotaId","==",String(me.id)).get(), "iuran"),
          fdb.collection("iuran").doc("_pengaturan").get().then(s => s.exists ? {id:s.id,...s.data()} : null).catch(e => { console.error("[PMR] Gagal memuat iuran/_pengaturan:", e); return null; }),
          fdb.collection("kta").doc(String(me.id)).get().then(s => s.exists ? {id:s.id,...s.data()} : null).catch(e => { console.error("[PMR] Gagal memuat KTA anggota:", e); return null; })
        ]);
        AppState.piket = piket; AppState.upacara = upacara; AppState.presensiHistory = presensi; AppState.iuran = iuran;
        const setting = nominal; AppState.nominalIuranStandar = setting?.nominalStandar || 5000;
        AppState.memberKta = kta || {};
      }
      _hitungRingkasan();
      return;
    }

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

    AppState.anggota    = snapAnggota.docs.map(d => _normalisasiAnggota({ id: d.id, ...d.data() }));
    AppState.kegiatan   = snapKegiatan.docs.map(d => ({ id: d.id, ...d.data() }));
    AppState.inventaris = snapInventaris.docs.map(d => ({ id: d.id, ...d.data() }));
    AppState.piket      = snapPiket.docs.map(d => ({ id: d.id, ...d.data() }));
    AppState.upacara    = snapUpacara.docs.map(d => ({ id: d.id, ...d.data() }));

    if (snapPengurus.exists) {
      const data = snapPengurus.data();
      /* Normalisasi ID ke string agar konsisten dengan DOM dataset.id */
      AppState.strukturPengurus = (data.jabatan || []).map(jabatan => ({
        ...jabatan,
        /* Semua PJ divisi menyediakan sampai 3 slot.
           Normalisasi ini juga menaikkan struktur lama yang masih menyimpan maks: 2,
           sehingga admin tidak perlu mengedit data Firestore secara manual. */
        maks: String(jabatan.role_id || "").startsWith("pj_") ? 3 : (jabatan.maks || 1),
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

    if (role === 'anggota') {
      const me = AppState.anggota.find(a =>
        (getCurrentUser()?.anggotaId && String(a.id) === String(getCurrentUser().anggotaId)) ||
        (firebase.auth().currentUser?.uid && String(a.authUid || '') === String(firebase.auth().currentUser.uid)) ||
        (getCurrentUser()?.username && String(a.nomorInduk || '').toLowerCase() === String(getCurrentUser().username).toLowerCase())
      );
      this._listeners.push(
        fdb.collection("anggota").orderBy("nama").onSnapshot(snap=>{ _laporkanStatusCache(snap); AppState.anggota=snap.docs.map(d=>_normalisasiAnggota({id:d.id,...d.data()})); _reRenderPage(); }),
        fdb.collection("kegiatan").orderBy("tanggal","desc").onSnapshot(snap=>{ _laporkanStatusCache(snap); AppState.kegiatan=snap.docs.map(d=>({id:d.id,...d.data()})); _reRenderPage(); })
      );
      if (me && String(me.statusKeanggotaan || me.status || 'Aktif').toLowerCase() === 'aktif') {
        this._listeners.push(
          fdb.collection("presensi").where("anggotaId","==",String(me.id)).onSnapshot(snap=>{_laporkanStatusCache(snap);AppState.presensiHistory=snap.docs.map(d=>({id:d.id,...d.data()}));_reRenderPage();}),
          fdb.collection("iuran").where("anggotaId","==",String(me.id)).onSnapshot(snap=>{_laporkanStatusCache(snap);AppState.iuran=snap.docs.map(d=>({id:d.id,...d.data()}));_reRenderPage();}),
          fdb.collection("piket").orderBy("tanggal","desc").onSnapshot(snap=>{_laporkanStatusCache(snap);AppState.piket=snap.docs.map(d=>({id:d.id,...d.data()}));_reRenderPage();}),
          fdb.collection("upacara").orderBy("tanggal","desc").onSnapshot(snap=>{_laporkanStatusCache(snap);AppState.upacara=snap.docs.map(d=>({id:d.id,...d.data()}));_reRenderPage();}),
          fdb.collection("kta").doc(String(me.id)).onSnapshot(snap=>{AppState.memberKta=snap.exists?snap.data():{};_reRenderPage();})
        );
      }
      return;
    }

    /* anggota, kegiatan, inventaris — boleh di-listen SEMUA role yang login */
    this._listeners.push(
      fdb.collection("anggota").orderBy("nama").onSnapshot(snap => {
        _laporkanStatusCache(snap);
        AppState.anggota = snap.docs.map(d => _normalisasiAnggota({ id: d.id, ...d.data() }));
        _hitungRingkasan(); _reRenderPage();
      }),
      fdb.collection("kegiatan").orderBy("tanggal", "desc").onSnapshot(snap => {
        _laporkanStatusCache(snap);
        AppState.kegiatan = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        _hitungRingkasan(); _reRenderPage();
      }),
      fdb.collection("inventaris").orderBy("nama").onSnapshot(snap => {
        _laporkanStatusCache(snap);
        AppState.inventaris = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        _reRenderPage();
      }),
      fdb.collection("piket").orderBy("tanggal", "desc").onSnapshot(snap => {
        _laporkanStatusCache(snap);
        AppState.piket = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        _reRenderPage();
      }),
      fdb.collection("upacara").orderBy("tanggal", "desc").onSnapshot(snap => {
        _laporkanStatusCache(snap);
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
          _laporkanStatusCache(snap);
          AppState.keuangan = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          _hitungRingkasan(); _reRenderPage();
        }),
        fdb.collection("iuran").onSnapshot(snap => {
          _laporkanStatusCache(snap);
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
          _laporkanStatusCache(snap);
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
      const now = new Date().toISOString();
      const payload = {
        ...data,
        createdAt: data.createdAt || now,
        updatedAt: now
      };
      if (!FIREBASE_ENABLED) {
        const id = String(Math.max(0, ...AppState.anggota.map(a => +a.id || 0)) + 1);
        AppState.anggota.push(_normalisasiAnggota({ id, ...payload }));
        AppState.anggota.sort((a,b) => a.nama.localeCompare(b.nama));
        _hitungRingkasan();
        return id;
      }
      const serverPayload = {
        ...payload,
        createdAt: data.createdAt || firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      const ref = await firebase.firestore().collection("anggota").add(serverPayload);
      return ref.id;
    },
    /* Mengembalikan { imported, total }. Firestore membatasi 1 batch = maks
       500 write, jadi data dipecah per 400 baris (400 dipilih dgn margin
       aman, bukan mepet ke limit 500). Tiap chunk atomik sendiri-sendiri,
       TAPI tidak ada atomisitas lintas chunk — kalau chunk ke-2 dari 3
       gagal, chunk ke-1 sudah permanen tersimpan. Kalau itu terjadi, error
       yang dilempar membawa properti .imported (jumlah baris yg SUDAH
       berhasil masuk sebelum gagal) supaya pemanggil (bukaImportAnggota)
       bisa mencoret baris-baris itu dari daftar sebelum retry — mencegah
       baris yang sama diimport dua kali saat user klik ulang. */
    async importBatch(rows) {
      const items = Array.isArray(rows) ? rows : [];
      if (!items.length) return { imported: 0, total: 0 };
      const now = new Date().toISOString();
      if (!FIREBASE_ENABLED) {
        let nextId = Math.max(0, ...AppState.anggota.map(a => +a.id || 0));
        items.forEach(row => {
          const id = String(++nextId);
          const payload = {
            ...row,
            id,
            createdAt: row.createdAt || now,
            updatedAt: now
          };
          AppState.anggota.push(_normalisasiAnggota(payload));
        });
        AppState.anggota.sort((a,b) => a.nama.localeCompare(b.nama));
        _hitungRingkasan();
        return { imported: items.length, total: items.length };
      }

      const fdb = firebase.firestore();
      let imported = 0;
      for (let start = 0; start < items.length; start += 400) {
        const chunk = items.slice(start, start + 400);
        const batch = fdb.batch();
        chunk.forEach(row => {
          const ref = fdb.collection("anggota").doc();
          batch.set(ref, {
            ...row,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        });
        try {
          await batch.commit();
          imported += chunk.length;
        } catch (e) {
          const err = new Error(e?.message || "Sebagian data gagal diimport.");
          err.imported = imported;
          err.total = items.length;
          err.cause = e;
          throw err;
        }
      }
      return { imported, total: items.length };
    },
    async update(id, data) {
      const now = new Date().toISOString();
      if (!FIREBASE_ENABLED) {
        const idx = AppState.anggota.findIndex(a => a.id === id);
        if (idx !== -1) {
          const merged = { ...AppState.anggota[idx], ...data, updatedAt: now };
          if (Object.prototype.hasOwnProperty.call(data, "statusKeanggotaan")) delete merged.status;
          AppState.anggota[idx] = _normalisasiAnggota(merged);
        }
        _hitungRingkasan();
        return;
      }
      const payload = { ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
      if (Object.prototype.hasOwnProperty.call(data, "statusKeanggotaan")) {
        payload.status = firebase.firestore.FieldValue.delete();
      }
      await firebase.firestore().collection("anggota").doc(id).update(payload);
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

  /* ──────────────────── IURAN / PEMBAYARAN BULANAN (F4.4 Fitur 1, + F4.5 Cicilan) ────────────────────
     Desain: record iuran HANYA dibuat untuk pembayaran (parsial atau
     lunas). Absennya record untuk (anggotaId,bulan,tahun) berarti
     "Belum Bayar" secara implisit — tidak perlu menulis N record kosong
     tiap bulan untuk semua anggota. Rekap Pembayaran (keuangan.js)
     membaca "Belum Bayar" sebagai default saat tidak menemukan record.

     [F4.5 — Cicilan] Record menyimpan `target` (nominal yang WAJIB
     dibayar bulan itu, disalin dari nominalIuranStandar SAAT pembayaran
     PERTAMA dibuat — supaya kalau nominal standar berubah belakangan,
     bulan-bulan lama tidak ikut berubah targetnya), `totalDibayar`
     (akumulasi seluruh pembayaran), dan `riwayatPembayaran` (array
     {tanggal, nominal} — satu entri per kali bayar). Status dihitung
     dari totalDibayar vs target: "Lunas" (>=target) atau "Belum Lunas"
     (>0 tapi <target).

     KOMPATIBILITAS DATA LAMA: record dari SEBELUM fitur cicilan hanya
     punya {status:"Lunas"/"Khusus", nominal}. Field itu TIDAK dihapus/
     dimigrasikan — kode baca (_normalisasiIuranRecord di keuangan.js)
     memperlakukan `nominal` lama sebagai totalDibayar SEKALIGUS target
     (nominal yang waktu itu dibayar dianggap sudah menutup kewajiban
     bulan itu, sesuai keputusan admin saat itu) — jadi record lama
     otomatis tetap tampil "Lunas", tidak pernah surut jadi "Belum
     Lunas" hanya karena field baru belum ada.

     SINKRONISASI KE BUKU KAS (Fitur 1.C, TIDAK berubah oleh F4.5):
     TETAP satu transaksi "Masuk" per (anggota,bulan,tahun) di collection
     keuangan, ditandai `sumber:"iuran"` — setiap kali ada pembayaran
     baru (termasuk cicilan), transaksi itu di-UPDATE jumlahnya jadi
     totalDibayar TERBARU (bukan baris baru per cicilan — sesuai
     keputusan project). Kedua tulis (iuran + keuangan) tetap dalam
     SATU batch Firestore agar atomic — pola sama dengan sebelumnya. */
  iuran: {
    /** Catat SATU kali pembayaran (bisa parsial/cicilan, bisa juga
     *  langsung lunas sekaligus) — MENAMBAH ke total yang sudah dibayar,
     *  BUKAN mengganti. Menolak (throw Error) jika nominalBayar akan
     *  membuat total melebihi target — project ini belum punya
     *  mekanisme kelebihan bayar, jadi ini murni pencegahan. */
    async tambahPembayaran({ anggotaId, anggotaNama, bulan, tahun, nominalBayar }) {
      if (!nominalBayar || nominalBayar <= 0) {
        throw new Error("Nominal pembayaran harus lebih dari 0.");
      }

      const existing = AppState.iuran.find(r =>
        r.anggotaId === anggotaId && r.bulan === bulan && r.tahun === tahun);
      const n = _normalisasiIuranRecord(existing, AppState.nominalIuranStandar);

      if (nominalBayar > n.sisa) {
        throw new Error(`Pembayaran (${formatRupiah(nominalBayar)}) melebihi sisa tagihan (${formatRupiah(n.sisa)}). Project ini belum punya mekanisme kelebihan bayar.`);
      }

      const tanggalBayar = new Date().toISOString().split("T")[0];
      const totalDibayarBaru = n.totalDibayar + nominalBayar;
      const riwayatBaru = [...n.riwayatPembayaran, { tanggal: tanggalBayar, nominal: nominalBayar }];
      const statusBaru = totalDibayarBaru >= n.target ? "Lunas" : "Belum Lunas";
      const uraian = `Iuran Bulanan — ${anggotaNama} — ${formatBulanTahun(bulan, tahun)}`;
      const dataKeuangan = {
        tanggal: tanggalBayar, uraian, jenis: "Masuk", jumlah: totalDibayarBaru, sumber: "iuran"
      };
      const dataIuranBaru = {
        status: statusBaru, target: n.target,
        totalDibayar: totalDibayarBaru, riwayatPembayaran: riwayatBaru
      };

      if (!FIREBASE_ENABLED) {
        if (existing) {
          await DB.keuangan.update(existing.keuanganId, dataKeuangan);
          const idx = AppState.iuran.findIndex(r => r.id === existing.id);
          AppState.iuran[idx] = { ...existing, ...dataIuranBaru };
        } else {
          const keuanganId = await DB.keuangan.tambah(dataKeuangan);
          const id = String(Math.max(0, ...AppState.iuran.map(x => +x.id || 0)) + 1);
          AppState.iuran.push({ id, anggotaId, bulan, tahun, ...dataIuranBaru, keuanganId });
        }
        return;
      }

      const fdb = firebase.firestore();
      const batch = fdb.batch();
      let refIuranId, refKeuanganId;
      if (existing) {
        refIuranId = existing.id;
        refKeuanganId = existing.keuanganId;
        batch.update(fdb.collection("keuangan").doc(refKeuanganId), dataKeuangan);
        batch.update(fdb.collection("iuran").doc(refIuranId), dataIuranBaru);
      } else {
        const refKeuangan = fdb.collection("keuangan").doc();
        batch.set(refKeuangan, dataKeuangan);
        const refIuran = fdb.collection("iuran").doc();
        batch.set(refIuran, { anggotaId, bulan, tahun, ...dataIuranBaru, keuanganId: refKeuangan.id });
        refIuranId = refIuran.id;
        refKeuanganId = refKeuangan.id;
      }
      await batch.commit();

      /* [Hotfix race condition] Update AppState.iuran secara
         OPTIMISTIS & SINKRON segera setelah commit berhasil — supaya
         panggilan tambahPembayaran() BERIKUTNYA (mis. cicilan kedua
         yang diklik segera setelah yang pertama) langsung menemukan
         `existing` yang benar lewat AppState.iuran.find() di atas,
         TANPA menunggu listener onSnapshot() yang asinkron (ada jeda
         walau biasanya singkat). Tanpa ini, panggilan kedua bisa
         gagal menemukan `existing` dan malah membuat dokumen iuran
         BARU yang terpisah alih-alih menambah ke totalDibayar yang
         sudah ada — itu akar masalah bug "pembayaran kedua tidak
         menambah total, seolah transaksi sebelumnya berdiri sendiri".

         onSnapshot TETAP jadi sumber kebenaran akhir (menangani
         perubahan dari sesi/perangkat lain) — begitu snapshot-nya
         tiba, ia menimpa AppState.iuran lagi dengan data server yang
         sesungguhnya; hasilnya idempotent karena data yang baru saja
         di-commit ini SAMA dengan yang tersimpan di Firestore. */
      if (existing) {
        const idx = AppState.iuran.findIndex(r => r.id === refIuranId);
        if (idx !== -1) AppState.iuran[idx] = { ...existing, ...dataIuranBaru };
      } else {
        AppState.iuran.push({
          id: refIuranId, anggotaId, bulan, tahun, ...dataIuranBaru, keuanganId: refKeuanganId
        });
      }
    },

    /** Shortcut satu-klik: lunasi SISA tagihan bulan ini (pengganti
     *  perilaku tombol "✓ Lunas" versi lama) — tetap lewat
     *  tambahPembayaran() supaya tercatat sebagai satu entri riwayat
     *  dan konsisten dengan alur cicilan. Tidak melakukan apa-apa jika
     *  sudah Lunas (sisa 0). */
    async lunasiSisa({ anggotaId, anggotaNama, bulan, tahun }) {
      const existing = AppState.iuran.find(r =>
        r.anggotaId === anggotaId && r.bulan === bulan && r.tahun === tahun);
      const n = _normalisasiIuranRecord(existing, AppState.nominalIuranStandar);
      if (n.sisa <= 0) return;
      await DB.iuran.tambahPembayaran({ anggotaId, anggotaNama, bulan, tahun, nominalBayar: n.sisa });
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
      /* Kapasitas PJ selalu 3 slot, termasuk saat menyimpan struktur lama. */
      strukturBaru = strukturBaru.map(jabatan => ({
        ...jabatan,
        maks: String(jabatan.role_id || "").startsWith("pj_") ? 3 : jabatan.maks
      }));
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