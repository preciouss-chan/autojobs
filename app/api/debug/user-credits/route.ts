import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getUserId } from "@/lib/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  try {
    // Get from JWT token if provided
    const authHeader = req.headers.get("Authorization");
    let jwtUserId: string | null = null;
    if (authHeader) {
      jwtUserId = getUserId(authHeader, undefined);
    }

    // Get from NextAuth session
    const session = await auth();
    const sessionUserId = (session?.user as any)?.id || null;
    const sessionEmail = session?.user?.email || null;

    // Check which user has credits
    const usersWithCredits = await prisma.user.findMany({
      include: { credits: true }
    });

    const info = {
      jwtUserId,
      sessionUserId,
      sessionEmail,
      allUsers: usersWithCredits.map(u => ({
        email: u.email,
        id: u.id,
        hasCredits: !!u.credits,
        balance: u.credits?.balance || null
      }))
    };

    return NextResponse.json(info);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
