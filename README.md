# LigaLokal

**Unified Football Intelligence Platform** — sistem operasi terpadu untuk manajemen
kompetisi, data pemain, dan kecerdasan talenta sepak bola akar rumput.

Dibangun dari `documents/Proposal_FOOTGRIT-OS-FINAL.pdf` untuk PT DVONES Indonesia.

## Tujuh modul kerja

| Modul | Rute | Isi |
|-------|------|-----|
| Command Center | `/command-center` | Dasbor operasional real-time, live match monitor, papan peringkat, kepatuhan verifikasi |
| Master Data & Registry | `/registry/*` | Pemain (13 posisi, NISN wajib & unik, hingga 2 klub, kaki dominan, foto, 5 dokumen privat), SSB (logo, alamat, Askot & Asprov), pelatih (foto, lisensi & KTP privat), wasit (lisensi, asal Askot), venue, aturan kategori usia (KU-8…KU-16, bisa ditambah sendiri) |
| Data Ingestion & Staging | `/ingestion` | Impor CSV dengan pipeline **8 tahap** — validasi skema, fuzzy dedupe, antrian tinjauan, commit + audit |
| Competition & Rules | `/kompetisi` | **Turnamen → KU**: satu turnamen berisi banyak KU (kategori usia); tiap KU berformat **Liga** (round-robin) atau **Cup** (sistem gugur + adu penalti). Jadwal otomatis, manual, atau **unggah CSV**; klasemen real-time + tie-breaker; bagan Cup; hapus KU / turnamen |
| Match Operations | `/match-ops` | Konsol pertandingan langsung: penugasan wasit & operator, timer, skor, kejadian sekali ketuk, pergantian dari cadangan, save otomatis dari tembakan tepat sasaran lawan, lini masa, validasi hasil |
| Player Intelligence & Radar | `/player-intelligence` | Radar performa, perbandingan head-to-head, **mesin formula penilaian**, galeri lencana (bisa disaring per turnamen & KU) |
| AI Scout & Insights | `/ai-scout` | Pencarian talenta bahasa natural, laporan analisis pemain / laga / kompetisi |
| DSP Pelatih | `/dsp` | Pilih KU → jadwal pertandingan klub → starter dan cadangan → submit; revisi sampai kick-off, status submit setiap tim tampil di kartu jadwal |

### Akun pelatih dan pembaruan DSP

Admin membuat atau mengubah akun login pada **Registry → Pelatih → profil pelatih → Akun login pelatih**. Tentukan SSB pelatih terlebih dahulu. Pelatih login dengan email dan kata sandi tersebut dan langsung masuk ke `/dsp`. Perubahan SSB pelatih juga memperbarui SSB akun login.

Migrasi `0006_coach_dsp` menambahkan relasi akun pelatih dan tabel status DSP. Jalankan `npm run db:migrate` saat memperbarui instalasi lain. Data lama tetap tersedia. Jika operator mengubah daftar atau peran pemain sebelum kick-off, status submit DSP tim yang diubah dikosongkan agar pelatih dapat meninjau dan mengirim ulang.

Di Galeri Lencana, admin/operator dapat memilih **Pemain Terbaik** per turnamen dan KU. Skor penerima mengikuti cakupan turnamen/KU yang dipilih. Kejadian `shot_on` berarti tembakan tepat sasaran yang tidak menjadi gol; kejadian gol sudah menyumbang tembakan tepat sasaran sendiri. Save dihitung untuk kiper lawan yang sedang bermain, tanpa pencatatan save manual. Membatalkan tembakan juga menghapus save otomatisnya.

Tes perubahan dengan `npm run test:logic` dan `npm run typecheck`. Untuk tes database, gunakan `UPDATES_TEST_DATABASE_URL=mysql://root@127.0.0.1:3306/footgrit_test_updates` lalu `npm run test:project-updates`. Database uji harus belum ada; skrip membuat, memigrasikan, menguji, dan menghapusnya, serta menolak alamat di luar localhost.

Untuk menambahkan contoh DSP ke **data yang sudah ada**, gunakan `npm run db:seed:dsp`. Skrip mengisi kedua tim pada maksimal enam pertandingan terjadwal, dua per KU, dengan pelatih klub, starter sesuai aturan KU, dan hingga empat cadangan. Akun pelatih baru memakai email pada profil pelatih dan kata sandi pengembangan `ligalokal123`; kata sandi akun yang sudah ada tetap dipertahankan. Akun `pelatih@ligalokal.id` dihubungkan ke Garuda Muda bila klubnya belum diatur. Susunan pemain/DSP yang sudah diisi dan pertandingan yang sudah dimulai dilewati. Menjalankan ulang tidak menambahkan duplikat atau mengganti pilihan yang sudah ada.

