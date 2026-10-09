CREATE TABLE `player_match_stats` (
	`id` char(36) NOT NULL,
	`match_id` char(36) NOT NULL,
	`player_id` char(36) NOT NULL,
	`club_id` char(36),
	`appearances` int NOT NULL DEFAULT 0,
	`minutes_played` int NOT NULL DEFAULT 0,
	`goals` int NOT NULL DEFAULT 0,
	`assists` int NOT NULL DEFAULT 0,
	`saves` int NOT NULL DEFAULT 0,
	`shots_on_target` int NOT NULL DEFAULT 0,
	`shots_off_target` int NOT NULL DEFAULT 0,
	`interceptions` int NOT NULL DEFAULT 0,
	`fouls_committed` int NOT NULL DEFAULT 0,
	`yellow_cards` int NOT NULL DEFAULT 0,
	`red_cards` int NOT NULL DEFAULT 0,
	`motm` int NOT NULL DEFAULT 0,
	CONSTRAINT `player_match_stats_id` PRIMARY KEY(`id`),
	CONSTRAINT `player_match_stats_idx` UNIQUE(`match_id`,`player_id`)
);
--> statement-breakpoint
ALTER TABLE `player_match_stats` ADD CONSTRAINT `player_match_stats_match_id_matches_id_fk` FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `player_match_stats` ADD CONSTRAINT `player_match_stats_player_id_players_id_fk` FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `player_match_stats` ADD CONSTRAINT `player_match_stats_club_id_clubs_id_fk` FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON DELETE set null ON UPDATE no action;