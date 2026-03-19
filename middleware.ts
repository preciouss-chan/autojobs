import { withAuth } from "next-auth/middleware";
import { NextRequest } from "next/server";

// This middleware protects routes that require authentication
export const middleware = withAuth(
  function middleware(req: NextRequest) {
    // Middleware runs on authenticated requests
    // If token is missing, withAuth will redirect to signin
    return;
  },
  {
    callbacks: {
      authorized: ({ token }) => {
        // Allow requests with a valid token
        return !!token;
      },
    },
    pages: {
      signIn: "/auth/signin",
    },
  }
);

// Protect routes that require authentication
// Note: /dashboard is protected by layout.tsx server-side check instead
export const config = {
  matcher: [
    "/", // Tailor page - requires login
    "/billing",
    "/billing/:path*",
  ],
};
