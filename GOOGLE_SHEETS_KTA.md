# Template Google Sheets — Data Anggota & Foto KTA

Gunakan template `template-kta-google-sheets.csv` di Google Sheets/Excel.

Kolom wajib:
- Nama
- NI

Kolom opsional:
- Status
- Jabatan
- Kelas
- Divisi
- Foto

## Foto Google Drive

1. Upload foto anggota ke folder Google Drive.
2. Untuk setiap foto, pilih **Bagikan → Akses umum → Siapa saja yang memiliki link → Pelihat**.
3. Salin link file ke kolom `Foto` pada baris anggota yang sesuai.
4. Satu foto harus dipetakan ke satu NI. Jangan mengandalkan urutan baris untuk mencocokkan foto.
5. Simpan/download spreadsheet sebagai **CSV UTF-8** sebelum diimport ke website.

Website akan mengenali format link `https://drive.google.com/file/d/FILE_ID/view`, `open?id=FILE_ID`, dan `uc?id=FILE_ID`.

Foto tidak disimpan di Firestore. Saat generator KTA berjalan, server mengambil foto Drive melalui endpoint `/api/kta-photo`, lalu browser menaruhnya ke template KTA.

Jika link Drive tidak publik, foto akan dianggap tidak tersedia dan generator memakai placeholder.

## Integrasi Web PMR

URL Web App Apps Script dikonfigurasi di `js/google-sheets-config.js`. Halaman **Anggota** menyediakan tombol **Sinkronkan Sheets** untuk mengambil JSON dari Apps Script dan mengimpor anggota baru ke Firestore berdasarkan NI. NI yang sudah ada dilewati agar sinkronisasi tidak membuat duplikat.

Pastikan Web App Apps Script aktif dan fungsi `doGet()` mengembalikan array anggota, atau objek dengan properti `data` berupa array. Nama kolom yang dikenali: `Nama`, `NI`, `Kelas`, `Jabatan`, `Divisi`, `Status`, dan `Foto`.
