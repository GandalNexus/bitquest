// db/schema.ts
import { pgTable, serial, text, integer, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  level: integer('level').default(1),
  xp: integer('xp').default(0),
  sats: integer('sats').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

export type User = typeof users.$inferSelect;