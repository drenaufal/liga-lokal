-- Turnamen → KU, plus the field changes asked for in the October 2026 review.
--
--  • A Turnamen (`competitions`) holds name / season / description / organizer and
--    owns many KUs. A KU is a row of `tournaments` (its age category, format,
--    dates, teams, fixtures, standings, stats …).
--  • Every tournament that exists today becomes a Turnamen with exactly one KU.
--    The Turnamen reuses the tournament's id, so old /kompetisi/<id> links still
--    open the right Turnamen. Nothing under a tournament (matches, standings,
--    squads, player stats, badges) is touched.
--  • Formats: "knockout" is now "cup"; the retired "hybrid" (which was scheduled
--    like a knockout) joins it. "cup" rows that already existed (group stage +
--    knockout) keep their groups and standings.
--  • Dropped on purpose: club accreditation, team colours and home venue; coach
--    experience, license dates and revoked status; the minimum age (and the
--    birth-year ceiling derived from it) of an age category; badge tiers.

CREATE TABLE `competitions` (
	`id` char(36) NOT NULL,
	`name` text NOT NULL,
	`slug` varchar(255) NOT NULL,
	`season` varchar(16) NOT NULL,
	`description` text,
	`organizer` text,
	`created_by` char(36),
	`created_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updated_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `competitions_id` PRIMARY KEY(`id`),
	CONSTRAINT `competitions_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `competitions` ADD CONSTRAINT `competitions_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
INSERT INTO `competitions` (`id`, `name`, `slug`, `season`, `description`, `organizer`, `created_by`, `created_at`, `updated_at`)
SELECT `id`, `name`, `slug`, `season`, `description`, `host`, `created_by`, `created_at`, `updated_at` FROM `tournaments`;
--> statement-breakpoint
ALTER TABLE `tournaments` ADD `competition_id` char(36);
--> statement-breakpoint
UPDATE `tournaments` SET `competition_id` = `id`;
--> statement-breakpoint
ALTER TABLE `tournaments` MODIFY COLUMN `competition_id` char(36) NOT NULL;
--> statement-breakpoint
UPDATE `tournaments` SET `format` = 'cup' WHERE `format` IN ('knockout', 'hybrid');
--> statement-breakpoint
ALTER TABLE `tournaments` MODIFY COLUMN `format` enum('league','cup') NOT NULL;
--> statement-breakpoint
ALTER TABLE `tournaments` DROP COLUMN `name`;
--> statement-breakpoint
ALTER TABLE `tournaments` DROP COLUMN `slug`;
--> statement-breakpoint
ALTER TABLE `tournaments` DROP COLUMN `season`;
--> statement-breakpoint
ALTER TABLE `tournaments` DROP COLUMN `description`;
--> statement-breakpoint
ALTER TABLE `tournaments` DROP COLUMN `logo_url`;
--> statement-breakpoint
ALTER TABLE `tournaments` DROP COLUMN `host`;
--> statement-breakpoint
CREATE UNIQUE INDEX `tournaments_competition_age_idx` ON `tournaments` (`competition_id`,`age_category_id`);
--> statement-breakpoint
ALTER TABLE `tournaments` ADD CONSTRAINT `tournaments_competition_id_competitions_id_fk` FOREIGN KEY (`competition_id`) REFERENCES `competitions`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE `clubs` DROP FOREIGN KEY `clubs_home_venue_id_venues_id_fk`;
--> statement-breakpoint
ALTER TABLE `clubs` ADD `address` text;
--> statement-breakpoint
ALTER TABLE `clubs` ADD `askot` text;
--> statement-breakpoint
ALTER TABLE `clubs` ADD `asprov` text;
--> statement-breakpoint
ALTER TABLE `clubs` DROP COLUMN `primary_color`;
--> statement-breakpoint
ALTER TABLE `clubs` DROP COLUMN `secondary_color`;
--> statement-breakpoint
ALTER TABLE `clubs` DROP COLUMN `home_venue_id`;
--> statement-breakpoint
ALTER TABLE `clubs` DROP COLUMN `accreditation`;
--> statement-breakpoint
ALTER TABLE `referees` ADD `askot` text;
--> statement-breakpoint
ALTER TABLE `coaches` ADD `license_doc_url` text;
--> statement-breakpoint
ALTER TABLE `coaches` ADD `ktp_url` text;
--> statement-breakpoint
ALTER TABLE `coaches` DROP COLUMN `license_issued_at`;
--> statement-breakpoint
ALTER TABLE `coaches` DROP COLUMN `license_expiry`;
--> statement-breakpoint
ALTER TABLE `coaches` DROP COLUMN `status`;
--> statement-breakpoint
ALTER TABLE `coaches` DROP COLUMN `experience_years`;
--> statement-breakpoint
ALTER TABLE `age_categories` DROP COLUMN `min_age`;
--> statement-breakpoint
ALTER TABLE `age_categories` DROP COLUMN `birth_year_to`;
--> statement-breakpoint
ALTER TABLE `badges` DROP COLUMN `tier`;