Preview tanpa perubahan: `node --import tsx scripts/seed-coach-dsp.ts --dry-run`. Jumlah contoh dapat diatur dengan `--matches=6 --per-ku=2`. Seed penuh `npm run db:seed` juga menyertakan contoh ini; gunakan `db:seed:dsp` untuk memperbarui data saat ini tanpa reset.

## Menjalankan

`npm run dev` menggunakan Webpack agar tidak terkena crash proses PostCSS
Turbopack di Windows saat alokasi memori gagal. Setelah mengubah bundler,
hentikan server lama dengan Ctrl+C, lalu jalankan ulang `npm run dev`.

Untuk memeriksa daftar pemain pertandingan tanpa mengubah database:

```bash
npx tsx scripts/check-match-roster.ts MATCH_ID
```

Gunakan ID dari URL `/match-ops/MATCH_ID`. Pemeriksaan memakai `DATABASE_URL`
dan membandingkan jumlah pemain klub, kecocokan kategori usia, skuad yang
dimuat, serta susunan pemain pertandingan. Skuad turnamen diprioritaskan;
tanpa skuad tersebut, konsol memakai klub utama / klub kedua dan KU pemain.

Database: **MariaDB** (kompatibel MySQL) — sama dengan yang dipakai hosting
Hostinger. Untuk lokal di Windows, pasang MariaDB sebagai service:

```bash
winget install MariaDB.Server --version 11.8.2.0
```

Lalu buat database + user (ganti `PASSWORD`; bisa lewat HeidiSQL yang ikut
terpasang, atau klien `mariadb`):

```sql
CREATE DATABASE ligalokal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'ligalokal'@'localhost' IDENTIFIED BY 'PASSWORD';
GRANT ALL PRIVILEGES ON ligalokal.* TO 'ligalokal'@'localhost';
```

Isi `.env.local` dengan `DATABASE_URL=mysql://ligalokal:PASSWORD@127.0.0.1:3306/ligalokal`
(karakter khusus di password harus di-URL-encode), lalu:

```bash
npm install
npm run db:migrate   # buat skema
npm run db:seed      # isi data contoh lengkap (khusus pengembangan lokal)
npm run dev          # http://localhost:3000
```

### Memperbarui database yang sudah berisi data (migrasi 0004)

Migrasi `0004_turnamen_ku` mengubah struktur turnamen dan menghapus beberapa
kolom. **Cadangkan dulu** (`mysqldump -u ligalokal -p ligalokal > cadangan.sql`),
lalu jalankan `npm run db:migrate`.

Untuk database di Hostinger: izinkan IP komputer Anda di hPanel → Databases →
Remote MySQL, lalu
`mysqldump -h HOST -u USER -p --single-transaction --skip-lock-tables --no-tablespaces NAMA_DB > cadangan-produksi.sql`
(atau ekspor lewat phpMyAdmin / unduh dari hPanel → Backups). **Periksa ukuran
berkasnya**: 0 byte berarti dump gagal dan belum ada cadangan. DDL MariaDB tidak
bisa di-rollback — bila `db:migrate` terhenti di tengah, jangan jalankan ulang
begitu saja (`competitions` sudah ada); pulihkan dari cadangan atau lanjutkan
dari pernyataan yang gagal.

- Setiap turnamen lama menjadi satu *Turnamen* berisi satu KU, dengan id yang
  sama — tautan `/kompetisi/<id>` lama tetap membuka turnamen yang benar. Laga,
  klasemen, skuad, statistik, dan lencana tidak disentuh.
- Format `knockout` dan `hybrid` menjadi `cup`.
- **Kolom yang dihapus (isinya hilang):** SSB — akreditasi, warna tim, venue
  kandang; pelatih — pengalaman, tanggal lisensi, status lisensi; kategori usia —
  usia minimal dan batas tahun lahir terbaru; lencana — tingkat (tier).
- Kolom baru: SSB — alamat, Askot, Asprov; wasit — Askot; pelatih — berkas
  lisensi dan KTP.

Database kosong tidak perlu langkah khusus: `db:migrate` lalu `db:seed`.

## Deploy ke Hostinger (paket Unlimited / Node.js Web App)

