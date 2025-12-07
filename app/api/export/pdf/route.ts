import { NextResponse } from "next/server";

/* escape latex */
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

/* build tex */
function buildTeX(resume: any) {
  return `
\\documentclass[10pt]{article}
\\usepackage[margin=0.7in]{geometry}
\\usepackage{parskip}
\\begin{document}

\\begin{center}
{\\Large \\textbf{${escapeTex(resume.name)}}} \\\\
${escapeTex(resume.contact.email)} \\quad ${escapeTex(resume.contact.phone)} \\\\
${escapeTex(resume.contact.linkedin || "")} \\quad ${escapeTex(resume.contact.github || "")}
\\end{center}

\\section*{Summary}
${escapeTex(resume.summary || "")}

\\section*{Experience}
${
  (resume.experience || [])
    .map(
      (e: any) => `
\\textbf{${escapeTex(e.role)}} --- ${escapeTex(e.company)} \\hfill ${escapeTex(e.dates || "")} \\\\
\\begin{itemize}
${e.bullets.map((b: string) => `  \\item ${escapeTex(b)}`).join("\n")}
\\end{itemize}
`
    )
    .join("\n")
}

\\section*{Projects}
${
  (resume.projects || [])
    .map(
      (p: any) => `
\\textbf{${escapeTex(p.name)}} \\hfill ${escapeTex(p.date || "")} \\\\
\\begin{itemize}
${p.bullets.map((b: string) => `  \\item ${escapeTex(b)}`).join("\n")}
\\end{itemize}
`
    )
    .join("\n")
}

\\section*{Education}
${
  (resume.education || [])
    .map(
      (ed: any) => `
\\textbf{${escapeTex(ed.degree)}} --- ${escapeTex(ed.institution)} \\hfill ${escapeTex(ed.graduation_year || "")} \\\\
GPA: ${escapeTex(ed.gpa || "")}
`
    )
    .join("\n")
}

\\section*{Skills}
Languages: ${escapeTex(resume.skills.languages.join(", "))} \\\\
Frameworks: ${escapeTex(resume.skills.frameworks_libraries.join(", "))} \\\\
Tools: ${escapeTex(resume.skills.tools.join(", "))}

\\end{document}
  `;
}

export async function POST(req: Request) {
  try {
    const resume = await req.json();
    const texSource = buildTeX(resume);

    const response = await fetch("https://latex.yt/compile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        compiler: "pdflatex",
        resources: [
          {
            name: "main.tex",
            content: texSource,
          },
        ],
        mainResource: "main.tex",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("LATEX ERROR:", errorText);
      return NextResponse.json(
        { error: "Latex compile failed", details: errorText },
        { status: 500 }
      );
    }

    const pdfArray = new Uint8Array(await response.arrayBuffer());

    return new NextResponse(pdfArray, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=resume.pdf",
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

