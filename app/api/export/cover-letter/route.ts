import { NextResponse } from "next/server";
import { writeFile, readFile, mkdtemp } from "fs/promises";
import { existsSync, readFileSync } from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

function escapeTex(s: string) {
  if (!s) return "";
  return s
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/%/g, "\\%")
    .replace(/&/g, "\\&")
    .replace(/\$/g, "\\$")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/{/g, "\\{")
    .replace(/}/g, "\\}")
    .replace(/\^/g, "\\^{}")
    .replace(/~/g, "\\~{}");
}

function buildCoverLetterTex(text: string) {
  // Split text into paragraphs
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  const body = paragraphs
    .map(p => escapeTex(p.trim()))
    .join("\n\n");

  return `
\\documentclass[11pt,letterpaper]{article}
\\usepackage[margin=1in]{geometry}
\\usepackage{parskip}
\\usepackage{fontspec}
\\setmainfont{Helvetica}

\\begin{document}
${body}
\\end{document}
`;
}

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid text" },
        { status: 400 }
      );
    }

    // Convert text to LaTeX
    const texSource = buildCoverLetterTex(text);

    // Create temp dir for building
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "cover-letter-"));
    const texPath = path.join(tmpDir, "cover_letter.tex");
    const pdfPath = path.join(tmpDir, "cover_letter.pdf");
    const logPath = path.join(tmpDir, "cover_letter.log");

    // Write LaTeX file
    await writeFile(texPath, texSource, "utf8");

    // Run XeLaTeX
    try {
      await execAsync(
        `xelatex -interaction=nonstopmode -halt-on-error -output-directory="${tmpDir}" "${texPath}"`
      );
    } catch (err) {
      console.warn("XeLaTeX returned a non-zero exit code — continuing anyway...");
    }

    // If PDF doesn't exist → error
    if (!existsSync(pdfPath)) {
      return NextResponse.json(
        { error: "LaTeX failed to generate a PDF", details: "No PDF file produced." },
        { status: 500 }
      );
    }

    // Load PDF buffer
    const pdf = await readFile(pdfPath);

    // Send PDF back
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="cover_letter.pdf"',
      },
    });

  } catch (err: any) {
    console.error("COVER_LETTER_PDF ERROR:", err);
    return NextResponse.json(
      { error: "PDF generation failed", details: err.message },
      { status: 500 }
    );
  }
}


