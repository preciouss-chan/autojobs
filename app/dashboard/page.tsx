"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AppShell, PageHeader, SurfaceHeading, SurfacePanel } from "@/app/components/AppShell";

export const dynamic = "force-dynamic";

const OPENAI_API_KEY_STORAGE_KEY = "openaiApiKey";

function maskApiKey(value: string): string {
  if (value.length <= 8) {
    return "Saved";
  }

  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

export default function DashboardPage(): React.ReactElement {
  const [apiKey, setApiKey] = useState<string>("");
  const [saveMessage, setSaveMessage] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const storedKey = window.sessionStorage.getItem(OPENAI_API_KEY_STORAGE_KEY) || "";
      setApiKey(storedKey);
      setIsLoaded(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  const hasSavedKey = useMemo(() => apiKey.trim().length > 0, [apiKey]);
  const saveToneClassName = saveMessage.includes("Saved")
    ? "status-note status-note-success"
    : "status-note";

  function handleSave(): void {
    const trimmedKey = apiKey.trim();

    if (!trimmedKey) {
      window.sessionStorage.removeItem(OPENAI_API_KEY_STORAGE_KEY);
      setApiKey("");
      setSaveMessage("Removed the saved API key from this browser session.");
      return;
    }

    window.sessionStorage.setItem(OPENAI_API_KEY_STORAGE_KEY, trimmedKey);
    setApiKey(trimmedKey);
    setSaveMessage("Saved your API key for this browser session.");
  }

  function handleClear(): void {
    window.sessionStorage.removeItem(OPENAI_API_KEY_STORAGE_KEY);
    setApiKey("");
    setSaveMessage("Removed the saved API key from this browser session.");
  }

  if (!isLoaded) {
    return (
      <AppShell>
        <PageHeader
          eyebrow="AutoJobs · Step 1 of 2"
          title="Set your session key first."
          description="This local-first setup keeps your OpenAI key in the current browser session so you can move into tailoring without extra account steps."
        />
        <SurfacePanel className="mt-6 flex min-h-52 items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-[color:var(--line-strong)] border-t-[color:var(--foreground)]"></div>
            <p className="section-copy">Loading your dashboard…</p>
          </div>
        </SurfacePanel>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="AutoJobs · Step 1 of 2"
        title="Save your session key, then head straight into tailoring."
        description="For students and new grads, the quickest path starts here: add your OpenAI key once for this browser session, then move into the workspace to paste a role, extract signals, and tailor your resume."
        actions={[
          { href: "/", label: "Open workspace", tone: "secondary" },
        ]}
        meta={
          <>
            <span className="chip">Local-first</span>
            <span className="chip">Session only</span>
            <span className="chip">
              {hasSavedKey ? `Ready · ${maskApiKey(apiKey.trim())}` : "Setup needed"}
            </span>
          </>
        }
      />

      <main className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)]">
        <SurfacePanel className="space-y-6">
          <SurfaceHeading
            title="OpenAI API key"
            description="Your key stays in sessionStorage for this browser session only. The workspace uses it through the app's server routes whenever you parse, extract requirements, or tailor a resume."
            aside={
              <span className="chip">
                {hasSavedKey ? `Saved · ${maskApiKey(apiKey.trim())}` : "Not saved yet"}
              </span>
            }
          />

          <div className="space-y-3">
            <label htmlFor="openai-api-key" className="field-label">
              Session API key
            </label>
            <input
              id="openai-api-key"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="sk-..."
              className="field-input"
            />
            <p className="section-copy">
              Paste the key you want this browser session to use. Clear it any time if you want to swap keys or reset the local setup.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSave}
              className="action-primary"
            >
              Save for this session
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="action-secondary"
            >
              Clear key
            </button>
            <Link href="/" className="action-subtle">
              Continue to workspace
            </Link>
          </div>

          {saveMessage ? (
            <p className={saveToneClassName}>{saveMessage}</p>
          ) : (
            <p className="status-note">
              Tip: once this is saved, the main workspace will immediately pick it up from the same browser session.
            </p>
          )}
        </SurfacePanel>

        <div className="space-y-6">
          <SurfacePanel muted className="space-y-5">
            <SurfaceHeading
              title="How the flow works"
              description="Keep setup light, then move into the actual resume work."
            />

            <ol className="space-y-4 text-sm text-[color:var(--foreground-soft)]">
              <li className="flex gap-3">
                <span className="chip h-fit">1</span>
                <div>
                  <p className="font-medium text-[color:var(--foreground)]">Save your key here</p>
                  <p className="mt-1 leading-6">
                    It stays in this browser session only, so you can work locally without extra account or billing steps.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="chip h-fit">2</span>
                <div>
                  <p className="font-medium text-[color:var(--foreground)]">Paste a job description in the workspace</p>
                  <p className="mt-1 leading-6">
                    Extract the role signals first if you want a quick structure check before tailoring.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="chip h-fit">3</span>
                <div>
                  <p className="font-medium text-[color:var(--foreground)]">Tailor and export</p>
                  <p className="mt-1 leading-6">
                    Review bullet rewrites, ATS feedback, and the merged resume preview before downloading a PDF.
                  </p>
                </div>
              </li>
            </ol>
          </SurfacePanel>

          <SurfacePanel className="space-y-4">
            <SurfaceHeading
              title="Local-first notes"
              description="The main web flow now stays practical and focused."
            />

            <ul className="space-y-3 text-sm leading-6 text-[color:var(--foreground-soft)]">
              <li>Billing, credits, and hosted sign-in are no longer part of this flow.</li>
              <li>The dashboard and workspace share the same browser-session API key.</li>
              <li>The fastest path is now setup here, then tailoring in the main workspace.</li>
            </ul>
          </SurfacePanel>
        </div>
      </main>
    </AppShell>
  );
}
