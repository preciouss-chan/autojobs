"use client";

import { AppShell, PageHeader, SurfaceHeading, SurfacePanel } from "@/app/components/AppShell";

export default function SignInPage(): React.ReactElement {
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-8">
        <PageHeader
          eyebrow="AutoJobs · Legacy auth route"
          title="Hosted sign-in is turned off in this version."
          description="The main app now uses a calmer local-first flow: save your OpenAI key in the dashboard, then use the workspace directly without account setup."
          actions={[
            { href: "/dashboard", label: "Open dashboard", tone: "primary" },
            { href: "/", label: "Open workspace", tone: "secondary" },
          ]}
        />

        <SurfacePanel className="space-y-5">
          <SurfaceHeading
            title="Use the app without sign-in"
            description="This route stays available so older auth links still resolve clearly."
          />

          <div className="hairline-list text-sm leading-6 text-[color:var(--foreground-soft)]">
            <div>
              <p className="font-medium text-[color:var(--foreground)]">Step 1</p>
              <p className="mt-1">Save your OpenAI API key in the dashboard for the current browser session.</p>
            </div>
            <div>
              <p className="font-medium text-[color:var(--foreground)]">Step 2</p>
              <p className="mt-1">Open the workspace to paste a role, tailor your resume, and export the result.</p>
            </div>
          </div>
        </SurfacePanel>
      </div>
    </AppShell>
  );
}
