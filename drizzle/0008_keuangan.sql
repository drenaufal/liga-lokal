CREATE TABLE `business_unit_members` (
	`user_id` char(36) NOT NULL,
	`business_unit_id` char(36) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `business_unit_members_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `business_units` (
	`id` char(36) NOT NULL,
	`code` varchar(24) NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text,
	`program_weeks` int NOT NULL DEFAULT 10,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `business_units_id` PRIMARY KEY(`id`),
	CONSTRAINT `business_units_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `fin_assets` (
	`id` char(36) NOT NULL,
	`business_unit_id` char(36) NOT NULL,
	`created_by` char(36),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`purchased_on` date NOT NULL,
	`name` varchar(160) NOT NULL,
	`amount` bigint NOT NULL,
	`proof_url` text,
	`note` text,
	CONSTRAINT `fin_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fin_budget_items` (
	`id` char(36) NOT NULL,
	`business_unit_id` char(36) NOT NULL,
	`created_by` char(36),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`period` enum('weekly','monthly') NOT NULL,
	`category` varchar(160) NOT NULL,
	`category_order` int NOT NULL DEFAULT 0,
	`name` varchar(200) NOT NULL,
	`item_order` int NOT NULL DEFAULT 0,
	`quantity` int NOT NULL DEFAULT 1,
	`unit_price` bigint NOT NULL DEFAULT 0,
	`note` text,
	CONSTRAINT `fin_budget_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fin_capital` (
	`id` char(36) NOT NULL,
	`business_unit_id` char(36) NOT NULL,
	`created_by` char(36),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`owner_name` varchar(120) NOT NULL,
	`amount` bigint NOT NULL,
	`status` enum('outstanding','returned') NOT NULL DEFAULT 'outstanding',
	`invested_on` date,
	`returned_on` date,
	`note` text,
	CONSTRAINT `fin_capital_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fin_dividends` (
	`id` char(36) NOT NULL,
	`business_unit_id` char(36) NOT NULL,
	`created_by` char(36),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`recipient_name` varchar(120) NOT NULL,
	`amount` bigint NOT NULL,
	`paid_on` date,
	`note` text,
	CONSTRAINT `fin_dividends_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fin_match_fees` (
	`id` char(36) NOT NULL,
	`business_unit_id` char(36) NOT NULL,
	`created_by` char(36),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`club_name` varchar(160) NOT NULL,
	`week` int NOT NULL,
	`matches` int NOT NULL,
	`fee_per_match` bigint NOT NULL,
	`proof_url` text,
	`note` text,
	CONSTRAINT `fin_match_fees_id` PRIMARY KEY(`id`),
	CONSTRAINT `fin_match_fees_unit_club_week_idx` UNIQUE(`business_unit_id`,`club_name`,`week`)
);
--> statement-breakpoint
CREATE TABLE `fin_registrations` (
	`id` char(36) NOT NULL,
	`business_unit_id` char(36) NOT NULL,
	`created_by` char(36),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`club_name` varchar(160) NOT NULL,
	`fee` bigint NOT NULL,
	`dp_amount` bigint NOT NULL DEFAULT 0,
	`dp_paid_on` date,
	`dp_proof_url` text,
	`final_amount` bigint NOT NULL DEFAULT 0,
	`final_paid_on` date,
	`final_proof_url` text,
	`note` text,
	CONSTRAINT `fin_registrations_id` PRIMARY KEY(`id`),
	CONSTRAINT `fin_registrations_unit_club_idx` UNIQUE(`business_unit_id`,`club_name`)
);
--> statement-breakpoint
ALTER TABLE `role_permissions` MODIFY COLUMN `role` enum('super_admin','admin','operator','referee','coach','scout','viewer','unit_bisnis') NOT NULL;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('super_admin','admin','operator','referee','coach','scout','viewer','unit_bisnis') NOT NULL DEFAULT 'viewer';--> statement-breakpoint
ALTER TABLE `business_unit_members` ADD CONSTRAINT `business_unit_members_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `business_unit_members` ADD CONSTRAINT `business_unit_members_business_unit_id_business_units_id_fk` FOREIGN KEY (`business_unit_id`) REFERENCES `business_units`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fin_assets` ADD CONSTRAINT `fin_assets_business_unit_id_business_units_id_fk` FOREIGN KEY (`business_unit_id`) REFERENCES `business_units`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fin_assets` ADD CONSTRAINT `fin_assets_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fin_budget_items` ADD CONSTRAINT `fin_budget_items_business_unit_id_business_units_id_fk` FOREIGN KEY (`business_unit_id`) REFERENCES `business_units`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fin_budget_items` ADD CONSTRAINT `fin_budget_items_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fin_capital` ADD CONSTRAINT `fin_capital_business_unit_id_business_units_id_fk` FOREIGN KEY (`business_unit_id`) REFERENCES `business_units`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fin_capital` ADD CONSTRAINT `fin_capital_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fin_dividends` ADD CONSTRAINT `fin_dividends_business_unit_id_business_units_id_fk` FOREIGN KEY (`business_unit_id`) REFERENCES `business_units`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fin_dividends` ADD CONSTRAINT `fin_dividends_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fin_match_fees` ADD CONSTRAINT `fin_match_fees_business_unit_id_business_units_id_fk` FOREIGN KEY (`business_unit_id`) REFERENCES `business_units`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fin_match_fees` ADD CONSTRAINT `fin_match_fees_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fin_registrations` ADD CONSTRAINT `fin_registrations_business_unit_id_business_units_id_fk` FOREIGN KEY (`business_unit_id`) REFERENCES `business_units`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fin_registrations` ADD CONSTRAINT `fin_registrations_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `business_unit_members_unit_idx` ON `business_unit_members` (`business_unit_id`);--> statement-breakpoint
CREATE INDEX `fin_assets_unit_date_idx` ON `fin_assets` (`business_unit_id`,`purchased_on`);--> statement-breakpoint
CREATE INDEX `fin_budget_items_unit_period_idx` ON `fin_budget_items` (`business_unit_id`,`period`);--> statement-breakpoint
CREATE INDEX `fin_capital_unit_idx` ON `fin_capital` (`business_unit_id`);--> statement-breakpoint
CREATE INDEX `fin_dividends_unit_idx` ON `fin_dividends` (`business_unit_id`);