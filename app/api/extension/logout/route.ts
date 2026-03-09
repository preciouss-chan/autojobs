import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * This endpoint is called by the extension to notify the dashboard
 * to log out. It returns a special response that tells the browser
 * to clear the session cookie.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Sign out by clearing the session cookie
    const response = NextResponse.json(
      { success: true, message: "Extension requested logout" },
      { status: 200 }
    );

    // Clear the NextAuth session cookie
    response.cookies.set("next-auth.session-token", "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0, // Expire immediately
    });

    console.log("✅ Extension logout request received, session cleared");

    return response;
  } catch (err: any) {
    console.error("Extension logout error:", err.message);
    return NextResponse.json(
      { error: "Logout failed", details: err.message },
      { status: 500 }
    );
  }
}
