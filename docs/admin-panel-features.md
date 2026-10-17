# LigaLokal — Admin Panel: Features, Settings & Access Control

Generated from the code on branch `update` (2026-10-16). UI labels are Bahasa Indonesia.
Every menu, tab and action in the app is **one permission** ("capability"). A **Super Admin** decides, per role,
which menus open and which actions (create, edit, delete, verify, confirm …) are allowed — on
**Pengaturan → Hak Akses Peran** (`/pengaturan/akses`). The tables below list all 69 permissions and their factory defaults.

---

## 1. Roles

| Role | Label | Visible to others? | Purpose |
|---|---|---|---|
| `super_admin` | Super Admin | **No — hidden from every other role** | Platform owner. Every permission, fixed. The only role that can edit the access matrix. |
| `admin` | Administrator | Yes | Everything except `access:manage` by default — but editable like any other role. |
| `operator` | Operator Kompetisi | Yes | Competitions, schedules, match operations, master data. |
| `referee` | Wasit | Yes | Runs assigned matches, confirms results. |
| `coach` | Pelatih | Yes | Submits DSP for the own SSB, reads analytics. |
| `scout` | Pemandu Bakat | Yes | AI Scout + Player Intelligence. |
| `viewer` | Peninjau | Yes | Read-only dashboards and reports. |

Demo accounts (`lib/demo-accounts.ts`, shown on the login quick-fill) cover admin, operator, referee, coach, scout and viewer.
The Super Admin is deliberately **not** in that list.

## 2. How access works

- **Menu permissions** (`…:view`) decide what a role *sees*: sidebar entries, module tabs, command-palette results,
  global-search results, dashboard panels. A menu with several tabs (Master Data, Player Intelligence, Pengaturan) opens when
  at least one of its tabs is allowed, and only the allowed tabs are shown.
- **Feature permissions** decide what a role can *do* inside a menu: buttons are hidden, the pages behind them
  redirect, and the server action / API route refuses the call even if someone crafts the request.
- A feature always needs the menu it lives in. Switching a feature on in the matrix switches its menu on;
  switching a menu off switches its features off.
- Someone sent away from a page lands on the dashboard (or their first allowed menu) with an "Akses ditolak" notice.
  A role with no menu at all lands on `/tanpa-akses`.
- Changes apply immediately to every account of the role (no re-login needed) and are written to the audit trail.
- `access:manage` can only ever be held by the Super Admin, whatever the matrix says.
- Defaults reproduce the behaviour from before this feature, so nothing changes until the Super Admin changes it.

## 3. Permission catalog (69) and factory defaults

"Super" is always ✓ and cannot be changed. ✓ in a role column = allowed by default; the Super Admin can switch any cell.

#### Command Center

| Izin | Jenis | Fungsi | Super | Admin | Operator | Wasit | Pelatih | Scout | Peninjau |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `dashboard:view` | Menu | **Membuka Command Center** — Dasbor operasional: KPI, pertandingan langsung, sebaran verifikasi, dan papan peringkat. | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `dashboard:activity` | Fitur | **Melihat aktivitas terbaru** — Panel aktivitas di Command Center (siapa mengubah apa dan kapan). _(butuh `dashboard:view`)_ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

#### Daftar Susunan Pemain (DSP)

| Izin | Jenis | Fungsi | Super | Admin | Operator | Wasit | Pelatih | Scout | Peninjau |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `dsp:view` | Menu | **Membuka menu DSP** — Halaman Daftar Susunan Pemain per pertandingan. | ✓ | ✓ |  |  | ✓ |  |  |
| `dsp:submit` | Fitur | **Mengirim / merevisi DSP** — Menyimpan susunan pemain. Untuk akun yang terhubung ke sebuah SSB, DSP berlaku untuk SSB tersebut. _(butuh `dsp:view`)_ | ✓ | ✓ |  |  | ✓ |  |  |
| `dsp:any-club` | Fitur | **Mengisi DSP untuk SSB mana pun** — Memilih sendiri SSB dan pelatih penanggung jawab, tidak terikat pada satu SSB. _(butuh `dsp:submit`)_ | ✓ | ✓ |  |  |  |  |  |

#### Master Data — Pemain

