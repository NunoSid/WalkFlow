-- No-op safeguard for shadow DB ordering
PRAGMA foreign_keys=OFF;
CREATE TABLE IF NOT EXISTS "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
