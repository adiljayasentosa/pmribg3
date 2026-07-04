/* =========================================================
   AUTH.JS — v2 Firebase-ready
   Mode DEMO  (FIREBASE_ENABLED=false): localStorage mock
   Mode FIREBASE (FIREBASE_ENABLED=true): Firebase Auth
   =========================================================
   Email pattern Firebase: {username}@pmr-smkibg3.app
   (Domain fiktif — hanya untuk Firebase Auth internal)
   ========================================================= */

const SESSION_KEY = "pmr_session";

/** Daftar role yang dikenal sistem + label & badge */
const ROLES = {
  admin:      { label: "Admin",       badge: "badge-red"     },
  ketua:      { label: "Ketua",       badge: "badge-red"     },
  wakil:      { label: "Wakil Ketua", badge: "badge-info"    },
  sekretaris: { label: "Sekretaris",  badge: "badge-info"    },
  bendahara:  { label: "Bendahara",   badge: "badge-success" },
  pj:         { label: "PJ Divisi",   badge: "badge-warning" }
};

/** Akun demo untuk mode tanpa backend */
const DUMMY_USERS = [
  { username:"admin",      password:"admin123",    role:"admin",      nama:"Admin Sistem"    },
  { username:"ketua",      password:"ketua123",    role:"ketua",      nama:"M. Arif Hidayat" },
  { username:"wakil",      password:"wakil123",    role:"wakil",      nama:"Nadia Salsabila" },
  { username:"sekretaris", password:"sekre123",    role:"sekretaris", nama:"Dewi Lestari"    },
  { username:"bendahara",  password:"bendahara123",role:"bendahara",  nama:"Putri Ramadhani" },
  { username:"pj",         password:"pj123",       role:"pj",         nama:"Raka Pratama"    }
];

/** Cache user aktif di memori (sinkron setelah init) */
let _currentUser = null;

/* ── Helper email Firebase ── */
function _toEmail(username) {
  return `${username.trim().toLowerCase()}@pmr-smkibg3.app`;
}

/* ────────────────────────────────────
   LOGIN
   Mengembalikan Promise<{ok, message?}>
──────────────────────────────────── */
async function login(username, password, role) {
  username = username.trim().toLowerCase();

  /* ── Mode Demo ── */
  if (!FIREBASE_ENABLED) {
    const user = DUMMY_USERS.find(u => u.username === username);
    if (!user)               return { ok:false, message:"Username tidak ditemukan." };
    if (user.role !== role)  return { ok:false, message:"Role tidak sesuai dengan akun ini." };
    if (user.password !== password) return { ok:false, message:"Password salah." };

    _currentUser = { nama:user.nama, username, role };
    localStorage.setItem(SESSION_KEY, JSON.stringify(_currentUser));
    return { ok:true };
  }

  /* ── Mode Firebase ── */
  try {
    const cred = await firebase.auth()
      .signInWithEmailAndPassword(_toEmail(username), password);

    const fdb = firebase.firestore();
    const uid = cred.user.uid;

    /* ── LANGKAH 1: Cari profil by UID (jalur normal) ── */
    let snap = await fdb.collection("users").doc(uid).get();

    /* ── LANGKAH 2: Fallback — profil belum pindah ke UID (masih Auto-ID dari import) ── */
    if (!snap.exists) {
      const q = await fdb.collection("users")
        .where("email", "==", _toEmail(username))
        .limit(1)
        .get();

      if (!q.empty) {
        const oldDoc  = q.docs[0];
        const oldId   = oldDoc.id;
        const oldData = oldDoc.data();

        if (oldId !== uid) {
          /* ── MIGRASI IDEMPOTENT ──
             Urutan wajib:
             1. Tulis ke users/{UID} terlebih dahulu
             2. Read-back untuk konfirmasi tulis berhasil
             3. Baru hapus dokumen Auto-ID lama
             Jika koneksi putus antara langkah 2 dan 3:
             - users/{UID} sudah ada → login berikutnya normal
             - dokumen Auto-ID masih ada → tidak masalah, query WHERE akan skip karena
               users/{UID} sudah lebih dulu ditemukan di LANGKAH 1
             Tidak ada data yang bisa hilang. */

          /* 1. Write ke UID baru — hapus flag synced, ini sudah profil resmi */
          const { synced, note, ...dataResmi } = oldData;
          await fdb.collection("users").doc(uid).set(dataResmi);

          /* 2. Read-back konfirmasi */
          const konfirmasi = await fdb.collection("users").doc(uid).get();
          if (!konfirmasi.exists) {
            /* Tulis gagal — jangan hapus yang lama, biarkan coba lagi saat login berikutnya */
            console.warn("[PMR] Migrasi profil: write berhasil dipanggil tapi read-back gagal. Login lanjut dengan data lama.");
            snap = oldDoc; /* gunakan data lama untuk sesi ini */
          } else {
            /* 3. Konfirmasi berhasil — sekarang aman hapus dokumen Auto-ID lama */
            await oldDoc.ref.delete();
            snap = konfirmasi;
          }
        } else {
          /* oldId === uid — dokumen sudah di tempat yang benar, tidak perlu migrasi */
          snap = oldDoc;
        }
      }
    }

    if (!snap || !snap.exists) {
      await firebase.auth().signOut();
      return { ok:false, message:"Profil pengguna belum dibuat. Hubungi admin atau jalankan Import Massal di setup.html." };
    }

    const profile = snap.data();
    if (profile.role !== role) {
      await firebase.auth().signOut();
      return { ok:false, message:"Role tidak sesuai dengan akun ini." };
    }

    _currentUser = { nama:profile.nama, username:profile.username, role:profile.role };
    localStorage.setItem(SESSION_KEY, JSON.stringify(_currentUser));
    return { ok:true };

  } catch(e) {
    const MSG = {
      "auth/user-not-found":         "Username tidak ditemukan.",
      "auth/wrong-password":         "Password salah.",
      "auth/invalid-credential":     "Username atau password salah.",
      "auth/too-many-requests":      "Terlalu banyak percobaan. Coba lagi nanti.",
      "auth/network-request-failed": "Gagal terhubung ke server. Periksa koneksi internet."
    };
    return { ok:false, message: MSG[e.code] || "Login gagal: " + e.message };
  }
}

