import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(): Promise<NextResponse> {
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

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Logout error:", message);
    return NextResponse.json(
      { error: "Logout failed", details: message },
      { status: 500 }
    );
  }
}
