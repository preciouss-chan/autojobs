import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/token";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;

    // Try JWT token first (extension)
    if (authHeader) {
      userId = getUserId(authHeader, undefined);
    }

    // Fall back to NextAuth session (web)
    if (!userId) {
      const session = await auth();
      userId = session?.user?.id || null;
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { amount = 1 } = await req.json();

    if (amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be positive" },
        { status: 400 }
      );
    }

    // Get current credits
    const credits = await prisma.credits.findUnique({
      where: { userId },
    });

    if (!credits) {
      return NextResponse.json({ error: "Credits not found" }, { status: 404 });
    }

    if (credits.balance < amount) {
      return NextResponse.json(
        { error: "Insufficient credits", availableBalance: credits.balance },
        { status: 402 } // Payment required
      );
    }

    // Deduct credits
    const updated = await prisma.credits.update({
      where: { userId },
      data: {
        balance: {
          decrement: amount,
        },
        lastDeductedAt: new Date(),
      },
    });

    // Record transaction
    await prisma.transaction.create({
      data: {
        userId,
        type: "deduction",
        amount: -amount,
        reason: "job_application",
      },
    });

    return NextResponse.json({
      success: true,
      newBalance: updated.balance,
      deducted: amount,
    });
  } catch (error) {
    console.error("Error deducting credits:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
