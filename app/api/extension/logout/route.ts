import { NextResponse } from "next/server";

/**
 * This endpoint is called by the extension to notify the dashboard
 * to log out. It returns a special response that tells the browser
 * to clear the session cookie.
 */
export async function POST(): Promise<NextResponse> {
  try {
    // Sign out by clearing the session cookie
    const response = NextResponse.json(
      { success: true, message: "Extension requested logout" },
      { status: 200 }
    );

    response.cookies.set("next-auth.session-token", "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    response.cookies.set("__Secure-next-auth.session-token", "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: true,
      maxAge: 0,
    });

    console.log("✅ Extension logout request received, session cleared");

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Extension logout error:", message);
    return NextResponse.json(
      { error: "Logout failed", details: message },
      { status: 500 }
    );
  }
}
