"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AppShell, PageHeader, SurfaceHeading, SurfacePanel } from "@/app/components/AppShell";

export const dynamic = "force-dynamic";

const OPENAI_API_KEY_STORAGE_KEY = "openaiApiKey";
const EXTENSION_MESSAGE_SOURCE = "autojobs-dashboard";
const EXTENSION_REPLY_SOURCE = "autojobs-extension";

interface ExtensionMessageData {
  readonly source?: unknown;
  readonly action?: unknown;
  readonly apiKey?: unknown;
  readonly resume?: unknown;
  readonly filename?: unknown;
  readonly hasResume?: unknown;
}

export default function DashboardPage(): React.ReactElement {
  const [apiKey, setApiKey] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [resumeFilename, setResumeFilename] = useState<string>("");

  useEffect(() => {
    function handleExtensionMessage(event: MessageEvent): void {
      if (event.source !== window || event.origin !== window.location.origin) {
        return;
      }

      const data = event.data as ExtensionMessageData;
      if (!data || data.source !== EXTENSION_REPLY_SOURCE) {
        return;
      }

      if (data.action === "AUTOJOBS_API_KEY_STATUS" && typeof data.apiKey === "string") {
        const extensionKey = data.apiKey.trim();
        if (extensionKey) {
          window.sessionStorage.setItem(OPENAI_API_KEY_STORAGE_KEY, extensionKey);
          setApiKey(extensionKey);
        }
      }

      if (
        data.action === "AUTOJOBS_RESUME_STATUS" &&
        data.hasResume === true &&
        typeof data.filename === "string"
      ) {
        setResumeFilename(data.filename);
      }
    }

    window.addEventListener("message", handleExtensionMessage);

    const frame = window.requestAnimationFrame(() => {
      const storedKey = window.sessionStorage.getItem(OPENAI_API_KEY_STORAGE_KEY) || "";
      setApiKey(storedKey);
      setIsLoaded(true);
      window.postMessage(
        {
          source: EXTENSION_MESSAGE_SOURCE,
          action: "AUTOJOBS_GET_API_KEY",
        },
        window.location.origin
      );
      window.postMessage(
        {
          source: EXTENSION_MESSAGE_SOURCE,
          action: "AUTOJOBS_GET_UPLOADED_RESUME",
        },
        window.location.origin
      );
    });

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("message", handleExtensionMessage);
    };
  }, []);

  const hasSavedKey = useMemo(() => apiKey.trim().length > 0, [apiKey]);
  const keyLabel = hasSavedKey ? "Model key saved" : "No model key";
  const resumeLabel = resumeFilename ? `Cached · ${resumeFilename}` : "No cached resume";

  if (!isLoaded) {
    return (
      <AppShell>
        <PageHeader
          eyebrow="AutoJobs dashboard"
          title="Loading your workspace."
          description="Checking your extension cache and browser session."
        />
        <SurfacePanel className="mt-6 flex min-h-52 items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-[color:var(--line-strong)] border-t-[color:var(--foreground)]"></div>
            <p className="section-copy">Loading dashboard…</p>
          </div>
        </SurfacePanel>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="AutoJobs dashboard"
        title="Start from the work, not setup."
        description="Use this hub to jump into tailoring, check what the extension has cached, and manage your model key only when you need to."
        actions={[
          { href: "/", label: "Open workspace", tone: "primary" },
          { href: "/dashboard/api-key", label: "Manage API key", tone: "secondary" },
        ]}
        meta={
          <>
            <span className="chip">{keyLabel}</span>
            <span className="chip">{resumeLabel}</span>
          </>
        }
      />

      <main className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
        <SurfacePanel className="space-y-6">
          <SurfaceHeading
            title="Tailoring workspace"
            description="Paste a role, tailor the resume, edit the cover letter, and export without going through setup again."
          />

          <div className="flex flex-wrap gap-3">
            <Link href="/" className="action-primary">
              Open workspace
            </Link>
            <Link href="/dashboard/api-key" className="action-secondary">
              Manage API key
            </Link>
          </div>

          {!hasSavedKey ? (
            <p className="status-note">
              No API key is saved in this browser session. Add one if you use OpenAI, or keep going if your server is configured for a local model.
            </p>
          ) : (
            <p className="status-note status-note-success">
              Your saved key is available to the workspace for hosted model calls.
            </p>
          )}
        </SurfacePanel>

        <div className="space-y-6">
          <SurfacePanel muted className="space-y-5">
            <SurfaceHeading
              title="Current setup"
              description="A quick read on what the app can use right now."
            />

            <div className="space-y-4 text-sm leading-6 text-[color:var(--foreground-soft)]">
              <div>
                <p className="font-medium text-[color:var(--foreground)]">Model key</p>
                <p>{hasSavedKey ? "Saved in this browser session and synced with the extension." : "No hosted model key saved."}</p>
              </div>
              <div>
                <p className="font-medium text-[color:var(--foreground)]">Resume cache</p>
                <p>{resumeFilename || "Upload a resume from the popup or workspace when you are ready."}</p>
              </div>
            </div>
          </SurfacePanel>

          <SurfacePanel className="space-y-4">
            <SurfaceHeading
              title="Shortcuts"
              description="The pieces you probably want most often."
            />

            <div className="flex flex-wrap gap-3">
              <Link href="/" className="action-secondary">
                Tailor a role
              </Link>
              <Link href="/dashboard/api-key" className="action-subtle">
                Key settings
              </Link>
            </div>
          </SurfacePanel>
        </div>
      </main>
    </AppShell>
  );
}
