# Audit performa Firestore — v1.1.73

## Perubahan
- Untuk role non-anggota, koleksi operasional yang dipantau realtime tidak lagi diambil lewat `.get()` sebelum `onSnapshot()` dipasang. Snapshot pertama menjadi sumber data awal.
- Bootstrap menunggu snapshot pertama listener yang relevan sebelum menutup loading.
- Snapshot pertama tidak memicu render berulang per koleksi; render realtime tetap terjadi pada perubahan sesudah snapshot awal.
- Dokumen `pengurus/struktur` tetap diambil terpisah karena tidak memiliki listener di bootstrap ini.
- Jalur portal anggota dipertahankan untuk menghindari perubahan pada pencocokan akun dan query data personal.

## Pekerjaan lanjutan
1. Audit jalur portal anggota karena masih melakukan fetch awal lalu memasang listener untuk sebagian koleksi yang sama.
2. Evaluasi pagination per halaman untuk koleksi histori (`presensi`, `iuran`, `keuangan`, `piket`, `upacara`) tanpa memotong kebutuhan laporan.
3. Ukur Firestore reads dan lakukan uji browser dengan role admin, bendahara, sekretaris, PJ, pembina, serta anggota.
4. Pastikan rules aktif di Firebase Console sesuai file rules di repositori.

## Batas verifikasi
- Pemeriksaan sintaks statis lulus.
- Belum dilakukan uji end-to-end browser atau pengukuran metrik Firebase produksi.
