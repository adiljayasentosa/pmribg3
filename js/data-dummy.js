/* =========================================================
   DATA DUMMY — v2 (Fase 1)
   Diperluas dengan presensiHistory untuk fitur rekap.
   ========================================================= */

const DUMMY_DATA = {
  periode: "2025/2026",
  nominalIuranStandar: 5000, /* F4.4 Fitur 1 — default iuran bulanan mode demo */

  ringkasan: {
    totalAnggota: 48,
    anggotaAktif: 44,
    kasSaldo: 2450000,
    programBerjalan: 5,
    kehadiranRata: 87
  },

  anggota: [
    { id: 1,  nama: "Raka Pratama",      kelas: "XI TKJ 1",  divisi: "Pertolongan Pertama", status: "Aktif",       noHp: "081234560001", bergabung: "2024-07-15" },
    { id: 2,  nama: "Siti Nuraini",      kelas: "XI AKL 2",  divisi: "Kesehatan Remaja",    status: "Aktif",       noHp: "081234560002", bergabung: "2024-07-15" },
    { id: 3,  nama: "Dewi Lestari",      kelas: "X RPL 1",   divisi: "Kepemimpinan",        status: "Aktif",       noHp: "081234560003", bergabung: "2025-07-10" },
    { id: 4,  nama: "Fajar Nugroho",     kelas: "XII OTKP",  divisi: "Bakti Masyarakat",    status: "Tidak Aktif", noHp: "081234560004", bergabung: "2023-08-01" },
    { id: 5,  nama: "Putri Ramadhani",   kelas: "XI TKJ 2",  divisi: "Pertolongan Pertama", status: "Aktif",       noHp: "081234560005", bergabung: "2024-07-15" },
    { id: 6,  nama: "Bagas Saputra",     kelas: "X AKL 1",   divisi: "Kesehatan Remaja",    status: "Aktif",       noHp: "081234560006", bergabung: "2025-07-10" },
    { id: 7,  nama: "Nadia Salsabila",   kelas: "XI RPL 2",  divisi: "Kepemimpinan",        status: "Aktif",       noHp: "081234560007", bergabung: "2024-07-15" },
    { id: 8,  nama: "M. Arif Hidayat",   kelas: "XII TKJ 1", divisi: "Kepemimpinan",        status: "Aktif",       noHp: "081234560008", bergabung: "2023-08-01" },
    { id: 9,  nama: "Rizky Firmansyah",  kelas: "X TKJ 2",   divisi: "Bakti Masyarakat",    status: "Aktif",       noHp: "081234560009", bergabung: "2025-07-10" },
    { id: 10, nama: "Aisyah Putri",      kelas: "XI AKL 1",  divisi: "Kesehatan Remaja",    status: "Aktif",       noHp: "081234560010", bergabung: "2024-07-15" },
    { id: 11, nama: "Dimas Wicaksono",   kelas: "X OTKP 1",  divisi: "Pertolongan Pertama", status: "Aktif",       noHp: "081234560011", bergabung: "2025-07-10" },
    { id: 12, nama: "Melinda Cahyani",   kelas: "XI TKJ 1",  divisi: "Bakti Masyarakat",    status: "Tidak Aktif", noHp: "081234560012", bergabung: "2024-07-15" }
  ],

  kegiatan: [
    { id: 1, nama: "Pelatihan PP Dasar",        tanggal: "2026-07-04", status: "Terjadwal", pj: "Dewi Lestari",   peserta: 30, lokasi: "Aula Sekolah" },
    { id: 2, nama: "Donor Darah Sekolah",       tanggal: "2026-06-20", status: "Selesai",   pj: "Raka Pratama",   peserta: 45, lokasi: "Lapangan SMK IBG 3" },
    { id: 3, nama: "Bakti Sosial Panti Asuhan", tanggal: "2026-06-12", status: "Selesai",   pj: "Fajar Nugroho",  peserta: 28, lokasi: "Panti Asuhan Al-Ikhlas" },
    { id: 4, nama: "Lomba PMR Tingkat Kota",    tanggal: "2026-08-02", status: "Terjadwal", pj: "Siti Nuraini",   peserta: 10, lokasi: "GOR Kota" },
    { id: 5, nama: "Rapat Evaluasi Semester",   tanggal: "2026-07-01", status: "Terjadwal", pj: "M. Arif Hidayat",peserta: 48, lokasi: "Ruang OSIS" }
  ],

  keuangan: [
    { id: 1, tanggal: "2026-06-25", uraian: "Kas anggota Juni",           jenis: "Masuk",  jumlah: 480000 },
    { id: 2, tanggal: "2026-06-20", uraian: "Perlengkapan donor darah",   jenis: "Keluar", jumlah: 220000 },
    { id: 3, tanggal: "2026-06-12", uraian: "Konsumsi bakti sosial",      jenis: "Keluar", jumlah: 150000 },
    { id: 4, tanggal: "2026-06-01", uraian: "Kas anggota Mei",            jenis: "Masuk",  jumlah: 460000 },
    { id: 5, tanggal: "2026-05-20", uraian: "Pembelian P3K cadangan",     jenis: "Keluar", jumlah: 185000 },
    { id: 6, tanggal: "2026-05-10", uraian: "Kas anggota April",          jenis: "Masuk",  jumlah: 460000 },
    { id: 7, tanggal: "2026-05-05", uraian: "Cetak sertifikat pelatihan", jenis: "Keluar", jumlah: 95000  }
  ],

  /* =========================================================
     PEMBINA/GURU — pool kandidat khusus untuk jabatan Pembimbing.
     Dipisah dari `anggota` karena Pembimbing adalah guru, bukan siswa.
     ========================================================= */
  guru: [
    { id: 101, nama: "Dra. Hj. Siti Aminah" },
    { id: 102, nama: "Bambang Wijaya, S.Pd" }
  ],

  /* =========================================================
     STRUKTUR PENGURUS — Format fleksibel & tidak hardcoded.
     Setiap jabatan = { role_id, jabatan, maks, anggota:[{id,nama}] }
     - maks   = kapasitas maksimal orang di jabatan tsb
     - anggota = daftar orang yang sedang menjabat (bisa 0..maks)
     Menambah/menghapus/reset jabatan cukup mengubah array ini —
     halaman Pengurus akan otomatis render ulang tanpa sentuh HTML.
     ========================================================= */
  strukturPengurus: [
    { role_id: "pembimbing",       jabatan: "Pembimbing",                  maks: 1, anggota: [
      { id: 101, nama: "Dra. Hj. Siti Aminah" }
    ]},
    { role_id: "ketua",            jabatan: "Ketua",                       maks: 1, anggota: [
      { id: 8,   nama: "M. Arif Hidayat" }
    ]},
    { role_id: "wakil",            jabatan: "Wakil Ketua",                 maks: 1, anggota: [
      { id: 7,   nama: "Nadia Salsabila" }
    ]},
    { role_id: "sekretaris",       jabatan: "Sekretaris",                  maks: 2, anggota: [
      { id: 3,   nama: "Dewi Lestari" },
      { id: 10,  nama: "Aisyah Putri" }
    ]},
    { role_id: "bendahara",        jabatan: "Bendahara",                   maks: 2, anggota: [
      { id: 5,    nama: "Putri Ramadhani" },
      { id: 9002, nama: "Naufal Ramadhan" }
    ]},
    { role_id: "pj_pp",            jabatan: "PJ Pertolongan Pertama (PP)", maks: 2, anggota: [
      { id: 1,   nama: "Raka Pratama" },
      { id: 11,  nama: "Dimas Wicaksono" }
    ]},
    { role_id: "pj_tandu",         jabatan: "PJ Tandu",                    maks: 2, anggota: [
      { id: 6,   nama: "Bagas Saputra" }
    ]},
    { role_id: "pj_kesehatan",     jabatan: "PJ Kesehatan",                maks: 2, anggota: [
      { id: 2,   nama: "Siti Nuraini" }
    ]},
    { role_id: "pj_logistik",      jabatan: "PJ Logistik",                 maks: 2, anggota: [
      { id: 9,   nama: "Rizky Firmansyah" }
    ]},
    { role_id: "pj_persahabatan",  jabatan: "PJ Persahabatan",             maks: 2, anggota: [] },
    { role_id: "pj_humas",         jabatan: "PJ Humas",                    maks: 3, anggota: [
      { id: 12,  nama: "Melinda Cahyani" }
    ]},
    { role_id: "pj_wirausaha",     jabatan: "PJ Wirausaha",                maks: 2, anggota: [] }
  ],

  /* Riwayat presensi: [anggotaId, tanggal, hadir, keterangan] */
  presensiHistory: [
    /* Pertemuan 1 — 2026-06-02 */
    ...[1,2,3,5,6,7,8,9,10,11].map(id => ({ anggotaId:id, tanggal:"2026-06-02", hadir:true,  ket:"" })),
    ...[4,12].map(id             => ({ anggotaId:id, tanggal:"2026-06-02", hadir:false, ket:"Tidak keterangan" })),

    /* Pertemuan 2 — 2026-06-09 */
    ...[1,2,3,5,7,8,9,10].map(id => ({ anggotaId:id, tanggal:"2026-06-09", hadir:true,  ket:"" })),
    { anggotaId:6,  tanggal:"2026-06-09", hadir:false, ket:"Izin" },
    { anggotaId:11, tanggal:"2026-06-09", hadir:false, ket:"Sakit" },
    ...[4,12].map(id             => ({ anggotaId:id, tanggal:"2026-06-09", hadir:false, ket:"" })),

    /* Pertemuan 3 — 2026-06-16 */
    ...[1,2,3,4,5,6,7,8,10,11].map(id => ({ anggotaId:id, tanggal:"2026-06-16", hadir:true,  ket:"" })),
    { anggotaId:9,  tanggal:"2026-06-16", hadir:false, ket:"Izin" },
    { anggotaId:12, tanggal:"2026-06-16", hadir:false, ket:"" },

    /* Pertemuan 4 — 2026-06-23 */
    ...[1,2,5,6,7,8,9,10,11,12].map(id => ({ anggotaId:id, tanggal:"2026-06-23", hadir:true,  ket:"" })),
    { anggotaId:3,  tanggal:"2026-06-23", hadir:false, ket:"Sakit" },
    { anggotaId:4,  tanggal:"2026-06-23", hadir:false, ket:"" }
  ]
};

/* =========================================================
   SALINAN DEFAULT STRUKTUR PENGURUS
   Dipakai oleh fitur "Reset Struktur" agar bisa mengembalikan
   data ke kondisi awal tanpa reload halaman.
   ========================================================= */
const STRUKTUR_PENGURUS_DEFAULT = JSON.parse(JSON.stringify(DUMMY_DATA.strukturPengurus));
