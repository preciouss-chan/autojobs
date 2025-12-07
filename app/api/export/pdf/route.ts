import { exec } from "child_process";
import { existsSync } from "fs";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { NextResponse } from "next/server";
import os from "os";
import path from "path";
import { promisify } from "util";
import { buildMTeckResume } from "../../../utils/mteckResumeTemplate"; // relative to this route

const execAsync = promisify(exec);

/* MAIN PDF ROUTE: Accepts a merged resume JSON, builds .tex, runs pdflatex, returns PDF */
export async function POST(req: Request) {
  try {
    const resume = await req.json();

    if (!resume || !resume.name) {
      return NextResponse.json(
        { error: "Invalid or missing resume object in POST body" },
        { status: 400 }
      );
    }

    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "resume-"));
    const tex = buildMTeckResume(resume);
    const texPath = path.join(tmpDir, "resume.tex");
    const pdfPath = path.join(tmpDir, "resume.pdf");

    await writeFile(texPath, tex, "utf8");

    // Try running pdflatex locally. Capture stderr/stdout when it fails.
    let execErrorStderr = "";
    let execErrorStdout = "";
    try {
      await execAsync(
        `pdflatex -interaction=nonstopmode -halt-on-error -output-directory="${tmpDir}" "${texPath}"`
      );
      // second run to resolve references if needed
      try {
        await execAsync(
          `pdflatex -interaction=nonstopmode -halt-on-error -output-directory="${tmpDir}" "${texPath}"`
        );
      } catch {}
    } catch (err: any) {
      execErrorStderr = String(err?.stderr || err?.message || "");
      execErrorStdout = String(err?.stdout || "");
      console.warn("pdflatex local run failed:", execErrorStderr || execErrorStdout);
    }

    // If local pdflatex did not produce a PDF, attempt remote compile as a fallback.
    if (!existsSync(pdfPath)) {
      try {
        const latexHost = "https://latex.aslushnikov.com/compile";
        const resp = await fetch(latexHost, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            compiler: "pdflatex",
            resources: [
              {
                main: true,
                content: tex,
              },
            ],
          }),
        });

        if (resp.ok) {
          const pdfArray = new Uint8Array(await resp.arrayBuffer());
          // Clean up temp directory
          try {
            await rm(tmpDir, { recursive: true, force: true });
          } catch (e) {
            console.warn("Failed to clean temp dir", e);
          }

          return new NextResponse(Buffer.from(pdfArray), {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": 'attachment; filename="resume.pdf"',
            },
          });
        } else {
          const errText = await resp.text();
          console.error("Remote LaTeX server error:", errText);
        }
      } catch (remoteErr) {
        console.error("Remote LaTeX fallback failed:", remoteErr);
      }
    }

    // If PDF not produced, return LaTeX log (if available) and exec stderr/stdout for easier debugging
    if (!existsSync(pdfPath)) {
      const logPath = path.join(tmpDir, "resume.log");
      let logContents = "";
      try {
        if (existsSync(logPath)) {
          logContents = await readFile(logPath, "utf8");
        }
      } catch (e) {
        // ignore
      }

      // Clean up temp dir (best-effort)
      try {
        await rm(tmpDir, { recursive: true, force: true });
      } catch {}

      return NextResponse.json(
        {
          error: "PDF generation failed",
          details: {
            pdflatex_stderr: execErrorStderr || null,
            pdflatex_stdout: execErrorStdout || null,
            latex_log: logContents || null,
          },
        },
        { status: 500 }
      );
    }

    const pdfBuffer = await readFile(pdfPath);

    // Clean up temp directory
    try {
      await rm(tmpDir, { recursive: true, force: true });
    } catch (e) {
      console.warn("Failed to clean temp dir", e);
    }

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="resume.pdf"',
      },
    });
  } catch (error: any) {
    console.error("PDF route error:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}

