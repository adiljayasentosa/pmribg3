# PMR WIRA UNIT v1.1.69

## Perbaikan
- Memperbaiki endpoint detail pendaftaran: sebelumnya `.select()` dipanggil pada `DocumentReference`, padahal `.select()` tersedia pada `Query`. Ini dapat membuat permintaan detail gagal dan menampilkan pesan yang salah, yaitu “Gagal menyimpan pendaftaran”.
- Detail pendaftar sekarang diambil melalui query berdasarkan document ID dengan field mask, sehingga hanya field yang diperlukan untuk modal detail yang dikirim.
- Pesan error endpoint GET kini menyatakan kegagalan memuat data, terpisah dari kegagalan menyimpan pendaftaran.
- Memperbarui versi aplikasi dan cache-busting script terkait menjadi 1.1.69; versionCode menjadi 79.

## Keamanan data
- Tidak ada dokumen pendaftar yang diubah, dihapus, atau dimigrasikan oleh perubahan ini.
- Alur submit pendaftaran dan persetujuan tidak diubah.
- Tidak menambahkan endpoint Vercel baru.

## Pemeriksaan lokal
- `node --check api/pendaftaran.js` lulus.
- `node --check api/pendaftaran-action.js` lulus.
- `node --check js/public/pendaftaran.js` lulus.
- `node --check js/system/dashboard.js` lulus.

Catatan: perubahan belum dianggap terdeploy atau teruji terhadap Firebase/Vercel produksi sampai ZIP ini di-deploy dan alur detail diuji di situs.
