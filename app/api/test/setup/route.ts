import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { randomBytes, randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  try {
    // Create a test user
    const user = await prisma.user.upsert({
      where: { email: "test@autojobs.local" },
      update: {},
      create: {
        email: "test@autojobs.local",
        name: "Test User",
      },
    });

    console.log("✅ Created/updated user:", user);

    // Create initial credits if not exists
    const existingCredits = await prisma.credits.findUnique({
      where: { userId: user.id },
    });

    if (!existingCredits) {
      await prisma.credits.create({
        data: {
          userId: user.id,
          balance: 10,
          totalPurchased: 0,
        },
      });
      console.log("✅ Created initial credits");
    }

    // Create a session using raw query
    const sessionToken = randomBytes(32).toString("hex");
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    await (prisma as any).$executeRaw`
      INSERT INTO "Session" ("id", "sessionToken", "userId", "expires") 
      VALUES (${sessionId}, ${sessionToken}, ${user.id}, ${expiresAt})
    `;

    console.log("✅ Created session");

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      session: {
        sessionToken,
        // For testing, return the cookie header format
        setCookie: `next-auth.session-token=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`,
      },
      message: "Test data created. Use the sessionToken in your tests.",
    });
  } catch (error: any) {
    console.error("Test setup error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
