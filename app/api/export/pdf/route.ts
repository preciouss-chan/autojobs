import { NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import { ExportPDFRequestSchema, ErrorResponseSchema } from "@/app/lib/schemas";
import type { Resume } from "@/app/lib/schemas";

export const runtime = "nodejs";

function formatGraduationLabel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  return /expected|graduat/i.test(trimmed) ? trimmed : `Expected ${trimmed}`;
}

function normalizeSkillValue(value: string): string {
  return value.trim().toLowerCase();
}

function countOccurrences(text: string, needle: string): number {
  if (!needle) {
    return 0;
  }

  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = text.match(new RegExp(`\\b${escaped}\\b`, "gi"));
  return matches ? matches.length : 0;
}

function rankSkillsByEvidence(resume: Resume, skills: string[]): string[] {
  const evidenceText = [
    resume.summary,
    ...resume.experience.flatMap((exp) => [exp.role, exp.company, ...(exp.bullets ?? [])]),
    ...resume.projects.flatMap((project) => [project.name, project.link, ...(project.bullets ?? [])]),
    ...resume.education.flatMap((edu) => [edu.degree, edu.institution]),
  ]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(" \n ")
    .toLowerCase();

  return [...skills].sort((left, right) => {
    const leftNormalized = normalizeSkillValue(left);
    const rightNormalized = normalizeSkillValue(right);
    const leftCount = countOccurrences(evidenceText, leftNormalized);
    const rightCount = countOccurrences(evidenceText, rightNormalized);

    if (rightCount !== leftCount) {
      return rightCount - leftCount;
    }

    return left.localeCompare(right);
  });
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    // Validate request body
    const body = await req.json();
    const resume = ExportPDFRequestSchema.parse(body);

    // Create PDF document (Letter size: 8.5 x 11 inches)
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "letter",
    });

    // Set default font and colors
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 28;
    const contentWidth = pageWidth - 2 * margin;
    let yPosition = margin;

     // Helper functions
     const setFontSize = (size: number): void => {
       doc.setFontSize(size);
     };

      const addSectionTitle = (title: string): void => {
        yPosition += 3; // Reduced from 6 to fit more content
        setFontSize(12);
        doc.setFont("helvetica", "bold");
        (doc.text as any)(title, margin, yPosition);
        yPosition += 12;

        // Add horizontal line with more margin
        doc.setDrawColor(0);
        doc.line(margin - 5, yPosition - 6, pageWidth - margin + 5, yPosition - 6);
        yPosition += 6; // Reduced from 10 to fit more content on one page
      };

     const addText = (text: string, fontSize = 10, isBold = false, extraSpacing = 4): void => {
       setFontSize(fontSize);
       doc.setFont("helvetica", isBold ? "bold" : "normal");
       const lines = doc.splitTextToSize(text as string, contentWidth) as string[];
       (doc.text as any)(lines, margin, yPosition);
       // Use proper line height: jsPDF's internal line spacing
       const lineHeight = fontSize * 1.15;
       yPosition += lines.length * lineHeight + extraSpacing;
     };

     const checkPageBreak = (neededSpace: number): void => {
       if (yPosition + neededSpace > pageHeight - margin) {
         doc.addPage();
         yPosition = margin;
       }
     };

    const lineHeightFor = (fontSize: number): number => fontSize * 1.15;

    const estimateResumeHeight = (inputResume: Resume): number => {
      let estimatedHeight = 34;

      if (inputResume.summary && inputResume.summary.trim().length > 0) {
        doc.setFontSize(10);
        const summaryLines = doc.splitTextToSize(inputResume.summary, contentWidth) as string[];
        estimatedHeight += 9 + summaryLines.length * lineHeightFor(10) + 8; // 3 + 6 for spacing around section
      }

      if (inputResume.experience && inputResume.experience.length > 0) {
        estimatedHeight += 3 + 12 + 6; // Before + title + after section title
        inputResume.experience.forEach((exp, index) => {
          estimatedHeight += 14;
          (exp.bullets ?? []).forEach((bullet) => {
            doc.setFontSize(10);
            const lines = doc.splitTextToSize(`• ${bullet}`, contentWidth - 10) as string[];
            estimatedHeight += lines.length * lineHeightFor(10) + 2;
          });
          if (index < inputResume.experience.length - 1) {
            estimatedHeight += 6; // Reduced from 10 to match new spacing
          }
        });
      }

      if (inputResume.projects && inputResume.projects.length > 0) {
        estimatedHeight += 3 + 12 + 6; // Before + title + after section title
        inputResume.projects.forEach((proj, index) => {
          estimatedHeight += 14;
          (proj.bullets ?? []).forEach((bullet) => {
            doc.setFontSize(10);
            const lines = doc.splitTextToSize(`• ${bullet}`, contentWidth - 10) as string[];
            estimatedHeight += lines.length * lineHeightFor(10) + 2;
          });
          if (index < inputResume.projects.length - 1) {
            estimatedHeight += 6; // Reduced from 10 to match new spacing
          }
        });
      }

      if (inputResume.skills) {
        const skillsArr: string[] = [];
        if (inputResume.skills.languages?.length) {
          skillsArr.push(`Languages: ${inputResume.skills.languages.join(", ")}`);
        }
        if (inputResume.skills.frameworks_libraries?.length) {
          skillsArr.push(`Frameworks: ${inputResume.skills.frameworks_libraries.join(", ")}`);
        }
        if (inputResume.skills.tools?.length) {
          skillsArr.push(`Tools: ${inputResume.skills.tools.join(", ")}`);
        }
        if (inputResume.skills.professional_skills?.length) {
          skillsArr.push(`Professional Skills: ${inputResume.skills.professional_skills.join(", ")}`);
        }
        if (skillsArr.length > 0) {
          estimatedHeight += 3 + 12 + 6; // Before + title + after section title
          skillsArr.forEach((skillLine) => {
            doc.setFontSize(10);
            const lines = doc.splitTextToSize(skillLine, contentWidth) as string[];
            estimatedHeight += lines.length * lineHeightFor(10) + 4;
          });
        }
      }

       if (inputResume.education && inputResume.education.length > 0) {
         estimatedHeight += 3 + 12 + 6; // Before + title + after section title
         inputResume.education.forEach((edu, index) => {
           doc.setFontSize(11);
           const degreeText = `${edu.degree ?? ""} — ${edu.institution ?? ""}`;
           const degreeLines = doc.splitTextToSize(degreeText, contentWidth - 100) as string[];
           estimatedHeight += degreeLines.length * lineHeightFor(11) + 14; // 11pt for title line

           if (edu.gpa) {
             doc.setFontSize(10);
             estimatedHeight += lineHeightFor(10) + 2; // GPA line
           }

           if (index < inputResume.education.length - 1) {
             estimatedHeight += 8;
           }
         });
       }

      return estimatedHeight;
    };

    const fitResumeToOnePage = (inputResume: Resume): Resume => {
      const fittedResume = structuredClone(inputResume);
      const maxHeight = pageHeight - margin * 2;

      fittedResume.summary = "";

      fittedResume.skills.languages = rankSkillsByEvidence(
        fittedResume,
        fittedResume.skills.languages
      );
      fittedResume.skills.frameworks_libraries = rankSkillsByEvidence(
        fittedResume,
        fittedResume.skills.frameworks_libraries
      );
      fittedResume.skills.tools = rankSkillsByEvidence(
        fittedResume,
        fittedResume.skills.tools
      );
      fittedResume.skills.professional_skills = rankSkillsByEvidence(
        fittedResume,
        fittedResume.skills.professional_skills
      );

      const compactSteps: Array<() => boolean> = [
        // Priority 1: Trim tools skills (least important)
        () => {
          if (fittedResume.skills.tools.length > 4) {
            fittedResume.skills.tools = rankSkillsByEvidence(
              fittedResume,
              fittedResume.skills.tools
            ).slice(0, 4);
            return true;
          }
          return false;
        },
        // Priority 2: Trim professional skills
        () => {
          if (fittedResume.skills.professional_skills.length > 4) {
            fittedResume.skills.professional_skills = rankSkillsByEvidence(
              fittedResume,
              fittedResume.skills.professional_skills
            ).slice(0, 4);
            return true;
          }
          return false;
        },
        // Priority 3: Trim frameworks_libraries
        () => {
          if (fittedResume.skills.frameworks_libraries.length > 5) {
            fittedResume.skills.frameworks_libraries = rankSkillsByEvidence(
              fittedResume,
              fittedResume.skills.frameworks_libraries
            ).slice(0, 5);
            return true;
          }
          return false;
        },
        // Priority 4: Trim languages
        () => {
          if (fittedResume.skills.languages.length > 5) {
            fittedResume.skills.languages = rankSkillsByEvidence(
              fittedResume,
              fittedResume.skills.languages
            ).slice(0, 5);
            return true;
          }
          return false;
        },
        // CRITICAL: Do NOT trim experience or project bullets - they are precious content
        // Instead, we remove some projects if needed (as a last resort)
        () => {
          // Only trim projects if still over height, and only remove lowest-value ones
          if (fittedResume.projects.length > 1) {
            fittedResume.projects = fittedResume.projects.slice(0, -1);
            return true;
          }
          return false;
        },
      ];

      for (const compactStep of compactSteps) {
        if (estimateResumeHeight(fittedResume) <= maxHeight) {
          break;
        }
        compactStep();
      }

      return fittedResume;
    };

    const fittedResume = fitResumeToOnePage(resume as Resume);

    // ===== HEADER =====
    setFontSize(16);
    doc.setFont("helvetica", "bold");
    // Center the name
    (doc.text as any)(fittedResume.name ?? "Resume", pageWidth / 2, yPosition, { align: "center" });
    yPosition += 16;

    function normalizeLink(url: string): string {
      if (url.startsWith("http://") || url.startsWith("https://")) {
        return url;
      }

      return `https://${url}`;
    }

    // Contact line - centered with clickable URL annotations
    if (fittedResume.contact?.email || fittedResume.contact?.phone || fittedResume.contact?.linkedin || fittedResume.contact?.github) {
      setFontSize(9);

      const contactItems: Array<{ text: string; isUrl: boolean }> = [];
      if (fittedResume.contact?.email) {
        contactItems.push({ text: fittedResume.contact.email, isUrl: false });
      }
      if (fittedResume.contact?.phone) {
        contactItems.push({ text: fittedResume.contact.phone, isUrl: false });
      }
      if (fittedResume.contact?.linkedin) {
        contactItems.push({ text: fittedResume.contact.linkedin, isUrl: true });
      }
      if (fittedResume.contact?.github) {
        contactItems.push({ text: fittedResume.contact.github, isUrl: true });
      }
      
      const separatorWidth = doc.getTextWidth(" • ");
      const totalContactWidth = contactItems.reduce((width, item, index) => {
        const itemWidth = doc.getTextWidth(item.text);
        return width + itemWidth + (index > 0 ? separatorWidth : 0);
      }, 0);

      // Render contact items with separators
      let currentX = Math.max((pageWidth - totalContactWidth) / 2, margin);
      const contactY = yPosition;

      for (let i = 0; i < contactItems.length; i++) {
        const item = contactItems[i];

        // Add separator before item (not before first item)
        if (i > 0) {
          doc.setTextColor(0, 0, 0);
          doc.setFont("helvetica", "normal");
          const sepText = " • ";
          (doc.text as any)(sepText, currentX, contactY);
          currentX += doc.getTextWidth(sepText);
        }
        
        if (item.isUrl) {
          // Render URLs as plain text (ATS-friendly)
          doc.setTextColor(0, 0, 0);
          doc.setFont("helvetica", "normal");
          (doc.text as any)(item.text, currentX, contactY);
          const textWidth = doc.getTextWidth(item.text);
          doc.link(currentX, contactY - 8, textWidth, 10, {
            url: normalizeLink(item.text),
          });
          currentX += textWidth;
        } else {
          // Regular text (email, phone)
          doc.setTextColor(0, 0, 0);
          doc.setFont("helvetica", "normal");
          (doc.text as any)(item.text, currentX, contactY);
          currentX += doc.getTextWidth(item.text);
        }
      }
      
      doc.setTextColor(0, 0, 0);
      yPosition += 10;
    }

    // Horizontal line with more margin
    doc.setDrawColor(0);
    doc.line(margin - 5, yPosition, pageWidth - margin + 5, yPosition);
    yPosition += 8;

      // ===== EXPERIENCE =====
      if (fittedResume.experience && fittedResume.experience.length > 0) {
        checkPageBreak(60);
        addSectionTitle("EXPERIENCE");

        fittedResume.experience.forEach((exp, index) => {
         checkPageBreak(50);

         // Role and company (bold) with dates on right
         setFontSize(11);
         doc.setFont("helvetica", "bold");
         const role = exp.role ?? "";
         const company = exp.company ?? "";
         const roleCompanyText = `${role} — ${company}`;
         
         // Render role/company on left
         (doc.text as any)(roleCompanyText, margin, yPosition);
         
         // Render dates on right (right-aligned)
         if (exp.dates) {
           setFontSize(11);
           doc.setFont("helvetica", "normal");
           (doc.text as any)(exp.dates, pageWidth - margin, yPosition, { align: "right" });
         }
         
         yPosition += 14;

          // Bullets
          if (exp.bullets && exp.bullets.length > 0) {
            setFontSize(10);
            doc.setFont("helvetica", "normal");
            // Render all bullets - no artificial limit (compaction already happened in fitResumeToOnePage)
            exp.bullets.forEach((bullet) => {
              const bulletLines = doc.splitTextToSize(`• ${bullet}` as string, contentWidth - 10) as string[];
              (doc.text as any)(bulletLines, margin + 8, yPosition);
              const lineHeight = 10 * 1.15;
              yPosition += bulletLines.length * lineHeight + 2;
            });
         }

          // Add spacing between experience entries
           if (index < fittedResume.experience.length - 1) {
            yPosition += 6; // Reduced from 10 to fit more content
          }
       });
     }

     // ===== PROJECTS =====
      if (fittedResume.projects && fittedResume.projects.length > 0) {
        checkPageBreak(60);
        addSectionTitle("PROJECTS");

        fittedResume.projects.forEach((proj, index) => {
         checkPageBreak(40);

         // Project name (bold) with link/date on right
         setFontSize(11);
         doc.setFont("helvetica", "bold");
         const projectName = proj.name ?? "";
         (doc.text as any)(projectName, margin, yPosition);
         
         // Link and date on right (right-aligned)
         if (proj.link || proj.date) {
           setFontSize(11);
           doc.setFont("helvetica", "normal");
           const linkDateParts = [proj.link, proj.date].filter((s): s is string => Boolean(s));
           const linkDateText = linkDateParts.join(" • ");
           (doc.text as any)(linkDateText, pageWidth - margin, yPosition, { align: "right" });
         }
         
         yPosition += 14;

          // Bullets
          if (proj.bullets && proj.bullets.length > 0) {
            setFontSize(10);
            doc.setFont("helvetica", "normal");
            // Render all bullets - no artificial limit (compaction already happened in fitResumeToOnePage)
            proj.bullets.forEach((bullet) => {
              const bulletLines = doc.splitTextToSize(`• ${bullet}` as string, contentWidth - 10) as string[];
              (doc.text as any)(bulletLines, margin + 8, yPosition);
              const lineHeight = 10 * 1.15;
              yPosition += bulletLines.length * lineHeight + 2;
            });
         }

          // Add spacing between projects
           if (index < fittedResume.projects.length - 1) {
            yPosition += 6; // Reduced from 10 to fit all projects on one page
          }
       });
     }

     // ===== SKILLS =====
      if (fittedResume.skills) {
        const skillsArr = [];
        if (fittedResume.skills.languages && fittedResume.skills.languages.length > 0) {
          skillsArr.push(`Languages: ${fittedResume.skills.languages.join(", ")}`);
        }
        if (fittedResume.skills.frameworks_libraries && fittedResume.skills.frameworks_libraries.length > 0) {
          skillsArr.push(`Frameworks: ${fittedResume.skills.frameworks_libraries.join(", ")}`);
        }
        if (fittedResume.skills.tools && fittedResume.skills.tools.length > 0) {
          skillsArr.push(`Tools: ${fittedResume.skills.tools.join(", ")}`);
        }
        if (fittedResume.skills.professional_skills && fittedResume.skills.professional_skills.length > 0) {
          skillsArr.push(`Professional Skills: ${fittedResume.skills.professional_skills.join(", ")}`);
        }

       if (skillsArr.length > 0) {
         checkPageBreak(60);
         addSectionTitle("SKILLS");

         setFontSize(10);
         doc.setFont("helvetica", "normal");
          skillsArr.forEach((skillLine) => {
           const lines = doc.splitTextToSize(skillLine as string, contentWidth) as string[];
           (doc.text as any)(lines, margin, yPosition);
           const lineHeight = 10 * 1.15;
           yPosition += lines.length * lineHeight + 4;
         });
       }
     }

      // ===== EDUCATION =====
       if (fittedResume.education && fittedResume.education.length > 0) {
         checkPageBreak(40);
         addSectionTitle("EDUCATION");

         fittedResume.education.forEach((edu, index) => {
          checkPageBreak(40);

          // Degree and institution on left, graduation/GPA on right
          setFontSize(11);
          doc.setFont("helvetica", "bold");
          (doc.text as any)(edu.degree ?? "", margin, yPosition);

          if (edu.graduation_year) {
            setFontSize(11);
            doc.setFont("helvetica", "normal");
            (doc.text as any)(formatGraduationLabel(edu.graduation_year), pageWidth - margin, yPosition, { align: "right" });
          }

          yPosition += 14;

          setFontSize(11);
          doc.setFont("helvetica", "normal");
          (doc.text as any)(edu.institution ?? "", margin, yPosition);

          if (edu.gpa) {
            setFontSize(10);
            doc.setFont("helvetica", "normal");
            (doc.text as any)(`GPA: ${edu.gpa}`, pageWidth - margin, yPosition, { align: "right" });
          }

          yPosition += 10 * 1.15 + 2;

          if (index < fittedResume.education.length - 1) {
            yPosition += 8;
          }
        });
      }

    // Convert PDF to buffer
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    // Return PDF
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="resume.pdf"',
      },
    });
  } catch (err: unknown) {
    console.error("PDF_EXPORT_ERROR:", err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack || "" : "";

    return NextResponse.json(
      ErrorResponseSchema.parse({
        error: "Failed to generate PDF",
        details: errorMessage,
        ...(process.env.NODE_ENV === "development" && { stack: errorStack }),
      }),
      { status: 500 }
    );
  }
}
