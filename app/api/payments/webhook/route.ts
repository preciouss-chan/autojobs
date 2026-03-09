import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature") || "";

  console.log("🔔 [WEBHOOK] Received request");
  console.log("🔔 [WEBHOOK] Signature present:", !!signature);
  console.log("🔔 [WEBHOOK] Body length:", body.length);

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    console.log("✅ [WEBHOOK] Signature verified successfully");
  } catch (error: any) {
    console.error("❌ [WEBHOOK] Signature verification failed:", error.message);
    return NextResponse.json(
      { error: "Webhook error" },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        console.log("🔔 [WEBHOOK] Event type: checkout.session.completed");
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const credits = parseInt(session.metadata?.credits || "0", 10);
        const sessionId = session.id;

        console.log("🔔 [WEBHOOK] Session ID:", sessionId);
        console.log("🔔 [WEBHOOK] User ID from metadata:", userId);
        console.log("🔔 [WEBHOOK] Credits from metadata:", credits);
        console.log("🔔 [WEBHOOK] Full metadata:", session.metadata);

        if (!userId || !credits) {
          console.error(
            "❌ [WEBHOOK] Missing userId or credits in metadata",
            { userId, credits }
          );
          return NextResponse.json({ received: true });
        }

        console.log(`✅ [WEBHOOK] Payment completed for session ${sessionId}`);

        // Update payment record - find by stripeSessionId and update with payment_intent
        const paymentIntentId = session.payment_intent as string;

        console.log(
          "🔔 [WEBHOOK] Looking for StripePayment record with sessionId:",
          sessionId
        );
        
        // First check if the record exists
        const existingPayment = await prisma.stripePayment.findUnique({
          where: { stripeSessionId: sessionId },
        });
        
        if (!existingPayment) {
          console.warn(
            "⚠️  [WEBHOOK] StripePayment record not found for session:",
            sessionId
          );
          console.warn(
            "⚠️  [WEBHOOK] This likely means the session was created via stripe trigger"
          );
          console.warn(
            "⚠️  [WEBHOOK] Creating new payment record from webhook event"
          );
          
          // Create a new payment record from the webhook event
          const newPayment = await prisma.stripePayment.create({
            data: {
              stripeSessionId: sessionId,
              stripePaymentId: paymentIntentId || `webhook_${sessionId}`,
              amount: session.amount_total || 249,
              credits,
              status: "completed",
              userId,
              email: session.customer_email || session.customer_details?.email || "unknown",
              completedAt: new Date(),
            },
          });
          console.log(
            "✅ [WEBHOOK] Created new StripePayment record:",
            newPayment.id
          );
        } else {
          console.log(
            "🔔 [WEBHOOK] Updating existing StripePayment record:",
            existingPayment.id
          );
          const updatedPayment = await prisma.stripePayment.update({
            where: { stripeSessionId: sessionId },
            data: {
              status: "completed",
              stripePaymentId: paymentIntentId || `success_${sessionId}`,
              completedAt: new Date(),
            },
          });
          console.log("✅ [WEBHOOK] StripePayment updated:", updatedPayment.id);
        }

        // Add credits to user
        console.log("🔔 [WEBHOOK] Incrementing credits for user:", userId);
        const updated = await prisma.credits.update({
          where: { userId },
          data: {
            balance: {
              increment: credits,
            },
            totalPurchased: {
              increment: credits,
            },
          },
        });

        console.log(
          `✅ [WEBHOOK] Credits added to user ${userId}: +${credits} (new balance: ${updated.balance})`
        );

        // Record transaction with expiration (1 year from now)
        const expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);

        console.log("🔔 [WEBHOOK] Creating transaction record");
        const transaction = await prisma.transaction.create({
          data: {
            userId,
            type: "purchase",
            amount: credits,
            reason: `stripe_purchase_${credits}`,
            stripePaymentId: paymentIntentId || sessionId,
            expiresAt,
          },
        });
        console.log("✅ [WEBHOOK] Transaction created:", transaction.id);
        break;
      }

      case "checkout.session.expired": {
        console.log("🔔 [WEBHOOK] Event type: checkout.session.expired");
        const session = event.data.object as Stripe.Checkout.Session;
        console.log("🔔 [WEBHOOK] Expired session ID:", session.id);

        await prisma.stripePayment.update({
          where: { stripeSessionId: session.id },
          data: { status: "failed" },
        });

        console.log(`❌ [WEBHOOK] Checkout session expired: ${session.id}`);
        break;
      }

      default:
        console.log(`🔔 [WEBHOOK] Unhandled event type: ${event.type}`);
    }

    console.log("✅ [WEBHOOK] Event processed successfully");
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("❌ [WEBHOOK] Error processing webhook:", error);
    if (error instanceof Error) {
      console.error("❌ [WEBHOOK] Error message:", error.message);
      console.error("❌ [WEBHOOK] Stack:", error.stack);
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
