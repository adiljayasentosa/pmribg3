/* =========================================================
   ROTATION-ENGINE.JS (F4.4 — Refactor Rotation Engine)
   =========================================================
   Diekstrak PERSIS dari algoritma "Smart Fair Scheduler" yang
   sebelumnya cuma ada di js/pages/piket.js (F4.1). Tidak ada
   perubahan pada aturan/skor/tie-break apa pun — murni
   pemindahan agar bisa dipakai bersama oleh Piket DAN Petugas
   Upacara (F4.4), tanpa duplikasi algoritma.

   Fungsi-fungsi di sini murni (pure) & deterministic, tidak
   menyentuh DOM, sehingga bisa diaudit/diuji terpisah dari UI —
   sama seperti versi asalnya di piket.js.

   Kontrak: SATU dokumen "riwayat" (piket ATAU upacara) berbentuk:
     { tanggal: "YYYY-MM-DD", status: string, petugas: [{id,nama}] }
   Field lain (lokasi, keterangan, dst) tidak dipedulikan engine
   ini — itu urusan masing-masing halaman (piket.js / upacara.js).

   Dipakai oleh:
     - js/pages/piket.js   (lewat wrapper backward-compatible
       _hitungRiwayatPiket()/generateJadwalPiket() — lihat file
       tsb, TIDAK ada perubahan perilaku/nama fungsi yang sudah
       dipakai kode lain)
     - js/pages/upacara.js (F4.4, langsung memakai
       RotationEngine.hitungRiwayat()/generateJadwal())
   ========================================================= */

