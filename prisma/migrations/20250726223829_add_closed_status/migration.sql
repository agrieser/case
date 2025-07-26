-- AlterEnum
ALTER TYPE "InvestigationStatus" ADD VALUE 'closed';

-- AlterTable
ALTER TABLE "Investigation" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "closedBy" TEXT;
