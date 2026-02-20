// db/schema.ts
import { pgTable, serial, text, integer, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  level: integer('level').default(1),
  xp: integer('xp').default(0),
  sats: integer('sats').default(50),
  createdAt: timestamp('created_at').defaultNow(),
});

export const quests = pgTable('quests', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  type: text('type').notNull(), // 'beginner', 'intermediate', 'advanced'
  content: jsonb('content').notNull(), // Theoretical content
  xpReward: integer('xp_reward').notNull(),
  satsReward: integer('sats_reward').notNull(),
  requiredLevel: integer('required_level').default(1),
  order: integer('order').notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const quizzes = pgTable('quizzes', {
  id: serial('id').primaryKey(),
  questId: integer('quest_id').notNull().references(() => quests.id),
  questions: jsonb('questions').notNull(), // Array of questions
  passingScore: integer('passing_score').default(70), // Percentage
  createdAt: timestamp('created_at').defaultNow(),
});

export const userQuestProgress = pgTable('user_quest_progress', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  questId: integer('quest_id').notNull().references(() => quests.id),
  status: text('status').notNull(), // 'locked', 'available', 'in_progress', 'completed'
  quizScore: integer('quiz_score'),
  quizPassed: boolean('quiz_passed').default(false),
  practicalCompleted: boolean('practical_completed').default(false),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const userBadges = pgTable('user_badges', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  badgeId: text('badge_id').notNull(),
  earnedAt: timestamp('earned_at').defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Quest = typeof quests.$inferSelect;
export type Quiz = typeof quizzes.$inferSelect;
export type UserQuestProgress = typeof userQuestProgress.$inferSelect;