# Changelog v1.1.72

## Alur foto KTA
- Kolom link foto Google Drive pada pendaftaran anggota baru menjadi opsional.
- Backend pendaftaran menerima `fotoDrive` kosong, tetapi tetap memvalidasi host jika link diisi.
- Halaman Profil Saya menyediakan pembaruan link foto hanya untuk akun anggota yang terhubung dengan UID anggota secara valid.
- Pembaruan link foto KTA memakai endpoint yang sudah ada (`/api/kta-member-session`) agar jumlah API Vercel tidak bertambah.
- Panel admin/pengurus tetap dapat mengelola link foto melalui formulir Edit Anggota yang sudah tersedia.
- Data dan akun lama tidak dihapus atau dimigrasikan.

## Desain login
- Menambahkan layar awal “Masuk ke akun” dengan pilihan Login dan Daftar.
- Form login yang sudah ada tetap dipakai; autentikasi, lupa password, dan redirect tidak diganti.

## Verifikasi
- Syntax check JavaScript/API dan validasi JSON dilakukan pada berkas proyek.
- Belum dilakukan pengujian end-to-end terhadap Firebase produksi. Uji di staging sebelum deployment.


## Hardening lanjutan (revisi lokal setelah audit)
- Endpoint `/api/imagekit` sekarang mewajibkan Firebase ID token yang valid dan role staf/pengurus pada operasi tanda tangan upload maupun penghapusan file. Private key tetap hanya berada di server.
- `js/core/storage.js` mengirim token Firebase saat meminta tanda tangan upload dan menghapus file. Kontrak helper publik tidak berubah.
- Penghapusan ImageKit memvalidasi format `fileId` dan memiliki timeout.
- Proxy foto KTA hanya menerima host Google yang diizinkan, memvalidasi setiap redirect, membatasi redirect maksimal 4 kali, timeout 9 detik, dan ukuran gambar maksimal 8 MB.
- Jumlah endpoint tetap 12. Tidak ada koleksi, akun, atau data anggota yang dihapus.
- Refaktor pembacaan/listener Firestore belum diterapkan: menghilangkan pembacaan awal secara global tanpa mengubah lifecycle UI berisiko membuat halaman menunggu atau kehilangan data. Pagination juga perlu diterapkan per fitur agar laporan historis tidak terpotong. Ini tetap menjadi pekerjaan lanjutan, bukan diklaim sudah diperbaiki.
