# Import Anggota Massal

Fitur import anggota lama tersedia dari halaman **Data Anggota** untuk role Admin, Ketua, Wakil Ketua, dan Sekretaris.

## Format

File yang diterima adalah CSV UTF-8. CSV dapat dibuat dari Excel atau Google Sheets dengan memilih **Save/Download as CSV**. Sistem juga mengenali pemisah koma, titik koma, dan tab.

Kolom wajib:
- `Nama`
- `NI`

Kolom opsional:
- `Status` → default `Aktif`
- `Jabatan` → default `Anggota`
- `Kelas`
- `Divisi`

Header memiliki alias yang aman, misalnya `Nomor Induk`, `NID`, atau `NI` dipetakan menjadi `nomorInduk`.

## Validasi sebelum import

- Nama tidak boleh kosong.
- NI tidak boleh kosong.
- NI tidak boleh sudah ada di database.
- NI tidak boleh duplikat di file yang sama.
- Status harus `Aktif` atau `Tidak Aktif`.
- Jabatan harus sesuai pilihan yang didukung.
- Maksimal 2.000 baris per proses.

Baris bermasalah **tidak ikut diimport**. Pengguna dapat melihat preview sebelum menekan tombol import.

## Data yang dibuat

Data hasil import diberi:
- `statusAkun: active`
- `sumberData: admin`
- `bergabung` otomatis jika kosong
- `createdAt` dan `updatedAt` otomatis

NI diperlakukan sebagai identifier bisnis untuk mencegah anggota lama masuk dua kali. ID dokumen Firestore tetap dibuat otomatis oleh Firestore.

## Alur

`Download Template → Isi Data → Upload CSV → Preview & Validasi → Import Data Valid → Firestore`

Tidak ada perubahan data yang dilakukan sebelum tombol **Import Data Valid** ditekan.

### Validasi Divisi Import
Jika kolom Divisi diisi, nilainya harus `Pertolongan Pertama` atau `Tandu` (pencocokan tidak sensitif huruf besar/kecil dan akan disimpan dalam bentuk canonical). Nilai lain akan ditolak pada preview. Kolom Divisi tetap boleh kosong.

### Kegagalan sebagian (>400 baris)
Firestore membatasi satu batch write maksimal 500 dokumen, jadi import di atas 400 baris dipecah jadi beberapa batch berurutan (masing-masing batch tetap atomik). Kalau salah satu batch gagal setelah batch sebelumnya berhasil, sistem sekarang:
- Memberi tahu persis berapa baris yang **sudah** berhasil masuk sebelum proses berhenti.
- Mencoret baris-baris yang sudah masuk itu dari daftar preview, supaya kalau tombol **Import Data Valid** ditekan lagi, hanya sisa baris yang belum berhasil yang dikirim ulang — bukan mengulang semuanya dan membuat data dobel.

Untuk import ≤400 baris (termasuk import ±120 anggota), satu batch selalu atomik penuh: gagal berarti nol baris masuk, retry aman tanpa risiko duplikat.
