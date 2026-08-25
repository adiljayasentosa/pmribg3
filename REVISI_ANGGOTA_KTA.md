# Revisi Struktur Anggota & KTA

Revisi berdasarkan audit read-only eksternal.

## Perbaikan
- `statusKeanggotaan` sekarang menjadi field canonical yang dipakai modul Beranda, Laporan, Rotasi, Piket, Upacara, Keuangan, dan Detail Anggota.
- Data lama yang hanya memiliki `status` dinormalisasi saat dibaca agar tetap kompatibel selama masa transisi.
- Saat status keanggotaan diubah melalui DB, field legacy `status` dihapus dari dokumen Firestore.
- `createdAt` dan `updatedAt` diisi otomatis pada create/update anggota.
- Badge `pending`, `active`, dan `rejected` ditampilkan dalam bahasa Indonesia.
- Menu Anggota, Persetujuan Anggota, dan KTA disembunyikan dari role yang tidak berwenang.
- Detail anggota memiliki fallback aman untuk kelas/divisi kosong.
- Syntax check seluruh JavaScript berhasil.

## Belum dilakukan
- Import anggota lama.
- Import CSV/Excel.
- Barcode final.
- Generator/softcopy KTA final.
- Sinkronisasi desain Canva.
- Migrasi massal data produksi.

ZIP ini masih merupakan versi development/fondasi dan perlu audit kedua sebelum production.

### Validasi Divisi Import
Jika kolom Divisi diisi, nilainya harus `Pertolongan Pertama` atau `Tandu` (pencocokan tidak sensitif huruf besar/kecil dan akan disimpan dalam bentuk canonical). Nilai lain akan ditolak pada preview. Kolom Divisi tetap boleh kosong.

### v1.0.9 — Perbaikan kegagalan sebagian saat import
- `DB.anggota.importBatch` sekarang melempar error yang membawa jumlah baris yang sudah berhasil masuk sebelum gagal (relevan untuk import >400 baris yang terpecah jadi beberapa batch Firestore).
- `bukaImportAnggota` mencoret baris yang sudah berhasil masuk dari daftar preview sebelum user retry, mencegah baris yang sama diimport dua kali.
- Daftar Divisi (`Pertolongan Pertama`, `Tandu`) sekarang satu sumber (`DIVISI_ANGGOTA_LIST`), dipakai bersama oleh form Tambah/Edit dan validator import — sebelumnya dua array terpisah dengan isi yang sama.
