-- Add eventTypes column to Event table
ALTER TABLE "Event" ADD COLUMN "eventTypes" TEXT[] NOT NULL DEFAULT '{}';

-- Backfill eventTypes from eventType for existing rows
UPDATE "Event" SET "eventTypes" = ARRAY["eventType"];