| Izin | Jenis | Fungsi | Super | Admin | Operator | Wasit | Pelatih | Scout | Peninjau |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `registry.player:view` | Menu | **Membuka daftar & profil pemain** — Tab Pemain: daftar, pencarian, profil, statistik per kompetisi. | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `registry.player:create` | Fitur | **Mendaftarkan pemain baru** — Tombol Tambah Pemain dan formulir registrasi (termasuk unggah foto & dokumen). _(butuh `registry.player:view`)_ | ✓ | ✓ | ✓ |  |  |  |  |
| `registry.player:edit` | Fitur | **Mengubah data pemain** — Tombol Ubah data pada profil pemain (termasuk unggah foto & dokumen). _(butuh `registry.player:view`)_ | ✓ | ✓ | ✓ |  |  |  |  |
| `registry.player:verify` | Fitur | **Memverifikasi pemain** — Menyetujui, menandai, atau menolak status verifikasi pemain. _(butuh `registry.player:view`)_ | ✓ | ✓ | ✓ |  |  |  |  |

#### Master Data — SSB

| Izin | Jenis | Fungsi | Super | Admin | Operator | Wasit | Pelatih | Scout | Peninjau |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `registry.club:view` | Menu | **Membuka daftar & profil SSB** — Tab SSB: daftar, profil, riwayat kompetisi. | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `registry.club:create` | Fitur | **Mendaftarkan SSB baru** — Tombol Tambah SSB dan formulir registrasi. _(butuh `registry.club:view`)_ | ✓ | ✓ | ✓ |  |  |  |  |
| `registry.club:edit` | Fitur | **Mengubah data SSB** — Mengubah profil, logo, dan dokumen SSB. _(butuh `registry.club:view`)_ | ✓ | ✓ | ✓ |  |  |  |  |

#### Master Data — Pelatih

| Izin | Jenis | Fungsi | Super | Admin | Operator | Wasit | Pelatih | Scout | Peninjau |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `registry.coach:view` | Menu | **Membuka daftar & profil pelatih** — Tab Pelatih: daftar dan profil pelatih. | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `registry.coach:create` | Fitur | **Mendaftarkan pelatih baru** — Tombol Tambah Pelatih dan formulir registrasi. _(butuh `registry.coach:view`)_ | ✓ | ✓ | ✓ |  |  |  |  |
| `registry.coach:edit` | Fitur | **Mengubah data pelatih** — Mengubah profil, lisensi, dan dokumen pelatih. _(butuh `registry.coach:view`)_ | ✓ | ✓ | ✓ |  |  |  |  |
| `registry.coach:account` | Fitur | **Mengelola akun login pelatih** — Membuat/mengubah email, kata sandi, dan status akun login pelatih (untuk mengisi DSP). _(butuh `registry.coach:view`)_ | ✓ | ✓ |  |  |  |  |  |

#### Master Data — Wasit

| Izin | Jenis | Fungsi | Super | Admin | Operator | Wasit | Pelatih | Scout | Peninjau |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `registry.referee:view` | Menu | **Membuka daftar & profil wasit** — Tab Wasit: daftar dan profil wasit. | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `registry.referee:create` | Fitur | **Mendaftarkan wasit baru** — Tombol Tambah Wasit dan formulir registrasi. _(butuh `registry.referee:view`)_ | ✓ | ✓ | ✓ |  |  |  |  |
| `registry.referee:edit` | Fitur | **Mengubah data wasit** — Mengubah profil dan lisensi wasit. _(butuh `registry.referee:view`)_ | ✓ | ✓ | ✓ |  |  |  |  |

#### Master Data — Operator

| Izin | Jenis | Fungsi | Super | Admin | Operator | Wasit | Pelatih | Scout | Peninjau |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `registry.operator:view` | Menu | **Membuka daftar operator** — Tab Operator: daftar akun operator pertandingan. | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `registry.operator:create` | Fitur | **Membuat akun operator** — Membuat akun login operator (nama, email, kata sandi). _(butuh `registry.operator:view`)_ | ✓ | ✓ |  |  |  |  |  |
| `registry.operator:edit` | Fitur | **Mengubah / menonaktifkan akun operator** — Mengubah nama, email, kata sandi, dan status aktif operator. _(butuh `registry.operator:view`)_ | ✓ | ✓ |  |  |  |  |  |

