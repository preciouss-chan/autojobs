
export function buildMTeckResume(resume: any) {
  function esc(s: string) {
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

  // -------- BULLET SQUEEZE FUNCTION --------
  function limitBullets(arr: string[], max = 3) {
    if (!arr) return [];
    if (arr.length <= max) return arr;
    return arr.slice(0, max); // truncate extra bullets
  }

  const tex = `
\\documentclass[letterpaper,10pt]{article}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{fancyhdr}
\\usepackage{fontawesome5}
\\usepackage{multicol}
\\usepackage{bookmark}
\\usepackage{lastpage}
\\usepackage{xcolor}
\\definecolor{accentTitle}{HTML}{0e6e55}
\\definecolor{accentText}{HTML}{0e6e55}
\\definecolor{accentLine}{HTML}{a16f0b}
\\usepackage{lmodern}
\\renewcommand{\\familydefault}{\\sfdefault}



\\pagestyle{fancy}
\\fancyhf{}
\\urlstyle{same}

% Tight layout
\\addtolength{\\oddsidemargin}{-0.7in}
\\addtolength{\\evensidemargin}{-0.7in}
\\addtolength{\\textwidth}{1.2in}
\\addtolength{\\topmargin}{-0.7in}
\\addtolength{\\textheight}{1.35in}

% Section formatting
\\titleformat{\\section}{
  \\vspace{-4pt}
  \\color{accentText}
  \\large\\bfseries
}{}{0em}{}[\\color{accentLine}\\titlerule]

\\begin{document}

% HEADER
\\begin{center}
  {\\Huge\\color{accentTitle} ${esc(resume.name)}}\\\\
  \\vspace{6pt}
  {${esc(resume.contact.phone)} • ${esc(resume.contact.email)} • ${esc(resume.contact.linkedin)} • ${esc(resume.contact.github)}}
  \\vspace{2pt}
  \\color{accentLine}\\hrule
\\end{center}

% EXPERIENCE
\\section*{Experience}
${resume.experience
  .map(
    (exp: any) => `
\\textbf{${esc(exp.company)}} \\hfill ${esc(exp.dates)} \\\\
\\textit{${esc(exp.role)}} \\\\
\\begin{itemize}[itemsep=1pt, leftmargin=15pt]
${limitBullets(exp.bullets, 3)
  .map((b) => `  \\item ${esc(b)}`)
  .join("\n")}
\\end{itemize}
`
  )
  .join("\n")}

% PROJECTS
\\section*{Projects}
${resume.projects
  .map(
    (p: any) => `
\\textbf{${esc(p.name)}} \\hfill ${esc(p.date)} \\\\
${p.link ? `\\href{${esc(p.link)}}{${esc(p.link)}}` : ""} \\\\
\\begin{itemize}[itemsep=1pt, leftmargin=15pt]
${limitBullets(p.bullets, 3)
  .map((b) => `  \\item ${esc(b)}`)
  .join("\n")}
\\end{itemize}
`
  )
  .join("\n")}

% SKILLS
\\section*{Skills}
\\begin{itemize}[leftmargin=15pt]
   \\item \\textbf{Languages:} ${esc(resume.skills.languages.join(", "))}
   \\item \\textbf{Frameworks:} ${esc(resume.skills.frameworks_libraries.join(", "))}
   \\item \\textbf{Tools:} ${esc(resume.skills.tools.join(", "))}
\\end{itemize}

% EDUCATION
\\section*{Education}
${resume.education
  .map(
    (ed: any) => `
\\textbf{${esc(ed.institution)}} \\hfill ${esc(ed.graduation_year)} \\\\
${esc(ed.degree)} — GPA: ${esc(ed.gpa)}
`
  )
  .join("\n")}

\\end{document}
`;

  return tex;
}

