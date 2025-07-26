-- Update any existing 'resolved' status to 'closed'
UPDATE "Investigation" SET "status" = 'closed' WHERE "status" = 'resolved';

-- Remove 'resolved' from the enum
-- First create a new enum type
CREATE TYPE "InvestigationStatus_new" AS ENUM ('investigating', 'escalated', 'closed');

-- Update the column to use the new enum
ALTER TABLE "Investigation" 
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "InvestigationStatus_new" 
    USING ("status"::text::"InvestigationStatus_new"),
  ALTER COLUMN "status" SET DEFAULT 'investigating';

-- Drop the old enum
DROP TYPE "InvestigationStatus";

-- Rename the new enum to the original name
ALTER TYPE "InvestigationStatus_new" RENAME TO "InvestigationStatus";