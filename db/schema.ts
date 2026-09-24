import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const games = sqliteTable("games", {
  room: text("room").primaryKey(),
  boardToken: text("board_token").notNull(),
  state: text("state").notNull(),
  version: integer("version").notNull().default(1),
  updated: integer("updated").notNull(),
});
