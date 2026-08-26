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
    { role_id: "pj_pp",            jabatan: "PJ Pertolongan Pertama (PP)", maks: 3, anggota: [
      { id: 1,   nama: "Raka Pratama" },
      { id: 11,  nama: "Dimas Wicaksono" }
    ]},
    { role_id: "pj_tandu",         jabatan: "PJ Tandu",                    maks: 3, anggota: [
      { id: 6,   nama: "Bagas Saputra" }
    ]},
    { role_id: "pj_kesehatan",     jabatan: "PJ Kesehatan",                maks: 3, anggota: [
      { id: 2,   nama: "Siti Nuraini" }
    ]},
    { role_id: "pj_logistik",      jabatan: "PJ Logistik",                 maks: 3, anggota: [
      { id: 9,   nama: "Rizky Firmansyah" }
    ]},
    { role_id: "pj_persahabatan",  jabatan: "PJ Persahabatan",             maks: 3, anggota: [] },
    { role_id: "pj_humas",         jabatan: "PJ Humas",                    maks: 3, anggota: [
      { id: 12,  nama: "Melinda Cahyani" }
    ]},
    { role_id: "pj_wirausaha",     jabatan: "PJ Wirausaha",                maks: 3, anggota: [] }
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

/* =========================================================
   [F6.0 — Konten Publik] DATA DUMMY — Artikel / Video / Poster
   / Dokumentasi.
   =========================================================
   SENGAJA konstanta TERPISAH dari DUMMY_DATA di atas — bukan
   dibaca oleh _seedAppStateFromDummy() (dashboard internal),
   jadi menambah data di sini TIDAK menyentuh perilaku dashboard
   yang sudah ada sama sekali. Dipakai oleh js/core/content-db.js
   sebagai sumber Mode Demo untuk halaman publik (Landing,
   /artikel, /video, /poster, /dokumentasi).

   `pjDivisi` memakai daftar divisi BARU khusus konten publik
   (Humas & Publikasi / Dokumentasi / Pendidikan & Pelatihan) —
   terpisah dari field `divisi` di DUMMY_DATA.anggota (yang tetap
   dipakai apa adanya untuk program kerja PMR, tidak diubah).
   ========================================================= */
/* [F7.0] Gambar contoh utk Mode Demo — SVG data-URI kecil, bukan
   file sungguhan (tak perlu upload nyata utk mencoba tampilan).
   Dipakai HANYA pada item pertama tiap tipe supaya jalur render
   "sudah ada gambar" dan jalur fallback "field lama tanpa gambar"
   sama-sama teruji. */
const _GBR_DEMO_1 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect width='400' height='300' fill='%23C8102E'/%3E%3Ctext x='50%25' y='50%25' fill='white' font-size='22' text-anchor='middle' dy='.3em'%3EContoh Gambar%3C/text%3E%3C/svg%3E";
const _GBR_DEMO_2 = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect width='400' height='300' fill='%232563EB'/%3E%3Ctext x='50%25' y='50%25' fill='white' font-size='22' text-anchor='middle' dy='.3em'%3EFoto Galeri%3C/text%3E%3C/svg%3E";

