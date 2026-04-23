"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { AppShell, PageHeader, SurfaceHeading, SurfacePanel } from "@/app/components/AppShell";

function ErrorContent(): React.ReactElement {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") || "UnknownError";

  const errorMessages: Record<string, string> = {
    Configuration:
      "This auth route has a configuration mismatch. The main app no longer depends on hosted sign-in.",
    AccessDenied: "Access was denied for this legacy auth flow.",
    Callback: "The auth callback could not be completed.",
    OAuthSignin: "The provider sign-in step failed.",
    OAuthCallback: "The provider callback step failed.",
    OAuthCreateAccount: "A provider account could not be created.",
    EmailCreateAccount: "An email-based account could not be created.",
    EmailSignInError: "The sign-in email could not be sent.",
    CredentialsSignin: "The credential sign-in attempt failed.",
    SessionCallback: "The session callback failed.",
    SessionSignInError: "The session sign-in attempt failed.",
    JWTSessionError: "The session token could not be processed.",
  };

  const message = errorMessages[error] || `A legacy auth error occurred: ${error}`;

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-8">
        <PageHeader
          eyebrow="AutoJobs · Legacy auth route"
          title="This auth path is no longer part of the main flow."
          description="If you were trying to use the web app, go back to the local-first setup: save your API key in the dashboard, then continue in the tailoring workspace."
          actions={[
            { href: "/dashboard", label: "Open dashboard", tone: "primary" },
            { href: "/", label: "Open workspace", tone: "secondary" },
          ]}
        />

        <SurfacePanel className="space-y-5">
          <SurfaceHeading
            title="Error details"
            description="This message is here to make older auth links clearer, not to send you back into hosted sign-in."
          />

          <p className="status-note status-note-danger">{message}</p>

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-[color:var(--foreground-soft)]">
                Error code
              </p>
              <p className="text-sm text-[color:var(--foreground)]">{error}</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/auth/signin" className="action-secondary">
                Legacy sign-in page
              </Link>
              <Link href="/dashboard" className="action-subtle">
                Use local setup instead
              </Link>
            </div>
          </div>
        </SurfacePanel>
      </div>
    </AppShell>
  );
}

function ErrorFallback(): React.ReactElement {
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-8">
        <PageHeader
          eyebrow="AutoJobs · Legacy auth route"
          title="Loading the auth error details."
          description="This page only exists to explain older auth links more clearly."
        />

        <SurfacePanel className="flex min-h-56 flex-col items-center justify-center gap-4 text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-[color:var(--line-strong)] border-t-[color:var(--foreground)]"></div>
          <p className="section-copy">Loading error details…</p>
        </SurfacePanel>
      </div>
    </AppShell>
  );
}

export default function ErrorPage(): React.ReactElement {
  return (
    <Suspense fallback={<ErrorFallback />}>
      <ErrorContent />
    </Suspense>
  );
}
