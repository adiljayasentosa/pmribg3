# Changelog v1.1.75

- Memperbaiki pemulihan pendaftaran setelah halaman dimuat ulang atau aplikasi ditutup.
- Draft non-rahasia (nama, username, email) disimpan di localStorage; kata sandi tidak pernah disimpan.
- Jika Firebase Auth sudah memiliki sesi dengan email yang sama, tombol Simpan Akun melanjutkan pembuatan profil, bukan mencoba membuat akun Auth duplikat.
- Validasi tidak lagi meminta kata sandi saat melanjutkan sesi akun Firebase yang sudah aktif dengan email yang sama.
- Versi: 1.1.75, versionCode 85.
