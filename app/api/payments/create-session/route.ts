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

    if (!session?.user?.email || !(session?.user as any)?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const origin = req.headers.get("origin") || "http://localhost:3000";
    const userId = (session.user as any).id;
    const userEmail = session.user.email;

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
      customer_email: userEmail,
      metadata: {
        userId,
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
          userId,
          email: userEmail,
        },
      });
    }

    return NextResponse.json({
      sessionId: checkoutSession.id,
      checkoutUrl: checkoutSession.url,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes("API_KEY")) {
      console.error("Stripe API key configuration error:", errorMessage);
      return NextResponse.json(
        { error: "Payment system not configured" },
        { status: 500 }
      );
    }

    if (errorMessage.includes("Invalid request")) {
      console.error("Invalid Stripe request:", errorMessage);
      return NextResponse.json(
        { error: "Invalid payment request" },
        { status: 400 }
      );
    }

    console.error("Error creating Stripe session:", errorMessage);
    return NextResponse.json(
      { error: "Failed to create payment session" },
      { status: 500 }
    );
  }
}