#### Master Data — Venue

| Izin | Jenis | Fungsi | Super | Admin | Operator | Wasit | Pelatih | Scout | Peninjau |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `registry.venue:view` | Menu | **Membuka daftar & detail venue** — Tab Venue: daftar dan detail venue. | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `registry.venue:create` | Fitur | **Menambah venue** — Tombol Tambah Venue dan formulirnya. _(butuh `registry.venue:view`)_ | ✓ | ✓ | ✓ |  |  |  |  |
| `registry.venue:edit` | Fitur | **Mengubah venue** — Mengubah data dan foto sampul venue. _(butuh `registry.venue:view`)_ | ✓ | ✓ | ✓ |  |  |  |  |

#### Master Data — Kategori Usia

| Izin | Jenis | Fungsi | Super | Admin | Operator | Wasit | Pelatih | Scout | Peninjau |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `registry.category:view` | Menu | **Membuka kategori usia** — Tab Kategori Usia: aturan KU-8 … KU-16. | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `registry.category:create` | Fitur | **Menambah kategori usia** — Membuat kategori usia baru beserta aturan pertandingannya. _(butuh `registry.category:view`)_ | ✓ | ✓ | ✓ |  |  |  |  |
| `registry.category:edit` | Fitur | **Mengubah kategori usia** — Mengubah batas usia dan aturan pertandingan. _(butuh `registry.category:view`)_ | ✓ | ✓ | ✓ |  |  |  |  |
| `registry.category:delete` | Fitur | **Menghapus kategori usia** — Menghapus kategori usia yang belum dipakai. _(butuh `registry.category:view`)_ | ✓ | ✓ | ✓ |  |  |  |  |

#### Master Data — Dokumen Pribadi

| Izin | Jenis | Fungsi | Super | Admin | Operator | Wasit | Pelatih | Scout | Peninjau |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `registry:documents` | Fitur | **Membuka dokumen identitas & lisensi** — KIA, KK, akta, ijazah, rapor pemain; KTP dan lisensi pelatih; dokumen SSB. Berkas bersifat privat. | ✓ | ✓ | ✓ |  |  |  |  |

#### Data Ingestion & Staging

| Izin | Jenis | Fungsi | Super | Admin | Operator | Wasit | Pelatih | Scout | Peninjau |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `ingestion:view` | Menu | **Membuka Data Ingestion** — Riwayat impor, detail batch, pipeline QA, dan baris staging. | ✓ | ✓ | ✓ |  |  |  |  |
| `ingestion:upload` | Fitur | **Mengunggah berkas CSV** — Membuat batch impor baru dari berkas CSV. _(butuh `ingestion:view`)_ | ✓ | ✓ | ✓ |  |  |  |  |
| `ingestion:review` | Fitur | **Menjalankan validasi & meninjau baris** — Menjalankan pipeline QA, menyetujui/menolak/menggabungkan baris (satuan atau massal). _(butuh `ingestion:view`)_ | ✓ | ✓ | ✓ |  |  |  |  |
| `ingestion:commit` | Fitur | **Commit batch ke sistem** — Memasukkan baris yang valid ke registry. _(butuh `ingestion:view`)_ | ✓ | ✓ | ✓ |  |  |  |  |

#### Competition & Rules — Turnamen

| Izin | Jenis | Fungsi | Super | Admin | Operator | Wasit | Pelatih | Scout | Peninjau |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `competition:view` | Menu | **Membuka Competition & Rules** — Daftar turnamen, KU, jadwal, klasemen, bagan, dan peserta. | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `competition:create` | Fitur | **Membuat turnamen** — Tombol Turnamen Baru. _(butuh `competition:view`)_ | ✓ | ✓ | ✓ |  |  |  |  |
| `competition:edit` | Fitur | **Mengubah turnamen** — Mengubah nama, musim, penyelenggara, dan deskripsi turnamen. _(butuh `competition:view`)_ | ✓ | ✓ | ✓ |  |  |  |  |
| `competition:delete` | Fitur | **Menghapus turnamen** — Menghapus turnamen beserta seluruh KU, jadwal, dan hasilnya. _(butuh `competition:view`)_ | ✓ | ✓ | ✓ |  |  |  |  |