1. **Database** — hPanel → Databases → MySQL Databases: buat database + user
   (nama berprefiks seperti `u123456789_ligalokal`).
2. **Skema + akun pertama** — hPanel → Databases → Remote MySQL: izinkan IP komputer
   Anda. Arahkan `DATABASE_URL` sementara ke host remote yang tertera di halaman
   itu, jalankan `npm run db:migrate`, lalu buat akun nyata pertama dengan
   `SUPER_ADMIN_EMAIL=… SUPER_ADMIN_PASSWORD=… npm run db:seed:super`
   (kata sandi minimal 12 karakter). **Jangan** menjalankan `npm run db:seed` di
   produksi: skrip itu menolak berjalan pada `NODE_ENV=production` atau database
   non-lokal. Untuk membawa data yang sudah ada, ekspor database lokal
   (`mysqldump`) lalu impor lewat phpMyAdmin. Kembalikan `DATABASE_URL` ke lokal
   setelahnya.
3. **Aplikasi** — hPanel → Websites → tambah Node.js Web App dari repo GitHub
   (Next.js, Node 22, build `npm run build`, start `npm start`). Skrip `build`
   memakai `next build --webpack`: Turbopack menjalankan PostCSS lewat proses
   Node anak yang dimatikan oleh batas proses di hosting bersama
   (`TurbopackInternalError` di `app/globals.css`).
4. **Environment variables** di pengaturan aplikasi (daftar lengkap dan
   penjelasannya ada di `.env.example`): `DATABASE_URL`, `AUTH_SECRET` (acak, ≥ 32
   karakter — `openssl rand -base64 48`), `AUTH_URL=https://domain-anda`,
   `TRUSTED_PROXY_HOPS` (jumlah reverse proxy di depan aplikasi; dipakai pembatas
   percobaan masuk), serta `CLOUDINARY_*` / `GEMINI_API_KEY` bila dipakai. Server
   menolak start di produksi bila `AUTH_SECRET` kosong/lemah. Restart aplikasi
   setiap kali variabel diubah.

Opsional: `DATABASE_POOL_SIZE` (default 5) — batas koneksi per user di shared
hosting kecil, jangan dinaikkan tanpa perlu.

### Catatan MariaDB

- Semua waktu disimpan dalam UTC (`datetime(3)`); koneksi dipaku ke
  `time_zone = '+00:00'` di `lib/db/pool.ts`. Tampilan selalu **WIB**
  (`Asia/Jakarta`, lihat `lib/utils.ts`), jadi server berzona waktu UTC seperti
  Hostinger tetap menampilkan jam kick-off yang benar.
- MariaDB tidak punya `RETURNING` — gunakan `insertReturning()` dari
  `lib/db/returning.ts`.
- Jangan pakai `db.query.*` dengan `with:` (MariaDB menolak subquery
  turunan berkorelasi yang dibuat Drizzle) — ambil relasi lewat `join`.

## Akun pengembangan (khusus lokal)

Dibuat oleh `npm run db:seed` untuk pengembangan di komputer sendiri. **Tidak ada di
halaman login dan tidak berlaku di produksi**: seed menolak berjalan di produksi, dan
kata sandi bersama ini ditolak oleh login bila `NODE_ENV=production`.

Kata sandi semua akun: **`ligalokal123`**

| Email | Peran | Akses |
|-------|-------|-------|
| `admin@ligalokal.id` | Administrator | Akses penuh |
| `operator@ligalokal.id` | Operator Kompetisi | Kompetisi, jadwal, match ops, data master |
| `wasit@ligalokal.id` | Wasit | Konsol pertandingan + validasi hasil |
| `pelatih@ligalokal.id` | Pelatih | Skuad klub + analitik pemain |
| `scout@ligalokal.id` | Pemandu Bakat | AI Scout + Player Intelligence |
| `peninjau@ligalokal.id` | Peninjau | Baca-saja |

## Alur kerja

**Turnamen & KU.** Buat *Turnamen* dulu di `/kompetisi/baru` (nama, musim,
penyelenggara, deskripsi). Buka turnamennya, lalu tekan **Tambah KU**: pilih
kategori usia, format (**Liga** atau **Cup**), formula penilaian, tanggal mulai,
dan SSB pesertanya. Satu turnamen boleh punya banyak KU, tetapi tiap kategori
usia hanya sekali. Setiap KU punya jadwal, klasemen / bagan, peserta, dan status
sendiri (Draf → Registrasi → Verifikasi → Siap → Berlangsung → Selesai); status
turnamen mengikuti KU yang masih berjalan. Di seluruh aplikasi sebuah KU ditulis
`<turnamen> · KU-14`.

