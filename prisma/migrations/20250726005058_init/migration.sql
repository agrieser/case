-- CreateEnum
CREATE TYPE "InvestigationStatus" AS ENUM ('investigating', 'escalated', 'resolved');

-- CreateTable
CREATE TABLE "Investigation" (
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "InvestigationStatus" NOT NULL DEFAULT 'investigating',
    "channelId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Investigation_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "investigationName" TEXT NOT NULL,
    "slackMessageUrl" TEXT NOT NULL,
    "addedBy" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Incident" (
    "investigationName" TEXT NOT NULL,
    "incidentCommander" TEXT NOT NULL,
    "escalatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("investigationName")
);

-- CreateTable
CREATE TABLE "ChannelState" (
    "channelId" TEXT NOT NULL,
    "currentInvestigation" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelState_pkey" PRIMARY KEY ("channelId")
);

-- CreateIndex
CREATE INDEX "Investigation_channelId_idx" ON "Investigation"("channelId");

-- CreateIndex
CREATE INDEX "Investigation_status_idx" ON "Investigation"("status");

-- CreateIndex
CREATE INDEX "Event_investigationName_idx" ON "Event"("investigationName");

-- CreateIndex
CREATE INDEX "Event_addedAt_idx" ON "Event"("addedAt");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_investigationName_fkey" FOREIGN KEY ("investigationName") REFERENCES "Investigation"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_investigationName_fkey" FOREIGN KEY ("investigationName") REFERENCES "Investigation"("name") ON DELETE RESTRICT ON UPDATE CASCADE;