#### Competition & Rules — KU, Peserta & Jadwal

| Izin | Jenis | Fungsi | Super | Admin | Operator | Wasit | Pelatih | Scout | Peninjau |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `ku:create` | Fitur | **Menambah KU** — Membuat KU baru di dalam turnamen (kategori usia, format Liga/Cup, tanggal). _(butuh `competition:view`)_ | ✓ | ✓ | ✓ |  |  |  |  |
| `ku:status` | Fitur | **Mengubah status siklus KU** — Menggeser KU antar tahap: draft, pendaftaran, verifikasi, siap, berlangsung, selesai, arsip. _(butuh `competition:view`)_ | ✓ | ✓ | ✓ |  |  |  |  |
| `ku:teams` | Fitur | **Mengelola peserta KU** — Menambah dan mengeluarkan SSB peserta. _(butuh `competition:view`)_ | ✓ | ✓ | ✓ |  |  |  |  |
| `ku:fixtures` | Fitur | **Membuat jadwal otomatis & hitung ulang klasemen** — Menghasilkan fixture Liga/Cup otomatis dan menghitung ulang klasemen. _(butuh `competition:view`)_ | ✓ | ✓ | ✓ |  |  |  |  |
| `ku:schedule` | Fitur | **Menambah pertandingan manual & impor jadwal CSV** — Tombol Tambah Pertandingan dan unggah jadwal dari berkas CSV. _(butuh `competition:view`)_ | ✓ | ✓ | ✓ |  |  |  |  |
| `ku:match-delete` | Fitur | **Menghapus pertandingan terjadwal** — Menghapus pertandingan yang belum dimulai dari jadwal. _(butuh `competition:view`)_ | ✓ | ✓ | ✓ |  |  |  |  |
| `ku:delete` | Fitur | **Menghapus KU** — Menghapus KU beserta jadwal dan hasilnya. _(butuh `competition:view`)_ | ✓ | ✓ | ✓ |  |  |  |  |

#### Match Operations

| Izin | Jenis | Fungsi | Super | Admin | Operator | Wasit | Pelatih | Scout | Peninjau |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `match:view` | Menu | **Membuka Match Operations** — Daftar pertandingan, konsol, lini masa, dan statistik pertandingan. | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `match:assign` | Fitur | **Menugaskan wasit & operator** — Menentukan wasit dan operator pencatat untuk pertandingan terjadwal. _(butuh `match:view`)_ | ✓ | ✓ | ✓ |  |  |  |  |
| `match:squad` | Fitur | **Memilih pemain pertandingan** — Menentukan starter dan cadangan kedua tim sebelum kick-off. _(butuh `match:view`)_ | ✓ | ✓ | ✓ |  |  |  |  |
| `match:operate` | Fitur | **Mengendalikan jam pertandingan** — Memulai, menjeda, melanjutkan babak kedua, dan mengakhiri pertandingan. _(butuh `match:view`)_ | ✓ | ✓ | ✓ | ✓ |  |  |  |
| `match:events` | Fitur | **Mencatat kejadian** — Gol, kartu, pergantian pemain, dan kejadian lain (satu ketukan maupun formulir lengkap). _(butuh `match:view`)_ | ✓ | ✓ | ✓ | ✓ |  |  |  |
| `match:void` | Fitur | **Membatalkan kejadian dari lini masa** — Membatalkan (void) kejadian yang salah catat lewat lini masa. _(butuh `match:view`)_ | ✓ | ✓ | ✓ | ✓ |  |  |  |
| `match:undo-any` | Fitur | **Membatalkan kejadian milik pencatat lain** — Tanpa izin ini, batal cepat hanya untuk kejadian yang dicatat sendiri. _(butuh `match:events`)_ | ✓ | ✓ |  |  |  |  |  |
| `match:confirm` | Fitur | **Mengonfirmasi hasil & adu penalti** — Mengonfirmasi hasil akhir dan mengisi skor adu penalti pertandingan gugur. _(butuh `match:view`)_ | ✓ | ✓ | ✓ | ✓ |  |  |  |
| `match:amend` | Fitur | **Mengoreksi hasil terkonfirmasi** — Mengubah hasil yang sudah dikonfirmasi (alasan wajib dan tercatat di audit). _(butuh `match:view`)_ | ✓ | ✓ | ✓ | ✓ |  |  |  |

