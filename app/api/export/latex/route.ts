import { NextResponse } from "next/server";

/* ---------------------- TEX ESCAPE ---------------------- */
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

/* ---------------------- TEX BUILDER ---------------------- */
function buildTex(resume: any) {
  const header = `
\\documentclass[10pt]{article}
\\usepackage[margin=0.7in]{geometry}
\\usepackage[hidelinks]{hyperref}
\\usepackage{parskip}
\\begin{document}

\\begin{center}
  {\\LARGE \\textbf{${escapeTex(resume.name)}}} \\\\
  ${escapeTex(resume.contact.email)} \\quad ${escapeTex(resume.contact.phone)} \\\\
  ${escapeTex(resume.contact.linkedin || "")} \\quad ${escapeTex(resume.contact.github || "")}
\\end{center}

\\vspace{8pt}
`;

  let body = "";

  /* ------------ SUMMARY ------------ */
  if (resume.summary) {
    body += `\\section*{Summary}\n${escapeTex(resume.summary)}\n\n`;
  }

  /* ------------ EXPERIENCE ------------ */
  if (resume.experience?.length) {
    body += `\\section*{Experience}\n`;
    resume.experience.forEach((exp: any) => {
      body += `\\textbf{${escapeTex(exp.role)}} --- ${escapeTex(exp.company)} \\hfill ${escapeTex(exp.dates || "")} \\\\ \n`;
      body += "\\begin{itemize}\n";
      exp.bullets.forEach((b: string) => {
        body += `  \\item ${escapeTex(b)}\n`;
      });
      body += "\\end{itemize}\n\n";
    });
  }

  /* ------------ PROJECTS ------------ */
  if (resume.projects?.length) {
    body += `\\section*{Projects}\n`;
    resume.projects.forEach((proj: any) => {
      body += `\\textbf{${escapeTex(proj.name)}} \\hfill ${escapeTex(proj.date || "")} \\\\ \n`;
      if (proj.link) body += `\\textit{${escapeTex(proj.link)}} \\\\ \n`;
      body += "\\begin{itemize}\n";
      proj.bullets.forEach((b: string) => (body += `  \\item ${escapeTex(b)}\n`));
      body += "\\end{itemize}\n\n";
    });
  }

  /* ------------ EDUCATION ------------ */
  if (resume.education?.length) {
    body += `\\section*{Education}\n`;
    resume.education.forEach((ed: any) => {
      body += `\\textbf{${escapeTex(ed.degree)}} --- ${escapeTex(ed.institution)} \\hfill ${escapeTex(ed.graduation_year || "")} \\\\ \n`;
      if (ed.gpa) body += `GPA: ${escapeTex(ed.gpa)} \\\\ \n`;
    });
    body += "\n";
  }

  /* ------------ SKILLS ------------ */
  if (resume.skills) {
    body += `\\section*{Skills}\n`;
    body += `\\textbf{Languages:} ${escapeTex(resume.skills.languages.join(", "))} \\\\ \n`;
    body += `\\textbf{Frameworks:} ${escapeTex(resume.skills.frameworks_libraries.join(", "))} \\\\ \n`;
    body += `\\textbf{Tools:} ${escapeTex(resume.skills.tools.join(", "))} \\\\ \n`;
  }

  const footer = "\n\\end{document}";

  return header + body + footer;
}

/* ---------------------- POST HANDLER (MERGED RESUME) ---------------------- */
export async function POST(req: Request) {
  try {
    const resume = await req.json(); // merged resume object

    if (!resume || !resume.name) {
      return NextResponse.json(
        { error: "Invalid or missing resume object in POST body" },
        { status: 400 }
      );
    }

    const tex = buildTex(resume);

    return new NextResponse(tex, {
      status: 200,
      headers: {
        "Content-Type": "application/x-tex",
        "Content-Disposition": 'attachment; filename="resume.tex"',
      },
    });
  } catch (error: any) {
    console.error("LaTeX error:", error);
    return NextResponse.json(
      { error: "Failed to generate .tex", details: error.message },
      { status: 500 }
    );
  }
}

