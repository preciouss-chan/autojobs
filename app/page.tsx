"use client";

import { mergeResume } from "@/app/utils/mergeResume";
import ResumePreview from "./ResumePreview";
import { ToastContainer, useToast } from "@/app/components/Toast";
import FormErrorBoundary from "./components/FormErrorBoundary";
import resumeData from "@/data/resume.json";
import { useState } from "react";
import type { JobRequirements, Resume, TailorResponse } from "@/app/lib/schemas";

type ApiError = {
  error: string;
};

export const dynamic = "force-dynamic";

export default function TailorPage(): React.ReactElement {
  const { toasts, addToast, removeToast } = useToast();
  const [job, setJob] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [extracting, setExtracting] = useState<boolean>(false);
  const [uploadingResume, setUploadingResume] = useState<boolean>(false);
  const [requirements, setRequirements] = useState<JobRequirements | null>(
    null
  );
  const [result, setResult] = useState<TailorResponse | null>(null);
  const [currentResume, setCurrentResume] = useState<Resume>(
    resumeData as Resume
  );
  const [mergedResume, setMergedResume] = useState<Resume | null>(null);

  function extractJobText(input: string): string {
    input = input.trim();
    if (!input) return "";

    if (input.startsWith("{") && input.endsWith("}")) {
      try {
        const parsed = JSON.parse(input) as { jobDescription?: string };
        if (parsed?.jobDescription) return parsed.jobDescription;
      } catch {
        // Continue with raw input if JSON parsing fails
      }
    }
    return input;
  }

  function isApiError(value: unknown): value is ApiError {
    return typeof value === "object" && value !== null && "error" in value;
  }

  async function handleExtractRequirements(): Promise<void> {
    setExtracting(true);
    setRequirements(null);

    const jobText = extractJobText(job);
    if (!jobText) {
      addToast("error", "Please paste a job description first.");
      setExtracting(false);
      return;
    }

    try {
      const response = await fetch("/api/extract-requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription: jobText }),
      });

      const data = (await response.json()) as JobRequirements | ApiError;
      if (isApiError(data)) {
        addToast("error", `Extraction failed: ${data.error}`);
      } else {
        setRequirements(data);
        addToast("success", "Job requirements extracted successfully!");
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
        body: formData,
      });

      if (!response.ok) {
        const errorData = (await response.json()) as Record<string, unknown>;
        addToast(
          "error",
          `Upload failed: ${errorData.error || "Unknown error"}`
        );
        setUploadingResume(false);
        return;
      }

      const parsedResume = (await response.json()) as Resume;
      setCurrentResume(parsedResume);
      addToast("success", "Resume uploaded and parsed successfully!");
    } catch (err: unknown) {
      addToast("error", "An error occurred uploading resume. Check console.");
      console.error(err);
    }

    setUploadingResume(false);
  }

  async function handleTailor(): Promise<void> {
    setLoading(true);
    setResult(null);

    const jobText = extractJobText(job);
    if (!jobText) {
      addToast("error", "Please paste a job description first.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobDescription: jobText,
          jobRequirements: requirements,
          resume: currentResume,
        }),
      });

      const data = (await response.json()) as TailorResponse;
      console.log("API Response:", data);
      setResult(data);
      const merged = mergeResume(currentResume, data);
      setMergedResume(merged);
      addToast("success", "Resume tailored successfully!");
    } catch (err: unknown) {
      addToast("error", "An error occurred tailoring resume. Check console.");
      console.error(err);
    }

    setLoading(false);
  }

  function copy(text: string): void {
    navigator.clipboard.writeText(text);
  }

  function handleClear(): void {
    setJob("");
    setResult(null);
    setRequirements(null);
    setMergedResume(null);
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-xl p-8">
        {/* Heading */}
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Internship Resume Tailor
        </h1>

        <FormErrorBoundary
          onError={(error) => {
            console.error("Form error:", error);
          }}
        >
          {/* Resume Upload Section */}
          <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <label htmlFor="resume-upload" className="block mb-2 text-sm font-medium text-gray-700">
              Resume (PDF)
            </label>
            <div className="flex items-center gap-4">
              <input
                id="resume-upload"
                type="file"
                accept=".pdf"
                onChange={handleResumeUpload}
                disabled={uploadingResume}
                aria-label="Upload PDF resume file"
                aria-busy={uploadingResume}
                aria-describedby="resume-upload-hint"
                className="flex-1 text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {uploadingResume && (
                <span className="text-sm text-gray-600" role="status" aria-live="polite">
                  Uploading...
                </span>
              )}
            </div>
            <p id="resume-upload-hint" className="text-xs text-gray-600 mt-2">
              Upload your resume PDF to parse and use for tailoring. If not provided, the default resume will be used.
            </p>
          </div>

          {/* Job Description Input */}
          <label htmlFor="job-description" className="block mb-2 text-sm font-medium text-gray-700">
            Job Description
          </label>
          <textarea
            id="job-description"
            className="w-full h-48 p-4 border rounded-lg outline-none focus:ring-2 focus:ring-blue-400 placeholder-gray-500 text-gray-900"
            placeholder="Paste job description here..."
            value={job}
            onChange={(e) => setJob(e.target.value)}
            aria-describedby="job-description-hint"
          />
          <p id="job-description-hint" className="text-xs text-gray-500 mt-1">
            Paste a job description to extract requirements or tailor your resume.
          </p>

          {/* Buttons */}
          <div className="flex gap-4 mt-4">
            <button
              type="button"
              onClick={handleExtractRequirements}
              disabled={extracting || job.trim() === ""}
              aria-label={extracting ? "Extracting job requirements" : "Extract job requirements from description"}
              aria-busy={extracting}
              className={`px-5 py-2 rounded-lg text-white font-medium transition ${
                extracting || job.trim() === ""
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {extracting ? "Extracting..." : "Extract Requirements"}
            </button>

            <button
              type="button"
              onClick={handleTailor}
              disabled={loading || job.trim() === ""}
              aria-label={loading ? "Tailoring your resume" : "Tailor resume to job description"}
              aria-busy={loading}
              className={`px-5 py-2 rounded-lg text-white font-medium transition ${
                loading || job.trim() === ""
                  ? "bg-blue-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {loading ? "Tailoring..." : "Tailor Resume"}
            </button>

            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear all inputs and results"
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition"
            >
              Clear
            </button>
          </div>

          {/* Extracted Requirements Section */}
          {requirements && (
            <section className="mt-10 p-6 border rounded-lg bg-green-50">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Extracted Job Requirements
              </h2>
              <div className="grid grid-cols-2 gap-4 text-sm text-gray-800">
                <div>
                  <p className="font-semibold">Job Title</p>
                  <p>{requirements.title}</p>
                </div>
                <div>
                  <p className="font-semibold">Seniority Level</p>
                  <p>{requirements.seniority_level}</p>
                </div>
                <div>
                  <p className="font-semibold">Domain</p>
                  <p>{requirements.domain}</p>
                </div>
                <div>
                  <p className="font-semibold">Team Focus</p>
                  <p>{requirements.team_focus}</p>
                </div>
                {requirements.experience_years && (
                  <div>
                    <p className="font-semibold">Experience Required</p>
                    <p>{requirements.experience_years}+ years</p>
                  </div>
                )}
              </div>

              <div className="mt-4">
                <p className="font-semibold text-gray-900 mb-2">
                  Required Skills
                </p>
                <div className="flex flex-wrap gap-2">
                  {requirements.required_skills.map((skill: string) => (
                    <span
                      key={skill}
                      className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {requirements.nice_to_have_skills.length > 0 && (
                <div className="mt-4">
                  <p className="font-semibold text-gray-900 mb-2">
                    Nice-to-Have Skills
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {requirements.nice_to_have_skills.map((skill: string) => (
                      <span
                        key={skill}
                        className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4">
                <p className="font-semibold text-gray-900 mb-2">
                  Required Tools & Frameworks
                </p>
                <div className="flex flex-wrap gap-2">
                  {requirements.required_tools_frameworks.map((tool: string) => (
                    <span
                      key={tool}
                      className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <p className="font-semibold text-gray-900 mb-2">
                  Key Responsibilities
                </p>
                <ul className="list-disc ml-5 space-y-1">
                  {requirements.key_responsibilities.map((resp: string) => (
                    <li key={resp} className="text-gray-700">
                      {resp}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {/* Formatted Output Sections */}
          {result && (
            <div className="mt-10 space-y-8 text-gray-900">
              {/* Skills to Add */}
              <section>
                <h2 className="text-xl font-semibold">Skills to Add</h2>

                <div className="mt-2 p-4 border rounded-lg bg-gray-50 text-sm">
                  {result.skills_to_add &&
                  Object.values(result.skills_to_add).some(
                    (arr: string[]) => arr.length > 0
                  ) ? (
                    <div className="space-y-2">
                      {Object.entries(result.skills_to_add).map(
                        ([category, items]: [string, string[]]) =>
                          items.length > 0 ? (
                            <div key={category}>
                              <span className="font-semibold capitalize">
                                {category}:
                              </span>{" "}
                              {items.join(", ")}
                            </div>
                          ) : null
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-500">
                      No additional skills suggested.
                    </p>
                  )}
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold">What Improved</h2>
                <div className="mt-2 p-4 border rounded-lg bg-gray-50 text-sm">
                  {result.improvement_notes.length > 0 ? (
                    <ul className="list-disc ml-5 space-y-1">
                      {result.improvement_notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500">No improvement notes returned.</p>
                  )}
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold">Changed Bullets</h2>
                <div className="mt-2 p-4 border rounded-lg bg-gray-50 text-sm space-y-4">
                  {result.changed_bullets.length > 0 ? (
                    result.changed_bullets.map((item) => (
                      <div key={item.id} className="border-b border-gray-200 pb-3 last:border-b-0 last:pb-0">
                        <p className="font-semibold text-gray-900">
                          {item.section_label} - bullet {item.index + 1}
                        </p>
                        <p className="text-gray-600 mt-1">Original: {item.original}</p>
                        <p className="text-gray-900 mt-1">Revised: {item.revised}</p>
                        <p className="text-xs text-gray-500 mt-1">{item.reason}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500">No bullet rewrites were accepted.</p>
                  )}
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold">Missing Keywords / Gaps</h2>
                <div className="mt-2 p-4 border rounded-lg bg-gray-50 text-sm">
                  {result.missing_keywords.length > 0 ? (
                    <ul className="space-y-2">
                      {result.missing_keywords.map((gap) => (
                        <li key={`${gap.category}-${gap.keyword}`}>
                          <span className="font-semibold">{gap.keyword}</span>
                          {` - ${gap.reason}`}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500">No unsupported gaps were identified.</p>
                  )}
                </div>
              </section>

              {/* Cover Letter */}
              <section>
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Cover Letter</h2>
                  <button
                    type="button"
                    onClick={() => copy(String(result.cover_letter || ""))}
                    aria-label="Copy cover letter text to clipboard"
                    className="text-blue-600 hover:underline transition focus:outline-none focus:ring-2 focus:ring-blue-400 rounded px-2 py-1"
                  >
                    Copy
                  </button>
                </div>

                <div className="mt-2 p-4 border rounded-lg bg-gray-50 text-sm whitespace-pre-wrap">
                  {result.cover_letter ? (
                    String(result.cover_letter)
                  ) : (
                    <p className="text-gray-500">No cover letter returned.</p>
                  )}
                </div>
              </section>

              {mergedResume && (
                <>
                  <div className="mt-10">
                    <h2 className="text-2xl font-bold mb-4 text-gray-900">
                      Resume Preview
                    </h2>
                    <ResumePreview resume={mergedResume} />
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const res = await fetch("/api/export/pdf", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(mergedResume),
                          });

                          const contentType = res.headers.get("content-type") ?? "";

                          if (!contentType.includes("pdf")) {
                            const errorText = await res.text();
                            console.error("PDF ERROR:", errorText);
                            alert("PDF FAILED — Check console");
                            return;
                          }

                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = "resume.pdf";
                          a.click();
                          URL.revokeObjectURL(url);
                        } catch (err) {
                          console.error(err);
                          alert("Something went wrong generating PDF");
                        }
                      }}
                      aria-label="Download tailored resume as PDF"
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      Download PDF
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </FormErrorBoundary>
      </div>
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}
