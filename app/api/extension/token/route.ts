import { auth } from "@/lib/auth";
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

    // Generate a JWT token valid for 30 days
    const token = jwt.sign(
      {
        email: session.user.email,
        id: session.user.id,
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
  } catch (error: any) {
    console.error("Extension token error:", error.message);
    return NextResponse.json(
      { error: "Failed to generate token" },
      { status: 500 }
    );
  }
}
