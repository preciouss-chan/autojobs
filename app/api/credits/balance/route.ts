import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/token";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
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
      userId = (session?.user as any)?.id || null;
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const credits = await prisma.credits.findUnique({
      where: { userId },
    });

    if (!credits) {
      return NextResponse.json({ error: "Credits not found" }, { status: 404 });
    }

    return NextResponse.json({
      userId,
      balance: credits.balance,
      totalPurchased: credits.totalPurchased,
      lastDeductedAt: credits.lastDeductedAt,
    });
  } catch (error) {
    console.error("Error fetching credits balance:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