**Pemain.** Posisi memakai 13 peran (GK · CB RB LB WB · DMF CMF AMF WF · ST CF LW RW);
kelompok Kiper/Bertahan/Tengah/Depan diturunkan darinya (`lib/positions.ts`) dan
dipakai untuk persentil & filter AI. NISN wajib 10 digit dan unik (dicek langsung
saat mengetik). Seorang pemain boleh punya **klub kedua**; di profilnya statistik
bisa difilter *Semua klub* / per klub, dan baris tiap kompetisi bisa diklik untuk
melihat pertandingan pemain di kompetisi itu.

**Pertandingan.**
1. Di kartu *Penugasan Petugas* tentukan **wasit** (lisensi masih berlaku) dan **operator**.
   Kick-off baru bisa ditekan setelah keduanya terisi; bentrok jadwal petugas
   (±2 jam) diberi peringatan.
2. Pilih klub di bagian atas daftar pemain, lalu ketuk tombol di samping nama:
   Gol · Assist · Tepat · Save · Intersep · Meleset · Merah · Kuning. Kejadian
   langsung masuk lini masa pada menit berjalan dan bisa dibatalkan lewat tombol
   *Batalkan* di notifikasi. Kuning kedua otomatis menjadi kartu kedua + pemain
   dikeluarkan; Assist otomatis terhubung ke gol yang belum punya assist.
   Kejadian lain (pergantian, penalti, gol bunuh diri) lewat tombol ⋯.
3. Setelah laga selesai, *Konfirmasi Hasil* memperbarui klasemen dan statistik
   pemain **per klub**. Konfirmasi ulang atau koreksi hanya menerapkan selisihnya
   (buku besar `player_match_stats`), jadi tidak ada hitungan ganda.
4. Di **Cup**, hasil seri tidak bisa dikonfirmasi: isi skor *adu penalti* dulu
   (harus ada pemenangnya). Setelah dikonfirmasi, pemenang otomatis maju ke slot
   babak berikutnya di bagan.

**Jadwal.** Ada tiga cara, semuanya di tab *Jadwal & Hasil* sebuah KU dan di tab
*Jadwal Turnamen* (semua KU sekaligus — pilih KU-nya):
- **Buat Jadwal Otomatis** — Liga: round-robin; Cup: bagan berunggulan, unggulan
  teratas mendapat *bye* bila jumlah SSB bukan pangkat dua, slot yang menunggu
  pemenang tampil sebagai "Pemenang SF1" dst.
- **Tambah Pertandingan** — satu per satu (waktu WIB; bentrok jadwal SSB atau
  wasit diberi peringatan). Cup boleh diberi slot bagan, mis. `QF1`.
- **Unggah Jadwal** — CSV (kolom wajib `home_short, away_short, date, time`;
  opsional `round, stage, venue, referee_license, bracket_slot`; boleh dipisah
  `,` atau `;`). Setiap baris dicek terhadap peserta KU sebelum diimpor; waktu
  dibaca sebagai WIB. Templat bisa diunduh dari dialognya.

**Hapus KU / turnamen.** *Hapus KU* ada di header KU, *Hapus turnamen* di header
turnamen (admin & operator). Perlu mengetik kode KU / nama turnamen; ditolak
selama ada laga berlangsung; statistik terkait dikurangkan dari total karier
pemain, sedangkan klasemen, lencana, dan laporan AI ikut terhapus. Menghapus
turnamen menghapus semua KU di dalamnya.

## Unggahan berkas

Foto pemain & pelatih, logo tim, dokumen pemain (KIA, KK, akta kelahiran, ijazah,
rapor), serta lisensi dan KTP pelatih diunggah langsung dari formulir dan disimpan
di database (tabel `media`), disajikan lewat `/api/media/[id]` — tidak butuh layanan
eksternal. Gambar diperkecil otomatis di browser sebelum diunggah (maks 5 MB per
berkas). Dokumen pemain dan pelatih bersifat privat: hanya peran dengan izin
verifikasi (admin & operator) yang dapat membukanya, dan tidak disimpan di cache
browser.

## Logo & ikon

