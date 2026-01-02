-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ChatThreadState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "threadKey" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChatThreadState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ChatThreadState" ("archived", "deletedAt", "id", "threadKey", "updatedAt", "userId") SELECT "archived", "deletedAt", "id", "threadKey", "updatedAt", "userId" FROM "ChatThreadState";
DROP TABLE "ChatThreadState";
ALTER TABLE "new_ChatThreadState" RENAME TO "ChatThreadState";
CREATE INDEX "ChatThreadState_userId_archived_idx" ON "ChatThreadState"("userId", "archived");
CREATE UNIQUE INDEX "ChatThreadState_userId_threadKey_key" ON "ChatThreadState"("userId", "threadKey");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
