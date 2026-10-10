/* Static reference pools for the demo seed (Indonesian grassroots football). */

export const FIRST_NAMES = [
  "Arya", "Bagus", "Candra", "Dimas", "Eka", "Fajar", "Gilang", "Hendra",
  "Ilham", "Joko", "Krisna", "Lukman", "Miftah", "Naufal", "Oka", "Panji",
  "Qori", "Rizky", "Satria", "Taufik", "Umar", "Vino", "Wahyu", "Yoga",
  "Zaki", "Aldi", "Bimo", "Cahyo", "Deni", "Erlangga", "Ferdi", "Galih",
  "Hafiz", "Irfan", "Julian", "Kevin", "Leo", "Made", "Nanda", "Okto",
  "Putra", "Raka", "Sandi", "Teguh", "Yusuf", "Bayu", "Reza", "Adit",
  "Farrel", "Gibran", "Hilmi", "Iqbal", "Jefri", "Kemal", "Lintang",
];

export const LAST_NAMES = [
  "Pratama", "Wijaya", "Saputra", "Nugroho", "Hidayat", "Ramadhan", "Kurniawan",
  "Setiawan", "Firmansyah", "Maulana", "Santoso", "Gunawan", "Halim", "Permana",
  "Wibowo", "Susanto", "Anggara", "Putra", "Syahputra", "Hakim", "Prasetyo",
  "Utomo", "Nashrullah", "Fadillah", "Rahardjo", "Siregar", "Nasution",
  "Simanjuntak", "Lubis", "Panjaitan", "Tanjung", "Mahendra", "Wardana",
  "Aditya", "Kusuma", "Pangestu", "Dwiputra", "Baskoro", "Nurcahyo",
];

export const CITIES = [
  ["Jakarta Selatan", "DKI Jakarta"],
  ["Jakarta Timur", "DKI Jakarta"],
  ["Depok", "Jawa Barat"],
  ["Bogor", "Jawa Barat"],
  ["Bekasi", "Jawa Barat"],
  ["Tangerang", "Banten"],
  ["Tangerang Selatan", "Banten"],
  ["Bandung", "Jawa Barat"],
] as const;

export const VENUES = [
  { name: "Stadion Mini Cibinong", city: "Bogor", province: "Jawa Barat", capacity: 3000, fieldCount: 2, surface: "natural" as const, floodlights: true },
  { name: "Lapangan ABC Senayan", city: "Jakarta Selatan", province: "DKI Jakarta", capacity: 1500, fieldCount: 3, surface: "artificial" as const, floodlights: true },
  { name: "Depok Sport Center", city: "Depok", province: "Jawa Barat", capacity: 2000, fieldCount: 2, surface: "hybrid" as const, floodlights: true },
  { name: "Lapangan Rawa Badak", city: "Jakarta Timur", province: "DKI Jakarta", capacity: 800, fieldCount: 1, surface: "natural" as const, floodlights: false },
  { name: "Bekasi Youth Arena", city: "Bekasi", province: "Jawa Barat", capacity: 2500, fieldCount: 2, surface: "artificial" as const, floodlights: true },
  { name: "Lapangan Ciputat Raya", city: "Tangerang Selatan", province: "Banten", capacity: 1200, fieldCount: 1, surface: "natural" as const, floodlights: false },
  { name: "GOR Pajajaran Bogor", city: "Bogor", province: "Jawa Barat", capacity: 1800, fieldCount: 1, surface: "artificial" as const, floodlights: true },
  { name: "Tangerang Football Base", city: "Tangerang", province: "Banten", capacity: 2200, fieldCount: 3, surface: "hybrid" as const, floodlights: true },
];

