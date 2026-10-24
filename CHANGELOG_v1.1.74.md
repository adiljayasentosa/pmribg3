# Changelog v1.1.74

## Perbaikan pemulihan pendaftaran anggota
- Menyimpan sementara nama, username, dan email pada `sessionStorage` agar isian tahap pertama tidak hilang saat halaman dimuat ulang pada sesi browser yang sama.
- Memulihkan tahap pendaftaran jika Firebase Auth masih memiliki sesi akun yang sama, lalu mengulang pembuatan profil secara idempoten melalui `/api/register-account`.
- Tidak menyimpan kata sandi di storage browser.
- Menghindari instruksi yang menyesatkan agar pengguna memakai email lain ketika email sudah memiliki akun.
- Menghapus draft lokal setelah pendaftaran anggota berhasil dikirim.

## Versi
- version: 1.1.74
- versionCode: 84

## Batasan
Pemulihan otomatis membutuhkan sesi Firebase Auth yang masih aktif dan draft sessionStorage yang belum hilang. Jika sesi sudah keluar atau storage sesi terhapus, pemulihan perlu ditangani admin/backend; jangan membuat akun baru menggunakan email berbeda sebagai jalan pintas.
