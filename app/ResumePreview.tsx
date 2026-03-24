"use client";

import type { Resume } from "@/app/lib/schemas";

interface ResumePreviewProps {
  readonly resume: Resume;
}

export default function ResumePreview({ resume }: ResumePreviewProps): React.ReactElement {
  const formatGraduationLabel = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) {
      return "";
    }

    return /expected|graduat/i.test(trimmed) ? trimmed : `Expected ${trimmed}`;
  };

  return (
    <div className="max-w-4xl mx-auto bg-white p-8 text-sm leading-normal print:p-6 font-sans">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-3xl font-bold mb-1">
          {resume.name}
        </h1>

        {/* Contact row - properly formatted */}
        <div className="text-xs text-gray-700 mb-3 flex flex-wrap gap-2">
          {resume.contact.email && <span>{resume.contact.email}</span>}
          {resume.contact.phone && <span>•</span>}
          {resume.contact.phone && <span>{resume.contact.phone}</span>}
          {resume.contact.linkedin && <span>•</span>}
          {resume.contact.linkedin && <span>{resume.contact.linkedin}</span>}
          {resume.contact.github && <span>•</span>}
          {resume.contact.github && <span>{resume.contact.github}</span>}
        </div>

        <hr className="border-gray-800 border-t-2" />
      </header>

      {/* Summary */}
      {resume.summary && resume.summary.trim().length > 0 && (
        <section className="mb-5">
          <h2 className="font-bold uppercase text-xs tracking-wide mb-2 border-b border-gray-400 pb-1">
            Summary
          </h2>
          <p className="text-sm leading-relaxed">
            {resume.summary}
          </p>
        </section>
      )}

      {/* Experience */}
      {resume.experience && resume.experience.length > 0 && (
        <section className="mb-5">
          <h2 className="font-bold uppercase text-xs tracking-wide mb-2 border-b border-gray-400 pb-1">
            Experience
          </h2>

          <div className="space-y-3">
            {resume.experience.map((exp, i) => (
              <div key={i}>
                <div className="flex justify-between items-baseline">
                  <div className="font-semibold text-sm">
                    {exp.role} — {exp.company}
                  </div>
                  {exp.dates && <span className="text-xs text-gray-600 ml-2 flex-shrink-0">{exp.dates}</span>}
                </div>

                {exp.bullets && exp.bullets.length > 0 && (
                  <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                    {exp.bullets.slice(0, 5).map((b, i2) => (
                      <li key={i2} className="text-sm">
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Projects */}
      {resume.projects && resume.projects.length > 0 && (
        <section className="mb-5">
          <h2 className="font-bold uppercase text-xs tracking-wide mb-2 border-b border-gray-400 pb-1">
            Projects
          </h2>

          <div className="space-y-3">
            {resume.projects.map((proj, i) => (
              <div key={i}>
                <div className="flex justify-between items-baseline">
                  <div className="font-semibold text-sm">
                    {proj.name}
                    {proj.link && (
                      <>
                        {" "}
                        <span className="text-gray-600 text-xs">({proj.link})</span>
                      </>
                    )}
                  </div>
                  {proj.date && <span className="text-xs text-gray-600 ml-2 flex-shrink-0">{proj.date}</span>}
                </div>

                {proj.bullets && proj.bullets.length > 0 && (
                  <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                    {proj.bullets.slice(0, 3).map((b, i2) => (
                      <li key={i2} className="text-sm">
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Skills */}
      {resume.skills && (
        <section className="mb-5">
          <h2 className="font-bold uppercase text-xs tracking-wide mb-2 border-b border-gray-400 pb-1">
            Skills
          </h2>

          <div className="space-y-1">
            {resume.skills.languages && resume.skills.languages.length > 0 && (
              <div className="text-sm">
                <span className="font-semibold">Languages:</span> {resume.skills.languages.join(", ")}
              </div>
            )}
            {resume.skills.frameworks_libraries && resume.skills.frameworks_libraries.length > 0 && (
              <div className="text-sm">
                <span className="font-semibold">Frameworks:</span> {resume.skills.frameworks_libraries.join(", ")}
              </div>
            )}
            {resume.skills.tools && resume.skills.tools.length > 0 && (
              <div className="text-sm">
                <span className="font-semibold">Tools:</span> {resume.skills.tools.join(", ")}
              </div>
            )}
            {resume.skills.professional_skills && resume.skills.professional_skills.length > 0 && (
              <div className="text-sm">
                <span className="font-semibold">Professional Skills:</span> {resume.skills.professional_skills.join(", ")}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Education */}
      {resume.education && resume.education.length > 0 && (
        <section>
          <h2 className="font-bold uppercase text-xs tracking-wide mb-2 border-b border-gray-400 pb-1">
            Education
          </h2>

          <div className="space-y-2">
            {resume.education.map((edu, i) => (
              <div key={i}>
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <div className="font-semibold text-sm">{edu.degree}</div>
                    <div className="text-sm">{edu.institution}</div>
                  </div>
                  <div className="text-right text-xs text-gray-600 flex-shrink-0">
                    {edu.graduation_year && (
                      <div>{formatGraduationLabel(edu.graduation_year)}</div>
                    )}
                    {edu.gpa && (
                      <div>GPA: {edu.gpa}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  ) as React.ReactElement;
}
