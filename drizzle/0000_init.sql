CREATE TABLE `age_categories` (
	`id` char(36) NOT NULL,
	`code` varchar(12) NOT NULL,
	`label` text NOT NULL,
	`min_age` int NOT NULL,
	`max_age` int NOT NULL,
	`birth_year_from` int,
	`birth_year_to` int,
	`rules` json NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `age_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `age_categories_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `ai_reports` (
	`id` char(36) NOT NULL,
	`kind` enum('player_scout','player_analysis','match_summary','competition_insight','talent_search') NOT NULL,
	`subject_type` varchar(24),
	`subject_id` char(36),
	`subject_label` text,
	`query` text,
	`result` json NOT NULL,
	`model` varchar(40) NOT NULL DEFAULT 'demo',
	`status` enum('generated','cached','failed') NOT NULL DEFAULT 'generated',
	`created_by` char(36),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `ai_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` char(36) NOT NULL,
	`actor_id` char(36),
	`actor_name` text,
	`actor_role` text,
	`action` varchar(64) NOT NULL,
	`entity_type` varchar(40) NOT NULL,
	`entity_id` char(36),
	`summary` text NOT NULL,
	`before` json,
	`after` json,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `badges` (
	`id` char(36) NOT NULL,
	`code` varchar(40) NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`icon` varchar(40) NOT NULL DEFAULT 'award',
	`tier` enum('bronze','silver','gold','platinum') NOT NULL DEFAULT 'bronze',
	CONSTRAINT `badges_id` PRIMARY KEY(`id`),
	CONSTRAINT `badges_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `clubs` (
	`id` char(36) NOT NULL,
	`name` text NOT NULL,
	`short_name` varchar(8) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`type` enum('club','academy') NOT NULL DEFAULT 'club',
	`city` text NOT NULL,
	`province` text,
	`founded_year` int,
	`logo_url` text,
	`primary_color` varchar(9) DEFAULT '#00e28a',
	`secondary_color` varchar(9) DEFAULT '#0f1620',
	`home_venue_id` char(36),
	`contact_name` text,
	`contact_email` text,
	`contact_phone` text,
	`accreditation` text,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `clubs_id` PRIMARY KEY(`id`),
	CONSTRAINT `clubs_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `coaches` (
	`id` char(36) NOT NULL,
	`full_name` text NOT NULL,
	`dob` date,
	`city` text,
	`club_id` char(36),
	`license_level` varchar(24) NOT NULL,
	`license_number` varchar(40) NOT NULL,
	`license_issued_at` date,
	`license_expiry` date NOT NULL,
	`status` enum('active','expiring','expired','revoked') NOT NULL DEFAULT 'active',
	`photo_url` text,
	`phone` text,
	`email` text,
	`experience_years` int NOT NULL DEFAULT 0,
	`specialty` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `coaches_id` PRIMARY KEY(`id`),
	CONSTRAINT `coaches_license_number_unique` UNIQUE(`license_number`)
);
--> statement-breakpoint
CREATE TABLE `import_batches` (
	`id` char(36) NOT NULL,
	`entity` enum('players','clubs','referees','venues','matches') NOT NULL,
	`file_name` text NOT NULL,
	`status` enum('uploaded','validating','validated','staged','needs_review','importing','completed','failed') NOT NULL DEFAULT 'uploaded',
	`total_rows` int NOT NULL DEFAULT 0,
	`valid_rows` int NOT NULL DEFAULT 0,
	`error_rows` int NOT NULL DEFAULT 0,
	`duplicate_rows` int NOT NULL DEFAULT 0,
	`review_rows` int NOT NULL DEFAULT 0,
	`imported_rows` int NOT NULL DEFAULT 0,
	`stages` json NOT NULL,
	`uploaded_by` char(36),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`completed_at` datetime(3),
	CONSTRAINT `import_batches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `import_rows` (
	`id` char(36) NOT NULL,
	`batch_id` char(36) NOT NULL,
	`row_number` int NOT NULL,
	`raw` json NOT NULL,
	`normalized` json,
	`status` enum('pending','valid','error','duplicate','needs_review','approved','rejected','imported') NOT NULL DEFAULT 'pending',
	`issues` json NOT NULL,
	`match_candidate_id` char(36),
	`match_candidate_name` text,
	`match_score` double,
	`resolution` varchar(16),
	`resolved_by` char(36),
	`resolved_at` datetime(3),
	`imported_entity_id` char(36),
	CONSTRAINT `import_rows_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `match_events` (
	`id` char(36) NOT NULL,
	`match_id` char(36) NOT NULL,
	`type` enum('goal','own_goal','penalty_goal','penalty_missed','assist','shot_on','shot_off','save','yellow_card','red_card','second_yellow','foul','offside','corner','substitution','injury','var_check','period') NOT NULL,
	`minute` int NOT NULL DEFAULT 0,
	`added_time` int NOT NULL DEFAULT 0,
	`period` enum('not_started','first_half','halftime','second_half','extra_time','penalties','full_time') NOT NULL DEFAULT 'first_half',
	`club_id` char(36),
	`player_id` char(36),
	`related_player_id` char(36),
	`x` double,
	`y` double,
	`detail` json,
	`voided` boolean NOT NULL DEFAULT false,
	`void_reason` text,
	`created_by` char(36),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `match_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `match_lineups` (
	`id` char(36) NOT NULL,
	`match_id` char(36) NOT NULL,
	`club_id` char(36) NOT NULL,
	`player_id` char(36) NOT NULL,
	`role` enum('starter','substitute') NOT NULL DEFAULT 'starter',
	`slot` varchar(8),
	`x` double,
	`y` double,
	`shirt_number` int,
	`is_captain` boolean NOT NULL DEFAULT false,
	`sub_in_minute` int,
	`sub_out_minute` int,
	`rating` double,
	CONSTRAINT `match_lineups_id` PRIMARY KEY(`id`),
	CONSTRAINT `match_lineup_idx` UNIQUE(`match_id`,`player_id`)
);
--> statement-breakpoint
CREATE TABLE `matches` (
	`id` char(36) NOT NULL,
	`tournament_id` char(36) NOT NULL,
	`stage` enum('league','group','round_of_32','round_of_16','quarter','semi','final','third_place') NOT NULL DEFAULT 'league',
	`round` int NOT NULL DEFAULT 1,
	`group_label` varchar(2),
	`bracket_slot` varchar(16),
	`home_club_id` char(36),
	`away_club_id` char(36),
	`home_placeholder` text,
	`away_placeholder` text,
	`venue_id` char(36),
	`referee_id` char(36),
	`scheduled_at` datetime(3) NOT NULL,
	`status` enum('scheduled','live','halftime','completed','postponed','cancelled') NOT NULL DEFAULT 'scheduled',
	`period` enum('not_started','first_half','halftime','second_half','extra_time','penalties','full_time') NOT NULL DEFAULT 'not_started',
	`duration_minutes` int,
	`current_minute` int NOT NULL DEFAULT 0,
	`clock_started_at` datetime(3),
	`home_score` int NOT NULL DEFAULT 0,
	`away_score` int NOT NULL DEFAULT 0,
	`home_score_ht` int,
	`away_score_ht` int,
	`home_penalties` int,
	`away_penalties` int,
	`home_formation` varchar(12) DEFAULT '4-3-3',
	`away_formation` varchar(12) DEFAULT '4-3-3',
	`attendance` int,
	`weather` text,
	`result_status` enum('unconfirmed','confirmed','disputed','amended') NOT NULL DEFAULT 'unconfirmed',
	`confirmed_by` char(36),
	`confirmed_at` datetime(3),
	`amendment_reason` text,
	`notes` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `matches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `media` (
	`id` char(36) NOT NULL,
	`kind` enum('image','document') NOT NULL,
	`file_name` text,
	`mime_type` varchar(80) NOT NULL,
	`size` int NOT NULL,
	`data` longtext NOT NULL,
	`uploaded_by` char(36),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `media_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `player_badges` (
	`id` char(36) NOT NULL,
	`player_id` char(36) NOT NULL,
	`badge_id` char(36) NOT NULL,
	`context` varchar(255),
	`tournament_id` char(36),
	`awarded_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `player_badges_id` PRIMARY KEY(`id`),
	CONSTRAINT `player_badge_idx` UNIQUE(`player_id`,`badge_id`,`context`)
);
--> statement-breakpoint
CREATE TABLE `player_season_history` (
	`id` char(36) NOT NULL,
	`player_id` char(36) NOT NULL,
	`season` varchar(16) NOT NULL,
	`club_id` char(36),
	`age_category_code` varchar(12),
	`appearances` int NOT NULL DEFAULT 0,
	`goals` int NOT NULL DEFAULT 0,
	`assists` int NOT NULL DEFAULT 0,
	`avg_rating` double NOT NULL DEFAULT 0,
	`note` text,
	CONSTRAINT `player_season_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `player_stats` (
	`id` char(36) NOT NULL,
	`player_id` char(36) NOT NULL,
	`tournament_id` char(36),
	`season` varchar(16) NOT NULL DEFAULT 'career',
	`appearances` int NOT NULL DEFAULT 0,
	`minutes_played` int NOT NULL DEFAULT 0,
	`goals` int NOT NULL DEFAULT 0,
	`assists` int NOT NULL DEFAULT 0,
	`saves` int NOT NULL DEFAULT 0,
	`tackles` int NOT NULL DEFAULT 0,
	`interceptions` int NOT NULL DEFAULT 0,
	`key_passes` int NOT NULL DEFAULT 0,
	`duels_won` int NOT NULL DEFAULT 0,
	`clean_sheets` int NOT NULL DEFAULT 0,
	`yellow_cards` int NOT NULL DEFAULT 0,
	`red_cards` int NOT NULL DEFAULT 0,
	`fouls_committed` int NOT NULL DEFAULT 0,
	`motm` int NOT NULL DEFAULT 0,
	`rating` double NOT NULL DEFAULT 0,
	`score` double NOT NULL DEFAULT 0,
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `player_stats_id` PRIMARY KEY(`id`),
	CONSTRAINT `player_stats_scope_idx` UNIQUE(`player_id`,`tournament_id`,`season`)
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` char(36) NOT NULL,
	`full_name` text NOT NULL,
	`nickname` text,
	`registration_no` varchar(32) NOT NULL,
	`nisn` varchar(10),
	`dob` date NOT NULL,
	`birth_place` text,
	`nationality` varchar(64) NOT NULL DEFAULT 'Indonesia',
	`gender` varchar(8) NOT NULL DEFAULT 'L',
	`height_cm` int,
	`weight_kg` int,
	`foot` enum('left','right','both') NOT NULL DEFAULT 'right',
	`position` enum('GK','DF','MF','FW') NOT NULL,
	`detailed_position` varchar(12),
	`jersey_number` int,
	`club_id` char(36),
	`age_category_id` char(36),
	`photo_url` text,
	`kia_url` text,
	`verification_status` enum('verified','flagged','pending','rejected') NOT NULL DEFAULT 'pending',
	`verification_notes` text,
	`verified_by` char(36),
	`verified_at` datetime(3),
	`guardian_name` text,
	`guardian_phone` text,
	`bio` text,
	`joined_at` date,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `players_id` PRIMARY KEY(`id`),
	CONSTRAINT `players_registration_no_unique` UNIQUE(`registration_no`),
	CONSTRAINT `players_nisn_unique` UNIQUE(`nisn`)
);
--> statement-breakpoint
CREATE TABLE `referees` (
	`id` char(36) NOT NULL,
	`full_name` text NOT NULL,
	`dob` date,
	`city` text,
	`license_level` varchar(24) NOT NULL,
	`license_number` varchar(40) NOT NULL,
	`license_issued_at` date,
	`license_expiry` date NOT NULL,
	`status` enum('active','expiring','expired','revoked') NOT NULL DEFAULT 'active',
	`photo_url` text,
	`phone` text,
	`email` text,
	`matches_officiated` int NOT NULL DEFAULT 0,
	`specialty` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `referees_id` PRIMARY KEY(`id`),
	CONSTRAINT `referees_license_number_unique` UNIQUE(`license_number`)
);
--> statement-breakpoint
CREATE TABLE `scoring_formulas` (
	`id` char(36) NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`weights` json NOT NULL,
	`is_active` boolean NOT NULL DEFAULT false,
	`version` int NOT NULL DEFAULT 1,
	`created_by` char(36),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `scoring_formulas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scout_shortlists` (
	`id` char(36) NOT NULL,
	`name` text NOT NULL,
	`query` text,
	`items` json NOT NULL,
	`owner_id` char(36),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `scout_shortlists_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `standings` (
	`id` char(36) NOT NULL,
	`tournament_id` char(36) NOT NULL,
	`club_id` char(36) NOT NULL,
	`group_label` varchar(2) NOT NULL DEFAULT '-',
	`played` int NOT NULL DEFAULT 0,
	`won` int NOT NULL DEFAULT 0,
	`drawn` int NOT NULL DEFAULT 0,
	`lost` int NOT NULL DEFAULT 0,
	`goals_for` int NOT NULL DEFAULT 0,
	`goals_against` int NOT NULL DEFAULT 0,
	`points` int NOT NULL DEFAULT 0,
	`fair_play_points` int NOT NULL DEFAULT 0,
	`form` json NOT NULL,
	`rank` int NOT NULL DEFAULT 0,
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `standings_id` PRIMARY KEY(`id`),
	CONSTRAINT `standings_idx` UNIQUE(`tournament_id`,`club_id`,`group_label`)
);
--> statement-breakpoint
CREATE TABLE `tournament_squad` (
	`id` char(36) NOT NULL,
	`tournament_team_id` char(36) NOT NULL,
	`player_id` char(36) NOT NULL,
	`jersey_number` int,
	`registered_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `tournament_squad_id` PRIMARY KEY(`id`),
	CONSTRAINT `tournament_squad_idx` UNIQUE(`tournament_team_id`,`player_id`)
);
--> statement-breakpoint
CREATE TABLE `tournament_teams` (
	`id` char(36) NOT NULL,
	`tournament_id` char(36) NOT NULL,
	`club_id` char(36) NOT NULL,
	`group_label` varchar(2),
	`seed` int,
	`registration_status` enum('invited','registered','verified','rejected','withdrawn') NOT NULL DEFAULT 'registered',
	`squad_locked_at` datetime(3),
	`notes` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `tournament_teams_id` PRIMARY KEY(`id`),
	CONSTRAINT `tournament_team_idx` UNIQUE(`tournament_id`,`club_id`)
);
--> statement-breakpoint
CREATE TABLE `tournaments` (
	`id` char(36) NOT NULL,
	`name` text NOT NULL,
	`slug` varchar(255) NOT NULL,
	`season` varchar(16) NOT NULL,
	`format` enum('cup','league','hybrid','knockout') NOT NULL,
	`status` enum('draft','registration','verification','ready','ongoing','completed','archived') NOT NULL DEFAULT 'draft',
	`age_category_id` char(36),
	`scoring_formula_id` char(36),
	`description` text,
	`logo_url` text,
	`host` text,
	`city` text,
	`start_date` date,
	`end_date` date,
	`group_count` int NOT NULL DEFAULT 0,
	`teams_per_group` int NOT NULL DEFAULT 0,
	`advance_per_group` int NOT NULL DEFAULT 2,
	`double_round` boolean NOT NULL DEFAULT false,
	`knockout_legs` int NOT NULL DEFAULT 1,
	`points_win` int NOT NULL DEFAULT 3,
	`points_draw` int NOT NULL DEFAULT 1,
	`points_loss` int NOT NULL DEFAULT 0,
	`tiebreakers` json NOT NULL,
	`created_by` char(36),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `tournaments_id` PRIMARY KEY(`id`),
	CONSTRAINT `tournaments_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` char(36) NOT NULL,
	`name` text NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` text NOT NULL,
	`role` enum('admin','operator','referee','coach','scout','viewer') NOT NULL DEFAULT 'viewer',
	`image` text,
	`title` text,
	`club_id` char(36),
	`active` boolean NOT NULL DEFAULT true,
	`last_login_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `venues` (
	`id` char(36) NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`city` text NOT NULL,
	`province` text,
	`capacity` int,
	`field_count` int NOT NULL DEFAULT 1,
	`surface` enum('natural','artificial','hybrid','futsal') NOT NULL DEFAULT 'natural',
	`photo_url` text,
	`latitude` double,
	`longitude` double,
	`floodlights` boolean NOT NULL DEFAULT false,
	`notes` text,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `venues_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `ai_reports` ADD CONSTRAINT `ai_reports_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actor_id_users_id_fk` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `clubs` ADD CONSTRAINT `clubs_home_venue_id_venues_id_fk` FOREIGN KEY (`home_venue_id`) REFERENCES `venues`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `coaches` ADD CONSTRAINT `coaches_club_id_clubs_id_fk` FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `import_batches` ADD CONSTRAINT `import_batches_uploaded_by_users_id_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `import_rows` ADD CONSTRAINT `import_rows_batch_id_import_batches_id_fk` FOREIGN KEY (`batch_id`) REFERENCES `import_batches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `import_rows` ADD CONSTRAINT `import_rows_resolved_by_users_id_fk` FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `match_events` ADD CONSTRAINT `match_events_match_id_matches_id_fk` FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `match_events` ADD CONSTRAINT `match_events_club_id_clubs_id_fk` FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `match_events` ADD CONSTRAINT `match_events_player_id_players_id_fk` FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `match_events` ADD CONSTRAINT `match_events_related_player_id_players_id_fk` FOREIGN KEY (`related_player_id`) REFERENCES `players`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `match_events` ADD CONSTRAINT `match_events_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `match_lineups` ADD CONSTRAINT `match_lineups_match_id_matches_id_fk` FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `match_lineups` ADD CONSTRAINT `match_lineups_club_id_clubs_id_fk` FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `match_lineups` ADD CONSTRAINT `match_lineups_player_id_players_id_fk` FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `matches` ADD CONSTRAINT `matches_tournament_id_tournaments_id_fk` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `matches` ADD CONSTRAINT `matches_home_club_id_clubs_id_fk` FOREIGN KEY (`home_club_id`) REFERENCES `clubs`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `matches` ADD CONSTRAINT `matches_away_club_id_clubs_id_fk` FOREIGN KEY (`away_club_id`) REFERENCES `clubs`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `matches` ADD CONSTRAINT `matches_venue_id_venues_id_fk` FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `matches` ADD CONSTRAINT `matches_referee_id_referees_id_fk` FOREIGN KEY (`referee_id`) REFERENCES `referees`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `matches` ADD CONSTRAINT `matches_confirmed_by_users_id_fk` FOREIGN KEY (`confirmed_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `media` ADD CONSTRAINT `media_uploaded_by_users_id_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `player_badges` ADD CONSTRAINT `player_badges_player_id_players_id_fk` FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `player_badges` ADD CONSTRAINT `player_badges_badge_id_badges_id_fk` FOREIGN KEY (`badge_id`) REFERENCES `badges`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `player_badges` ADD CONSTRAINT `player_badges_tournament_id_tournaments_id_fk` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `player_season_history` ADD CONSTRAINT `player_season_history_player_id_players_id_fk` FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `player_season_history` ADD CONSTRAINT `player_season_history_club_id_clubs_id_fk` FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `player_stats` ADD CONSTRAINT `player_stats_player_id_players_id_fk` FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `player_stats` ADD CONSTRAINT `player_stats_tournament_id_tournaments_id_fk` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `players` ADD CONSTRAINT `players_club_id_clubs_id_fk` FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `players` ADD CONSTRAINT `players_age_category_id_age_categories_id_fk` FOREIGN KEY (`age_category_id`) REFERENCES `age_categories`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `players` ADD CONSTRAINT `players_verified_by_users_id_fk` FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scoring_formulas` ADD CONSTRAINT `scoring_formulas_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `scout_shortlists` ADD CONSTRAINT `scout_shortlists_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `standings` ADD CONSTRAINT `standings_tournament_id_tournaments_id_fk` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `standings` ADD CONSTRAINT `standings_club_id_clubs_id_fk` FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tournament_squad` ADD CONSTRAINT `tournament_squad_tournament_team_id_tournament_teams_id_fk` FOREIGN KEY (`tournament_team_id`) REFERENCES `tournament_teams`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tournament_squad` ADD CONSTRAINT `tournament_squad_player_id_players_id_fk` FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tournament_teams` ADD CONSTRAINT `tournament_teams_tournament_id_tournaments_id_fk` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tournament_teams` ADD CONSTRAINT `tournament_teams_club_id_clubs_id_fk` FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tournaments` ADD CONSTRAINT `tournaments_age_category_id_age_categories_id_fk` FOREIGN KEY (`age_category_id`) REFERENCES `age_categories`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tournaments` ADD CONSTRAINT `tournaments_scoring_formula_id_scoring_formulas_id_fk` FOREIGN KEY (`scoring_formula_id`) REFERENCES `scoring_formulas`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tournaments` ADD CONSTRAINT `tournaments_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `coaches_club_idx` ON `coaches` (`club_id`);--> statement-breakpoint
CREATE INDEX `players_club_idx` ON `players` (`club_id`);--> statement-breakpoint
CREATE INDEX `players_age_cat_idx` ON `players` (`age_category_id`);