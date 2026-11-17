CREATE TABLE `articles` (
	`id` char(36) NOT NULL,
	`title` varchar(200) NOT NULL,
	`excerpt` text,
	`body` longtext NOT NULL,
	`cover_url` text,
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`author_id` char(36),
	`published_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `articles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `articles` ADD CONSTRAINT `articles_author_id_users_id_fk` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `articles_status_published_idx` ON `articles` (`status`,`published_at`);