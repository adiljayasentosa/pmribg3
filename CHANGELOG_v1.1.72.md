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
