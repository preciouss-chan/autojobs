import { NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import { ExportPDFRequestSchema, ErrorResponseSchema } from "@/app/lib/schemas";

export const runtime = "nodejs";

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
      setFontSize(12);
      doc.setFont("helvetica", "bold");
      (doc.text as any)(title, margin, yPosition);
      yPosition += 10;

      // Add horizontal line
      doc.setDrawColor(0);
      doc.line(margin, yPosition - 3, pageWidth - margin, yPosition - 3);
      yPosition += 2;
    };

    const addText = (text: string, fontSize = 10, isBold = false): void => {
      setFontSize(fontSize);
      doc.setFont("helvetica", isBold ? "bold" : "normal");
      const lines = doc.splitTextToSize(text as string, contentWidth) as string[];
      (doc.text as any)(lines, margin, yPosition);
      // Fixed: Use proper line height calculation
      // jsPDF text() method uses internal line height of approximately fontSize * 1.15
      const lineHeight = fontSize * 1.15;
      yPosition += lines.length * lineHeight + 8;
    };

    const checkPageBreak = (neededSpace: number): void => {
      if (yPosition + neededSpace > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
      }
    };

    // ===== HEADER =====
    setFontSize(16);
    doc.setFont("helvetica", "bold");
    (doc.text as any)(resume.name ?? "Resume", margin, yPosition);
    yPosition += 16;

    // Contact line
    const contactParts = [
      resume.contact?.email ?? "",
      resume.contact?.phone ?? "",
      resume.contact?.linkedin ?? "",
      resume.contact?.github ?? "",
    ].filter((s): s is string => s.length > 0);

    if (contactParts.length > 0) {
      setFontSize(9);
      doc.setFont("helvetica", "normal");
      const contactText = contactParts.join(" • ");
      const contactLines = doc.splitTextToSize(contactText as string, contentWidth) as string[];
      (doc.text as any)(contactLines, margin, yPosition);
      yPosition += contactLines.length * 4 + 10;
    }

    // Horizontal line
    doc.setDrawColor(0);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;

    // ===== SUMMARY =====
    if (resume.summary && resume.summary.trim().length > 0) {
      checkPageBreak(40);
      addSectionTitle("SUMMARY");
      addText(resume.summary, 10);
      yPosition += 4;
    }

    // ===== EXPERIENCE =====
    if (resume.experience && resume.experience.length > 0) {
      checkPageBreak(60);
      addSectionTitle("EXPERIENCE");

      resume.experience.forEach((exp) => {
        checkPageBreak(50);

        // Role and company
        setFontSize(11);
        doc.setFont("helvetica", "bold");
        const role = exp.role ?? "";
        const company = exp.company ?? "";
        const roleCompanyText = `${role} — ${company}`;
        (doc.text as any)(roleCompanyText, margin, yPosition);
        yPosition += 10;

        // Dates (right-aligned, but we'll put it below for simplicity)
        if (exp.dates) {
          setFontSize(9);
          doc.setFont("helvetica", "normal");
          (doc.text as any)(exp.dates, margin, yPosition);
          yPosition += 8;
        }

        // Bullets
        if (exp.bullets && exp.bullets.length > 0) {
          setFontSize(10);
          doc.setFont("helvetica", "normal");
          exp.bullets.slice(0, 5).forEach((bullet) => {
            const bulletLines = doc.splitTextToSize(`• ${bullet}` as string, contentWidth - 10) as string[];
            (doc.text as any)(bulletLines, margin + 8, yPosition);
            // Fixed: Proper line height calculation for 10pt font
            yPosition += bulletLines.length * 11.5 + 3;
          });
        }

         yPosition += 6;
      });
    }

    // ===== PROJECTS =====
    if (resume.projects && resume.projects.length > 0) {
      checkPageBreak(60);
      addSectionTitle("PROJECTS");

      resume.projects.forEach((proj) => {
        checkPageBreak(40);

        // Project name
        setFontSize(11);
        doc.setFont("helvetica", "bold");
        const projectName = proj.name ?? "";
        (doc.text as any)(projectName, margin, yPosition);
        yPosition += 10;

         // Link and date
         if (proj.link || proj.date) {
           setFontSize(9);
           doc.setFont("helvetica", "normal");
           const linkDateParts = [proj.link, proj.date].filter((s): s is string => Boolean(s));
           const linkDateText = linkDateParts.join(" • ");
           (doc.text as any)(linkDateText, margin, yPosition);
           yPosition += 10;
         }

        // Bullets
        if (proj.bullets && proj.bullets.length > 0) {
          setFontSize(10);
          doc.setFont("helvetica", "normal");
          proj.bullets.slice(0, 3).forEach((bullet) => {
            const bulletLines = doc.splitTextToSize(`• ${bullet}` as string, contentWidth - 10) as string[];
            (doc.text as any)(bulletLines, margin + 8, yPosition);
            // Fixed: Proper line height calculation
            yPosition += bulletLines.length * 11.5 + 3;
          });
        }

         yPosition += 6;
      });
    }

    // ===== SKILLS =====
    if (resume.skills) {
      const skillsArr = [];
      if (resume.skills.languages && resume.skills.languages.length > 0) {
        skillsArr.push(`Languages: ${resume.skills.languages.join(", ")}`);
      }
      if (resume.skills.frameworks_libraries && resume.skills.frameworks_libraries.length > 0) {
        skillsArr.push(`Frameworks: ${resume.skills.frameworks_libraries.join(", ")}`);
      }
      if (resume.skills.tools && resume.skills.tools.length > 0) {
        skillsArr.push(`Tools: ${resume.skills.tools.join(", ")}`);
      }

       if (skillsArr.length > 0) {
         checkPageBreak(60);
         addSectionTitle("SKILLS");

         setFontSize(10);
         doc.setFont("helvetica", "normal");
         skillsArr.forEach((skillLine) => {
           const lines = doc.splitTextToSize(skillLine as string, contentWidth) as string[];
           (doc.text as any)(lines, margin, yPosition);
           // Fixed: Proper line height calculation
           yPosition += lines.length * 11.5 + 3;
         });
       }
    }

    // ===== EDUCATION =====
    if (resume.education && resume.education.length > 0) {
      checkPageBreak(40);
      addSectionTitle("EDUCATION");

       resume.education.forEach((edu) => {
         const degree = edu.degree ?? "";
         const institution = edu.institution ?? "";
         const degreeText = `${degree} — ${institution}`;
         addText(degreeText, 10, true);

         const detailsArr = [];
         if (edu.graduation_year) detailsArr.push(`Graduation: ${edu.graduation_year}`);
         if (edu.gpa) detailsArr.push(`GPA: ${edu.gpa}`);

         if (detailsArr.length > 0) {
           addText(detailsArr.join(" • "), 9);
         }

         yPosition += 8;
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
