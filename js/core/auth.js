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
  admin:    { label: "Admin",    badge: "badge-red" },
  pembina:  { label: "Pembina",  badge: "badge-info" },
  pengurus: { label: "Pengurus", badge: "badge-red" },
  anggota:  { label: "Anggota",  badge: "badge-success" }
};

const MANAGEMENT_ROLES = ["admin", "pembina", "pengurus"];
function hasManagementAccess(user = getCurrentUser()) {
  return !!user && MANAGEMENT_ROLES.includes(user.role);
}

/** Akun demo untuk mode tanpa backend.
 *  [F6.0] Field `divisi` ditambahkan HANYA pada akun role "pj" —
 *  dipakai semata oleh fitur baru Konten Publik (lihat content-db.js
 *  & firestore.rules getDivisi()). Tidak dibaca oleh logic login/
 *  session manapun yang sudah ada, jadi tidak mengubah perilaku lama. */
const DUMMY_USERS = [
  { username:"admin", password:"admin123", role:"admin", nama:"Admin Sistem" },
  { username:"pembina", password:"pembina123", role:"pembina", nama:"Pembina PMR" },
  { username:"pengurus", password:"pengurus123", role:"pengurus", nama:"Pengurus PMR" }
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
async function login(username, password) {
  username = username.trim().toLowerCase();

  /* ── Mode Demo ── */
  if (!FIREBASE_ENABLED) {
    const user = DUMMY_USERS.find(u => u.username === username && u.role !== 'demo');
    if (!user) return { ok:false, message:"Username tidak ditemukan." };
    if (user.password !== password) return { ok:false, message:"Password salah." };
    _currentUser = { nama:user.nama, username, role:user.role, anggotaId:user.anggotaId || null };
    localStorage.setItem(SESSION_KEY, JSON.stringify(_currentUser));
    return { ok:true };
  }

  try {
    /* Firebase Auth menerima email, sementara UI login memakai username.
       API hanya menyelesaikan username -> email. Password tetap diverifikasi
       langsung oleh Firebase Auth, bukan oleh endpoint ini. */
    const lookupResp = await fetch('/api/auth', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ action:'lookup', username })
    });
    const lookup = await lookupResp.json().catch(()=>({}));
    if (!lookupResp.ok || !lookup.email) return { ok:false, message:lookup.error || 'Username tidak ditemukan.' };

    const cred = await firebase.auth().signInWithEmailAndPassword(lookup.email, password);
    const fdb = firebase.firestore();
    const uid = cred.user.uid;

    let snap = await fdb.collection('users').doc(uid).get();
    let profile = snap.exists ? snap.data() : null;
    if (!profile) {
      const idToken = await cred.user.getIdToken(true);
      const response = await fetch('/api/auth', {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'profile', idToken})
      });
      const data = await response.json().catch(()=>({}));
      if (!response.ok || !data.ok) {
        await firebase.auth().signOut();
        return { ok:false, message:data.error || 'Profil pengguna belum dibuat.' };
      }
      profile = data.profile || null;
    }
    if (!profile) {
      await firebase.auth().signOut();
      return { ok:false, message:'Profil pengguna belum dibuat.' };
    }
    if (profile.role === 'demo') {
      await firebase.auth().signOut();
      return { ok:false, message:'Akun Demo sudah dinonaktifkan.' };
    }
    if (String(profile.status || '').toLowerCase() === 'pending' || !profile.anggotaId && profile.role === 'anggota') {
      await firebase.auth().signOut();
      return { ok:false, message:'Pendaftaran akunmu masih menunggu persetujuan pengurus.' };
    }

    _currentUser = {
      nama:profile.nama, username:profile.username || username, role:profile.role,
      anggotaId:profile.anggotaId || null, authUid:uid
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(_currentUser));
    return { ok:true };
  } catch(e) {
    const MSG = {
      'auth/user-not-found':'Username tidak ditemukan.',
      'auth/wrong-password':'Password salah.',
      'auth/invalid-credential':'Username atau password salah.',
      'auth/too-many-requests':'Terlalu banyak percobaan. Coba lagi nanti.',
      'auth/network-request-failed':'Gagal terhubung ke server. Periksa koneksi internet.'
    };
    return { ok:false, message:MSG[e.code] || 'Login gagal: ' + e.message };
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

    /* Profil selalu disegarkan dari Firestore terlebih dahulu. Ini penting
       untuk perubahan role (mis. Admin -> Pembina): sesi localStorage lama
       tidak boleh mengunci role lama. Jika jaringan/Firestore gagal, baru
       fallback ke cache sesi yang sudah ada. */
    let user = null;
    try {
      const snap = await firebase.firestore()
        .collection("users").doc(firebaseUser.uid).get();
      if (snap.exists) {
        user = { ...snap.data(), authUid: firebaseUser.uid };
        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
        _currentUser = user;
      } else {
        const idToken = await firebaseUser.getIdToken(true);
        const response = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action:'profile', idToken })
        });
        let data = {};
        try { data = await response.json(); } catch (_) {}
        if (response.ok && data.ok && data.profile) {
          user = { ...data.profile, authUid: firebaseUser.uid };
          localStorage.setItem(SESSION_KEY, JSON.stringify(user));
          _currentUser = user;
        }
      }
    } catch(e) {
      console.error("[PMR] Gagal ambil profil terbaru:", e);
      user = getCurrentUser();
    }

    if (user && user.role === 'anggota' && (String(user.status || '').toLowerCase() === 'pending' || !user.anggotaId)) {
      try { await firebase.auth().signOut(); } catch (_) {}
      localStorage.removeItem(SESSION_KEY);
      _currentUser = null;
      onNoUser();
      return;
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
