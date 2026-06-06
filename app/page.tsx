"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AppShell, PageHeader, SurfaceHeading, SurfacePanel } from "@/app/components/AppShell";
import FormErrorBoundary from "@/app/components/FormErrorBoundary";
import { ToastContainer, useToast } from "@/app/components/Toast";
import type { JobRequirements, Resume, TailorResponse } from "@/app/lib/schemas";
import { mergeResume } from "@/app/utils/mergeResume";
import resumeData from "@/data/resume.json";
import ResumePreview from "./ResumePreview";

type ApiError = {
  error: string;
  details?: string;
};

const OPENAI_API_KEY_STORAGE_KEY = "openaiApiKey";
const EXTENSION_MESSAGE_SOURCE = "autojobs-dashboard";
const EXTENSION_REPLY_SOURCE = "autojobs-extension";
const COVER_LETTER_SYNC_DELAY_MS = 300;
const RESUME_SYNC_DELAY_MS = 800;

export const dynamic = "force-dynamic";

type ResumeSkillCategory = keyof Resume["skills"];

interface ExtensionMessageData {
  readonly source?: unknown;
  readonly action?: unknown;
  readonly apiKey?: unknown;
  readonly resume?: unknown;
  readonly filename?: unknown;
  readonly hasResume?: unknown;
}

function isResume(value: unknown): value is Resume {
  return typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "contact" in value;
}

function postMessageToExtension(
  action: string,
  payload: Record<string, unknown> = {}
): void {
  if (typeof window === "undefined") {
    return;
  }

  window.postMessage(
    {
      source: EXTENSION_MESSAGE_SOURCE,
      action,
      ...payload,
    },
    window.location.origin
  );
}

function postCoverLetterToExtension(coverLetter: string): void {
  const trimmedCoverLetter = coverLetter.trim();
  postMessageToExtension(
    trimmedCoverLetter ? "AUTOJOBS_SAVE_COVER_LETTER" : "AUTOJOBS_CLEAR_COVER_LETTER",
    trimmedCoverLetter ? { coverLetter } : {}
  );
}

function parseCommaSeparatedList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function cloneResume(resume: Resume): Resume {
  return JSON.parse(JSON.stringify(resume)) as Resume;
}

function areResumesEqual(left: Resume | null, right: Resume | null): boolean {
  if (!left || !right) {
    return left === right;
  }

  return JSON.stringify(left) === JSON.stringify(right);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(index, index + chunkSize))
    );
  }

  return window.btoa(binary);
}

async function createResumePdfBlob(resume: Resume): Promise<Blob> {
  const response = await fetch("/api/export/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(resume),
  });
  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok || !contentType.includes("pdf")) {
    const errorText = await response.text().catch(() => "");
    throw new Error(errorText || `PDF export failed with status ${response.status}`);
  }

  return response.blob();
}

async function syncTailoredResumePdfToExtension(resume: Resume): Promise<void> {
  try {
    const blob = await createResumePdfBlob(resume);
    const buffer = await blob.arrayBuffer();
    postMessageToExtension("AUTOJOBS_SAVE_TAILORED_RESUME_PDF", {
      base64: arrayBufferToBase64(buffer),
      filename: "Tailored_Resume.pdf",
    });
  } catch (err: unknown) {
    console.warn("Unable to sync edited resume PDF to extension:", err);
  }
}

function getExtensionMessageData(event: MessageEvent): ExtensionMessageData | null {
  if (event.source !== window || event.origin !== window.location.origin) {
    return null;
  }

  const data = event.data as ExtensionMessageData;
  if (!data || data.source !== EXTENSION_REPLY_SOURCE) {
    return null;
  }

  return data;
}

interface DetailItemProps {
  readonly label: string;
  readonly value: string;
}

function DetailItem({ label, value }: DetailItemProps): React.ReactElement {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-[color:var(--foreground-soft)]">
        {label}
      </p>
      <p className="text-sm leading-6 text-[color:var(--foreground)]">{value}</p>
    </div>
  );
}

interface ListBlockProps {
  readonly title: string;
  readonly items: readonly string[];
  readonly emptyMessage: string;
}

