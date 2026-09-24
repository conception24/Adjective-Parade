CREATE TABLE `games` (
	`room` text PRIMARY KEY NOT NULL,
	`board_token` text NOT NULL,
	`state` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated` integer NOT NULL
);
