"use client";
import { useState } from "react";

export default function TailorPage() {
  const [job, setJob] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function runTailor() {
    setLoading(true);
    const res = await fetch("/api/tailor", {
      method: "POST",
      body: JSON.stringify({ jobDescription: job })
    });
    const data = await res.json();
    setResult(data);
    setLoading(false);
  }

  return (
    <div style={{ padding: 24 }}>

       <h1>Tailor Resume</h1>

      <textarea
        style={{ width: "100%", height: 200 }}
        placeholder="Paste job description here..."
        value={job}
        onChange={(e) => setJob(e.target.value)}
      />

      <button onClick={runTailor} disabled={loading}>
        {loading ? "Loading..." : "Tailor Resume"}
      </button>

      {result && (
        <pre style={{ marginTop: 20, background: "#111", color: "#fff", padding: 12 }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}


