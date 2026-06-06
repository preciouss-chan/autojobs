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
}

export default function ApiKeyPage(): React.ReactElement {
  const [apiKey, setApiKey] = useState<string>("");
  const [saveMessage, setSaveMessage] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    function handleExtensionMessage(event: MessageEvent): void {
      if (event.source !== window || event.origin !== window.location.origin) {
        return;
      }

      const data = event.data as ExtensionMessageData;
      if (
        !data ||
        data.source !== EXTENSION_REPLY_SOURCE ||
        data.action !== "AUTOJOBS_API_KEY_STATUS" ||
        typeof data.apiKey !== "string"
      ) {
        return;
      }

      const extensionKey = data.apiKey.trim();
      if (!extensionKey) {
        return;
      }

      window.sessionStorage.setItem(OPENAI_API_KEY_STORAGE_KEY, extensionKey);
      setApiKey(extensionKey);
      setSaveMessage("Loaded the API key already saved in the extension.");
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
    });

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("message", handleExtensionMessage);
    };
  }, []);

  const hasSavedKey = useMemo(() => apiKey.trim().length > 0, [apiKey]);
  const keyStatusLabel = hasSavedKey ? "Key saved" : "No key saved";
  const saveToneClassName = saveMessage.includes("Saved") || saveMessage.includes("Loaded")
    ? "status-note status-note-success"
    : "status-note";

  function notifyExtension(action: "AUTOJOBS_SAVE_API_KEY" | "AUTOJOBS_CLEAR_API_KEY", apiKey?: string): void {
    window.postMessage(
      {
        source: EXTENSION_MESSAGE_SOURCE,
        action,
        ...(apiKey ? { apiKey } : {}),
      },
      window.location.origin
    );
  }

  function handleSave(): void {
    const trimmedKey = apiKey.trim();

    if (!trimmedKey) {
      window.sessionStorage.removeItem(OPENAI_API_KEY_STORAGE_KEY);
      notifyExtension("AUTOJOBS_CLEAR_API_KEY");
      setApiKey("");
      setSaveMessage("Removed the saved API key from this browser session.");
      return;
    }

    window.sessionStorage.setItem(OPENAI_API_KEY_STORAGE_KEY, trimmedKey);
    notifyExtension("AUTOJOBS_SAVE_API_KEY", trimmedKey);
    setApiKey(trimmedKey);
    setSaveMessage("Saved your API key for this browser session and synced it to the extension if installed.");
  }

  function handleClear(): void {
    window.sessionStorage.removeItem(OPENAI_API_KEY_STORAGE_KEY);
    notifyExtension("AUTOJOBS_CLEAR_API_KEY");
    setApiKey("");
    setSaveMessage("Removed the saved API key from this browser session.");
  }

  if (!isLoaded) {
    return (
      <AppShell>
        <PageHeader
          eyebrow="AutoJobs settings"
          title="Loading model key settings."
          description="Checking your browser session and extension storage."
        />
        <SurfacePanel className="mt-6 flex min-h-52 items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-[color:var(--line-strong)] border-t-[color:var(--foreground)]"></div>
            <p className="section-copy">Loading key settings…</p>
          </div>
        </SurfacePanel>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="AutoJobs settings"
        title="Manage your model key."
        description="Save an OpenAI-compatible key here only when your model provider needs one. The normal dashboard stays focused on the resume workflow."
        actions={[
          { href: "/dashboard", label: "Back to dashboard", tone: "secondary" },
          { href: "/", label: "Open workspace", tone: "subtle" },
        ]}
        meta={
          <>
            <span className="chip">Local-first</span>
            <span className="chip">Synced with extension</span>
            <span className="chip">{keyStatusLabel}</span>
          </>
        }
      />

      <main className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)]">
        <SurfacePanel className="space-y-6">
          <SurfaceHeading
            title="Optional API key"
            description="Your key is loaded into this browser session and synced with extension storage when the extension is installed. The workspace sends it to the app's server routes, but local Ollama-style setups do not need one."
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
              placeholder="sk-... or leave empty for local"
              className="field-input"
            />
            <p className="section-copy">
              Paste the key you want this browser session to use, or leave this empty when the server is configured for a local model.
              If the extension is installed, this page can also load the key already saved by the popup.
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
            <Link href="/dashboard" className="action-subtle">
              Back to dashboard
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
              title="When to use this"
              description="Most sessions should start from the dashboard; this page is only for model access."
            />

            <ol className="space-y-4 text-sm text-[color:var(--foreground-soft)]">
              <li className="flex gap-3">
                <span className="chip h-fit">1</span>
                <div>
                  <p className="font-medium text-[color:var(--foreground)]">Hosted models</p>
                  <p className="mt-1 leading-6">
                    Save a key here if you use OpenAI or another OpenAI-compatible hosted provider.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="chip h-fit">2</span>
                <div>
                  <p className="font-medium text-[color:var(--foreground)]">Local models</p>
                  <p className="mt-1 leading-6">
                    Leave this blank if your server is configured with a local Ollama-style model.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="chip h-fit">3</span>
                <div>
                  <p className="font-medium text-[color:var(--foreground)]">Normal flow</p>
                  <p className="mt-1 leading-6">
                    Start from the dashboard or workspace once the key setup is handled.
                  </p>
                </div>
              </li>
            </ol>
          </SurfacePanel>

          <SurfacePanel className="space-y-4">
            <SurfaceHeading
              title="Shortcuts"
              description="Jump back to the actual workflow when you are done."
            />

            <div className="flex flex-wrap gap-3">
              <Link href="/dashboard" className="action-secondary">
                Dashboard
              </Link>
              <Link href="/" className="action-subtle">
                Workspace
              </Link>
            </div>
          </SurfacePanel>
        </div>
      </main>
    </AppShell>
  );
}
