CREATE TABLE `match_dsp_submissions` (
	`id` char(36) NOT NULL,
	`match_id` char(36) NOT NULL,
	`club_id` char(36) NOT NULL,
	`submitted_by` char(36),
	`coach_name` text NOT NULL,
	`submitted_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `match_dsp_submissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `match_dsp_side_idx` UNIQUE(`match_id`,`club_id`)
);
--> statement-breakpoint
ALTER TABLE `coaches` ADD `user_id` char(36);--> statement-breakpoint
ALTER TABLE `coaches` ADD CONSTRAINT `coaches_user_id_unique` UNIQUE(`user_id`);--> statement-breakpoint
ALTER TABLE `match_dsp_submissions` ADD CONSTRAINT `match_dsp_submissions_match_id_matches_id_fk` FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `match_dsp_submissions` ADD CONSTRAINT `match_dsp_submissions_club_id_clubs_id_fk` FOREIGN KEY (`club_id`) REFERENCES `clubs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `match_dsp_submissions` ADD CONSTRAINT `match_dsp_submissions_submitted_by_users_id_fk` FOREIGN KEY (`submitted_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `coaches` ADD CONSTRAINT `coaches_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;