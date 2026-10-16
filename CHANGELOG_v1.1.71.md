# Changelog v1.1.71

## Pendaftaran dan persetujuan anggota
- Memindahkan pemeriksaan duplikasi NIK/NISN, keanggotaan yang sudah ada, dan pendaftaran pending milik akun ke transaksi Firestore bersama pembuatan dokumen pendaftaran.
- Membatasi query duplikasi dengan `limit()` yang sudah digunakan, serta mengembalikan status HTTP 409 untuk konflik duplikasi agar UI dapat membedakan konflik data dari gangguan server.
- Menjadikan aksi penolakan transaksional sehingga status pendaftaran diverifikasi kembali sebelum diubah.
- Memverifikasi ulang status pendaftaran di dalam transaksi akhir persetujuan untuk mencegah dua pengurus yang menyetujui bersamaan membuat anggota duplikat.
- Mempertahankan collection dan field yang sudah ada; tidak menghapus atau memigrasikan data anggota/pendaftar.
- Menaikkan versi aplikasi ke 1.1.71 (versionCode 81) dan menyinkronkan cache PWA serta cache-busting asset.

## Verifikasi
- Pemeriksaan sintaks Node.js untuk API pendaftaran dan persetujuan.
- Pemeriksaan JSON untuk version.json dan manifest.json.
- Belum dilakukan pengujian end-to-end dengan Firebase produksi; uji pada proyek staging sebelum deployment disarankan.
