"use client";

import Link from "next/link";

import { AppShell, PageHeader, SurfaceHeading, SurfacePanel } from "@/app/components/AppShell";

export const dynamic = "force-dynamic";

export default function BillingPage(): React.ReactElement {
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-8">
        <PageHeader
          eyebrow="AutoJobs · Legacy route"
          title="Billing is no longer part of the app."
          description="AutoJobs now stays focused on a local-first workflow for students and new grads: save your own API key in the dashboard, then move straight into tailoring."
          actions={[
            { href: "/dashboard", label: "Open dashboard", tone: "primary" },
            { href: "/", label: "Open workspace", tone: "secondary" },
          ]}
        />

        <SurfacePanel className="space-y-5">
          <SurfaceHeading
            title="What changed"
            description="This route remains only so older links do not feel broken."
          />

          <div className="hairline-list text-sm leading-6 text-[color:var(--foreground-soft)]">
            <div>
              <p className="font-medium text-[color:var(--foreground)]">No Stripe or credit packs</p>
              <p className="mt-1">The app no longer sells credits or runs payment setup.</p>
            </div>
            <div>
              <p className="font-medium text-[color:var(--foreground)]">Bring your own API key</p>
              <p className="mt-1">Use the dashboard to save a session key for the current browser session.</p>
            </div>
            <div>
              <p className="font-medium text-[color:var(--foreground)]">Resume work starts in the workspace</p>
              <p className="mt-1">Paste a job description, review the extracted signals, tailor, and export from the main flow.</p>
            </div>
          </div>
        </SurfacePanel>

        <SurfacePanel muted className="space-y-4">
          <SurfaceHeading
            title="Next best step"
            description="If you landed here from an older path, go back to the two-step setup and work flow."
          />

          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard" className="action-primary">
              Start with dashboard
            </Link>
            <Link href="/" className="action-secondary">
              Go to workspace
            </Link>
          </div>
        </SurfacePanel>
      </div>
    </AppShell>
  );
}