export const CLUBS = [
  { name: "Garuda Muda Football Academy", short: "GMF", type: "academy" as const, city: "Jakarta Selatan", province: "DKI Jakarta", founded: 2009 },
  { name: "Depok Bhayangkara Junior", short: "DBJ", type: "club" as const, city: "Depok", province: "Jawa Barat", founded: 2012 },
  { name: "Cibinong Putra FC", short: "CPF", type: "club" as const, city: "Bogor", province: "Jawa Barat", founded: 2005 },
  { name: "Rajawali Bekasi Soccer School", short: "RBS", type: "academy" as const, city: "Bekasi", province: "Jawa Barat", founded: 2015 },
  { name: "Tangerang Elang Muda", short: "TEM", type: "club" as const, city: "Tangerang", province: "Banten", founded: 2010 },
  { name: "Jakarta Timur United Youth", short: "JTU", type: "club" as const, city: "Jakarta Timur", province: "DKI Jakarta", founded: 2008 },
  { name: "Persib Junior Development", short: "PJD", type: "academy" as const, city: "Bandung", province: "Jawa Barat", founded: 2000 },
  { name: "Ciputat Raya FA", short: "CRF", type: "academy" as const, city: "Tangerang Selatan", province: "Banten", founded: 2016 },
  { name: "Bogor Kencana FC", short: "BKF", type: "club" as const, city: "Bogor", province: "Jawa Barat", founded: 2007 },
  { name: "Bintang Selatan Academy", short: "BSA", type: "academy" as const, city: "Jakarta Selatan", province: "DKI Jakarta", founded: 2013 },
  { name: "Metro Bekasi Junior", short: "MBJ", type: "club" as const, city: "Bekasi", province: "Jawa Barat", founded: 2011 },
  { name: "Depok Garuda Sakti", short: "DGS", type: "club" as const, city: "Depok", province: "Jawa Barat", founded: 2014 },
];

export const REFEREE_LEVELS = ["C-3", "C-2", "C-1", "Nasional"];

/**
 * `minAge` is only used here, to spread the generated players' birth years over
 * the youngest ages of a category; the database stores just the upper limit.
 */
export const AGE_CATEGORIES = [
  {
    code: "KU-8", label: "Kelompok Umur 8", minAge: 6, maxAge: 8,
    rules: { matchDuration: 40, halfDuration: 20, playersOnField: 7, maxSquad: 12, substitutions: "Rolling, tidak dibatasi", ballSize: 3, fieldType: "Lapangan mini (30×20 m)", notes: ["Tanpa kartu", "Fokus partisipasi & fun football"] },
  },
  {
    code: "KU-10", label: "Kelompok Umur 10", minAge: 9, maxAge: 10,
    rules: { matchDuration: 50, halfDuration: 25, playersOnField: 7, maxSquad: 14, substitutions: "Rolling, tidak dibatasi", ballSize: 4, fieldType: "Lapangan 7v7 (55×37 m)", notes: ["Kartu kuning bersifat pembinaan", "Offside dinonaktifkan"] },
  },
  {
    code: "KU-12", label: "Kelompok Umur 12", minAge: 11, maxAge: 12,
    rules: { matchDuration: 60, halfDuration: 30, playersOnField: 9, maxSquad: 16, substitutions: "Maksimal 7 pemain", ballSize: 4, fieldType: "Lapangan 9v9 (75×50 m)", notes: ["Offside diberlakukan", "Tendangan bebas tidak langsung dari back-pass"] },
  },
  {
    code: "KU-14", label: "Kelompok Umur 14", minAge: 13, maxAge: 14,
    rules: { matchDuration: 70, halfDuration: 35, playersOnField: 11, maxSquad: 18, substitutions: "Maksimal 5 pemain (3 kesempatan)", ballSize: 5, fieldType: "Lapangan penuh", notes: ["Aturan pertandingan mengikuti Laws of the Game", "Wajib pelindung tulang kering"] },
  },
  {
    code: "KU-16", label: "Kelompok Umur 16", minAge: 15, maxAge: 16,
    rules: { matchDuration: 80, halfDuration: 40, playersOnField: 11, maxSquad: 20, substitutions: "Maksimal 5 pemain (3 kesempatan)", ballSize: 5, fieldType: "Lapangan penuh", notes: ["Aturan pertandingan mengikuti Laws of the Game", "Kartu akumulatif berlaku antar pertandingan"] },
  },
];

