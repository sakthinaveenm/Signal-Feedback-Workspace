CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`url` text DEFAULT '' NOT NULL,
	`platform` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`type` text NOT NULL,
	`priority` text NOT NULL,
	`status` text NOT NULL,
	`source` text NOT NULL,
	`contact` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
