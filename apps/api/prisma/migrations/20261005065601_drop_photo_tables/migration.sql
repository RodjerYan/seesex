/*
  Warnings:

  - You are about to drop the `EventPhoto` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PartnerPhoto` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "EventPhoto" DROP CONSTRAINT "EventPhoto_eventId_fkey";

-- DropForeignKey
ALTER TABLE "PartnerPhoto" DROP CONSTRAINT "PartnerPhoto_partnerId_fkey";

-- DropTable
DROP TABLE "EventPhoto";

-- DropTable
DROP TABLE "PartnerPhoto";
