CREATE TABLE `print_templates` (
	`id` char(36) NOT NULL,
	`competition_id` char(36) NOT NULL,
	`kind` enum('name_tag','certificate') NOT NULL,
	`image_url` text NOT NULL,
	`width` int NOT NULL,
	`height` int NOT NULL,
	`layout` json,
	`updated_by` char(36),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `print_templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `print_template_idx` UNIQUE(`competition_id`,`kind`)
);
--> statement-breakpoint
ALTER TABLE `print_templates` ADD CONSTRAINT `print_templates_competition_id_competitions_id_fk` FOREIGN KEY (`competition_id`) REFERENCES `competitions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `print_templates` ADD CONSTRAINT `print_templates_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;