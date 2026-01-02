-- Add chat thread state table
CREATE TABLE IF NOT EXISTS "ChatThreadState" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "threadKey" TEXT NOT NULL,
  "archived" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" DATETIME,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatThreadState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChatThreadState_userId_threadKey_key" ON "ChatThreadState"("userId", "threadKey");
CREATE INDEX IF NOT EXISTS "ChatThreadState_userId_archived_idx" ON "ChatThreadState"("userId", "archived");
