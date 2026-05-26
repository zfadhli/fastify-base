CREATE TABLE `comment` (
	`id` text PRIMARY KEY NOT NULL,
	`postId` text NOT NULL,
	`authorId` text NOT NULL,
	`content` text NOT NULL,
	`createdAt` text NOT NULL,
	`updatedAt` text NOT NULL,
	FOREIGN KEY (`postId`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`authorId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
