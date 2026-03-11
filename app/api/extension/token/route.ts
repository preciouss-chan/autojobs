import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    const session = await auth();

    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    
    if (!userId) {
      console.error("❌ No user ID in session:", {
        email: session.user.email,
        name: session.user.name,
        keys: Object.keys(session.user)
      });
      return NextResponse.json({ error: "User ID not found in session" }, { status: 401 });
    }

    console.log("✅ Session found for:", session.user.email, "ID:", userId);

    // Ensure credits exist for this user
    const existingCredits = await prisma.credits.findUnique({
      where: { userId },
    });

    if (!existingCredits) {
      console.log("📝 Creating initial credits for user:", userId);
      // Create initial credits (1 free application)
      await prisma.credits.create({
        data: {
          userId,
          balance: 1,
          totalPurchased: 0,
        },
      });

      console.log("✅ Credits created");

      // Record the free grant transaction
      await prisma.transaction.create({
        data: {
          userId,
          type: "grant",
          amount: 1,
          reason: "free_trial",
        },
      });

      console.log("✅ Transaction recorded");
    } else {
      console.log("✅ Credits already exist for user:", userId, "Balance:", existingCredits.balance);
    }

    // Generate a JWT token valid for 30 days
    const token = jwt.sign(
      {
        email: session.user.email,
        id: userId,
        iat: Math.floor(Date.now() / 1000),
      },
      process.env.AUTH_SECRET || "fallback_secret",
      { expiresIn: "30d" }
    );

    return NextResponse.json({
      token,
      email: session.user.email,
      name: session.user.name,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error("Extension token error:", errorMessage);
    return NextResponse.json(
      { error: "Failed to generate token", details: errorMessage },
      { status: 500 }
    );
  }
}
