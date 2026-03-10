-- Add free resume parse tracking to Credits model
ALTER TABLE "Credits" ADD COLUMN "usedFreeResumeParse" BOOLEAN NOT NULL DEFAULT false;
