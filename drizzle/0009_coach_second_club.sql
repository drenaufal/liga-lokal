ALTER TABLE `coaches` ADD `second_club_id` char(36);--> statement-breakpoint
ALTER TABLE `coaches` ADD CONSTRAINT `coaches_second_club_id_clubs_id_fk` FOREIGN KEY (`second_club_id`) REFERENCES `clubs`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `coaches_second_club_idx` ON `coaches` (`second_club_id`);