#### Player Intelligence

| Izin | Jenis | Fungsi | Super | Admin | Operator | Wasit | Pelatih | Scout | Peninjau |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `intelligence.radar:view` | Menu | **Membuka Radar Performa** — Tab Radar Performa dengan filter pemain. | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `intelligence.compare:view` | Menu | **Membuka Perbandingan Pemain** — Tab untuk membandingkan pemain berdampingan. | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `intelligence.formula:view` | Menu | **Membuka Formula Penilaian** — Tab formula dan pratinjau dampaknya pada papan peringkat. | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `intelligence.formula:edit` | Fitur | **Mengubah formula penilaian** — Mengubah nama dan bobot metrik lalu menyimpannya (naik versi). _(butuh `intelligence.formula:view`)_ | ✓ | ✓ |  |  |  |  |  |
| `intelligence.formula:activate` | Fitur | **Mengaktifkan formula penilaian** — Menjadikan satu formula aktif; skor & rating seluruh pemain dihitung ulang. _(butuh `intelligence.formula:view`)_ | ✓ | ✓ |  |  |  |  |  |
| `intelligence.badge:view` | Menu | **Membuka Galeri Lencana** — Tab lencana dan para penerimanya. | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `intelligence.badge:select` | Fitur | **Memilih pemain terbaik (MVP)** — Menetapkan lencana pemain terbaik secara manual. _(butuh `intelligence.badge:view`)_ | ✓ | ✓ | ✓ |  |  |  |  |

#### AI Scout & Insights

| Izin | Jenis | Fungsi | Super | Admin | Operator | Wasit | Pelatih | Scout | Peninjau |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `scout:view` | Menu | **Membuka AI Scout & Insights** — Daftar laporan, shortlist tersimpan, dan detail laporan. | ✓ | ✓ | ✓ |  | ✓ | ✓ |  |
| `scout:search` | Fitur | **Mencari talenta** — Pencarian talenta dengan bahasa natural. _(butuh `scout:view`)_ | ✓ | ✓ | ✓ |  | ✓ | ✓ |  |
| `scout:shortlist` | Fitur | **Menyimpan shortlist** — Menyimpan hasil pencarian sebagai shortlist. _(butuh `scout:view`)_ | ✓ | ✓ | ✓ |  | ✓ | ✓ |  |
| `scout:report` | Fitur | **Membuat laporan AI** — Membuat laporan analisis pemain, ringkasan laga, dan wawasan kompetisi. _(butuh `scout:view`)_ | ✓ | ✓ | ✓ |  | ✓ | ✓ |  |

#### Pengaturan & Keamanan

| Izin | Jenis | Fungsi | Super | Admin | Operator | Wasit | Pelatih | Scout | Peninjau |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `settings:view` | Menu | **Membuka Pengaturan** — Halaman Pengaturan: profil organisasi, ringkasan data, dan konfigurasi sistem. | ✓ | ✓ | ✓ |  |  |  |  |
| `settings:users` | Fitur | **Melihat daftar pengguna** — Tabel pengguna & peran (nama, email, status, login terakhir) di Pengaturan. _(butuh `settings:view`)_ | ✓ | ✓ | ✓ |  |  |  |  |
| `audit:view` | Fitur | **Membuka jejak audit** — Log audit menyeluruh: pelaku, aksi, dan waktu. _(butuh `settings:view`)_ | ✓ | ✓ | ✓ |  |  |  |  |
| `access:manage` | Fitur | **Mengatur hak akses peran** — Mengubah matriks izin pada layar Hak Akses Peran. Khusus Super Admin. _(butuh `settings:view`)_ | ✓ |  |  |  |  |  |  |


## 4. Menus and what is behind them

