/* =========================================================
   FIREBASE CONFIG — PMR WIRA UNIT SMK IBG 3
   =========================================================
   LANGKAH SETUP:
   1. Buka https://console.firebase.google.com
   2. Buat project baru → aktifkan Firestore & Authentication
   3. Salin nilai dari Project Settings → Your apps
   4. Isi semua konstanta di bawah
   5. Ubah FIREBASE_ENABLED = true
   6. Buka setup.html untuk seed data & buat akun pengguna
   ========================================================= */

const FIREBASE_ENABLED = true; /* ← ubah ke true setelah isi config */

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyDsCUlO8VEZH0uOFzoXbLDYMmwpvf1Ry98",
  authDomain:        "pmr-smkibg3.firebaseapp.com",
  projectId:         "pmr-smkibg3",
  storageBucket:     "pmr-smkibg3.firebasestorage.app",
  messagingSenderId: "206053331083",
  appId:             "1:206053331083:web:44d8fb34904000cb7e848e"
};

/* ── Init Firebase (hanya jika diaktifkan) ── */
if (FIREBASE_ENABLED) {
  if (!firebase.apps || !firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }
  /* Enable offline persistence (Firestore bekerja meski sinyal lemah) */
  firebase.firestore().enablePersistence({ synchronizeTabs: true })
    .catch((err) => {
      if (err.code === "failed-precondition") {
        console.warn("[PMR] Offline persistence tidak aktif: banyak tab terbuka.");
      }
    });
}
