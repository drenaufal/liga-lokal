CREATE TABLE `match_operators` (
	`match_id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `match_operator_idx` UNIQUE(`match_id`,`user_id`)
);
--> statement-breakpoint
ALTER TABLE `match_operators` ADD CONSTRAINT `match_operators_match_id_matches_id_fk` FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `match_operators` ADD CONSTRAINT `match_operators_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `match_operator_user_idx` ON `match_operators` (`user_id`);
--> statement-breakpoint
INSERT INTO `match_operators` (`match_id`, `user_id`)
SELECT `id`, `operator_id` FROM `matches` WHERE `operator_id` IS NOT NULL;
