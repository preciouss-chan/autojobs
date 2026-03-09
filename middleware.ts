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

// Protect dashboard route and other protected routes
export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/billing",
    "/billing/:path*",
  ],
};
