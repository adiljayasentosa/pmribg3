<div align="center">

# 🩹 Website PMR WIRA UNIT

**Sistem informasi & administrasi digital PMR WIRA UNIT — SMK IBG 3**

![Version](https://img.shields.io/badge/version-5.0-C8102E?style=flat-square)
![Firebase](https://img.shields.io/badge/backend-Firebase-FFCA28?style=flat-square&logo=firebase&logoColor=black)
![License](https://img.shields.io/badge/license-Internal--Use-lightgrey?style=flat-square)
![Status](https://img.shields.io/badge/status-active-brightgreen?style=flat-square)

</div>

---

## 📖 Deskripsi

**Website PMR WIRA UNIT** adalah aplikasi web internal untuk mengelola kegiatan, keanggotaan, keuangan, presensi, piket, dan administrasi organisasi **PMR (Palang Merah Remaja) WIRA UNIT SMK IBG 3**.

Dibangun sebagai **Single Page Application (SPA) ringan** tanpa framework — murni HTML, CSS, dan JavaScript — dengan **Firebase** (Authentication + Firestore) sebagai backend real-time. Setiap role memiliki tampilan dan hak akses yang berbeda, mulai dari Admin hingga Anggota biasa.

---

## 🖼️ Preview

<div align="center">

![Preview Dashboard](https://via.placeholder.com/1200x650/C8102E/FFFFFF?text=Beranda+Dashboard+%E2%80%94+PMR+WIRA+UNIT)

*Ganti gambar di atas dengan screenshot asli aplikasi (simpan di `docs/preview.png`)*

</div>

---

## ✨ Fitur Utama

- 🔐 **Autentikasi berbasis role** — 7 role dengan hak akses berbeda (RBAC penuh di Firestore Rules)
- 🏠 **Dashboard adaptif** — tampilan & data menyesuaikan role yang login
- 📅 **Manajemen kegiatan** — jadwal, lokasi, status, dan riwayat kegiatan
- 🧑‍🤝‍🧑 **Manajemen anggota & struktur pengurus**
- 💰 **Modul keuangan** — kas masuk/keluar & rekap iuran anggota
- ✅ **Presensi digital** per kegiatan
- 🗓️ **Smart Fair Scheduler** — rotasi jadwal Piket & Petugas Upacara otomatis & adil berbasis riwayat
- 📦 **Manajemen inventaris** barang PMR
- 📊 **Report Engine generik** — cetak/ekspor laporan (PDF/CSV) dari satu mesin laporan yang sama
- 🔔 **Reminder & Notification Center** kontekstual sesuai role
- 📦 **Mode Demo** — bisa dijalankan tanpa Firebase (data dummy) untuk keperluan development/preview

---

## 🛠️ Tech Stack

| Layer | Teknologi |
|---|---|
| Markup & Style | HTML5, CSS3 (custom design system — tanpa framework CSS) |
| Logic | JavaScript (Vanilla, ES6+, modular per halaman) |
| Backend / Database | [Firebase Authentication](https://firebase.google.com/products/auth) + [Cloud Firestore](https://firebase.google.com/products/firestore) |
| Keamanan Data | Firestore Security Rules (RBAC berbasis role di koleksi `users`) |
| Export Laporan | jsPDF + jsPDF-AutoTable |
| Font | Poppins & Inter (Google Fonts) |
| Hosting | Vercel (static hosting) |
| Tooling | Tidak ada build step — murni static file, siap deploy langsung |

---

## 📁 Struktur Folder Project

```

pmr-wira-unit/
├── index.html              # Landing page
├── login.html               # Halaman masuk
├── setup.html                # Wizard setup awal Firebase (seed data & akun)
├── dashboard.html          # Shell utama SPA (sidebar + topbar + content-area)
├── firestore.rules          # Aturan keamanan & RBAC Firestore
│
├── assets/                    # Logo & aset statis
│
├── css/
│   ├── variables.css        # Design token (warna, spacing, radius, dsb.)
│   ├── base.css                # Reset & style dasar
│   ├── components.css     # Komponen UI reusable (card, badge, tabel, dst.)
│   ├── dashboard.css       # Layout sidebar, topbar, shell dashboard
│   ├── auth.css / landing.css / modal.css / laporan.css / pengurus.css / upacara.css
│
└── js/
    ├── firebase-config.js       # Konfigurasi & init Firebase
    ├── landing.js / login.js     # Logic halaman publik
    ├── dashboard.js                 # Bootstrap SPA: auth check, load data, router
    ├── data-dummy.js               # Data contoh untuk Mode Demo
    │
    ├── core/
    │   ├── auth.js                        # Login, session, daftar role
    │   ├── firebase-db.js               # AppState + seluruh query Firestore
    │   ├── utils.js                          # Helper format tanggal/rupiah/dll.
    │   ├── modal.js                        # Komponen modal & search bar
    │   ├── report-engine.js            # Mesin generik cetak/ekspor laporan
    │   └── rotation-engine.js         # Algoritma Smart Fair Scheduler
    │
    └── pages/
        ├── beranda.js       # Dashboard utama (per role)
        ├── anggota.js        # Manajemen anggota
        ├── kegiatan.js       # Manajemen kegiatan
        ├── keuangan.js      # Kas & iuran
        ├── presensi.js       # Presensi kegiatan
        ├── piket.js              # Jadwal piket (Smart Scheduler)
        ├── upacara.js        # Petugas upacara (Smart Scheduler)
        ├── inventaris.js     # Inventaris barang
        ├── pengurus.js      # Struktur pengurus
        ├── laporan.js         # Halaman laporan
        ├── profil-saya.js  # Profil untuk role anggota
        └── pengaturan.js  # Pengaturan akun

````

---

## 🚀 Cara Menjalankan Project

Project ini **tidak memerlukan build tool** — cukup web server statis.

```bash
# 1. Clone repository
git clone <url-repo-anda>
cd pmr-wira-unit

# 2. Jalankan dengan live server apa pun, contoh:
npx serve .
# atau
python3 -m http.server 5500
````

Lalu buka `http://localhost:5500` di browser.

> 💡 **Mode Demo:** jika `FIREBASE_ENABLED = false` di `js/firebase-config.js`, aplikasi berjalan dengan data dummy (`js/data-dummy.js`) tanpa perlu koneksi Firebase — cocok untuk development UI.

---

## 🔥 Firebase Configuration

Project menggunakan **Firebase Authentication** & **Cloud Firestore**. Untuk menyambungkan ke project Firebase Anda sendiri:

1. Buat project baru di [Firebase Console](https://console.firebase.google.com)
2. Aktifkan **Authentication** (Email/Password) dan **Firestore Database**
3. Salin nilai konfigurasi dari **Project Settings → Your apps**
4. Isi ke `js/firebase-config.js`:

   ```js
   const FIREBASE_ENABLED = true;

   const FIREBASE_CONFIG = {
     apiKey:            "<YOUR_API_KEY>",
     authDomain:        "<YOUR_PROJECT>.firebaseapp.com",
     projectId:         "<YOUR_PROJECT_ID>",
     storageBucket:     "<YOUR_PROJECT>.firebasestorage.app",
     messagingSenderId: "<YOUR_SENDER_ID>",
     appId:             "<YOUR_APP_ID>"
   };
   ```
5. Deploy aturan keamanan: `firebase deploy --only firestore:rules`
6. Buka `setup.html` untuk seed data awal & membuat akun pengguna pertama

> ⚠️ Jangan pernah meng-commit kredensial **Firebase Admin SDK** atau file `.env` ke repository. Konfigurasi web di atas *by design* aman untuk client-side, tetapi keamanan data sesungguhnya ditegakkan oleh `firestore.rules`.

---

## 👥 Role & Permission

| Role | Ringkasan Akses |
|---|---|
| 🛡️ **Admin** | Akses penuh ke seluruh modul, termasuk pengaturan sistem & manajemen seluruh data |
| 🧑‍💼 **Pengurus** *(Ketua, Wakil, Sekretaris, Bendahara, PJ Divisi)* | Kelola kegiatan, anggota, presensi, keuangan (Bendahara), piket/upacara, dan laporan — sesuai lingkup jabatan masing-masing |
| 🙋 **Anggota** | Akses baca (read-only) ke informasi kegiatan, struktur pengurus, dan profil pribadi; tidak dapat melihat data keuangan atau presensi anggota lain |

Seluruh aturan di atas ditegakkan di dua lapis: **UI** (`js/core/auth.js`, per-halaman RBAC) dan **Firestore Security Rules** (`firestore.rules`) sebagai sumber kebenaran akhir.

---

## ☁️ Deployment

### Frontend — Vercel

1. Import repository ini ke [Vercel](https://vercel.com)
2. Framework preset: **Other** (static site, tanpa build command)
3. Output directory: `.` (root)
4. Deploy 🚀

### Backend — Firebase

```bash
# Login & pilih project
firebase login
firebase use <project-id>

# Deploy Firestore Rules
firebase deploy --only firestore:rules
```

---

## 📋 Daftar Fitur

<details>
<summary>Klik untuk melihat detail lengkap per modul</summary>

- **Beranda** — dashboard ringkasan adaptif per role
- **Anggota** — CRUD data anggota
- **Kegiatan** — CRUD kegiatan, filter status
- **Pengurus** — struktur organisasi, mode lihat-saja untuk anggota
- **Keuangan** — kas masuk/keluar, rekap iuran per bulan
- **Presensi** — input & rekap kehadiran per kegiatan
- **Piket** — jadwal piket dengan rotasi adil otomatis
- **Petugas Upacara** — rotasi petugas upacara (algoritma sama dengan Piket)
- **Inventaris** — pendataan & kondisi barang PMR
- **Laporan** — cetak/ekspor PDF & CSV dari satu report engine generik
- **Profil Saya** — halaman khusus role anggota
- **Pengaturan** — preferensi akun

</details>

---

## 🗺️ Roadmap Singkat

- [x] Modularisasi arsitektur per halaman (Fase 3)
- [x] Modul Inventaris & Smart Fair Scheduler (Piket & Upacara)
- [x] Report Engine generik & Reminder Center
- [x] Visual refresh dashboard (F5.0)
- [ ] Progressive Web App (installable & offline-first)
- [ ] Notifikasi push (kegiatan mendatang, piket, jatuh tempo iuran)
- [ ] Dark mode

---

## 🤝 Kontribusi

Kontribusi internal terbuka untuk anggota/pengurus PMR WIRA UNIT.

1. Fork / buat branch baru dari `main`
2. Commit dengan pesan yang jelas
3. Ajukan Pull Request beserta deskripsi perubahan

---

## 📄 License

Belum ada lisensi terbuka yang ditetapkan — project ini didistribusikan untuk **penggunaan internal** organisasi PMR WIRA UNIT SMK IBG 3. Hubungi pengurus/pembina jika ingin menggunakan ulang sebagian kode untuk keperluan lain.

---

## © Copyright

© 2025/2026 **PMR WIRA UNIT — SMK IBG 3**. Seluruh hak atas nama, logo, dan data organisasi dilindungi.

<div align="center">

Made with ❤️ by PMR WIRA UNIT — *Siap, Peduli, Bersahabat*

</div>
