#!/usr/bin/env node
/**
 * sync-version.js
 * ---------------------------------------------------------------
 * Sinkronisasi versi dari SATU sumber (/version.json) ke:
 *   - sw.js         (const APP_VERSION = "...")
 *   - manifest.json ("version": "...")
 *
 * Jalankan MANUAL setiap kali bump versi, sebelum deploy:
 *   1. Edit /version.json  -> ubah "version" (dan "versionCode" kalau perlu)
 *   2. node scripts/sync-version.js
 *   3. Commit & deploy seperti biasa
 *
 * Tidak menambah dependency/build-step ke situs yang di-deploy — ini
 * cuma alat bantu lokal, hasilnya tetap file statis biasa.
 * (Phase 3: nilai "versionCode" di /version.json juga dipakai sebagai
 * android.versionCode & "version" sebagai android.versionName di
 * twa-manifest.json saat build APK dengan Bubblewrap.)
 * ---------------------------------------------------------------
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const versionFile = path.join(ROOT, "version.json");
const swFile = path.join(ROOT, "sw.js");
const manifestFile = path.join(ROOT, "manifest.json");

function fail(msg) {
  console.error("✗ " + msg);
  process.exit(1);
}

if (!fs.existsSync(versionFile)) fail("version.json tidak ditemukan di root project.");

const { version, versionCode } = JSON.parse(fs.readFileSync(versionFile, "utf8"));
if (!version) fail('Field "version" kosong di version.json.');

// --- sw.js ---
let sw = fs.readFileSync(swFile, "utf8");
const swPattern = /const APP_VERSION = "[^"]*";/;
if (!swPattern.test(sw)) fail('Baris `const APP_VERSION = "...";` tidak ditemukan di sw.js.');
sw = sw.replace(swPattern, `const APP_VERSION = "${version}";`);
fs.writeFileSync(swFile, sw);
console.log(`✓ sw.js -> APP_VERSION = "${version}"`);

// --- manifest.json ---
const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
manifest.version = version;
fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + "\n");
console.log(`✓ manifest.json -> version = "${version}"`);

console.log(`\nSelesai. Ingat: versi baru baru akan terdeteksi user setelah di-deploy`);
console.log(`(cache name di sw.js otomatis ikut berubah karena memakai APP_VERSION).`);
if (versionCode) console.log(`versionCode saat ini: ${versionCode} (dipakai nanti di Phase 3 untuk APK).`);