| # | Menu (sidebar) | Route | Opens with | Tabs / sub-pages (own permission) |
|---|---|---|---|---|
| 1 | Daftar Susunan Pemain | `/dsp` | `dsp:view` | — |
| 2 | Command Center | `/command-center` | `dashboard:view` | — |
| 3 | Master Data & Registry | `/registry/*` | any registry tab | Pemain `registry.player:view`, SSB `registry.club:view`, Pelatih `registry.coach:view`, Wasit `registry.referee:view`, Operator `registry.operator:view`, Venue `registry.venue:view`, Kategori Usia `registry.category:view` |
| 4 | Data Ingestion & Staging | `/ingestion` | `ingestion:view` | batch detail `/ingestion/[batchId]` |
| 5 | Competition & Rules | `/kompetisi` | `competition:view` | turnamen → KU (Ringkasan, Jadwal & Hasil, Klasemen, Bagan Cup, Peserta) |
| 6 | Match Operations | `/match-ops` | `match:view` | match console `/match-ops/[id]` |
| 7 | Player Intelligence | `/player-intelligence` | any tab | Radar Performa `intelligence.radar:view`, Perbandingan `intelligence.compare:view`, Formula `intelligence.formula:view`, Lencana `intelligence.badge:view` |
| 8 | AI Scout & Insights | `/ai-scout` | `scout:view` | report detail `/ai-scout/laporan/[id]` |
| 9 | Pengaturan | `/pengaturan` | `settings:view` | Umum, Jejak Audit (`audit:view`), Hak Akses Peran (`access:manage`) |

Shell: floating sidebar (lg+), bottom nav + menu sheet (mobile), top bar with command palette (⌘/Ctrl+K — searches
players, SSB, tournaments, referees, coaches, venues, but only the kinds the role may open), active-formula chip
(needs `intelligence.formula:view`), shortcuts help and user menu.

## 5. Features by menu (what each permission switches)

### Command Center
KPI tiles, live match monitor, verification donut, tournament-status mix, leaderboards (top scorers/assists/saves/rated),
auto-refresh every 20 s. The **activity feed** (latest audit entries) needs `dashboard:activity`; actions by the hidden
Super Admin are shown without the actor.

### DSP
`dsp:view` opens the page; `dsp:submit` allows saving/revising a squad (without it the form is locked);
`dsp:any-club` lets the person pick either SSB of any match and the responsible coach (otherwise the account's own SSB is used —
the account must be linked to an SSB).

### Master Data & Registry
- **Pemain**: list/search/profile/per-competition stats (`view`); *Pemain Baru* + registration form incl. photo & documents (`create`);
  *Ubah data* (`edit`); verification verified/flagged/pending/rejected (`verify`); NISN live check (create or edit).
- **SSB**: list/profile (`view`); create; edit profile, logo, documents. "Tambah pelatih" on the SSB page needs `registry.coach:create`.
- **Pelatih**: list/profile; create; edit; **login account** card — email, password, active (`registry.coach:account`).
- **Wasit**: list/profile; create; edit (licence status active/expiring/expired/revoked).
- **Operator**: list (`view`); create operator account (`create`); edit/deactivate (`edit`).
- **Venue**: list/detail; create; edit (cover photo, surface, capacity, floodlights).
- **Kategori Usia**: list of rules; create; edit; delete.
- **Dokumen pribadi** (`registry:documents`): opening KIA/KK/akta/ijazah/rapor, coach KTP/licence and club documents
  (the file route `/api/media/[id]` enforces it). Uploading photos/files in forms needs create or edit on the record's kind.

### Data Ingestion & Staging
`view` = history, batch detail, QA pipeline, staging rows. `upload` = new CSV batch (players, clubs, referees, venues, matches).
`review` = run validation (stages 2–6) and resolve rows — approve / reject / merge duplicate, single or bulk. `commit` = write valid rows to the registry.
Templates for the CSVs are downloadable from the page.

### Competition & Rules
- **Turnamen**: view (list, KU & Ringkasan, Jadwal Turnamen); `create` (Turnamen Baru); `edit` (Ubah); `delete` (typed-confirmation).
- **KU**: `ku:create` (Tambah KU: age category, Liga/Cup, dates); `ku:status` (draft → registration → verification → ready → ongoing → completed → archived);
  `ku:teams` (add/remove SSB); `ku:fixtures` (generate fixtures, recompute standings); `ku:schedule` (add match manually, CSV schedule import with preview);
  `ku:match-delete` (delete a scheduled match); `ku:delete` (delete KU, typed confirmation).
