# LigaLokal

**Unified Football Intelligence Platform** — sistem operasi terpadu untuk manajemen
kompetisi, data pemain, dan kecerdasan talenta sepak bola akar rumput.

Dibangun dari `documents/Proposal_FOOTGRIT-OS-FINAL.pdf` untuk PT DVONES Indonesia.
Lingkungan demo, siap ditunjukkan ke calon klien.

## Tujuh modul kerja

| Modul | Rute | Isi |
|-------|------|-----|
| Command Center | `/command-center` | Dasbor operasional real-time, live match monitor, papan peringkat, kepatuhan verifikasi |
| Master Data & Registry | `/registry/*` | Pemain (13 posisi, NISN wajib & unik, hingga 2 klub, kaki dominan, foto, 5 dokumen privat), klub (logo tim), pelatih, wasit, venue, aturan kategori usia (KU-8…KU-20, bisa ditambah sendiri) |
| Data Ingestion & Staging | `/ingestion` | Impor CSV dengan pipeline **8 tahap** — validasi skema, fuzzy dedupe, antrian tinjauan, commit + audit |
| Competition & Rules | `/kompetisi` | Format Cup / League / Hybrid / Knockout, fixture otomatis atau **unggah jadwal CSV**, klasemen real-time + tie-breaker, bagan gugur, hapus turnamen |
| Match Operations | `/match-ops` | Konsol pertandingan langsung: penugasan wasit & operator, timer, skor, daftar pemain per klub dengan **8 tombol kejadian sekali ketuk**, lini masa, validasi hasil |
| Player Intelligence & Radar | `/player-intelligence` | Radar performa, perbandingan head-to-head, **mesin formula penilaian**, galeri lencana |
| AI Scout & Insights | `/ai-scout` | Pencarian talenta bahasa natural, laporan analisis pemain / laga / kompetisi |

## Menjalankan

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
npm run db:seed      # isi data demo lengkap
npm run dev          # http://localhost:3000
```

## Deploy ke Hostinger (paket Unlimited / Node.js Web App)

1. **Database** — hPanel → Databases → MySQL Databases: buat database + user
   (nama berprefiks seperti `u123456789_ligalokal`).
2. **Skema + data** — hPanel → Databases → Remote MySQL: izinkan IP komputer
   Anda. Arahkan `DATABASE_URL` sementara ke host remote yang tertera di halaman
   itu, lalu jalankan `npm run db:migrate` dan `npm run db:seed` (data demo).
   Untuk membawa data yang sudah ada, ekspor database lokal (`mysqldump`) lalu
   impor lewat phpMyAdmin. Kembalikan `DATABASE_URL` ke lokal setelahnya.
3. **Aplikasi** — hPanel → Websites → tambah Node.js Web App dari repo GitHub
   (Next.js, Node 22, build `npm run build`, start `npm start`). Skrip `build`
   memakai `next build --webpack`: Turbopack menjalankan PostCSS lewat proses
   Node anak yang dimatikan oleh batas proses di hosting bersama
   (`TurbopackInternalError` di `app/globals.css`).
4. **Environment variables** di pengaturan aplikasi:
   `DATABASE_URL=mysql://USER:PASSWORD@localhost:3306/NAMA_DB`, `AUTH_SECRET`,
   `AUTH_URL=https://domain-anda`, `AUTH_TRUST_HOST=true`, serta `CLOUDINARY_*` /
   `GEMINI_API_KEY` bila dipakai. Restart aplikasi setiap kali variabel diubah.

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

## Akun demo

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

**Jadwal.** Di tab *Jadwal & Hasil* sebuah turnamen, tombol **Unggah Jadwal** membaca
CSV (kolom wajib `home_short, away_short, date, time`; opsional `round, stage,
group, venue, referee_license`; boleh dipisah `,` atau `;`). Setiap baris dicek
terhadap peserta turnamen sebelum diimpor; waktu dibaca sebagai WIB. Templat
bisa diunduh dari dialognya.

**Hapus turnamen.** Di header turnamen (admin & operator). Perlu mengetik nama
turnamen; ditolak selama ada laga berlangsung; statistik turnamen itu dikurangkan
dari total karier pemain.

## Unggahan berkas

Foto pemain & pelatih, logo tim, dan dokumen pemain (KIA, KK, akta kelahiran,
ijazah, rapor) diunggah langsung dari formulir dan disimpan di database (tabel
`media`), disajikan lewat `/api/media/[id]` — tidak butuh layanan eksternal. Gambar
diperkecil otomatis di browser sebelum diunggah (maks 5 MB per berkas). Dokumen
pemain bersifat privat: hanya peran dengan izin verifikasi (admin & operator)
yang dapat membukanya, dan tidak disimpan di cache browser.

## Integrasi opsional

| Layanan | Tanpa konfigurasi | Dengan konfigurasi |
|---------|-------------------|--------------------|
| **Google Gemini** | AI Scout jalan dalam mode demo berbasis data (percentil, per-90, tren) | Set `GEMINI_API_KEY` — laporan otomatis pakai Gemini |

## Stack

Next.js 16 (App Router, Turbopack, `proxy.ts`) · React 19 · Tailwind v4 ·
Drizzle ORM + MariaDB/MySQL (`mysql2`) · Auth.js v5 (Credentials + JWT, RBAC) ·
recharts + SVG kustom · unggahan berkas di database · Google Gemini (opsional).

## Skrip

| Perintah | Fungsi |
|----------|--------|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run db:generate` | Buat berkas migrasi dari perubahan skema |
| `npm run db:migrate` | Terapkan migrasi ke database (jalankan setelah menarik perubahan skema) |
| `npm run db:seed` | Reset + isi ulang seluruh data demo |
| `npm run db:copy-from-neon` | **Dinonaktifkan** — skema berubah (13 posisi, NISN wajib, klub kedua). Pindahkan data dengan `mysqldump` + impor SQL |
| `npm run db:studio` | Drizzle Studio |
| `npm run typecheck` | `tsc --noEmit` |

> Catatan: `npm run db:seed` melakukan `TRUNCATE` seluruh tabel lalu mengisi ulang.
> Setelah re-seed, sesi login lama tetap valid (identitas diselesaikan via email),
> tetapi ID entitas berubah — muat ulang halaman detail bila perlu.
