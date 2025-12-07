"use client";

export default function ResumePreview({ resume }: { resume: any }) {
  return (
    <div className="max-w-2xl mx-auto bg-white p-6 text-[13px] leading-tight print:p-0">
      {/* Header */}
      <header className="text-center mb-2">
        <h1 className="text-2xl font-serif font-bold tracking-tight">
          {resume.name}
        </h1>

        <p className="text-[12px] text-gray-700 mt-1">
          {resume.contact.email} • {resume.contact.phone}
        </p>
        <p className="text-[12px] text-gray-700">
          {resume.contact.linkedin} • {resume.contact.github}
        </p>

        <hr className="border-gray-400 mt-2" />
      </header>


      {/* Experience */}
      {resume.experience?.length > 0 && (
        <section className="mb-1">
          <h2 className="font-semibold uppercase text-[11px] tracking-wider">
            Experience
          </h2>

          {resume.experience.map((exp: any, i: number) => (
            <div className="mt-1" key={i}>
              <div className="flex justify-between text-[12px] leading-tight">
                <span className="font-semibold">{exp.role}, {exp.company}</span>
                <span className="text-gray-600">{exp.dates}</span>
              </div>

              <ul className="list-disc ml-4 mt-1 space-y-0.5">
                {exp.bullets.map((b: string, i2: number) => (
                  <li key={i2}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {/* Projects */}
      {resume.projects?.length > 0 && (
        <section className="mb-1">
          <h2 className="font-semibold uppercase text-[11px] tracking-wider">
            Projects
          </h2>

          {resume.projects.map((proj: any, i: number) => (
            <div className="mt-1" key={i}>
              <div className="flex justify-between text-[12px] leading-tight">
                <span className="font-semibold">{proj.name}</span>
                <span className="text-gray-600">{proj.date}</span>
              </div>

              <ul className="list-disc ml-4 mt-1 space-y-0.5">
                {proj.bullets.map((b: string, i2: number) => (
                  <li key={i2}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {/* Education */}
      <section className="mb-1">
        <h2 className="font-semibold uppercase text-[11px] tracking-wider">
          Education
        </h2>

        {resume.education?.map((ed: any, i: number) => (
          <div className="mt-1 text-[12px]" key={i}>
            <div className="font-semibold">
              {ed.degree}, {ed.institution}
            </div>
            <div className="text-gray-600">
              {ed.graduation_year} • GPA {ed.gpa}
            </div>
          </div>
        ))}
      </section>

      {/* Skills */}
      <section className="mt-2">
        <h2 className="font-semibold uppercase text-[11px] tracking-wider">
          Skills
        </h2>

        <div className="grid grid-cols-3 gap-2 text-[12px] mt-1">
          <div>
            <span className="font-semibold">Languages:</span>{" "}
            {resume.skills.languages.join(", ")}
          </div>
          <div>
            <span className="font-semibold">Frameworks:</span>{" "}
            {resume.skills.frameworks_libraries.join(", ")}
          </div>
          <div>
            <span className="font-semibold">Tools:</span>{" "}
            {resume.skills.tools.join(", ")}
          </div>
        </div>
      </section>
    </div>
  );
}

