"use client";

import { useEffect } from "react";

import { AppShell, PageHeader, SurfacePanel } from "@/app/components/AppShell";

export const dynamic = "force-dynamic";

export default function ExtensionAuthPage(): React.ReactElement {
  useEffect(() => {
    const timer = setTimeout(() => {
      window.close();
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-8">
        <PageHeader
          eyebrow="AutoJobs · Extension handoff"
          title="Finishing the extension handoff."
          description="This page should close automatically once the extension has what it needs."
        />

        <SurfacePanel className="flex min-h-56 flex-col items-center justify-center gap-5 text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-[color:var(--line-strong)] border-t-[color:var(--foreground)]"></div>
          <div className="space-y-2">
            <p className="text-base font-medium text-[color:var(--foreground)]">Closing this window…</p>
            <p className="section-copy max-w-md">
              If the window stays open, return to the extension and continue there.
            </p>
          </div>
        </SurfacePanel>
      </div>
    </AppShell>
  );
}
