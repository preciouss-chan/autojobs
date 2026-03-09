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

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error: any) {
    console.error("Webhook signature verification failed:", error.message);
    return NextResponse.json(
      { error: "Webhook error" },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const credits = parseInt(session.metadata?.credits || "0", 10);

        if (!userId || !credits) {
          console.error("Missing userId or credits in metadata");
          return NextResponse.json({ received: true });
        }

        // Update payment record
        await prisma.stripePayment.update({
          where: { stripeSessionId: session.id },
          data: {
            status: "completed",
            stripePaymentId: session.payment_intent as string,
            completedAt: new Date(),
          },
        });

        // Add credits to user
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

        // Record transaction with expiration (1 year from now)
        const expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);

        await prisma.transaction.create({
          data: {
            userId,
            type: "purchase",
            amount: credits,
            reason: `stripe_purchase_${credits}`,
            stripePaymentId: session.payment_intent as string,
            expiresAt,
          },
        });

        console.log(
          `✅ Credits added to user ${userId}: +${credits} (new balance: ${updated.balance})`
        );
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        
        await prisma.stripePayment.update({
          where: { stripeSessionId: session.id },
          data: { status: "failed" },
        });

        console.log(`❌ Checkout session expired: ${session.id}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
