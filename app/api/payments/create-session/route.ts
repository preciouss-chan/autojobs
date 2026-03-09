import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session?.user?.email || !session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const origin = req.headers.get("origin") || "http://localhost:3000";

    // Create Stripe checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "AutoJobs - 100 Applications Credit Pack",
              description: "100 job applications with resume tailoring",
            },
            unit_amount: 249, // $2.49 in cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/dashboard?payment=success`,
      cancel_url: `${origin}/dashboard?payment=cancelled`,
      customer_email: session.user.email,
      metadata: {
        userId: session.user.id,
        credits: "100",
      },
    });

    // Store payment record in database
    if (checkoutSession.id) {
      // Generate a unique ID for stripe payment record
      // Using sessionId as the primary key since we don't have payment_intent yet
      const uniqueStripePaymentId = `pending_${checkoutSession.id}`;
      
      await prisma.stripePayment.create({
        data: {
          stripeSessionId: checkoutSession.id,
          stripePaymentId: uniqueStripePaymentId,
          amount: 249,
          credits: 100,
          status: "pending",
          userId: session.user.id,
          email: session.user.email,
        },
      });
    }

    return NextResponse.json({
      sessionId: checkoutSession.id,
      checkoutUrl: checkoutSession.url,
    });
  } catch (error) {
    console.error("Error creating Stripe session:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

