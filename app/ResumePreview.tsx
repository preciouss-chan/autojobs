"use client";

export default function ResumePreview({ resume }: { resume: any }) {
  const ed = resume.education?.[0] || {};

  return (
    <div className="max-w-2xl mx-auto bg-white p-6 text-[13px] leading-tight print:p-0">
      {/* Header */}
      <header className="text-center mb-4">
        <h1 className="text-2xl font-serif font-bold tracking-tight">
          {resume.name}
        </h1>

        <hr className="border-gray-400 mt-2 mb-1" />

        {/* Contact row (single line mimic) */}
        <div className="text-[8px] text-gray-700 flex items-center justify-center gap-3 whitespace-nowrap overflow-hidden">

          <span>📞 {resume.contact.phone}</span>
          <span>✉️ {resume.contact.email}</span>
          <span>🔗 {resume.contact.linkedin}</span>
          <span>🐙 {resume.contact.github}</span>
        </div>


        <hr className="border-gray-400 mt-2" />
      </header>

      {/* Projects */}
      <section className="mb-2">
        <h2 className="font-semibold uppercase text-[11px] tracking-wider mb-1">
          Projects
        </h2>

        <div className="ml-3">
          {resume.projects.map((proj: any, i: number) => (
            <div className="mt-1" key={i}>
              <div className="flex justify-between text-[12px]">
                <span className="font-semibold">
                  {proj.name} {proj.link ? `(${proj.link})` : ""}
                </span>
                <span className="text-gray-600">{proj.date}</span>
              </div>

              <ul className="list-disc ml-4 mt-1 space-y-0.5">
                {proj.bullets.slice(0, 2).map((b: string, i2: number) => (
                  <li key={i2}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>


      {/* Experience */}
      <section className="mb-2">
        <h2 className="font-semibold uppercase text-[11px] tracking-wider mb-1">
          Experience
        </h2>

        <div className="ml-3">
          {resume.experience.map((exp: any, i: number) => (
            <div className="mt-1" key={i}>
              <div className="flex justify-between text-[12px]">
                <span className="font-semibold">
                  {exp.role} — {exp.company}
                </span>
                <span className="text-gray-600">{exp.dates}</span>
              </div>

              <ul className="list-disc ml-4 mt-1 space-y-0.5">
                {exp.bullets.slice(0, 3).map((b: string, i2: number) => (
                  <li key={i2}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>


      {/* Skills */}
      <section className="mb-2">
    <h2 className="font-semibold uppercase text-[11px] tracking-wider mb-1">
      Skills
    </h2>

    <div className="text-[12px] space-y-1 ml-3">
      <div>
        <span className="font-semibold">Languages:</span> {resume.skills.languages.join(", ")}
      </div>
      <div>
        <span className="font-semibold">Frameworks:</span> {resume.skills.frameworks_libraries.join(", ")}
      </div>
      <div>
        <span className="font-semibold">Tools:</span> {resume.skills.tools.join(", ")}
      </div>
    </div>
  </section>


      {/* Education */}
      <section className="mt-3 mb-2">
        <h2 className="font-semibold uppercase text-[11px] tracking-wider mb-1">
          Education
        </h2>

        <div className="text-[12px] ml-2">
          
          {/* Top row: degree + institution (left)  — graduation year (right) */}
          <div className="flex justify-between font-semibold">
            <span>
              {ed.degree} — {ed.institution}
            </span>
            <span>{ed.graduation_year}</span>
          </div>

          {/* GPA row */}
          <div className="text-gray-600">
            GPA {ed.gpa}
          </div>
        </div>
      </section>

    </div>
  );
}

