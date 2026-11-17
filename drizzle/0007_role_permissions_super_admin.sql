CREATE TABLE `role_permissions` (
	`id` char(36) NOT NULL,
	`role` enum('super_admin','admin','operator','referee','coach','scout','viewer') NOT NULL,
	`capability` varchar(48) NOT NULL,
	`granted` boolean NOT NULL,
	`updated_by` char(36),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `role_permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `role_permissions_role_cap_idx` UNIQUE(`role`,`capability`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('super_admin','admin','operator','referee','coach','scout','viewer') NOT NULL DEFAULT 'viewer';--> statement-breakpoint
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;