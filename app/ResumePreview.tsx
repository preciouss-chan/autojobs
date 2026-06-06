"use client";

import type { Resume } from "@/app/lib/schemas";

type ResumeSkillCategory = keyof Resume["skills"];

interface ResumePreviewProps {
  readonly resume: Resume;
  readonly editable?: boolean;
  readonly onSkillChange?: (category: ResumeSkillCategory, value: string) => void;
  readonly onExperienceBulletChange?: (
    experienceIndex: number,
    bulletIndex: number,
    value: string
  ) => void;
  readonly onProjectBulletChange?: (
    projectIndex: number,
    bulletIndex: number,
    value: string
  ) => void;
}

const skillRows: Array<{
  readonly key: ResumeSkillCategory;
  readonly label: string;
}> = [
  { key: "languages", label: "Languages" },
  { key: "frameworks_libraries", label: "Frameworks" },
  { key: "tools", label: "Technologies" },
  { key: "professional_skills", label: "Professional Skills" },
];

function editableRows(value: string, minimum = 1): number {
  return Math.max(minimum, Math.ceil(value.length / 105));
}

function formatList(items: readonly string[]): string {
  return items.join(", ");
}

export default function ResumePreview({
  resume,
  editable = false,
  onSkillChange,
  onExperienceBulletChange,
  onProjectBulletChange,
}: ResumePreviewProps): React.ReactElement {
  const formatGraduationLabel = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) {
      return "";
    }

    return /expected|graduat/i.test(trimmed) ? trimmed : `Expected ${trimmed}`;
  };

  const editableTextClassName = "w-full resize-none rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm leading-relaxed text-gray-900 outline-none transition hover:border-gray-300 focus:border-gray-500 focus:bg-white";
  const editableInputClassName = "min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm text-gray-900 outline-none transition hover:border-gray-300 focus:border-gray-500 focus:bg-white";

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

      </header>
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

                {exp.bullets && exp.bullets.length > 0 ? (
                  editable ? (
                    <div className="ml-2 mt-1 space-y-1">
                      {exp.bullets.map((bullet, bulletIndex) => (
                        <div key={bulletIndex} className="flex items-start gap-2 text-sm">
                          <span className="mt-1 text-gray-900">•</span>
                          <textarea
                            value={bullet}
                            rows={editableRows(bullet)}
                            onChange={(event) =>
                              onExperienceBulletChange?.(i, bulletIndex, event.target.value)
                            }
                            aria-label={`Edit ${exp.company} bullet ${bulletIndex + 1}`}
                            className={editableTextClassName}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                      {exp.bullets.map((bullet, bulletIndex) => (
                        <li key={bulletIndex} className="text-sm">
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  )
                ) : null}
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

                {proj.bullets && proj.bullets.length > 0 ? (
                  editable ? (
                    <div className="ml-2 mt-1 space-y-1">
                      {proj.bullets.map((bullet, bulletIndex) => (
                        <div key={bulletIndex} className="flex items-start gap-2 text-sm">
                          <span className="mt-1 text-gray-900">•</span>
                          <textarea
                            value={bullet}
                            rows={editableRows(bullet)}
                            onChange={(event) =>
                              onProjectBulletChange?.(i, bulletIndex, event.target.value)
                            }
                            aria-label={`Edit ${proj.name} bullet ${bulletIndex + 1}`}
                            className={editableTextClassName}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                      {proj.bullets.map((bullet, bulletIndex) => (
                        <li key={bulletIndex} className="text-sm">
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  )
                ) : null}
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
            {skillRows.map((row) => {
              const value = formatList(resume.skills[row.key]);
              if (!editable && !value) {
                return null;
              }

              return (
                <div key={row.key} className="flex items-baseline gap-1 text-sm">
                  <span className="shrink-0 font-semibold">{row.label}:</span>
                  {editable ? (
                    <input
                      type="text"
                      value={value}
                      onChange={(event) => onSkillChange?.(row.key, event.target.value)}
                      aria-label={`Edit ${row.label.toLowerCase()}`}
                      className={editableInputClassName}
                    />
                  ) : (
                    <span>{value}</span>
                  )}
                </div>
              );
            })}
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
