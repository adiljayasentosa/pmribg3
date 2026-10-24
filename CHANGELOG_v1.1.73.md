# Changelog v1.1.73

## Firestore bootstrap / realtime
- Menghindari pembacaan awal `.get()` lalu snapshot awal `onSnapshot()` pada koleksi operasional yang sama untuk role non-anggota.
- Bootstrap menunggu snapshot pertama dari listener yang relevan sebelum menyelesaikan loading dashboard.
- Snapshot awal mengisi AppState tanpa memicu render berulang; perubahan realtime setelah snapshot pertama tetap memperbarui halaman.
- Dokumen `pengurus/struktur` tetap dibaca sekali melalui `.get()` karena tidak dipasang listener di alur bootstrap ini.
- Alur portal anggota dipertahankan agar pencocokan identitas anggota dan query data pribadi tidak berubah dalam refaktor ini.

## Versioning
- version: 1.1.73
- versionCode: 83
- API Vercel tetap 12 file; tidak ada endpoint baru.
- Tidak ada perubahan skema atau penghapusan data Firestore.

## Verifikasi
- Pemeriksaan sintaks JavaScript dan parsing JSON dijalankan secara lokal.
- Belum dilakukan uji browser end-to-end atau pengukuran pemakaian baca pada Firebase produksi.