const DUMMY_KONTEN_PUBLIK = {
  artikel: [
    {
      id: "a1", slug: "5-langkah-pertolongan-pertama",
      judul: "5 Langkah Dasar Pertolongan Pertama yang Wajib Diketahui",
      ringkasan: "Panduan singkat menangani luka ringan, pingsan, dan cedera sebelum bantuan medis tiba.",
      /* [F7.0] Item ini memakai skema BARU: coverImage + articleUrl
         (bukan konten[] paragraf lagi). */
      coverImage: _GBR_DEMO_1,
      articleUrl: "https://www.palangmerah.org/",
      kategori: "Kesehatan", tanggal: "2026-05-21", pjDivisi: "Pendidikan & Pelatihan",
      penulis: "Tim Pendidikan PMR", publish: true
    },
    {
      id: "a2", slug: "kenapa-donor-darah-penting",
      judul: "Kenapa Donor Darah Rutin Itu Penting?",
      ringkasan: "Manfaat donor darah bagi tubuh pendonor sekaligus dampaknya bagi yang membutuhkan.",
      /* Item lama (pra-F7.0) — masih pakai konten[] paragraf, sengaja
         DIPERTAHANKAN apa adanya untuk menguji jalur fallback baca. */
      konten: [
        "Donor darah tidak hanya bermanfaat bagi penerima, tetapi juga bagi kesehatan pendonor itu sendiri.",
        "Setiap kantong darah yang didonorkan berpotensi menyelamatkan hingga tiga nyawa berbeda.",
        "PMI menganjurkan donor darah rutin setiap 3 bulan sekali bagi pendonor yang memenuhi syarat kesehatan."
      ],
      kategori: "Kemanusiaan", tanggal: "2026-05-18", pjDivisi: "Humas & Publikasi",
      penulis: "Tim Humas PMR", publish: true
    },
    {
      id: "a3", slug: "sistem-rotasi-piket-upacara",
      judul: "Mengenal Sistem Rotasi Piket & Petugas Upacara",
      ringkasan: "Bagaimana PMR WIRA UNIT menjaga pembagian tugas yang adil antar anggota.",
      konten: [
        "Pembagian jadwal piket dan petugas upacara di PMR WIRA UNIT menggunakan sistem rotasi berbasis riwayat.",
        "Setiap anggota dipastikan mendapat giliran secara merata berdasarkan jumlah tugas yang pernah dijalani sebelumnya."
      ],
      kategori: "Kesiapsiagaan", tanggal: "2026-05-10", pjDivisi: "Dokumentasi",
      penulis: "Tim Dokumentasi PMR", publish: true
    }
  ],

  video: [
    {
      id: "v1", slug: "cara-membalut-luka-perban-segitiga",
      judul: "Cara Membalut Luka dengan Perban Segitiga",
      deskripsi: "Video ini membahas teknik dasar membalut luka menggunakan perban segitiga untuk berbagai jenis cedera ringan.",
      durasi: "2:45", kategori: "Tutorial", tanggal: "2026-07-20",
      pjDivisi: "Pendidikan & Pelatihan",
      /* [F7.0] Skema baru: videoUrl (bukan embedUrl) + thumbnailUrl */
      videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", thumbnailUrl: "", publish: true
    },
    {
      id: "v2", slug: "cpr-dasar-untuk-pemula",
      judul: "Langkah RJP (CPR) Dasar untuk Pemula",
      deskripsi: "Panduan langkah demi langkah melakukan resusitasi jantung paru (RJP) dasar dalam situasi darurat.",
      durasi: "3:10", kategori: "Tutorial", tanggal: "2026-07-18",
      pjDivisi: "Pendidikan & Pelatihan", embedUrl: "", publish: true /* field lama, uji fallback */
    },
    {
      id: "v3", slug: "keseruan-bakti-sosial-2026",
      judul: "Keseruan Bakti Sosial PMR WIRA UNIT 2026",
      deskripsi: "Dokumentasi kegiatan bakti sosial PMR WIRA UNIT bersama warga sekitar sekolah.",
      durasi: "4:20", kategori: "Dokumentasi", tanggal: "2026-07-15",
      pjDivisi: "Dokumentasi", embedUrl: "", publish: true
    }
  ],

  poster: [
    {
      id: "p1", slug: "donor-darah", judul: "Donor Darah",
      deskripsi: "Ayo donorkan darahmu untuk membantu sesama. Setetes darah sangat berarti bagi mereka yang membutuhkan.",
      kategori: "Kesehatan", tanggal: "2026-07-20", pjDivisi: "Humas & Publikasi",
      imageUrl: _GBR_DEMO_1, publish: true /* [F7.0] field baru */
    },
    {
      id: "p2", slug: "cuci-tangan-pakai-sabun", judul: "Cuci Tangan Pakai Sabun",
      deskripsi: "Membiasakan cuci tangan pakai sabun secara rutin untuk mencegah penyebaran penyakit.",
      kategori: "Kesehatan", tanggal: "2026-07-15", pjDivisi: "Humas & Publikasi",
      gambarUrl: "", publish: true /* field lama, uji fallback */
    },
    {
      id: "p3", slug: "pertolongan-pertama-pingsan", judul: "Pertolongan Pertama Saat Pingsan",
      deskripsi: "Langkah cepat dan tepat menangani orang yang pingsan di sekitar kita.",
      kategori: "Pertolongan Pertama", tanggal: "2026-07-10", pjDivisi: "Pendidikan & Pelatihan",
      gambarUrl: "", publish: true
    }
  ],

  dokumentasi: [
    {
      id: "d1", slug: "bakti-sosial-2026", judul: "Bakti Sosial 2026",
      deskripsi: "Kegiatan bakti sosial berupa pembagian sembako, pemeriksaan kesehatan gratis, dan edukasi kesehatan di lingkungan masyarakat.",
      tanggal: "2026-07-20", pjDivisi: "Dokumentasi",
      /* [F7.0] Skema baru: coverImage + images[] (photoCount otomatis
         dari images.length, tidak diinput manual lagi) */
      coverImage: _GBR_DEMO_1,
      images: [_GBR_DEMO_2, _GBR_DEMO_2, _GBR_DEMO_2], photoCount: 3,
      albumTerkait: ["d2", "d3"], publish: true
    },
    {
      id: "d2", slug: "pelatihan-p3k-2026", judul: "Pelatihan P3K",
      deskripsi: "Pelatihan pertolongan pertama dasar dan lanjutan bagi seluruh anggota PMR WIRA UNIT.",
      tanggal: "2026-07-10", pjDivisi: "Dokumentasi", jumlahFoto: 28, /* field lama, uji fallback */
      foto: [], albumTerkait: ["d1", "d3"], publish: true
    },
    {
      id: "d3", slug: "kerja-bakti-sekolah", judul: "Kerja Bakti Sekolah",
      deskripsi: "Kegiatan kerja bakti membersihkan lingkungan sekolah bersama seluruh anggota PMR.",
      tanggal: "2026-07-05", pjDivisi: "Dokumentasi", jumlahFoto: 12,
      foto: [], albumTerkait: ["d1", "d2"], publish: true
    }
  ]
};
