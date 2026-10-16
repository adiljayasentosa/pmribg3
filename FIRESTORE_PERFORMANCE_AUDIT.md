# Audit performa Firestore — v1.1.70 (tanpa perubahan versi)

## Perubahan yang diterapkan
- Halaman KTA hanya membaca dokumen `kta/{anggotaId}` untuk anggota berstatus aktif yang ditampilkan.
- Cache KTA di memori selama 30 detik menghindari pembacaan ulang ketika halaman KTA dirender ulang dalam waktu singkat.
- Kegagalan baca tidak disimpan dalam cache, sehingga percobaan berikutnya tetap bisa mencoba lagi.
- Cache diinvalidasi secara efektif untuk anggota yang KTA-nya baru diaktifkan dengan menyimpan token terbaru.
- Tidak ada dokumen Firestore yang dihapus/ditulis ulang dan tidak ada perubahan rules, role, API, atau skema data.

## Temuan untuk tahap berikutnya
1. `js/core/firebase-db.js`: `DB.init()` membaca beberapa koleksi penuh lalu `DB.initListeners()` memasang listener pada koleksi yang sama. Listener realtime melakukan initial snapshot yang juga dapat menimbulkan pembacaan. Menghapus fetch awal perlu refaktor bootstrap agar UI menunggu snapshot pertama secara aman; tidak dilakukan otomatis untuk menghindari regresi.
2. Koleksi `presensi`, `iuran`, `keuangan`, `piket`, dan `upacara` punya beberapa query tanpa batas. Pagination/limit harus diterapkan per halaman dan laporan, bukan secara global, agar rekap historis tidak terpotong.
3. Listener koleksi penuh untuk data operasional bisa mahal ketika histori tumbuh. Solusi aman adalah memisahkan query per halaman dan menerapkan pagination; untuk dashboard, gunakan agregasi/ringkasan yang konsisten bila memang dibutuhkan.
4. `js/firebase-db.js` lama juga berisi pembacaan/listener koleksi penuh. Periksa apakah file ini masih dipakai sebelum menghapus atau memodifikasinya.

## Batas verifikasi
- `node --check js/system/dashboard.js` berhasil.
- Ini audit statis; belum ada pengujian browser end-to-end atau pengukuran metrik Firestore produksi.