Logo aplikasi adalah `public/logo-font-putih.png` (huruf putih, latar transparan);
di permukaan terang ia dipasang di dalam pil gelap (`LogoChip` di
`components/brand/logo.tsx`). Set ikon — favicon, apple-touch-icon, android-chrome,
ms-icon, dan `manifest.json` — ada di `public/Web/` dan dipasang lewat metadata di
`app/layout.tsx`; `next.config.ts` meneruskan `/favicon.ico`,
`/apple-touch-icon.png`, dan `/manifest.json` ke berkas itu. Nama berkas dan warna
merek terkumpul di `lib/brand.ts`.

## Dua bahasa (Indonesia / English)

Seluruh situs — halaman publik, login, dan panel admin — tersedia dalam Bahasa Indonesia dan English.
Bahasa diganti lewat tombol **ID | EN** di navigasi halaman publik, halaman login, dan bilah atas panel
admin (di ponsel ada di menu samping). Pilihan disimpan di cookie `footgrit-locale`, URL tidak berubah;
tanpa pilihan tersimpan, bahasa mengikuti `Accept-Language` peramban (bawaan: Indonesia).

- Teks Indonesia adalah **kunci**: tulis `t("Simpan perubahan")` di kode, terjemahan Inggrisnya ada di
  `lib/i18n/messages/<area>.ts`. `t("…")` dengan teks yang belum ada di katalog gagal di `npm run typecheck`.
- Server: `const { t, fmt } = await getI18n()` (`lib/i18n/server.ts`); klien: `useT()` / `useI18n()`
  (`lib/i18n/client.tsx`). Tanggal, angka, dan waktu relatif lewat `fmt`. Katalog Inggris hanya dikirim ke
  pengguna yang memilih English.
- Konstanta tingkat modul dibungkus `msg("…")` lalu ditampilkan dengan `t(...)`; bentuk jamak Inggris
  ditulis `{n|satu|banyak}`; dua arti Inggris untuk satu kata Indonesia dibedakan dengan akhiran `::konteks`.
- Jejak audit disimpan dalam Bahasa Indonesia (`auditText("…")`) dan diterjemahkan saat ditampilkan
  (`lib/audit-display.ts`, templat di `lib/i18n/messages/audit.ts`) — entri lama ikut diterjemahkan.
- Data yang diketik pengguna (nama, catatan) dan laporan AI yang sudah dibuat tetap dalam bahasa aslinya.
- `npm run check:i18n` memeriksa katalog: teks ganda antar-berkas, placeholder, bentuk jamak, tag.

## Integrasi opsional

| Layanan | Tanpa konfigurasi | Dengan konfigurasi |
|---------|-------------------|--------------------|
| **Google Gemini** | AI Scout jalan dalam mode berbasis data (percentil, per-90, tren) | Set `GEMINI_API_KEY` — laporan otomatis pakai Gemini |

## Stack

Next.js 16 (App Router, Turbopack, `proxy.ts`) · React 19 · Tailwind v4 ·
Drizzle ORM + MariaDB/MySQL (`mysql2`) · Auth.js v5 (Credentials + JWT, RBAC) ·
recharts + SVG kustom · unggahan berkas di database · Google Gemini (opsional).

## Skrip

| Perintah | Fungsi |
|----------|--------|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run db:generate` | Buat berkas migrasi dari perubahan skema |
| `npm run db:migrate` | Terapkan migrasi ke database (jalankan setelah menarik perubahan skema; cadangkan dulu bila sudah berisi data — lihat catatan migrasi 0004) |
| `npm run db:seed` | Reset + isi ulang seluruh data contoh (hanya lokal; menolak berjalan di produksi / database non-lokal) |
| `npm run db:copy-from-neon` | **Dinonaktifkan** — skema berubah (13 posisi, NISN wajib, klub kedua). Pindahkan data dengan `mysqldump` + impor SQL |
| `npm run db:studio` | Drizzle Studio |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check:i18n` | Periksa katalog terjemahan (teks ganda, placeholder, bentuk jamak) |
| `npm run test:security` | Uji keamanan: path `next` aman, pembatas login, CSP, cek env produksi, penjaga seed, tidak ada kredensial demo di bundle klien |
| `npm run test:logic` | Uji logika murni: klasemen, bagan Cup, impor jadwal, jadwal manual, status Turnamen / KU |

> Catatan: `npm run db:seed` melakukan `TRUNCATE` seluruh tabel lalu mengisi ulang.
> Setelah re-seed, sesi login lama tetap valid (identitas diselesaikan via email),
> tetapi ID entitas berubah — muat ulang halaman detail bila perlu.
