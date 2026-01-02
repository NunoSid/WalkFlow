-- AlterTable
ALTER TABLE "Utente" ADD COLUMN "triageStartAt" DATETIME;

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromUserId" TEXT NOT NULL,
    "toRole" TEXT,
    "toUserId" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChatMessage_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Assessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "utenteId" TEXT NOT NULL,
    "nurseId" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "observations" TEXT,
    "ecgDone" BOOLEAN NOT NULL DEFAULT false,
    "comburDone" BOOLEAN NOT NULL DEFAULT false,
    "bloodPressure" TEXT,
    "heartRate" INTEGER,
    "temperature" REAL,
    "respiratoryRate" INTEGER,
    "pain" INTEGER,
    "spo2" INTEGER,
    "glucose" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Assessment_utenteId_fkey" FOREIGN KEY ("utenteId") REFERENCES "Utente" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Assessment_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Assessment" ("color", "createdAt", "id", "nurseId", "observations", "utenteId") SELECT "color", "createdAt", "id", "nurseId", "observations", "utenteId" FROM "Assessment";
DROP TABLE "Assessment";
ALTER TABLE "new_Assessment" RENAME TO "Assessment";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
