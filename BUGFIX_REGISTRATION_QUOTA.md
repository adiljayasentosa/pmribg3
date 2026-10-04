# v1.1.60 — Firestore Read/Registration Bugfix

## Temuan utama
Masalah 49K reads bukan berasal dari satu `.get()` seluruh collection pada halaman pendaftaran.
Audit source v1.1.59 menemukan sumber yang jauh lebih berbahaya: `api/public-stats.js` mengambil seluruh dokumen `anggota` aktif hanya untuk menghitung jumlah anggota, sementara landing page memanggil endpoint tersebut setiap 15 detik untuk setiap pengunjung.

Sebelumnya:
- `anggota.where(statusKeanggotaan == Aktif).get()` → seluruh dokumen aktif dibaca.
- Landing polling setiap 15 detik.
- Banyak pengunjung = pembacaan dokumen yang berulang dan sangat besar.

Sekarang:
- `count()` aggregation digunakan untuk statistik.
- Cache CDN/server 60 detik + stale-while-revalidate 300 detik.
- Polling landing diperpanjang menjadi 60 detik.
- Halaman publik tidak lagi mengunduh seluruh data anggota hanya untuk angka statistik.

## Perbaikan registrasi
- `register-account.js` tidak lagi query `users` berdasarkan username/email.
- Username memakai `usernameIndex/{username}`.
- Reservasi username + pembuatan profil dilakukan dalam satu Firestore transaction.
- Firebase Auth tetap menjadi sumber validasi unik untuk email.
- Retry setelah timeout/5xx dibuat idempotent agar tidak membuat akun/profil duplikat.
- Tombol Step 1 tetap disabled selama request berlangsung.
- Error quota ditampilkan dengan pesan yang manusiawi.
- Firestore rules menutup `usernameIndex` dari browser.

## Migrasi usernameIndex
Setelah akun internal/migrasi user selesai, jalankan satu kali:

`FIREBASE_SERVICE_ACCOUNT_KEY='...' node scripts/seed-username-index.js`

Script tersebut membaca `users` satu kali untuk migrasi dan membuat index yang diperlukan. Jangan menjalankannya berulang tanpa alasan di production; script aman untuk rerun tetapi tetap melakukan pembacaan seluruh `users` saat dijalankan.

## Catatan deployment
- Version: 1.1.60
- Version code: 70
- Jumlah Vercel Serverless Functions tetap 12.
- Deploy rules Firestore bersama source ini.
- Pastikan usernameIndex sudah terisi untuk akun internal sebelum pendaftaran publik dibuka.

## Verifikasi
Tes minimal:
1. 1 registrasi baru.
2. 5 registrasi berurutan.
3. Beberapa registrasi bersamaan.
4. Username duplikat.
5. Email duplikat.
6. Double-click tombol.
7. Retry setelah request timeout/5xx.
8. NIK/NISN duplikat.
9. Data Step 2 tidak lengkap.
10. Pantau Firestore Usage setelah deployment.
