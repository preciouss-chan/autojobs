import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();

    if (!session) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Sign out by clearing the session cookie
    const response = NextResponse.json(
      { success: true, message: "Logged out from everywhere" },
      { status: 200 }
    );

    // Clear the NextAuth session cookie
    response.cookies.set("next-auth.session-token", "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0, // Expire immediately
    });

    return response;
  } catch (err: any) {
    console.error("Logout error:", err.message);
    return NextResponse.json(
      { error: "Logout failed", details: err.message },
      { status: 500 }
    );
  }
}
