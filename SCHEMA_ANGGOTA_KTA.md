# Struktur Dasar Data Anggota & KTA PMR

Dokumen ini hanya mendefinisikan struktur dasar. Belum berisi data anggota produksi.

## Collection `anggota`

- `nama`: string, nama lengkap anggota
- `nomorInduk`: string, nomor induk resmi PMR
- `kelas`: string, kelas sekolah (opsional untuk KTA)
- `divisi`: string, divisi anggota
- `jabatan`: string, default `Anggota`; contoh `Ketua`, `Wakil Ketua`, `Sekretaris`, `Bendahara`, `PJ Divisi`
- `statusKeanggotaan`: `Aktif` | `Alumni` | `Tidak Aktif` (field canonical; modul aplikasi membaca field ini)
- `statusAkun`: `pending` | `active` | `rejected`
- `sumberData`: `registration` | `admin`
- `foto`: string, URL publik/data URL foto (opsional; file foto tidak disimpan di Firestore)
- `authUid`: string, UID Firebase Auth akun anggota (opsional)
- `ktaToken`: string, token acak untuk mengikat QR ke akun anggota (opsional)
- `bergabung`: string tanggal ISO
- `createdAt`: timestamp (diisi otomatis oleh layer DB saat create/import)
- `updatedAt`: timestamp (diisi otomatis oleh layer DB saat create/update)

## Alur anggota

Anggota lama: import/admin -> `statusAkun: active` -> KTA dapat ditampilkan.

Anggota baru: registration -> `statusAkun: pending` -> persetujuan pengurus berwenang -> `active` atau `rejected`.

## KTA

KTA tidak disimpan sebagai data anggota terpisah pada tahap ini. Data KTA dibentuk dari anggota aktif: `nama`, `nomorInduk`, `jabatan/status`, dan nantinya barcode yang mengarah ke softcopy KTA.

## Permission dasar

Admin, Ketua, Wakil Ketua, dan Sekretaris dapat mengelola data anggota dan persetujuan. Implementasi barcode, import CSV/Excel, pendaftaran publik, dan generator KTA belum diaktifkan pada tahap struktur dasar ini.

## KTA v1.1.8
- Admin/pengurus berwenang dapat membuat akun anggota dari NI.
- Username login anggota = NI. Password awal dibuat acak oleh backend dan hanya ditampilkan sekali.
- QR KTA mengarah ke `kta-member.html?kta=<token>` dan dapat diverifikasi publik melalui endpoint server; login hanya diperlukan untuk membuka KTA/profil milik akun sendiri.
- Halaman scan QR menampilkan informasi verifikasi publik yang disanitasi. Jika anggota login, token QR tetap diverifikasi agar hanya akun pemilik yang dapat membuka tampilan KTA pribadi.
- Template depan/belakang berasal dari desain KTA yang disediakan.

## Data pribadi hasil pendaftaran

Collection `anggota_private/{anggotaId}` menyimpan data pribadi yang dikumpulkan dari formulir pendaftaran, terpisah dari `anggota` agar tidak terbaca oleh seluruh akun login.

- `anggotaId`: string, ID dokumen anggota terkait
- `nik`: string
- `tempatLahir`: string
- `tanggalLahir`: string
- `agama`: string
- `jenisKelamin`: string
- `noHandphone`: string
- `golonganDarah`: string
- `provinsi`: string
- `kabKota`: string
- `kecamatan`: string
- `desaKelurahan`: string
- `alamat`: string
- `linkDrive`: string, link dokumen/foto KTA di Google Drive

Penulisan collection ini hanya dilakukan oleh API approval menggunakan Firebase Admin SDK. Pengurus berwenang dapat membaca data tersebut melalui aturan Firestore.