- Tabs per KU: Ringkasan, Jadwal & Hasil, Klasemen (league/groups), Bagan Cup (knockout), Peserta.

### Match Operations
`view`: match list with filters, live scoreboard, timeline, statistics, goal scorers. `assign`: referee + operators. `squad`: starters/substitutes
before kick-off. `operate`: start, end first half, start second half, end match. `events`: one-tap quick events and the full event form
(goal, own goal, penalty goal/missed, assist, shots, save, cards, foul, offside, corner, substitution, injury, VAR, interception) and quick undo.
`void`: cancel an event from the timeline. `undo-any`: quick-undo events recorded by others. `confirm`: confirm the result and enter shoot-out scores.
`amend`: correct an already confirmed result (reason required).

### Player Intelligence
Radar (filters, player picker), compare, formula view with impact preview, `formula:edit` (name + weights, saved as a new version),
`formula:activate` (recomputes every player's score & rating), badge gallery, `badge:select` (manual MVP).

### AI Scout & Insights
`view`: reports list, saved shortlists, report detail. `search`: natural-language talent search. `shortlist`: save a shortlist.
`report`: generate player analysis, match summary and competition insight reports (Gemini when `GEMINI_API_KEY` is set, otherwise the built-in generator).

### Pengaturan
| Item | Status |
|---|---|
| Profil Organisasi (instansi, penyelenggara, lingkungan, zona waktu, bahasa, klasifikasi) | **Display only** (hard-coded, not editable) |
| Ringkasan Data (counts; tiles link to a module only if the role may open it) | Read-only |
| Konfigurasi Sistem → formula / aturan kategori usia / jejak audit / **hak akses peran** | Links, each shown only to roles with the matching permission |
| Integrasi Google Gemini AI / Cloudinary | **Static badges** — not wired to real env state |
| Manajemen Pengguna & Peran (`settings:users`) | Read-only table; the Super Admin account is hidden |
| Jejak Audit (`audit:view`) | Searchable, filter by action, 30/page, immutable; hidden-actor masking |
| **Hak Akses Peran** (`access:manage`) | The matrix editor — Super Admin only |

## 6. The access-matrix screen (Super Admin only)

- Route `/pengaturan/akses`. Columns: Super Admin (fixed) + Administrator, Operator, Wasit, Pelatih, Pemandu Bakat, Peninjau.
  Rows: all 69 permissions in 17 groups, tagged **Menu** or **Fitur**.
- Per group: a tri-state checkbox per role switches the whole group; groups collapse; search filters menus/features by name, description or key.
- Per role: *Bawaan* (factory default), *Semua*, *Kosong*; global *Kembalikan semua ke bawaan*.
- Cells that differ from the factory default are highlighted; unsaved roles are flagged "diubah"; nothing applies until **Simpan perubahan**.
- Saving validates every key on the server, strips anything a role can never hold, re-applies dependencies, stores only deviations from the defaults
  in `role_permissions`, writes an `access.update` audit entry (actor masked for everyone else) and revalidates the whole app.
- If the table does not exist yet (migration not applied) the app runs on the factory defaults.

## 7. Hidden Super Admin

- Role `super_admin`, created by `npm run db:seed:super` with `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` from the environment
  (never committed; the script is idempotent and rotates the password of an existing Super Admin).
- Hidden from: the Settings user table, the audit trail and dashboard activity (actor masked), operator pickers (cannot be assigned as match operator),
  the login quick-fill, and the access screen for everyone else (the route redirects).
- Treated as unrestricted in code paths that used to special-case `admin` (DSP, quick-undo).

## 8. Rolling it out

1. `npm run db:migrate` — applies `drizzle/0007_role_permissions_super_admin.sql` (new table + `super_admin` in the role enums). Additive; back up first if the target is production.
2. `SUPER_ADMIN_EMAIL=… SUPER_ADMIN_PASSWORD=… npm run db:seed:super`.
3. Sign in as the Super Admin → Pengaturan → Hak Akses Peran.
4. `npm run test:access` runs the 50+ logic checks for the catalog, defaults, dependencies and menus.