/* ────────────────────────────────────
   LOGOUT
──────────────────────────────────── */
function logout() {
  localStorage.removeItem(SESSION_KEY);
  _currentUser = null;
  if (FIREBASE_ENABLED) {
    firebase.auth().signOut().catch(() => {});
  }
  window.location.href = "login.html";
}

/* ────────────────────────────────────
   GET CURRENT USER (sinkron, dari cache)
──────────────────────────────────── */
function getCurrentUser() {
  if (_currentUser) return _currentUser;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    _currentUser = JSON.parse(raw);
    return _currentUser;
  } catch { return null; }
}

/* ────────────────────────────────────
   INIT AUTH — dipanggil di awal setiap halaman yang butuh login.
   onUser(user) dipanggil jika sesi valid.
   onNoUser()   dipanggil jika belum login → redirect login.
──────────────────────────────────── */
function initAuth(onUser, onNoUser) {
  /* Mode Demo: cek localStorage saja */
  if (!FIREBASE_ENABLED) {
    const user = getCurrentUser();
    if (user) onUser(user);
    else onNoUser();
    return;
  }

  /* Mode Firebase: tunggu Firebase memverifikasi token */
  firebase.auth().onAuthStateChanged(async (firebaseUser) => {
    if (!firebaseUser) {
      localStorage.removeItem(SESSION_KEY);
      _currentUser = null;
      onNoUser();
      return;
    }

    /* Coba ambil dari cache dulu */
    let user = getCurrentUser();
    if (!user) {
      try {
        const snap = await firebase.firestore()
          .collection("users").doc(firebaseUser.uid).get();
        if (snap.exists) {
          user = snap.data();
          localStorage.setItem(SESSION_KEY, JSON.stringify(user));
          _currentUser = user;
        }
      } catch(e) {
        console.error("[PMR] Gagal ambil profil:", e);
      }
    }

    if (user) onUser(user);
    else onNoUser();
  });
}

/* ────────────────────────────────────
   BUAT AKUN FIREBASE (admin only, dipanggil dari setup.html)
──────────────────────────────────── */
async function buatAkunFirebase(users, onProgress) {
  if (!FIREBASE_ENABLED) {
    onProgress?.("FIREBASE_ENABLED masih false.", "warn");
    return;
  }
  const fdb = firebase.firestore();

  for (const u of users) {
    try {
      onProgress?.(`Membuat akun: ${u.username}…`);
      const cred = await firebase.auth()
        .createUserWithEmailAndPassword(_toEmail(u.username), u.password);
      await fdb.collection("users").doc(cred.user.uid).set({
        username: u.username,
        nama:     u.nama,
        role:     u.role,
        email:    _toEmail(u.username)
      });
      onProgress?.(`✓ Akun ${u.username} (${u.role}) berhasil dibuat.`, "ok");
    } catch(e) {
      if (e.code === "auth/email-already-in-use") {
        onProgress?.(`↷ ${u.username}: sudah ada, dilewati.`, "warn");
      } else {
        onProgress?.(`✗ ${u.username}: ${e.message}`, "error");
      }
    }
  }
  onProgress?.("✓ Semua akun selesai diproses.", "done");
}
