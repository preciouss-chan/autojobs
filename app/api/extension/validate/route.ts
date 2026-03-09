import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Validate if the user still has an active session
 * Called by the extension to detect if user logged out on the dashboard
 * 
 * Does NOT require the JWT token - only checks if server session exists
 * This way the extension can detect dashboard logouts
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();

    if (!session || !session.user?.email) {
      // No session - user is logged out
      return NextResponse.json(
        { valid: false, message: "No active session" },
        { status: 200 }
      );
    }

    // Session exists - user is still logged in
    return NextResponse.json(
      { valid: true, email: session.user.email },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error("Session validation error:", errorMessage);
    return NextResponse.json(
      { valid: false, error: "Validation failed" },
      { status: 200 } // Return 200 even on error - treat as "invalid session"
    );
  }
}
