# PMR WIRA UNIT v1.1.70

## Perubahan
- Menambahkan sistem ikon SVG terpusat untuk mengganti emoji yang dipakai sebagai ikon antarmuka.
- Ikon mengikuti konteks umum seperti kalender, anggota, iuran, presensi, inventaris, pengaturan, pencarian, dan aksi.
- Sistem memantau elemen UI yang dirender dinamis agar ikon yang muncul setelah interaksi juga diproses.
- Emoji pada teks konten biasa tidak diubah secara global agar isi artikel/pesan tidak rusak.
- Memperbarui versi aplikasi dan cache-busting menjadi 1.1.70; versionCode 80.

## Catatan verifikasi
- Sistem ikon memakai SVG inline dan tidak menambah dependensi runtime eksternal.
- Perlu uji visual pada halaman publik dan dashboard setelah deploy, khususnya komponen dinamis yang menggunakan emoji di luar elemen UI umum.