function ListBlock({ title, items, emptyMessage }: ListBlockProps): React.ReactElement {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-[color:var(--foreground)]">{title}</h3>
      {items.length > 0 ? (
        <ul className="space-y-2 text-sm leading-6 text-[color:var(--foreground-soft)]">
          {items.map((item) => (
            <li key={item} className="flex gap-3">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[color:var(--foreground-soft)]"></span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[color:var(--foreground-soft)]">{emptyMessage}</p>
      )}
    </section>
  );
}

interface ChipListProps {
  readonly title: string;
  readonly items: readonly string[];
  readonly emptyMessage: string;
}

function ChipList({ title, items, emptyMessage }: ChipListProps): React.ReactElement {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-[color:var(--foreground)]">{title}</h3>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <span key={item} className="chip">
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[color:var(--foreground-soft)]">{emptyMessage}</p>
      )}
    </section>
  );
}

function formatTitleAlignment(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function TailorPage(): React.ReactElement {
  const { toasts, addToast, removeToast } = useToast();
  const [job, setJob] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [extracting, setExtracting] = useState<boolean>(false);
  const [uploadingResume, setUploadingResume] = useState<boolean>(false);
  const [requirements, setRequirements] = useState<JobRequirements | null>(null);
  const [result, setResult] = useState<TailorResponse | null>(null);
  const [generatedCoverLetter, setGeneratedCoverLetter] = useState<string>("");
  const [currentResume, setCurrentResume] = useState<Resume>(resumeData as Resume);
  const [mergedResume, setMergedResume] = useState<Resume | null>(null);
  const [generatedMergedResume, setGeneratedMergedResume] = useState<Resume | null>(null);
  const [isResumeEditMode, setIsResumeEditMode] = useState<boolean>(false);
  const [apiKey, setApiKey] = useState<string>("");
  const [apiKeyLoaded, setApiKeyLoaded] = useState<boolean>(false);
  const [hasCustomResume, setHasCustomResume] = useState<boolean>(false);
  const [resumeFilename, setResumeFilename] = useState<string>("");
  const hasTailoredResult = result !== null;

  useEffect(() => {
    function handleExtensionMessage(event: MessageEvent): void {
      const data = getExtensionMessageData(event);
      if (!data) {
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
        isResume(data.resume)
      ) {
        setCurrentResume(data.resume);
        setHasCustomResume(true);
        setResumeFilename(typeof data.filename === "string" ? data.filename : "");
      }
    }

    window.addEventListener("message", handleExtensionMessage);

    const frame = window.requestAnimationFrame(() => {
      const storedKey = window.sessionStorage.getItem(OPENAI_API_KEY_STORAGE_KEY) || "";
      setApiKey(storedKey);
      setApiKeyLoaded(true);
      postMessageToExtension("AUTOJOBS_GET_API_KEY");
      postMessageToExtension("AUTOJOBS_GET_UPLOADED_RESUME");
    });

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("message", handleExtensionMessage);
    };
  }, []);

  useEffect(() => {
    if (!result) {
      return;
    }

    const coverLetter = String(result.cover_letter || "");
    const timeoutId = window.setTimeout(() => {
      postCoverLetterToExtension(coverLetter);
    }, COVER_LETTER_SYNC_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [result]);

  useEffect(() => {
    if (!hasTailoredResult || !mergedResume) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void syncTailoredResumePdfToExtension(mergedResume);
    }, RESUME_SYNC_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [hasTailoredResult, mergedResume]);

  function extractJobText(input: string): string {
    input = input.trim();
    if (!input) return "";

    if (input.startsWith("{") && input.endsWith("}")) {
      try {
        const parsed = JSON.parse(input) as { jobDescription?: string };
        if (parsed?.jobDescription) return parsed.jobDescription;
      } catch {
        return input;
      }
    }

    return input;
  }

  function isApiError(value: unknown): value is ApiError {
    return typeof value === "object" && value !== null && "error" in value;
  }

  function buildApiHeaders(contentType?: string): HeadersInit {
    const headers: Record<string, string> = {};

    if (contentType) {
      headers["Content-Type"] = contentType;
    }

    if (apiKey.trim()) {
      headers["X-OpenAI-API-Key"] = apiKey.trim();
    }

    return headers;
  }

  async function readErrorMessage(response: Response): Promise<string> {
    try {
      const data = (await response.json()) as ApiError;
      if (isApiError(data)) {
        return data.details ? `${data.error} ${data.details}` : data.error;
      }
      return `Request failed with status ${response.status}`;
    } catch {
      return `Request failed with status ${response.status}`;
    }
  }

  async function handleExtractRequirements(): Promise<void> {
    setExtracting(true);
    setRequirements(null);

    const jobText = extractJobText(job);
    if (!jobText) {
      addToast("error", "Paste a job description before extracting requirements.");
      setExtracting(false);
      return;
    }

    try {
      const response = await fetch("/api/extract-requirements", {
        method: "POST",
        headers: buildApiHeaders("application/json"),
        body: JSON.stringify({ jobDescription: jobText }),
      });

      if (!response.ok) {
        addToast("error", `Extraction failed: ${await readErrorMessage(response)}`);
        setExtracting(false);
        return;
      }

      const data = (await response.json()) as JobRequirements | ApiError;
      if (isApiError(data)) {
        addToast("error", `Extraction failed: ${data.error}`);
      } else {
        setRequirements(data);
        addToast("success", "Requirements extracted. Review the job signals below.");
      }
    } catch (err: unknown) {
      addToast("error", "An error occurred extracting requirements. Check console.");
      console.error(err);
    }

    setExtracting(false);
  }

  async function handleResumeUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingResume(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/parse-resume", {
        method: "POST",
        headers: buildApiHeaders(),
        body: formData,
      });

      if (!response.ok) {
        addToast("error", `Upload failed: ${await readErrorMessage(response)}`);
        setUploadingResume(false);
        return;
      }

      const parsedResume = (await response.json()) as Resume;
      setCurrentResume(parsedResume);
      setHasCustomResume(true);
      setResumeFilename(file.name);
      postMessageToExtension("AUTOJOBS_SAVE_UPLOADED_RESUME", {
        resume: parsedResume,
        filename: file.name,
      });
      addToast("success", "Resume uploaded and parsed successfully.");
    } catch (err: unknown) {
      addToast("error", "An error occurred uploading resume. Check console.");
      console.error(err);
    }

    setUploadingResume(false);
  }

  async function handleTailor(): Promise<void> {
    setLoading(true);
    setResult(null);
    setGeneratedCoverLetter("");
    setGeneratedMergedResume(null);
    setMergedResume(null);
    setIsResumeEditMode(false);
    postCoverLetterToExtension("");

    const jobText = extractJobText(job);
    if (!jobText) {
      addToast("error", "Paste a job description before tailoring your resume.");
      setLoading(false);
      return;
    }

    try {
      const payload = {
        jobDescription: jobText,
        ...(requirements ? { jobRequirements: requirements } : {}),
        resume: currentResume,
      };

      const response = await fetch("/api/tailor", {
        method: "POST",
        headers: buildApiHeaders("application/json"),
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        addToast("error", `Tailor failed: ${await readErrorMessage(response)}`);
        setLoading(false);
        return;
      }

      const data = (await response.json()) as TailorResponse | ApiError;
      if (isApiError(data)) {
        addToast("error", `Tailor failed: ${data.error}`);
        setLoading(false);
        return;
      }

      setResult(data);
      setGeneratedCoverLetter(String(data.cover_letter || ""));
      const merged = mergeResume(currentResume, data);
      setMergedResume(merged);
      setGeneratedMergedResume(cloneResume(merged));
      addToast("success", "Resume tailored successfully.");
    } catch (err: unknown) {
      addToast("error", "An error occurred tailoring resume. Check console.");
      console.error(err);
    }

    setLoading(false);
  }

  async function handleDownloadPdf(): Promise<void> {
    if (!mergedResume) {
      return;
    }

    try {
      const blob = await createResumePdfBlob(mergedResume);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "resume.pdf";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      console.error(err);
      addToast("error", "Something went wrong generating the PDF.");
    }
  }

  function copy(text: string): void {
    navigator.clipboard.writeText(text);
    addToast("info", "Copied to clipboard.", 2200);
  }

  function handleClear(): void {
    setJob("");
    setResult(null);
    setGeneratedCoverLetter("");
    setRequirements(null);
    setMergedResume(null);
    setGeneratedMergedResume(null);
    setIsResumeEditMode(false);
    postCoverLetterToExtension("");
  }

  function updateMergedResume(updater: (resume: Resume) => Resume): void {
    setMergedResume((current) => current ? updater(current) : current);
  }

  function handleResumeSkillChange(category: ResumeSkillCategory, value: string): void {
    updateMergedResume((resume) => ({
      ...resume,
      skills: {
        ...resume.skills,
        [category]: parseCommaSeparatedList(value),
      },
    }));
  }

  function handleExperienceBulletChange(
    experienceIndex: number,
    bulletIndex: number,
    value: string
  ): void {
    updateMergedResume((resume) => ({
      ...resume,
      experience: resume.experience.map((item, itemIndex) =>
        itemIndex === experienceIndex
          ? {
              ...item,
              bullets: item.bullets.map((bullet, currentBulletIndex) =>
                currentBulletIndex === bulletIndex ? value : bullet
              ),
            }
          : item
      ),
    }));
  }

  function handleProjectBulletChange(
    projectIndex: number,
    bulletIndex: number,
    value: string
  ): void {
    updateMergedResume((resume) => ({
      ...resume,
      projects: resume.projects.map((item, itemIndex) =>
        itemIndex === projectIndex
          ? {
              ...item,
              bullets: item.bullets.map((bullet, currentBulletIndex) =>
                currentBulletIndex === bulletIndex ? value : bullet
              ),
            }
          : item
      ),
    }));
  }

  function handleResetResume(): void {
    if (!generatedMergedResume) {
      return;
    }

    setMergedResume(cloneResume(generatedMergedResume));
    addToast("info", "Resume reset to the generated draft.", 2200);
  }

  function handleCoverLetterChange(value: string): void {
    setResult((current) => current ? { ...current, cover_letter: value } : current);
  }

  function handleCoverLetterBlur(): void {
    if (!result) {
      return;
    }

    postCoverLetterToExtension(String(result.cover_letter || ""));
  }

  function handleResetCoverLetter(): void {
    setResult((current) => current ? { ...current, cover_letter: generatedCoverLetter } : current);
    addToast("info", "Cover letter reset to the generated draft.", 2200);
  }

  const hasApiKey = apiKey.trim().length > 0;
  const hasJobText = job.trim().length > 0;
  const resumeSourceLabel = hasCustomResume
    ? `Using ${resumeFilename || currentResume.name || "your uploaded resume"}`
    : "Using bundled default resume";
  const isCoverLetterEdited = Boolean(
    result && generatedCoverLetter && String(result.cover_letter || "") !== generatedCoverLetter
  );
  const isResumeEdited = Boolean(
    mergedResume && generatedMergedResume && !areResumesEqual(mergedResume, generatedMergedResume)
  );
  const setupClassName = !apiKeyLoaded
    ? "status-note"
    : hasApiKey
      ? "status-note status-note-success"
      : "status-note status-note-accent";
  const setupMessage = !apiKeyLoaded
    ? "Checking this browser session for an optional saved API key."
    : hasApiKey
      ? "Dashboard session key loaded. The server will use it unless a local LLM is configured."
      : "No session key saved. This works with a local LLM server, or with OPENAI_API_KEY on the server.";

  return (
    <AppShell>
      <PageHeader
        eyebrow="AutoJobs · Step 2 of 2"
        title="Paste the role, tighten the draft, and export a stronger resume."
        description="This workspace is built for the fastest path from job description to tailored resume. Start with the role, review the extracted signals if needed, then tailor and export without leaving the local flow."
        actions={[
          {
            href: "/dashboard",
            label: "Dashboard",
            tone: hasApiKey ? "secondary" : "subtle",
          },
        ]}
        meta={
          <>
            <span className="chip">Workflow</span>
            <span className="chip">
              {hasCustomResume ? "Uploaded resume in use" : "Using default resume"}
            </span>
            <span className="chip">
              {result ? "Tailored draft ready" : requirements ? "Job signals extracted" : "Awaiting input"}
            </span>
          </>
        }
      />

      <main className="mt-8 space-y-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.75fr)]">
          <SurfacePanel className="space-y-6">
            <SurfaceHeading
              title="Tailoring workspace"
              description="Start with the job description. Upload a PDF only if you want to replace the bundled resume before tailoring."
            />

            <p className={setupClassName}>{setupMessage}</p>

            <FormErrorBoundary
              onError={(error) => {
                console.error("Form error:", error);
              }}
            >
              <div className="grid gap-6 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)]">
                <div className="space-y-4">
                  <div className="space-y-3">
                    <label htmlFor="resume-upload" className="field-label">
                      Resume (PDF)
                    </label>
                    <input
                      id="resume-upload"
                      type="file"
                      accept=".pdf"
                      onChange={handleResumeUpload}
                      disabled={uploadingResume}
                      aria-label="Upload PDF resume file"
                      aria-busy={uploadingResume}
                      aria-describedby="resume-upload-hint"
                      className="sr-only"
                    />
                    <div className="flex min-w-0 flex-col items-start gap-2">
                      <label
                        htmlFor="resume-upload"
                        className="inline-flex h-11 shrink-0 cursor-pointer items-center rounded-full border border-[color:var(--line-strong)] px-4 text-sm font-medium text-[color:var(--foreground)] hover:border-[color:var(--accent-strong)] hover:text-[color:var(--accent-strong)]"
                      >
                        Choose PDF
                      </label>
                      <span className="max-w-full truncate text-sm font-medium text-[color:var(--foreground-soft)]">
                        {resumeSourceLabel}
                      </span>
                    </div>
                    <p id="resume-upload-hint" className="section-copy">
                      {hasCustomResume
                        ? "This resume is the current source for tailoring. If it came from the extension cache, the browser file picker may still appear empty."
                        : "If you skip upload, the app keeps using the bundled default resume."}
                    </p>
                    {uploadingResume ? (
                      <p className="text-sm text-[color:var(--foreground-soft)]" role="status" aria-live="polite">
                        Uploading and parsing your resume…
                      </p>
                    ) : null}
                  </div>

                  <div className="status-note">
                    <p className="font-medium text-[color:var(--foreground)]">Keep setup practical</p>
                    <p className="mt-1 text-sm leading-6">
                      Dashboard is step one. This page is step two: paste a role, review the extracted signals, then tailor when you are ready.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-3">
                    <label htmlFor="job-description" className="field-label">
                      Job description
                    </label>
                    <textarea
                      id="job-description"
                      value={job}
                      onChange={(event) => setJob(event.target.value)}
                      aria-describedby="job-description-hint"
                      placeholder="Paste the full job description or a JSON payload with a jobDescription field."
                      className="field-textarea h-72 resize-y"
                    />
                    <p id="job-description-hint" className="section-copy">
                      Paste the role first. Extract requirements if you want a quick structure check, or tailor immediately using the role text and current resume.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleExtractRequirements}
                      disabled={extracting || !hasJobText}
                      aria-label={extracting ? "Extracting job requirements" : "Extract job requirements from description"}
                      aria-busy={extracting}
                      className="action-secondary"
                    >
                      {extracting ? "Extracting…" : "Extract requirements"}
                    </button>

                    <button
                      type="button"
                      onClick={handleTailor}
                      disabled={loading || !hasJobText}
                      aria-label={loading ? "Tailoring your resume" : "Tailor resume to job description"}
                      aria-busy={loading}
                      className="action-primary"
                    >
                      {loading ? "Tailoring…" : "Tailor resume"}
                    </button>

                    <button
                      type="button"
                      onClick={handleClear}
                      aria-label="Clear all inputs and results"
                      className="action-secondary"
                    >
                      Clear results
                    </button>
                  </div>
                </div>
              </div>
            </FormErrorBoundary>
          </SurfacePanel>

          <div className="space-y-6">
            <SurfacePanel muted className="space-y-5">
              <SurfaceHeading
                title="Fast path"
                description="Use the same order every time to move faster."
              />

              <ol className="space-y-4 text-sm leading-6 text-[color:var(--foreground-soft)]">
                <li className="flex gap-3">
                  <span className="chip h-fit">1</span>
                  <div>
                    <p className="font-medium text-[color:var(--foreground)]">Start from the dashboard</p>
                    <p className="mt-1">Save a key only if you are using OpenAI instead of a local model.</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="chip h-fit">2</span>
                  <div>
                    <p className="font-medium text-[color:var(--foreground)]">Paste the job post here</p>
                    <p className="mt-1">Extract signals first if you want a cleaner view of the role before tailoring.</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="chip h-fit">3</span>
                  <div>
                    <p className="font-medium text-[color:var(--foreground)]">Review, tailor, export</p>
                    <p className="mt-1">Check the rewrites, ATS notes, cover letter, and merged preview before downloading the PDF.</p>
                  </div>
                </li>
              </ol>
            </SurfacePanel>

            <SurfacePanel className="space-y-4">
              <SurfaceHeading
                title="Current session"
                description="The workspace reads the same browser-session key you manage from settings."
              />

              <p className={setupClassName}>{setupMessage}</p>

              <Link href="/dashboard/api-key" className="action-subtle">
                Manage API key
              </Link>
            </SurfacePanel>
          </div>
        </div>

        {requirements ? (
          <SurfacePanel className="space-y-6">
            <SurfaceHeading
              title="Extracted job signals"
              description="Use this as a quick read on the role before you tailor the resume."
            />

            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
              <DetailItem label="Job title" value={requirements.title || "Not identified"} />
              <DetailItem label="Seniority" value={requirements.seniority_level || "Not identified"} />
              <DetailItem label="Domain" value={requirements.domain || "Not identified"} />
              <DetailItem label="Team focus" value={requirements.team_focus || "Not identified"} />
              <DetailItem
                label="Experience"
                value={requirements.experience_years ? `${requirements.experience_years}+ years` : "Not specified"}
              />
            </div>

            <div className="hairline-list">
              <ChipList
                title="Required skills"
                items={requirements.required_skills}
                emptyMessage="No required skills were surfaced."
              />
              <ChipList
                title="Nice-to-have skills"
                items={requirements.nice_to_have_skills}
                emptyMessage="No optional skills were surfaced."
              />
              <ChipList
                title="Required tools and frameworks"
                items={requirements.required_tools_frameworks}
                emptyMessage="No tools or frameworks were surfaced."
              />
              <ListBlock
                title="Key responsibilities"
                items={requirements.key_responsibilities}
                emptyMessage="No responsibilities were surfaced."
              />
            </div>
          </SurfacePanel>
        ) : null}

        {result ? (
          <SurfacePanel className="space-y-6">
            <SurfaceHeading
              title="Tailored output"
              description="Review the returned edits and alignment notes before you export the final draft."
            />

            <div className="grid gap-6 lg:grid-cols-2">
              <ListBlock
                title="What improved"
                items={result.improvement_notes}
                emptyMessage="No improvement notes were returned."
              />
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-[color:var(--foreground)]">Skills to add</h3>
                {Object.values(result.skills_to_add).some((items) => items.length > 0) ? (
                  <div className="space-y-3 text-sm leading-6 text-[color:var(--foreground-soft)]">
                    {Object.entries(result.skills_to_add).map(([category, items]) =>
                      items.length > 0 ? (
                        <p key={category}>
                          <span className="font-medium text-[color:var(--foreground)]">
                            {category.replace(/_/g, " ")}
                          </span>{" "}
                          {items.join(", ")}
                        </p>
                      ) : null
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-[color:var(--foreground-soft)]">
                    No additional skills were suggested.
                  </p>
                )}
              </section>
            </div>

            <div className="hairline-list">
              <section className="space-y-5">
                <h3 className="text-sm font-semibold text-[color:var(--foreground)]">ATS optimization</h3>

                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
                  <DetailItem label="ATS score" value={`${result.ats_analysis.score}/100`} />
                  <DetailItem
                    label="Target title"
                    value={result.ats_analysis.target_job_title || "Not identified"}
                  />
                  <DetailItem
                    label="Title alignment"
                    value={formatTitleAlignment(result.ats_analysis.title_alignment)}
                  />
                  <DetailItem
                    label="Matched keywords"
                    value={result.ats_analysis.matched_keywords.length > 0 ? `${result.ats_analysis.matched_keywords.length}` : "0"}
                  />
                  <DetailItem
                    label="Section coverage"
                    value={`${result.ats_analysis.section_coverage.summary.length + result.ats_analysis.section_coverage.skills.length + result.ats_analysis.section_coverage.experience.length + result.ats_analysis.section_coverage.projects.length} signals`}
                  />
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <ChipList
                    title="Matched keywords"
                    items={result.ats_analysis.matched_keywords}
                    emptyMessage="No matched keywords surfaced yet."
                  />
                  <ListBlock
                    title="Section coverage"
                    items={[
                      `Summary: ${result.ats_analysis.section_coverage.summary.length}`,
                      `Skills: ${result.ats_analysis.section_coverage.skills.length}`,
                      `Experience: ${result.ats_analysis.section_coverage.experience.length}`,
                      `Projects: ${result.ats_analysis.section_coverage.projects.length}`,
                    ]}
                    emptyMessage="No section coverage information was returned."
                  />
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <ListBlock
                    title="Formatting warnings"
                    items={result.ats_analysis.formatting_warnings}
                    emptyMessage="No formatting warnings were returned."
                  />
                  <ListBlock
                    title="Optimization tips"
                    items={result.ats_analysis.optimization_tips}
                    emptyMessage="No optimization tips were returned."
                  />
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-[color:var(--foreground)]">Changed bullets</h3>
                {result.changed_bullets.length > 0 ? (
                  <div className="space-y-4">
                    {result.changed_bullets.map((item) => (
                      <article key={item.id} className="rounded-2xl border border-[color:var(--line)] px-4 py-4">
                        <p className="text-sm font-medium text-[color:var(--foreground)]">
                          {item.section_label} · bullet {item.index + 1}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--foreground-soft)]">
                          <span className="font-medium text-[color:var(--foreground)]">Original:</span>{" "}
                          {item.original}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                          <span className="font-medium">Revised:</span> {item.revised}
                        </p>
                        <p className="mt-2 text-xs leading-5 text-[color:var(--foreground-soft)]">{item.reason}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[color:var(--foreground-soft)]">
                    No bullet rewrites were accepted.
                  </p>
                )}
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-[color:var(--foreground)]">Missing keywords and gaps</h3>
                {result.missing_keywords.length > 0 ? (
                  <ul className="space-y-3 text-sm leading-6 text-[color:var(--foreground-soft)]">
                    {result.missing_keywords.map((gap) => (
                      <li key={`${gap.category}-${gap.keyword}`}>
                        <span className="font-medium text-[color:var(--foreground)]">{gap.keyword}</span>
                        {` — ${gap.reason}`}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[color:var(--foreground-soft)]">
                    No unsupported gaps were identified.
                  </p>
                )}
              </section>

              <section className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-[color:var(--foreground)]">Cover letter</h3>
                      {isCoverLetterEdited ? <span className="chip">Edited</span> : null}
                    </div>
                    <p className="section-copy">Edit this draft before copying it into an application.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleResetCoverLetter}
                      disabled={!isCoverLetterEdited}
                      aria-label="Reset cover letter to generated draft"
                      className="action-secondary"
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => copy(String(result.cover_letter || ""))}
                      disabled={!String(result.cover_letter || "").trim()}
                      aria-label="Copy edited cover letter text to clipboard"
                      className="action-secondary"
                    >
                      Copy cover letter
                    </button>
                  </div>
                </div>

                <textarea
                  value={String(result.cover_letter || "")}
                  onChange={(event) => handleCoverLetterChange(event.target.value)}
                  onBlur={handleCoverLetterBlur}
                  aria-label="Edit generated cover letter"
                  className="field-textarea min-h-80 resize-y leading-7"
                  placeholder="No cover letter returned."
                />
              </section>
            </div>
          </SurfacePanel>
        ) : null}

        {mergedResume ? (
          <SurfacePanel className="space-y-6">
            <SurfaceHeading
              title="Resume preview"
              description={
                isResumeEditMode
                  ? "Edit directly in this view. The PDF export and extension upload will use these changes."
                  : "Review the tailored draft before downloading or editing it inline."
              }
              aside={
                <div className="flex flex-wrap gap-2">
                  {isResumeEdited ? (
                    <button
                      type="button"
                      onClick={handleResetResume}
                      aria-label="Reset resume to generated draft"
                      className="action-secondary"
                    >
                      Reset
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setIsResumeEditMode((current) => !current)}
                    aria-label={isResumeEditMode ? "Finish editing resume preview" : "Edit resume preview inline"}
                    className="action-secondary"
                  >
                    {isResumeEditMode ? "Done editing" : "Edit preview"}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    aria-label="Download tailored resume as PDF"
                    className="action-primary"
                  >
                    Download PDF
                  </button>
                </div>
              }
            />

            <div className="overflow-hidden rounded-2xl border border-[color:var(--line)] bg-white">
              <ResumePreview
                resume={mergedResume}
                editable={isResumeEditMode}
                onSkillChange={handleResumeSkillChange}
                onExperienceBulletChange={handleExperienceBulletChange}
                onProjectBulletChange={handleProjectBulletChange}
              />
            </div>
          </SurfacePanel>
        ) : null}
      </main>

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </AppShell>
  );
}
