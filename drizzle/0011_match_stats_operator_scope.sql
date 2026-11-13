CREATE TABLE `operator_competitions` (
	`user_id` char(36) NOT NULL,
	`competition_id` char(36) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `operator_competition_idx` UNIQUE(`user_id`,`competition_id`)
);
--> statement-breakpoint
ALTER TABLE `coaches` MODIFY COLUMN `license_level` varchar(24);--> statement-breakpoint
ALTER TABLE `coaches` MODIFY COLUMN `license_number` varchar(40);--> statement-breakpoint
ALTER TABLE `match_events` MODIFY COLUMN `type` enum('goal','own_goal','penalty_goal','penalty_missed','assist','shot_on','shot_off','save','yellow_card','red_card','second_yellow','foul','offside','corner','substitution','injury','var_check','period','interception','pass') NOT NULL;--> statement-breakpoint
ALTER TABLE `player_match_stats` ADD `clean_sheets` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `operator_competitions` ADD CONSTRAINT `operator_competitions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `operator_competitions` ADD CONSTRAINT `operator_competitions_competition_id_competitions_id_fk` FOREIGN KEY (`competition_id`) REFERENCES `competitions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `operator_competition_comp_idx` ON `operator_competitions` (`competition_id`);