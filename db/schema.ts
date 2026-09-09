import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const adventures=sqliteTable('adventures',{
 id:text('id').primaryKey(),state:text('state').notNull(),revision:integer('revision').notNull().default(0),updatedAt:text('updated_at').notNull(),
});
