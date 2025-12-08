export function buildMTeckResume(resume: any) {
  const esc = (s: string = "") =>
    s
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

  const limit = (arr: string[] = [], n: number) => arr.slice(0, n);

  // PROJECTS
 const projects = (resume.projects || [])
    .map((p: any) => {
      const bullets = limit(p.bullets, 2)
        .map((b: string) => `  \\item ${esc(b)}`)
        .join("\n");

      return `
\\par\\vspace{2pt}
\\noindent\\hspace{8pt}\\textbf{${esc(p.name)}\\textnormal{ (${esc(p.link || "")})}} \\hfill \\textbf{${esc(p.date || "")}}
\\begin{itemize}[itemsep=1pt,topsep=1pt,leftmargin=12pt]
${bullets}
\\end{itemize}
`;
    })
    .join("\n");

  // EXPERIENCE
  const experience = (resume.experience || [])
    .map((e: any) => {
      const bullets = limit(e.bullets, 3)
        .map((b: string) => `  \\item ${esc(b)}`)
        .join("\n");

      return `
\\hspace{8pt}\\textbf{${esc(e.role)}} — ${esc(e.company)} \\hfill \\textbf{${esc(e.dates)}} 
\\begin{itemize}[itemsep=1pt,topsep=1pt,leftmargin=12pt]
${bullets}
\\end{itemize}
`;
    })
    .join("\n");

  const skills = `
\\hspace{8pt}\\textbf{Languages:} ${esc(resume.skills.languages.join(", "))} \\\\
\\hspace*{8pt}\\textbf{Frameworks:} ${esc(resume.skills.frameworks_libraries.join(", "))} \\\\
\\hspace*{8pt}\\textbf{Tools:} ${esc(resume.skills.tools.join(", "))}
`;

  const ed = resume.education?.[0] || {};

  return `
\\documentclass[10pt,letterpaper]{article}

% ----------- PACKAGES -----------
\\usepackage{fontspec}
\\usepackage{fontawesome5}
\\usepackage[margin=0.4in]{geometry}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{titlesec}

% Sans-serif font (clean + ATS-friendly)
\\setmainfont{Helvetica}

% Tight spacing
\\setlength{\\parskip}{2pt}
\\setlength{\\parsep}{0pt}
\\setlist[itemize]{itemsep=1pt,topsep=1pt,leftmargin=12pt}

% Section style
\\titleformat{\\section}{\\large\\bfseries}{}{0pt}{}
\\titlespacing*{\\section}{0pt}{4pt}{2pt}

% ----------- BEGIN DOC ----------
\\begin{document}

% -------- HEADER --------
\\centerline{\\Large \\textbf{${esc(resume.name)}}}

\\vspace{2pt}
\\rule{\\textwidth}{0.5pt}
% ICON CONTACT LINE — single line guaranteed
\\noindent
{\\footnotesize % shrink just the contact line
  \\hbox to \\textwidth{
    \\raisebox{-0.1\\height}{\\faPhone}~${esc(resume.contact.phone)}
    \\hspace{0.4em}
    \\raisebox{-0.1\\height}{\\faEnvelope}~${esc(resume.contact.email)}
    \\hspace{0.4em}
    \\raisebox{-0.1\\height}{\\faLinkedin}~\\href{${esc(resume.contact.linkedin)}}{${esc(resume.contact.linkedin)}}
    \\hspace{0.4em}
    \\raisebox{-0.1\\height}{\\faGithub}~\\href{${esc(resume.contact.github)}}{${esc(resume.contact.github)}}
  }
}
\\vspace{-20pt}


\\rule{\\textwidth}{0.5pt}

% -------- PROJECTS --------
\\section*{Projects}
${projects}

% -------- EXPERIENCE --------
\\section*{Experience}
${experience}

% -------- SKILLS --------
\\section*{Skills}
${skills}

% -------- EDUCATION --------
\\section*{Education}
\\hspace{8pt}\\textbf{${esc(ed.degree || "")}} — ${esc(ed.institution || "")} \\hfill ${esc(ed.graduation_year || "")} \\\\
\\noindent\\hspace*{8pt}GPA: ${esc(ed.gpa || "")}

\\end{document}
`;
}

