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
       yPosition += 6; // Space before section
       setFontSize(12);
       doc.setFont("helvetica", "bold");
       (doc.text as any)(title, margin, yPosition);
       yPosition += 12;

       // Add horizontal line with more margin
       doc.setDrawColor(0);
       doc.line(margin - 5, yPosition - 6, pageWidth - margin + 5, yPosition - 6);
       yPosition += 2;
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

    // ===== HEADER =====
    setFontSize(16);
    doc.setFont("helvetica", "bold");
    // Center the name
    (doc.text as any)(resume.name ?? "Resume", pageWidth / 2, yPosition, { align: "center" });
    yPosition += 16;

    // Contact line - render with blue/underlined URLs
    if (resume.contact?.email || resume.contact?.phone || resume.contact?.linkedin || resume.contact?.github) {
      setFontSize(9);
      
      const contactItems: Array<{ text: string; isUrl: boolean }> = [];
      if (resume.contact?.email) {
        contactItems.push({ text: resume.contact.email, isUrl: false });
      }
      if (resume.contact?.phone) {
        contactItems.push({ text: resume.contact.phone, isUrl: false });
      }
      if (resume.contact?.linkedin) {
        contactItems.push({ text: resume.contact.linkedin, isUrl: true });
      }
      if (resume.contact?.github) {
        contactItems.push({ text: resume.contact.github, isUrl: true });
      }
      
      // Render contact items with separators
      let currentX = margin;
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
          // Render URLs as blue and underlined
          doc.setTextColor(0, 0, 255);
          doc.setFont("helvetica", "normal");
          (doc.text as any)(item.text, currentX, contactY);
          const textWidth = doc.getTextWidth(item.text);
          // Draw underline
          doc.setDrawColor(0, 0, 255);
          doc.line(currentX, contactY + 2, currentX + textWidth, contactY + 2);
          doc.setDrawColor(0);
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

       resume.experience.forEach((exp, index) => {
         checkPageBreak(50);

         // Role and company (bold)
         setFontSize(11);
         doc.setFont("helvetica", "bold");
         const role = exp.role ?? "";
         const company = exp.company ?? "";
         const roleCompanyText = `${role} — ${company}`;
         (doc.text as any)(roleCompanyText, margin, yPosition);
         yPosition += 14;

         // Dates
         if (exp.dates) {
           setFontSize(9);
           doc.setFont("helvetica", "normal");
           (doc.text as any)(exp.dates, margin, yPosition);
           yPosition += 10;
         }

         // Bullets
         if (exp.bullets && exp.bullets.length > 0) {
           setFontSize(10);
           doc.setFont("helvetica", "normal");
           exp.bullets.slice(0, 5).forEach((bullet) => {
             const bulletLines = doc.splitTextToSize(`• ${bullet}` as string, contentWidth - 10) as string[];
             (doc.text as any)(bulletLines, margin + 8, yPosition);
             const lineHeight = 10 * 1.15;
             yPosition += bulletLines.length * lineHeight + 2;
           });
         }

         // Add spacing between experience entries
         if (index < resume.experience.length - 1) {
           yPosition += 10;
         }
       });
     }

     // ===== PROJECTS =====
     if (resume.projects && resume.projects.length > 0) {
       checkPageBreak(60);
       addSectionTitle("PROJECTS");

       resume.projects.forEach((proj, index) => {
         checkPageBreak(40);

         // Project name (bold)
         setFontSize(11);
         doc.setFont("helvetica", "bold");
         const projectName = proj.name ?? "";
         (doc.text as any)(projectName, margin, yPosition);
         yPosition += 14;

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
             const lineHeight = 10 * 1.15;
             yPosition += bulletLines.length * lineHeight + 2;
           });
         }

         // Add spacing between projects
         if (index < resume.projects.length - 1) {
           yPosition += 10;
         }
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
         skillsArr.forEach((skillLine, index) => {
           const lines = doc.splitTextToSize(skillLine as string, contentWidth) as string[];
           (doc.text as any)(lines, margin, yPosition);
           const lineHeight = 10 * 1.15;
           yPosition += lines.length * lineHeight + 4;
         });
       }
     }

     // ===== EDUCATION =====
     if (resume.education && resume.education.length > 0) {
       checkPageBreak(40);
       addSectionTitle("EDUCATION");

       resume.education.forEach((edu, index) => {
         const degree = edu.degree ?? "";
         const institution = edu.institution ?? "";
         const degreeText = `${degree} — ${institution}`;
         addText(degreeText, 10, true, 6);

         const detailsArr = [];
         if (edu.graduation_year) detailsArr.push(`Graduation: ${edu.graduation_year}`);
         if (edu.gpa) detailsArr.push(`GPA: ${edu.gpa}`);

         if (detailsArr.length > 0) {
           addText(detailsArr.join(" • "), 9, false, 8);
         }

         // Add spacing between education entries
         if (index < resume.education.length - 1) {
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
