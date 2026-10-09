-- Match events: one-click "Intersep" button (appended, so existing values keep their order)
ALTER TABLE `match_events` MODIFY COLUMN `type` enum('goal','own_goal','penalty_goal','penalty_missed','assist','shot_on','shot_off','save','yellow_card','red_card','second_yellow','foul','offside','corner','substitution','injury','var_check','period','interception') NOT NULL;--> statement-breakpoint

-- Players: position GK/DF/MF/FW -> 13 specific roles.
-- Widen the enum first so existing rows stay valid, convert, then narrow it.
ALTER TABLE `players` MODIFY COLUMN `position` enum('GK','DF','MF','FW','CB','RB','LB','WB','DMF','CMF','AMF','WF','ST','CF','LW','RW') NOT NULL;--> statement-breakpoint
-- Nothing more specific is known for old rows, so spread each line over its roles
-- (CB/RB/LB/WB, DMF/CMF/AMF/WF, ST/CF/LW/RW). Operators can refine them per player.
UPDATE `players` p
JOIN (
  SELECT `id`, ROW_NUMBER() OVER (PARTITION BY `position` ORDER BY `created_at`, `id`) AS rn FROM `players`
) x ON x.`id` = p.`id`
SET p.`position` = CASE p.`position`
  WHEN 'DF' THEN ELT(MOD(x.rn, 6) + 1, 'CB','RB','CB','LB','CB','WB')
  WHEN 'MF' THEN ELT(MOD(x.rn, 6) + 1, 'CMF','DMF','CMF','AMF','CMF','WF')
  WHEN 'FW' THEN ELT(MOD(x.rn, 6) + 1, 'ST','LW','ST','RW','CF','ST')
  ELSE p.`position`
END
WHERE p.`position` IN ('DF','MF','FW');--> statement-breakpoint
ALTER TABLE `players` MODIFY COLUMN `position` enum('GK','CB','RB','LB','WB','DMF','CMF','AMF','WF','ST','CF','LW','RW') NOT NULL;--> statement-breakpoint

-- Players: NISN becomes required. Rows without one get a placeholder
-- (0 + birth-year digits + running number) so the NOT NULL / UNIQUE rules hold;
-- replace them with the real NISN from each player's edit form.
UPDATE `players` p
JOIN (
  SELECT `id`, ROW_NUMBER() OVER (ORDER BY `created_at`, `id`) AS rn FROM `players` WHERE `nisn` IS NULL OR `nisn` = ''
) x ON x.`id` = p.`id`
SET p.`nisn` = CONCAT('0', RIGHT(YEAR(p.`dob`), 2), LPAD(x.rn, 7, '0'));--> statement-breakpoint
ALTER TABLE `players` MODIFY COLUMN `nisn` varchar(10) NOT NULL;--> statement-breakpoint

-- Players: second club + the extra private documents (KK, akta, ijazah, rapor)
ALTER TABLE `players` ADD `second_club_id` char(36);--> statement-breakpoint
ALTER TABLE `players` ADD `kk_url` text;--> statement-breakpoint
ALTER TABLE `players` ADD `akta_url` text;--> statement-breakpoint
ALTER TABLE `players` ADD `ijazah_url` text;--> statement-breakpoint
ALTER TABLE `players` ADD `rapor_url` text;--> statement-breakpoint
ALTER TABLE `players` ADD CONSTRAINT `players_second_club_id_clubs_id_fk` FOREIGN KEY (`second_club_id`) REFERENCES `clubs`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `players_second_club_idx` ON `players` (`second_club_id`);--> statement-breakpoint

-- Player stats: which club each tournament's numbers were earned for, plus shot counts
ALTER TABLE `player_stats` ADD `club_id` char(36);--> statement-breakpoint
ALTER TABLE `player_stats` ADD `shots_on_target` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `player_stats` ADD `shots_off_target` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `player_stats` ADD CONSTRAINT `player_stats_club_id_clubs_id_fk` FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Backfill: the club a player was registered under in that tournament...
UPDATE `player_stats` ps
JOIN `tournament_teams` tt ON tt.`tournament_id` = ps.`tournament_id`
JOIN `tournament_squad` sq ON sq.`tournament_team_id` = tt.`id` AND sq.`player_id` = ps.`player_id`
SET ps.`club_id` = tt.`club_id`
WHERE ps.`tournament_id` IS NOT NULL;--> statement-breakpoint
-- ...else their own club. The "career" row (no tournament) stays NULL = all clubs.
UPDATE `player_stats` ps
JOIN `players` p ON p.`id` = ps.`player_id`
SET ps.`club_id` = p.`club_id`
WHERE ps.`tournament_id` IS NOT NULL AND ps.`club_id` IS NULL;--> statement-breakpoint

-- Matches: operator assignment (the referee column already exists)
ALTER TABLE `matches` ADD `operator_id` char(36);--> statement-breakpoint
ALTER TABLE `matches` ADD CONSTRAINT `matches_operator_id_users_id_fk` FOREIGN KEY (`operator_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Matches that already started: credit the operator who recorded their first event
UPDATE `matches` m
SET m.`operator_id` = (
  SELECT e.`created_by` FROM `match_events` e
  WHERE e.`match_id` = m.`id` AND e.`created_by` IS NOT NULL
  ORDER BY e.`created_at` LIMIT 1
)
WHERE m.`status` IN ('live','halftime','completed') AND m.`operator_id` IS NULL;
