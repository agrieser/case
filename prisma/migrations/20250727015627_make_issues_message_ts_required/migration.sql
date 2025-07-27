/*
  Warnings:

  - Made the column `issuesMessageTs` on table `Investigation` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Investigation" ALTER COLUMN "issuesMessageTs" SET NOT NULL;
