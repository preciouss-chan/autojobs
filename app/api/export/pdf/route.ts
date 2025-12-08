import { NextResponse } from "next/server";
import { writeFile, readFile, mkdtemp } from "fs/promises";
import { existsSync, readFileSync } from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import os from "os";
import { buildMTeckResume } from "@/app/utils/mteckResumeTemplate";

const execAsync = promisify(exec);

export async function POST(req: Request) {
  try {
    // Get merged resume JSON from frontend
    const resume = await req.json();

    // Convert resume JSON → LaTeX source
    const texSource = buildMTeckResume(resume);

    // Create temp dir for building
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "latex-"));
    const texPath = path.join(tmpDir, "resume.tex");
    const pdfPath = path.join(tmpDir, "resume.pdf");
    const logPath = path.join(tmpDir, "resume.log");

    // Write LaTeX file
    await writeFile(texPath, texSource, "utf8");

    // Run XeLaTeX (works with system fonts, less package hell)
    try {
      await execAsync(
        `xelatex -interaction=nonstopmode -halt-on-error -output-directory="${tmpDir}" "${texPath}"`
      );
    } catch (err) {
      console.warn("XeLaTeX returned a non-zero exit code — continuing anyway...");
    }

    // Debug: Print full LaTeX log
    if (existsSync(logPath)) {
      console.log("===== LATEX LOG START =====");
      console.log(readFileSync(logPath, "utf8"));
      console.log("===== LATEX LOG END =====");
    }

    // If PDF doesn't exist → fatal LaTeX crash
    if (!existsSync(pdfPath)) {
      return NextResponse.json(
        { error: "LaTeX failed to generate a PDF", details: "No PDF file produced." },
        { status: 500 }
      );
    }

    // Load PDF buffer
    const pdf = await readFile(pdfPath);

    // Send PDF back to frontend
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="resume.pdf"',
      },
    });

  } catch (err: any) {
    console.error("PDF ROUTE ERROR:", err);
    return NextResponse.json(
      { error: "PDF generation failed", details: err.message },
      { status: 500 }
    );
  }
}

