-- CreateTable
CREATE TABLE "TaskApplication" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "taskId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'applied',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskApplication_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TaskApplication_userId_createdAt_idx" ON "TaskApplication"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskApplication_taskId_createdAt_idx" ON "TaskApplication"("taskId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TaskApplication_taskId_userId_key" ON "TaskApplication"("taskId", "userId");
