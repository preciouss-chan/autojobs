"use client";

import { mergeResume } from "@/app/utils/mergeResume";
import ResumePreview from "./ResumePreview.tsx";
import resumeData from "@/data/resume.json";
import { useState } from "react";

export default function TailorPage() {
  const [job, setJob] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [mergedResume, setMergedResume] = useState<any>(null);


  // Accept raw job text OR JSON { "jobDescription": "..." }
  function extractJobText(input: string) {
    input = input.trim();
    if (!input) return "";

    if (input.startsWith("{") && input.endsWith("}")) {
      try {
        const parsed = JSON.parse(input);
        if (parsed?.jobDescription) return parsed.jobDescription;
      } catch {}
    }
    return input;
  }

  async function handleTailor() {
    setLoading(true);
    setError(null);
    setResult(null);

    const jobText = extractJobText(job);
    if (!jobText) {
      setError("Please paste a job description or a valid JSON object.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription: jobText }),
      });

      const data = await response.json();
      console.log("API Response:", data);
      setResult(data);
      const merged = mergeResume(resumeData, data);
      setMergedResume(merged);
    } catch (err: any) {
      setError("An error occurred. Check console for details.");
      console.error(err);
    }

    setLoading(false);
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto bg-white shadow-lg rounded-xl p-8">
        {/* Heading */}
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Internship Resume Tailor
        </h1>

        {/* Job Description Input */}
        <label className="block mb-2 text-sm font-medium text-gray-700">
          Job Description (paste raw text or JSON with {"{ jobDescription: \"...\" }"})
        </label>
        <textarea
          className="w-full h-48 p-4 border rounded-lg outline-none focus:ring-2 focus:ring-blue-400 placeholder-gray-500 text-gray-900"
          placeholder="Paste job description here..."
          value={job}
          onChange={(e) => setJob(e.target.value)}
        />

        {/* Buttons */}
        <div className="flex gap-4 mt-4">
          <button
            onClick={handleTailor}
            disabled={loading}
            className={`px-5 py-2 rounded-lg text-white font-medium transition ${
              loading ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {loading ? "Tailoring..." : "Tailor Resume"}
          </button>

          <button
            onClick={() => {
              setJob("");
              setResult(null);
              setError(null);
            }}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
          >
            Clear
          </button>

          {result && (
            <button
              onClick={() => setShowRaw(!showRaw)}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100"
            >
              {showRaw ? "Hide Raw JSON" : "Show Raw JSON"}
            </button>
          )}
        </div>

        {/* Error message */}
        {error && <p className="mt-4 text-red-600 font-medium">{error}</p>}

        {/* Raw JSON Viewer */}
        {showRaw && result && (
          <div className="mt-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Raw JSON Response
            </h2>
            <pre className="bg-gray-900 text-green-200 p-4 rounded-lg overflow-auto text-sm whitespace-pre-wrap">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}

        {/* Formatted Output Sections */}
        {result && !showRaw && (
          <div className="mt-10 space-y-8 text-gray-900">
            {/* Experience Edits */}
            <section>
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Experience Edits</h2>
                <button
                  onClick={() =>
                    copy(JSON.stringify(result.experience_edits || {}, null, 2))
                  }
                  className="text-blue-600 hover:underline"
                >
                  Copy
                </button>
              </div>

              <div className="mt-2 p-4 border rounded-lg bg-gray-50 text-sm">
                {result.experience_edits &&
                Object.keys(result.experience_edits).length > 0 ? (
                  <pre className="whitespace-pre-wrap">
                    {JSON.stringify(result.experience_edits, null, 2)}
                  </pre>
                ) : (
                  <p className="text-gray-500">No experience edits returned.</p>
                )}
              </div>
            </section>

            {/* Skills to Add */}
            <section>
              <h2 className="text-xl font-semibold">Skills to Add</h2>
              <div className="mt-2 p-4 border rounded-lg bg-gray-50 text-sm">
                {result.skills_to_add &&
                Object.values(result.skills_to_add).some(
                  (arr: any) => arr && arr.length > 0
                ) ? (
                  <pre>{JSON.stringify(result.skills_to_add, null, 2)}</pre>
                ) : (
                  <p className="text-gray-500">No additional skills suggested.</p>
                )}
              </div>
            </section>

            {/* Cover Letter */}
            <section>
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Cover Letter</h2>
                <button
                  onClick={() => copy(result.cover_letter || "")}
                  className="text-blue-600 hover:underline"
                >
                  Copy
                </button>
              </div>

              <div className="mt-2 p-4 border rounded-lg bg-gray-50 text-sm whitespace-pre-wrap">
                {result.cover_letter ? (
                  result.cover_letter
                ) : (
                  <p className="text-gray-500">No cover letter returned.</p>
                )}
              </div>
            </section>
            {mergedResume && (
              <>
                <div className="mt-10">
                  <h2 className="text-2xl font-bold mb-4 text-gray-900">Resume Preview</h2>
                  <ResumePreview resume={mergedResume} />
                </div>
                <div className="flex gap-3 mt-4">

                  <button
                    onClick={async () => {
                      const res = await fetch("/api/export/latex", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(mergedResume),
                      });

                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "resume.tex";
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="px-4 py-2 bg-gray-800 text-white rounded"
                  >
                    Download LaTeX (.tex)
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch("/api/export/pdf", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(mergedResume),
                        });

                        // Check response type before downloading
                        const contentType = res.headers.get("content-type") || "";
                        console.log("PDF content type:", contentType);

                        // If the API returned JSON instead of PDF, log the error
                        if (!contentType.includes("pdf")) {
                          const errorText = await res.text();
                          console.error("PDF ERROR RESPONSE:", errorText);
                          alert("PDF generation failed!\nSee console for details.");
                          return;
                        }

                        // Otherwise, download the PDF
                        const blob = await res.blob();
                        console.log("PDF blob size:", blob.size);

                        if (blob.size === 0) {
                          alert("Got an empty PDF (0 bytes). Check API logs.");
                          return;
                        }

                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "resume.pdf";
                        a.click();
                        URL.revokeObjectURL(url);
                      } catch (err) {
                        console.error("PDF download error:", err);
                        alert("PDF generation crashed — check console.");
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded"
                  >
                    Download PDF
                  </button>



                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

