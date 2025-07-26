-- CreateEnum
CREATE TYPE "InvestigationStatus" AS ENUM ('investigating', 'escalated', 'resolved');

-- CreateTable
CREATE TABLE "Investigation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "InvestigationStatus" NOT NULL DEFAULT 'investigating',
    "channelId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Investigation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "investigationId" TEXT NOT NULL,
    "slackMessageUrl" TEXT NOT NULL,
    "addedBy" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "investigationId" TEXT NOT NULL,
    "incidentCommander" TEXT NOT NULL,
    "escalatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Investigation_name_key" ON "Investigation"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Investigation_channelId_key" ON "Investigation"("channelId");

-- CreateIndex
CREATE INDEX "Investigation_channelId_idx" ON "Investigation"("channelId");

-- CreateIndex
CREATE INDEX "Investigation_status_idx" ON "Investigation"("status");

-- CreateIndex
CREATE INDEX "Investigation_name_idx" ON "Investigation"("name");

-- CreateIndex
CREATE INDEX "Event_investigationId_idx" ON "Event"("investigationId");

-- CreateIndex
CREATE INDEX "Event_addedAt_idx" ON "Event"("addedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Incident_investigationId_key" ON "Incident"("investigationId");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_investigationId_fkey" FOREIGN KEY ("investigationId") REFERENCES "Investigation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_investigationId_fkey" FOREIGN KEY ("investigationId") REFERENCES "Investigation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