export const BADGES = [
  { code: "top_scorer", name: "Pencetak Gol Terbanyak", description: "Top skor pada sebuah kompetisi resmi.", icon: "target" },
  { code: "playmaker", name: "Kreator Serangan", description: "Assist terbanyak pada sebuah kompetisi.", icon: "wand" },
  { code: "golden_glove", name: "Sarung Tangan Emas", description: "Kiper dengan nirbobol terbanyak.", icon: "hand" },
  { code: "mvp_tournament", name: "Pemain Terbaik Turnamen", description: "Pemain paling berpengaruh sepanjang turnamen.", icon: "star" },
  { code: "hat_trick", name: "Hat-trick", description: "Mencetak tiga gol dalam satu pertandingan.", icon: "flame" },
  { code: "iron_man", name: "Manusia Besi", description: "Bermain penuh di seluruh pertandingan kompetisi.", icon: "shield" },
  { code: "fair_play", name: "Fair Play", description: "Tanpa kartu sepanjang kompetisi dengan >8 penampilan.", icon: "heart" },
  { code: "debut", name: "Debut Kompetisi", description: "Penampilan pertama pada kompetisi resmi LigaLokal.", icon: "sparkles" },
  { code: "rising_talent", name: "Talenta Menjanjikan", description: "Skor performa persentil 90+ untuk kelompok umurnya.", icon: "trending-up" },
  { code: "wall", name: "Tembok Pertahanan", description: "Tekel + intersep terbanyak pada sebuah kompetisi.", icon: "brick-wall" },
];

export const FORMATIONS: Record<string, { slot: string; x: number; y: number }[]> = {
  "4-3-3": [
    { slot: "GK", x: 50, y: 92 },
    { slot: "RB", x: 82, y: 72 }, { slot: "RCB", x: 62, y: 78 }, { slot: "LCB", x: 38, y: 78 }, { slot: "LB", x: 18, y: 72 },
    { slot: "RCM", x: 68, y: 52 }, { slot: "CM", x: 50, y: 56 }, { slot: "LCM", x: 32, y: 52 },
    { slot: "RW", x: 78, y: 26 }, { slot: "ST", x: 50, y: 18 }, { slot: "LW", x: 22, y: 26 },
  ],
  "4-4-2": [
    { slot: "GK", x: 50, y: 92 },
    { slot: "RB", x: 82, y: 72 }, { slot: "RCB", x: 62, y: 78 }, { slot: "LCB", x: 38, y: 78 }, { slot: "LB", x: 18, y: 72 },
    { slot: "RM", x: 80, y: 48 }, { slot: "RCM", x: 58, y: 52 }, { slot: "LCM", x: 42, y: 52 }, { slot: "LM", x: 20, y: 48 },
    { slot: "RST", x: 58, y: 20 }, { slot: "LST", x: 42, y: 20 },
  ],
  "3-4-3": [
    { slot: "GK", x: 50, y: 92 },
    { slot: "RCB", x: 68, y: 78 }, { slot: "CB", x: 50, y: 80 }, { slot: "LCB", x: 32, y: 78 },
    { slot: "RM", x: 84, y: 50 }, { slot: "RCM", x: 60, y: 54 }, { slot: "LCM", x: 40, y: 54 }, { slot: "LM", x: 16, y: 50 },
    { slot: "RW", x: 76, y: 24 }, { slot: "ST", x: 50, y: 18 }, { slot: "LW", x: 24, y: 24 },
  ],
  "4-2-3-1": [
    { slot: "GK", x: 50, y: 92 },
    { slot: "RB", x: 82, y: 72 }, { slot: "RCB", x: 62, y: 78 }, { slot: "LCB", x: 38, y: 78 }, { slot: "LB", x: 18, y: 72 },
    { slot: "RDM", x: 60, y: 58 }, { slot: "LDM", x: 40, y: 58 },
    { slot: "RAM", x: 76, y: 36 }, { slot: "CAM", x: 50, y: 34 }, { slot: "LAM", x: 24, y: 36 },
    { slot: "ST", x: 50, y: 16 },
  ],
};

export const POSITION_BY_SLOT: Record<string, "GK" | "DF" | "MF" | "FW"> = {
  GK: "GK",
  RB: "DF", LB: "DF", CB: "DF", RCB: "DF", LCB: "DF",
  RM: "MF", LM: "MF", CM: "MF", RCM: "MF", LCM: "MF", RDM: "MF", LDM: "MF",
  RAM: "MF", LAM: "MF", CAM: "MF",
  RW: "FW", LW: "FW", ST: "FW", RST: "FW", LST: "FW",
};
