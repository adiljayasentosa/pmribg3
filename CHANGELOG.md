## v1.1.75 — 2026-10-24
- Memperbaiki pemulihan pendaftaran setelah reload/keluar dengan menyimpan draft non-rahasia di localStorage.
- Melanjutkan akun Firebase yang sudah login berdasarkan kecocokan email tanpa membuat akun duplikat.
- Melewati validasi kata sandi hanya saat sesi Firebase aktif cocok dengan email formulir.
- versionCode 85.


## v1.1.73 — 2026-10-24
- Refaktor bootstrap Firestore agar snapshot awal realtime menjadi data awal untuk role non-anggota.
- Bootstrap menunggu snapshot pertama dan menghindari render berulang saat data awal masuk.
- API tetap 12 file; tidak ada perubahan skema/data.

## v1.1.74 — 2026-10-24
- Perbaikan pemulihan pendaftaran anggota setelah halaman reload pada tahap pembuatan akun.
- Menyimpan draft non-rahasia sementara dan melanjutkan profil untuk sesi Firebase Auth yang sama.
- Versi web 1.1.74, versionCode 84.