const RotationEngine = (() => {

  /* ── SEEDED PRNG — deterministic, BUKAN Math.random() murni.
     Dipakai HANYA untuk tie-break saat dua+ kandidat punya skor
     prioritas identik. Seed diturunkan dari tanggal target,
     sehingga generate ulang untuk tanggal yang sama (data tidak
     berubah) selalu menghasilkan urutan tie-break yang SAMA —
     auditable — tapi tanggal target berbeda menghasilkan urutan
     berbeda. (Identik dengan versi asal di piket.js F4.1.) ── */
  function hashString(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
    }
    return hash >>> 0;
  }

  function buatPrng(seed) {
    let a = seed;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function selisihHari(tglA, tglB) {
    return Math.round((new Date(tglA) - new Date(tglB)) / 86400000);
  }

  /* ── RIWAYAT & FAIRNESS — sumber tunggal kebenaran, generik untuk
     koleksi manapun (piket, upacara, atau rotasi lain di masa depan)
     yang mengikuti kontrak {tanggal, status, petugas}.

     Dokumen berstatus `statusDibatalkan` (default "Dibatalkan") TIDAK
     dihitung sebagai riwayat. Dokumen "Terjadwal" TETAP dihitung —
     mencegah seseorang di-generate dobel untuk dua jadwal berdekatan
     sebelum tanggal pertama tiba. (Identik dengan _hitungRiwayatPiket
     versi asal.)

     Return: { [anggotaId]: { jumlah, terakhir } }
  ── */
  function hitungRiwayat(koleksi, statusDibatalkan = "Dibatalkan") {
    const map = {};
    AppState.anggota.forEach(a => { map[a.id] = { jumlah: 0, terakhir: null }; });
    (koleksi || []).forEach(dok => {
      if (dok.status === statusDibatalkan) return;
      (dok.petugas || []).forEach(pt => {
        if (!map[pt.id]) map[pt.id] = { jumlah: 0, terakhir: null };
        map[pt.id].jumlah++;
        if (!map[pt.id].terakhir || dok.tanggal > map[pt.id].terakhir) {
          map[pt.id].terakhir = dok.tanggal;
        }
      });
    });
    return map;
  }

  /* ── ALGORITMA SMART FAIR SCHEDULER ──
     Urutan prioritas (identik dengan versi asal di piket.js):
       1. jumlah ASCENDING     (paling jarang dapat giliran duluan)
       2. terakhir ASCENDING   (paling lama tidak dapat giliran duluan;
                                 belum pernah = prioritas tertinggi)
       3. id ASCENDING         (tie-break stabil sebelum random)
       4. seeded random        (HANYA jika skor 1 & 2 identik persis)

     Parameter (object, bukan posisional) supaya pemanggil baru
     (upacara.js) eksplisit & tidak gampang salah urutan argumen:
       koleksi           : array dokumen riwayat (AppState.piket / AppState.upacara)
       tanggalTarget     : "YYYY-MM-DD" — tanggal jadwal yang mau digenerate
       jumlahPetugas     : jumlah slot yang mau diisi
       minimalJeda       : jarak minimal hari sejak giliran terakhir (default 0)
       dikecualikanIds   : array id anggota yang tidak boleh dipilih
       statusDibatalkan  : nilai status yang dianggap "batal" (default "Dibatalkan")
  ── */
  function generateJadwal({
    koleksi, tanggalTarget, jumlahPetugas, minimalJeda = 0,
    dikecualikanIds = [], statusDibatalkan = "Dibatalkan"
  }) {
    const riwayat = hitungRiwayat(koleksi, statusDibatalkan);

    let kandidat = AppState.anggota
      .filter(a => a.status === "Aktif")
      .filter(a => !dikecualikanIds.includes(a.id))
      .map(a => {
        const r = riwayat[a.id] || { jumlah: 0, terakhir: null };
        const selisih = r.terakhir ? selisihHari(tanggalTarget, r.terakhir) : Infinity;
        return { id: a.id, nama: a.nama, jumlah: r.jumlah, terakhir: r.terakhir, selisihHari: selisih };
      })
      .filter(a => a.selisihHari >= minimalJeda);

    /* Sort dasar deterministic (belum random) */
    kandidat.sort((a, b) => {
      if (a.jumlah !== b.jumlah) return a.jumlah - b.jumlah;
      const ta = a.terakhir || "0000-00-00";
      const tb = b.terakhir || "0000-00-00";
      if (ta !== tb) return ta.localeCompare(tb);
      return a.id.localeCompare(b.id);
    });

    /* Seeded shuffle HANYA di dalam sub-grup yang skornya identik persis */
    const rng = buatPrng(hashString(tanggalTarget));
    let i = 0;
    while (i < kandidat.length) {
      let j = i + 1;
      while (j < kandidat.length &&
             kandidat[j].jumlah === kandidat[i].jumlah &&
             kandidat[j].terakhir === kandidat[i].terakhir) j++;
      if (j - i > 1) {
        for (let k = j - 1; k > i; k--) {
          const idx = i + Math.floor(rng() * (k - i + 1));
          [kandidat[k], kandidat[idx]] = [kandidat[idx], kandidat[k]];
        }
      }
      i = j;
    }

    const terpilih = kandidat.slice(0, jumlahPetugas).map(a => ({
      id: a.id,
      nama: a.nama,
      jumlah: a.jumlah,
      terakhir: a.terakhir,
      selisihHari: a.selisihHari,
      /* Teks default generik — pemanggil (piket.js/upacara.js) boleh
         membentuk teksnya sendiri dari field jumlah/terakhir/selisihHari
         di atas jika butuh istilah yang lebih spesifik ("piket" vs
         "giliran upacara"), lihat generateJadwalPiket() di piket.js. */
      alasan: a.jumlah === 0
        ? "Belum pernah dapat giliran"
        : `Terakhir giliran ${a.selisihHari} hari lalu (${a.jumlah}x total)`
    }));

    return {
      terpilih,
      totalKandidatMemenuhiSyarat: kandidat.length,
      kandidatCadangan: kandidat.slice(jumlahPetugas) /* dipakai fitur "Ganti" di preview */
    };
  }

  return { hashString, buatPrng, selisihHari, hitungRiwayat, generateJadwal };
})();
