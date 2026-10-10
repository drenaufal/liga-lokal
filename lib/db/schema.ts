import { relations, sql } from "drizzle-orm";
import {
  boolean,
  char,
  customType,
  date as mysqlDate,
  datetime,
  double,
  index,
  int,
  longtext,
  mysqlEnum,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { PLAYER_POSITIONS } from "../positions";

/* ═══════════════════════ Column helpers (MariaDB) ══════════════════════ */

/** UUID primary key, generated in the app (MariaDB has no portable uuid default). */
const id = () =>
  char("id", { length: 36 })
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

/** UUID reference column. */
const uuid = (name: string) => char(name, { length: 36 });

/**
 * UTC instant with millisecond precision. `lib/db/index.ts` pins every
 * connection to `time_zone = '+00:00'`, so DB defaults and `now()` are UTC too.
 */
const timestamp = (name: string) => datetime(name, { mode: "date", fsp: 3 });
const NOW = sql`CURRENT_TIMESTAMP(3)`;

/** Calendar date kept as a `YYYY-MM-DD` string. */
const date = (name: string) => mysqlDate(name, { mode: "string" });

/**
 * JSON column. MariaDB stores JSON as LONGTEXT, so the driver hands back a
 * string — parse it here (MySQL 8 already returns parsed objects).
 */
const json = customType<{ data: unknown; driverData: string }>({
  dataType: () => "json",
  toDriver: (value) => JSON.stringify(value),
  fromDriver: (value) => (typeof value === "string" ? JSON.parse(value) : value),
});

/* ═══════════════════════════ Enums ═══════════════════════════════════ */

export const userRole = [
  "admin",
  "operator",
  "referee",
  "coach",
  "scout",
  "viewer",
] as const;

export const verificationStatus = [
  "verified",
  "flagged",
  "pending",
  "rejected",
] as const;

export const refereeStatus = [
  "active",
  "expiring",
  "expired",
  "revoked",
] as const;

/** image = photos / logos (any signed-in user); document = identity papers (verifiers only). */
export const mediaKind = ["image", "document"] as const;

export const clubType = ["club", "academy"] as const;
export const venueSurface = [
  "natural",
  "artificial",
  "hybrid",
  "futsal",
] as const;
/** 13 specific roles — see lib/positions.ts for the GK/DF/MF/FW lines derived from them. */
export const playerPosition = PLAYER_POSITIONS;
export const preferredFoot = ["left", "right", "both"] as const;

/** league = round-robin table; cup = single-elimination knockout. */
export const tournamentFormat = ["league", "cup"] as const;
export const tournamentStatus = [
  "draft",
  "registration",
  "verification",
  "ready",
  "ongoing",
  "completed",
  "archived",
] as const;
export const registrationStatus = [
  "invited",
  "registered",
  "verified",
  "rejected",
  "withdrawn",
] as const;

export const matchStage = [
  "league",
  "group",
  "round_of_32",
  "round_of_16",
  "quarter",
  "semi",
  "final",
  "third_place",
] as const;
export const matchStatus = [
  "scheduled",
  "live",
  "halftime",
  "completed",
  "postponed",
  "cancelled",
] as const;
export const matchPeriod = [
  "not_started",
  "first_half",
  "halftime",
  "second_half",
  "extra_time",
  "penalties",
  "full_time",
] as const;
export const resultStatus = [
  "unconfirmed",
  "confirmed",
  "disputed",
  "amended",
] as const;

export const matchEventType = [
  "goal",
  "own_goal",
  "penalty_goal",
  "penalty_missed",
  "assist",
  "shot_on",
  "shot_off",
  "save",
  "yellow_card",
  "red_card",
  "second_yellow",
  "foul",
  "offside",
  "corner",
  "substitution",
  "injury",
  "var_check",
  "period",
  "interception",
] as const;
export const lineupRole = ["starter", "substitute"] as const;

export const importEntity = [
  "players",
  "clubs",
  "referees",
  "venues",
  "matches",
] as const;
export const importBatchStatus = [
  "uploaded",
  "validating",
  "validated",
  "staged",
  "needs_review",
  "importing",
  "completed",
  "failed",
] as const;
export const importRowStatus = [
  "pending",
  "valid",
  "error",
  "duplicate",
  "needs_review",
  "approved",
  "rejected",
  "imported",
] as const;

export const aiReportKind = [
  "player_scout",
  "player_analysis",
  "match_summary",
  "competition_insight",
  "talent_search",
] as const;
export const aiReportStatus = [
  "generated",
  "cached",
  "failed",
] as const;

/* ═══════════════════════════ Auth ═══════════════════════════════════ */

export const users = mysqlTable("users", {
  id: id(),
  name: text("name").notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: mysqlEnum("role", userRole).notNull().default("viewer"),
  image: text("image"),
  title: text("title"),
  clubId: uuid("club_id"),
  active: boolean("active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").default(NOW).notNull(),
});

/* ═══════════════════════ Config / Rules ═════════════════════════════ */

export type AgeCategoryRules = {
  matchDuration: number; // total minutes
  halfDuration: number;
  playersOnField: number;
  maxSquad: number;
  substitutions: string;
  ballSize: number;
  fieldType: string;
  notes?: string[];
};

export const ageCategories = mysqlTable("age_categories", {
  id: id(),
  code: varchar("code", { length: 12 }).notNull().unique(), // KU-8 … KU-16
  label: text("label").notNull(),
  /** A category is defined by its upper age limit; younger players may always play up. */
  maxAge: int("max_age").notNull(),
  /** Oldest eligible birth year (season year − maxAge): born in or after it = eligible. */
  birthYearFrom: int("birth_year_from"),
  rules: json("rules").$type<AgeCategoryRules>().notNull(),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").default(NOW).notNull(),
});

export type FormulaWeights = {
  goal: number;
  assist: number;
  save: number;
  tackle: number;
  interception: number;
  cleanSheet: number;
  keyPass: number;
  duelWon: number;
  yellowCard: number;
  redCard: number;
  minutesPer90: number;
  motm: number;
};

export const scoringFormulas = mysqlTable("scoring_formulas", {
  id: id(),
  name: text("name").notNull(),
  description: text("description"),
  weights: json("weights").$type<FormulaWeights>().notNull(),
  isActive: boolean("is_active").notNull().default(false),
  version: int("version").notNull().default(1),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").default(NOW).notNull(),
  updatedAt: timestamp("updated_at").default(NOW).notNull(),
});

/* ═══════════════════════════ Registry ══════════════════════════════ */

export const venues = mysqlTable("venues", {
  id: id(),
  name: text("name").notNull(),
  address: text("address"),
  city: text("city").notNull(),
  province: text("province"),
  capacity: int("capacity"),
  fieldCount: int("field_count").notNull().default(1),
  surface: mysqlEnum("surface", venueSurface).notNull().default("natural"),
  photoUrl: text("photo_url"),
  latitude: double("latitude"),
  longitude: double("longitude"),
  floodlights: boolean("floodlights").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(NOW).notNull(),
});

/** An SSB (sekolah sepak bola) — the "club" of the app. `name` is shown as "Nama SSB". */
export const clubs = mysqlTable("clubs", {
  id: id(),
  name: text("name").notNull(),
  shortName: varchar("short_name", { length: 8 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  type: mysqlEnum("type", clubType).notNull().default("club"),
  city: text("city").notNull(),
  province: text("province"),
  /** Street address of the SSB (free text). */
  address: text("address"),
  /** Asosiasi Kota PSSI the SSB belongs to (free text). */
  askot: text("askot"),
  /** Asosiasi Provinsi PSSI the SSB belongs to (free text). */
  asprov: text("asprov"),
  foundedYear: int("founded_year"),
  logoUrl: text("logo_url"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").default(NOW).notNull(),
});

export const referees = mysqlTable("referees", {
  id: id(),
  fullName: text("full_name").notNull(),
  dob: date("dob"),
  city: text("city"),
  /** Asosiasi Kota PSSI the referee comes from (free text). */
  askot: text("askot"),
  licenseLevel: varchar("license_level", { length: 24 }).notNull(), // C-3, C-2, C-1, Nasional
  licenseNumber: varchar("license_number", { length: 40 }).notNull().unique(),
  licenseIssuedAt: date("license_issued_at"),
  licenseExpiry: date("license_expiry").notNull(),
  status: mysqlEnum("status", refereeStatus).notNull().default("active"),
  photoUrl: text("photo_url"),
  phone: text("phone"),
  email: text("email"),
  matchesOfficiated: int("matches_officiated").notNull().default(0),
  specialty: text("specialty"), // wasit / asisten wasit / wasit ke-4
  createdAt: timestamp("created_at").default(NOW).notNull(),
});

export const coaches = mysqlTable(
  "coaches",
  {
    id: id(),
    fullName: text("full_name").notNull(),
    dob: date("dob"),
    city: text("city"),
    clubId: uuid("club_id").references(() => clubs.id, { onDelete: "set null" }),
    licenseLevel: varchar("license_level", { length: 24 }).notNull(), // D Nasional … Pro AFC
    licenseNumber: varchar("license_number", { length: 40 }).notNull().unique(),
    // Private scans (see lib/coach-documents.ts): URLs of `document` media rows.
    licenseDocUrl: text("license_doc_url"), // scan sertifikat lisensi kepelatihan
    ktpUrl: text("ktp_url"), // KTP
    photoUrl: text("photo_url"),
    phone: text("phone"),
    email: text("email"),
    specialty: text("specialty"), // pelatih kepala / asisten / kiper / fisik
    createdAt: timestamp("created_at").default(NOW).notNull(),
  },
  (t) => [index("coaches_club_idx").on(t.clubId)],
);

export const players = mysqlTable(
  "players",
  {
    id: id(),
    fullName: text("full_name").notNull(),
    nickname: text("nickname"),
    registrationNo: varchar("registration_no", { length: 32 }).notNull().unique(),
    nisn: varchar("nisn", { length: 10 }).notNull().unique(), // Nomor Induk Siswa Nasional — wajib & unik
    dob: date("dob").notNull(),
    birthPlace: text("birth_place"),
    nationality: varchar("nationality", { length: 64 }).notNull().default("Indonesia"),
    gender: varchar("gender", { length: 8 }).notNull().default("L"),
    heightCm: int("height_cm"),
    weightKg: int("weight_kg"),
    foot: mysqlEnum("foot", preferredFoot).notNull().default("right"),
    position: mysqlEnum("position", playerPosition).notNull(),
    jerseyNumber: int("jersey_number"),
    /** Klub utama. */
    clubId: uuid("club_id").references(() => clubs.id, { onDelete: "set null" }),
    /** Klub kedua — seorang pemain boleh membela paling banyak dua klub. */
    secondClubId: uuid("second_club_id").references(() => clubs.id, { onDelete: "set null" }),
    ageCategoryId: uuid("age_category_id").references(() => ageCategories.id, {
      onDelete: "set null",
    }),
    photoUrl: text("photo_url"),
    // Private documents (see lib/player-documents.ts)
    kiaUrl: text("kia_url"), // Kartu Identitas Anak
    kkUrl: text("kk_url"), // Kartu Keluarga
    aktaUrl: text("akta_url"), // Akta kelahiran
    ijazahUrl: text("ijazah_url"),
    raporUrl: text("rapor_url"),
    verificationStatus: mysqlEnum("verification_status", verificationStatus)
      .notNull()
      .default("pending"),
    verificationNotes: text("verification_notes"),
    verifiedBy: uuid("verified_by").references(() => users.id, {
      onDelete: "set null",
    }),
    verifiedAt: timestamp("verified_at"),
    guardianName: text("guardian_name"),
    guardianPhone: text("guardian_phone"),
    bio: text("bio"),
    joinedAt: date("joined_at"),
    createdAt: timestamp("created_at").default(NOW).notNull(),
    updatedAt: timestamp("updated_at").default(NOW).notNull(),
  },
  (t) => [
    index("players_club_idx").on(t.clubId),
    index("players_second_club_idx").on(t.secondClubId),
    index("players_age_cat_idx").on(t.ageCategoryId),
  ],
);

/* ═══════════════════ Player stats / history / badges ═══════════════ */

export const playerStats = mysqlTable(
  "player_stats",
  {
    id: id(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    tournamentId: uuid("tournament_id").references(() => tournaments.id, {
      onDelete: "cascade",
    }),
    /** Club represented in that tournament; null on the "career" (all clubs) row. */
    clubId: uuid("club_id").references(() => clubs.id, { onDelete: "set null" }),
    season: varchar("season", { length: 16 }).notNull().default("career"),
    appearances: int("appearances").notNull().default(0),
    minutesPlayed: int("minutes_played").notNull().default(0),
    goals: int("goals").notNull().default(0),
    assists: int("assists").notNull().default(0),
    saves: int("saves").notNull().default(0),
    shotsOnTarget: int("shots_on_target").notNull().default(0),
    shotsOffTarget: int("shots_off_target").notNull().default(0),
    tackles: int("tackles").notNull().default(0),
    interceptions: int("interceptions").notNull().default(0),
    keyPasses: int("key_passes").notNull().default(0),
    duelsWon: int("duels_won").notNull().default(0),
    cleanSheets: int("clean_sheets").notNull().default(0),
    yellowCards: int("yellow_cards").notNull().default(0),
    redCards: int("red_cards").notNull().default(0),
    foulsCommitted: int("fouls_committed").notNull().default(0),
    motm: int("motm").notNull().default(0),
    rating: double("rating").notNull().default(0),
    score: double("score").notNull().default(0),
    updatedAt: timestamp("updated_at").default(NOW).notNull(),
  },
  (t) => [
    uniqueIndex("player_stats_scope_idx").on(t.playerId, t.tournamentId, t.season),
  ],
);

export const playerSeasonHistory = mysqlTable("player_season_history", {
  id: id(),
  playerId: uuid("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  season: varchar("season", { length: 16 }).notNull(),
  clubId: uuid("club_id").references(() => clubs.id, { onDelete: "set null" }),
  ageCategoryCode: varchar("age_category_code", { length: 12 }),
  appearances: int("appearances").notNull().default(0),
  goals: int("goals").notNull().default(0),
  assists: int("assists").notNull().default(0),
  avgRating: double("avg_rating").notNull().default(0),
  note: text("note"),
});

export const badges = mysqlTable("badges", {
  id: id(),
  code: varchar("code", { length: 40 }).notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: varchar("icon", { length: 40 }).notNull().default("award"),
});

export const playerBadges = mysqlTable(
  "player_badges",
  {
    id: id(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    badgeId: uuid("badge_id")
      .notNull()
      .references(() => badges.id, { onDelete: "cascade" }),
    context: varchar("context", { length: 255 }),
    tournamentId: uuid("tournament_id").references(() => tournaments.id, {
      onDelete: "set null",
    }),
    awardedAt: timestamp("awarded_at").default(NOW).notNull(),
  },
  (t) => [uniqueIndex("player_badge_idx").on(t.playerId, t.badgeId, t.context)],
);

/* ═══════════════════════════ Competitions ══════════════════════════ */

export type Tiebreaker =
  | "points"
  | "headToHead"
  | "goalDifference"
  | "goalsFor"
  | "wins"
  | "fairPlay"
  | "drawLots";

/**
 * Turnamen — the umbrella event. It carries only what is the same for every
 * age group: name, season, description and organizer. Each age group (KU)
 * that plays in it is one row of `tournaments` below.
 */
export const competitions = mysqlTable("competitions", {
  id: id(),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  season: varchar("season", { length: 16 }).notNull(),
  description: text("description"),
  /** Penyelenggara. */
  organizer: text("organizer"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").default(NOW).notNull(),
  updatedAt: timestamp("updated_at").default(NOW).notNull(),
});

/**
 * One KU (age group) inside a Turnamen: its own format, dates, participants,
 * fixtures, standings and statistics. The UI calls a row of this table a "KU";
 * everything that used to hang off a tournament (matches, standings, squads,
 * player stats, badges) still points here.
 *
 * Display name = `<turnamen name> · <age category code>` — see `kuName` in
 * lib/queries/ku.ts.
 */
export const tournaments = mysqlTable(
  "tournaments",
  {
    id: id(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    format: mysqlEnum("format", tournamentFormat).notNull(),
    status: mysqlEnum("status", tournamentStatus).notNull().default("draft"),
    ageCategoryId: uuid("age_category_id").references(() => ageCategories.id, {
      onDelete: "set null",
    }),
    scoringFormulaId: uuid("scoring_formula_id").references(
      () => scoringFormulas.id,
      { onDelete: "set null" },
    ),
    city: text("city"),
    startDate: date("start_date"),
    endDate: date("end_date"),
    // Group-stage settings: only rows created before the Piala/Hybrid formats were retired use them.
    groupCount: int("group_count").notNull().default(0),
    teamsPerGroup: int("teams_per_group").notNull().default(0),
    advancePerGroup: int("advance_per_group").notNull().default(2),
    doubleRound: boolean("double_round").notNull().default(false),
    knockoutLegs: int("knockout_legs").notNull().default(1),
    pointsWin: int("points_win").notNull().default(3),
    pointsDraw: int("points_draw").notNull().default(1),
    pointsLoss: int("points_loss").notNull().default(0),
    tiebreakers: json("tiebreakers").$type<Tiebreaker[]>().notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").default(NOW).notNull(),
    updatedAt: timestamp("updated_at").default(NOW).notNull(),
  },
  (t) => [
    // an age group takes part in a turnamen once
    uniqueIndex("tournaments_competition_age_idx").on(t.competitionId, t.ageCategoryId),
  ],
);

export const tournamentTeams = mysqlTable(
  "tournament_teams",
  {
    id: id(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    clubId: uuid("club_id")
      .notNull()
      .references(() => clubs.id, { onDelete: "cascade" }),
    groupLabel: varchar("group_label", { length: 2 }),
    seed: int("seed"),
    registrationStatus: mysqlEnum("registration_status", registrationStatus)
      .notNull()
      .default("registered"),
    squadLockedAt: timestamp("squad_locked_at"),
    notes: text("notes"),
    createdAt: timestamp("created_at").default(NOW).notNull(),
  },
  (t) => [uniqueIndex("tournament_team_idx").on(t.tournamentId, t.clubId)],
);

export const tournamentSquad = mysqlTable(
  "tournament_squad",
  {
    id: id(),
    tournamentTeamId: uuid("tournament_team_id")
      .notNull()
      .references(() => tournamentTeams.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    jerseyNumber: int("jersey_number"),
    registeredAt: timestamp("registered_at")
      .default(NOW)
      .notNull(),
  },
  (t) => [uniqueIndex("tournament_squad_idx").on(t.tournamentTeamId, t.playerId)],
);

export const standings = mysqlTable(
  "standings",
  {
    id: id(),
    tournamentId: uuid("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    clubId: uuid("club_id")
      .notNull()
      .references(() => clubs.id, { onDelete: "cascade" }),
    groupLabel: varchar("group_label", { length: 2 }).notNull().default("-"),
    played: int("played").notNull().default(0),
    won: int("won").notNull().default(0),
    drawn: int("drawn").notNull().default(0),
    lost: int("lost").notNull().default(0),
    goalsFor: int("goals_for").notNull().default(0),
    goalsAgainst: int("goals_against").notNull().default(0),
    points: int("points").notNull().default(0),
    fairPlayPoints: int("fair_play_points").notNull().default(0),
    form: json("form").$type<string[]>().notNull().$defaultFn(() => []),
    rank: int("rank").notNull().default(0),
    updatedAt: timestamp("updated_at").default(NOW).notNull(),
  },
  (t) => [
    uniqueIndex("standings_idx").on(t.tournamentId, t.clubId, t.groupLabel),
  ],
);

export const matches = mysqlTable("matches", {
  id: id(),
  tournamentId: uuid("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  stage: mysqlEnum("stage", matchStage).notNull().default("league"),
  round: int("round").notNull().default(1),
  groupLabel: varchar("group_label", { length: 2 }),
  bracketSlot: varchar("bracket_slot", { length: 16 }), // e.g. SF1, QF3, F
  homeClubId: uuid("home_club_id").references(() => clubs.id, {
    onDelete: "set null",
  }),
  awayClubId: uuid("away_club_id").references(() => clubs.id, {
    onDelete: "set null",
  }),
  homePlaceholder: text("home_placeholder"), // "Juara Grup A"
  awayPlaceholder: text("away_placeholder"),
  venueId: uuid("venue_id").references(() => venues.id, { onDelete: "set null" }),
  refereeId: uuid("referee_id").references(() => referees.id, {
    onDelete: "set null",
  }),
  /** Operator assigned to run the match console; kick-off needs both a referee and an operator. */
  operatorId: uuid("operator_id").references(() => users.id, { onDelete: "set null" }),
  scheduledAt: timestamp("scheduled_at").notNull(),
  status: mysqlEnum("status", matchStatus).notNull().default("scheduled"),
  period: mysqlEnum("period", matchPeriod).notNull().default("not_started"),
  /** Length of this match in minutes, set at kick-off; null = use the age category rule. */
  durationMinutes: int("duration_minutes"),
  currentMinute: int("current_minute").notNull().default(0),
  clockStartedAt: timestamp("clock_started_at"),
  homeScore: int("home_score").notNull().default(0),
  awayScore: int("away_score").notNull().default(0),
  homeScoreHt: int("home_score_ht"),
  awayScoreHt: int("away_score_ht"),
  homePenalties: int("home_penalties"),
  awayPenalties: int("away_penalties"),
  homeFormation: varchar("home_formation", { length: 12 }).default("4-3-3"),
  awayFormation: varchar("away_formation", { length: 12 }).default("4-3-3"),
  attendance: int("attendance"),
  weather: text("weather"),
  resultStatus: mysqlEnum("result_status", resultStatus).notNull().default("unconfirmed"),
  confirmedBy: uuid("confirmed_by").references(() => users.id, {
    onDelete: "set null",
  }),
  confirmedAt: timestamp("confirmed_at"),
  amendmentReason: text("amendment_reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(NOW).notNull(),
  updatedAt: timestamp("updated_at").default(NOW).notNull(),
});

export const matchEvents = mysqlTable("match_events", {
  id: id(),
  matchId: uuid("match_id")
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  type: mysqlEnum("type", matchEventType).notNull(),
  minute: int("minute").notNull().default(0),
  addedTime: int("added_time").notNull().default(0),
  period: mysqlEnum("period", matchPeriod).notNull().default("first_half"),
  clubId: uuid("club_id").references(() => clubs.id, { onDelete: "set null" }),
  playerId: uuid("player_id").references(() => players.id, {
    onDelete: "set null",
  }),
  relatedPlayerId: uuid("related_player_id").references(() => players.id, {
    onDelete: "set null",
  }),
  x: double("x"),
  y: double("y"),
  detail: json("detail").$type<Record<string, unknown>>(),
  voided: boolean("voided").notNull().default(false),
  voidReason: text("void_reason"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").default(NOW).notNull(),
});

export const matchLineups = mysqlTable(
  "match_lineups",
  {
    id: id(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    clubId: uuid("club_id")
      .notNull()
      .references(() => clubs.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    role: mysqlEnum("role", lineupRole).notNull().default("starter"),
    slot: varchar("slot", { length: 8 }), // GK, LB, CM1 …
    x: double("x"),
    y: double("y"),
    shirtNumber: int("shirt_number"),
    isCaptain: boolean("is_captain").notNull().default(false),
    subInMinute: int("sub_in_minute"),
    subOutMinute: int("sub_out_minute"),
    rating: double("rating"),
  },
  (t) => [uniqueIndex("match_lineup_idx").on(t.matchId, t.playerId)],
);

/**
 * What a confirmed match contributed to each player's statistics. Confirming or
 * amending a result applies only the difference to this ledger, so a match is
 * never counted twice and a correction really changes the numbers.
 */
export const playerMatchStats = mysqlTable(
  "player_match_stats",
  {
    id: id(),
    matchId: uuid("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    /** Club the player played this match for. */
    clubId: uuid("club_id").references(() => clubs.id, { onDelete: "set null" }),
    appearances: int("appearances").notNull().default(0),
    minutesPlayed: int("minutes_played").notNull().default(0),
    goals: int("goals").notNull().default(0),
    assists: int("assists").notNull().default(0),
    saves: int("saves").notNull().default(0),
    shotsOnTarget: int("shots_on_target").notNull().default(0),
    shotsOffTarget: int("shots_off_target").notNull().default(0),
    interceptions: int("interceptions").notNull().default(0),
    foulsCommitted: int("fouls_committed").notNull().default(0),
    yellowCards: int("yellow_cards").notNull().default(0),
    redCards: int("red_cards").notNull().default(0),
    motm: int("motm").notNull().default(0),
  },
  (t) => [uniqueIndex("player_match_stats_idx").on(t.matchId, t.playerId)],
);

/* ═══════════════════════ Data Ingestion ═══════════════════════════ */

export type ImportStage = {
  key: string;
  label: string;
  status: "pending" | "running" | "passed" | "failed" | "skipped";
  detail?: string;
  count?: number;
};

export type ImportIssue = {
  field: string;
  code: string;
  message: string;
  severity: "error" | "warning";
};

export const importBatches = mysqlTable("import_batches", {
  id: id(),
  entity: mysqlEnum("entity", importEntity).notNull(),
  fileName: text("file_name").notNull(),
  status: mysqlEnum("status", importBatchStatus).notNull().default("uploaded"),
  totalRows: int("total_rows").notNull().default(0),
  validRows: int("valid_rows").notNull().default(0),
  errorRows: int("error_rows").notNull().default(0),
  duplicateRows: int("duplicate_rows").notNull().default(0),
  reviewRows: int("review_rows").notNull().default(0),
  importedRows: int("imported_rows").notNull().default(0),
  stages: json("stages").$type<ImportStage[]>().notNull(),
  uploadedBy: uuid("uploaded_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").default(NOW).notNull(),
  completedAt: timestamp("completed_at"),
});

export const importRows = mysqlTable("import_rows", {
  id: id(),
  batchId: uuid("batch_id")
    .notNull()
    .references(() => importBatches.id, { onDelete: "cascade" }),
  rowNumber: int("row_number").notNull(),
  raw: json("raw").$type<Record<string, string>>().notNull(),
  normalized: json("normalized").$type<Record<string, unknown>>(),
  status: mysqlEnum("status", importRowStatus).notNull().default("pending"),
  issues: json("issues").$type<ImportIssue[]>().notNull().$defaultFn(() => []),
  matchCandidateId: uuid("match_candidate_id"),
  matchCandidateName: text("match_candidate_name"),
  matchScore: double("match_score"),
  resolution: varchar("resolution", { length: 16 }), // create | merge | skip
  resolvedBy: uuid("resolved_by").references(() => users.id, {
    onDelete: "set null",
  }),
  resolvedAt: timestamp("resolved_at"),
  importedEntityId: uuid("imported_entity_id"),
});

/* ═══════════════════════════ Media ═════════════════════════════════ */

/**
 * Uploaded files (player photos, KIA scans, club logos) stored inline as
 * base64 so uploads work without any external object store. Served by
 * `/api/media/[id]`.
 */
export const media = mysqlTable("media", {
  id: id(),
  kind: mysqlEnum("kind", mediaKind).notNull(),
  fileName: text("file_name"),
  mimeType: varchar("mime_type", { length: 80 }).notNull(),
  size: int("size").notNull(),
  data: longtext("data").notNull(),
  uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").default(NOW).notNull(),
});

/* ═══════════════════════ Audit + AI ═══════════════════════════════ */

export const auditLogs = mysqlTable("audit_logs", {
  id: id(),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  actorName: text("actor_name"),
  actorRole: text("actor_role"),
  action: varchar("action", { length: 64 }).notNull(),
  entityType: varchar("entity_type", { length: 40 }).notNull(),
  entityId: uuid("entity_id"),
  summary: text("summary").notNull(),
  before: json("before").$type<Record<string, unknown>>(),
  after: json("after").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").default(NOW).notNull(),
});

export type AiReportResult = {
  headline?: string;
  summary: string;
  sections: { title: string; body: string; bullets?: string[] }[];
  tags?: string[];
  ratings?: { label: string; value: number }[];
  recommendations?: string[];
};

export const aiReports = mysqlTable("ai_reports", {
  id: id(),
  kind: mysqlEnum("kind", aiReportKind).notNull(),
  subjectType: varchar("subject_type", { length: 24 }),
  subjectId: uuid("subject_id"),
  subjectLabel: text("subject_label"),
  query: text("query"),
  result: json("result").$type<AiReportResult>().notNull(),
  model: varchar("model", { length: 40 }).notNull().default("demo"),
  status: mysqlEnum("status", aiReportStatus).notNull().default("generated"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").default(NOW).notNull(),
});

export type ShortlistItem = {
  playerId: string;
  name: string;
  reason: string;
  score: number;
};

export const scoutShortlists = mysqlTable("scout_shortlists", {
  id: id(),
  name: text("name").notNull(),
  query: text("query"),
  items: json("items").$type<ShortlistItem[]>().notNull(),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").default(NOW).notNull(),
});

/* ═══════════════════════════ Relations ════════════════════════════ */

export const clubsRelations = relations(clubs, ({ many }) => ({
  players: many(players),
  coaches: many(coaches),
}));

export const coachesRelations = relations(coaches, ({ one }) => ({
  club: one(clubs, { fields: [coaches.clubId], references: [clubs.id] }),
}));

export const playersRelations = relations(players, ({ one, many }) => ({
  club: one(clubs, { fields: [players.clubId], references: [clubs.id] }),
  ageCategory: one(ageCategories, {
    fields: [players.ageCategoryId],
    references: [ageCategories.id],
  }),
  stats: many(playerStats),
  badges: many(playerBadges),
  seasonHistory: many(playerSeasonHistory),
}));

export const playerSeasonHistoryRelations = relations(playerSeasonHistory, ({ one }) => ({
  player: one(players, {
    fields: [playerSeasonHistory.playerId],
    references: [players.id],
  }),
}));

export const playerStatsRelations = relations(playerStats, ({ one }) => ({
  player: one(players, {
    fields: [playerStats.playerId],
    references: [players.id],
  }),
  tournament: one(tournaments, {
    fields: [playerStats.tournamentId],
    references: [tournaments.id],
  }),
}));

export const playerBadgesRelations = relations(playerBadges, ({ one }) => ({
  player: one(players, {
    fields: [playerBadges.playerId],
    references: [players.id],
  }),
  badge: one(badges, {
    fields: [playerBadges.badgeId],
    references: [badges.id],
  }),
}));

export const competitionsRelations = relations(competitions, ({ many }) => ({
  kus: many(tournaments),
}));

export const tournamentsRelations = relations(tournaments, ({ one, many }) => ({
  competition: one(competitions, {
    fields: [tournaments.competitionId],
    references: [competitions.id],
  }),
  ageCategory: one(ageCategories, {
    fields: [tournaments.ageCategoryId],
    references: [ageCategories.id],
  }),
  scoringFormula: one(scoringFormulas, {
    fields: [tournaments.scoringFormulaId],
    references: [scoringFormulas.id],
  }),
  teams: many(tournamentTeams),
  matches: many(matches),
  standings: many(standings),
}));

export const tournamentTeamsRelations = relations(
  tournamentTeams,
  ({ one, many }) => ({
    tournament: one(tournaments, {
      fields: [tournamentTeams.tournamentId],
      references: [tournaments.id],
    }),
    club: one(clubs, {
      fields: [tournamentTeams.clubId],
      references: [clubs.id],
    }),
    squad: many(tournamentSquad),
  }),
);

export const matchesRelations = relations(matches, ({ one, many }) => ({
  tournament: one(tournaments, {
    fields: [matches.tournamentId],
    references: [tournaments.id],
  }),
  homeClub: one(clubs, {
    fields: [matches.homeClubId],
    references: [clubs.id],
    relationName: "homeClub",
  }),
  awayClub: one(clubs, {
    fields: [matches.awayClubId],
    references: [clubs.id],
    relationName: "awayClub",
  }),
  venue: one(venues, { fields: [matches.venueId], references: [venues.id] }),
  referee: one(referees, {
    fields: [matches.refereeId],
    references: [referees.id],
  }),
  events: many(matchEvents),
  lineups: many(matchLineups),
}));

export const matchEventsRelations = relations(matchEvents, ({ one }) => ({
  match: one(matches, {
    fields: [matchEvents.matchId],
    references: [matches.id],
  }),
  club: one(clubs, { fields: [matchEvents.clubId], references: [clubs.id] }),
  player: one(players, {
    fields: [matchEvents.playerId],
    references: [players.id],
    relationName: "eventPlayer",
  }),
  relatedPlayer: one(players, {
    fields: [matchEvents.relatedPlayerId],
    references: [players.id],
    relationName: "eventRelatedPlayer",
  }),
}));

export const standingsRelations = relations(standings, ({ one }) => ({
  tournament: one(tournaments, {
    fields: [standings.tournamentId],
    references: [tournaments.id],
  }),
  club: one(clubs, { fields: [standings.clubId], references: [clubs.id] }),
}));

export const importRowsRelations = relations(importRows, ({ one }) => ({
  batch: one(importBatches, {
    fields: [importRows.batchId],
    references: [importBatches.id],
  }),
}));

/* ═══════════════════════════ Type exports ═════════════════════════ */

export type User = typeof users.$inferSelect;
export type Player = typeof players.$inferSelect;
export type Club = typeof clubs.$inferSelect;
export type Referee = typeof referees.$inferSelect;
export type Coach = typeof coaches.$inferSelect;
export type Media = typeof media.$inferSelect;
export type Venue = typeof venues.$inferSelect;
export type AgeCategory = typeof ageCategories.$inferSelect;
export type ScoringFormula = typeof scoringFormulas.$inferSelect;
/** Turnamen (the umbrella event). */
export type Competition = typeof competitions.$inferSelect;
/** KU — one age group inside a Turnamen. */
export type Tournament = typeof tournaments.$inferSelect;
export type TournamentTeam = typeof tournamentTeams.$inferSelect;
export type Standing = typeof standings.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type MatchEvent = typeof matchEvents.$inferSelect;
export type MatchLineup = typeof matchLineups.$inferSelect;
export type PlayerMatchStat = typeof playerMatchStats.$inferSelect;
export type PlayerStat = typeof playerStats.$inferSelect;
export type Badge = typeof badges.$inferSelect;
export type PlayerBadge = typeof playerBadges.$inferSelect;
export type ImportBatch = typeof importBatches.$inferSelect;
export type ImportRow = typeof importRows.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type AiReport = typeof aiReports.$inferSelect;
export type ScoutShortlist = typeof scoutShortlists.$inferSelect;
