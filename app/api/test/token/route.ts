import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    // Generate a JWT token for our test user
    const token = jwt.sign(
      {
        email: "test@example.com",
        id: "test-user-1",
        iat: Math.floor(Date.now() / 1000),
      },
      process.env.AUTH_SECRET || "fallback_secret",
      { expiresIn: "30d" }
    );

    return NextResponse.json({
      token,
      email: "test@example.com",
      name: "Test User",
      message: "⚠️ This is a TEST token. Only for development.",
    });
  } catch (error: any) {
    console.error("Test token error:", error.message);
    return NextResponse.json(
      { error: "Failed to generate test token" },
      { status: 500 }
    );
  }
}
