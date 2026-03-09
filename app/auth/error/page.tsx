"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function ErrorContent(): React.ReactElement {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") || "Unknown error";

  const errorMessages: Record<string, string> = {
    Configuration:
      "There's a configuration issue with the authentication provider. Please contact support.",
    AccessDenied: "Access was denied. Please try again.",
    Callback: "There was an error processing your callback. Please try again.",
    OAuthSignin:
      "There was an error signing in with your provider. Please try again.",
    OAuthCallback:
      "There was an error processing your provider's callback. Please try again.",
    OAuthCreateAccount: "Could not create a new account with your provider.",
    EmailCreateAccount: "Could not create a new account with your email.",
    EmailSignInError: "The sign in email was not sent.",
    CredentialsSignin: "Sign in failed. Check the details you provided are correct.",
    SessionCallback: "Session callback error.",
    SessionSignInError: "Session sign in error.",
    JWTSessionError: "JWT session error.",
  };

  const message = errorMessages[error] || `An error occurred: ${error}`;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-4 text-red-600">Authentication Error</h1>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="space-y-3">
          <Link
            href="/auth/signin"
            className="block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg"
          >
            Try Again
          </Link>
          <Link
            href="/"
            className="block bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg"
          >
            Go Home
          </Link>
        </div>
        <p className="text-xs text-gray-500 mt-6">Error code: {error}</p>
      </div>
    </div>
  );
}

export default function ErrorPage(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <ErrorContent />
    </Suspense>
  );
}
