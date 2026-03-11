-- Add webhook event ID to StripePayment for idempotency
ALTER TABLE "StripePayment" ADD COLUMN "webhookEventId" TEXT UNIQUE;

-- Create index on webhookEventId
CREATE INDEX "StripePayment_webhookEventId_idx" ON "StripePayment"("webhookEventId");
