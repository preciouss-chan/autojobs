import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get URL search parameters for filtering
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // Optional filter by transaction type

    const where: { userId: string; type?: string } = {
      userId: session.user.id,
    };

    if (type) {
      where.type = type;
    }

    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        type: true,
        amount: true,
        reason: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    return NextResponse.json(transactions);
  } catch (err: any) {
    console.error("Error fetching transactions:", err.message || String(err));
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
