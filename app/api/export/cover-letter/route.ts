import { NextResponse } from "next/server";
import { jsPDF } from "jspdf";

export const runtime = "nodejs";

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid text" },
        { status: 400 }
      );
    }

    const doc = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "letter",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 72;
    const contentWidth = pageWidth - margin * 2;
    const fontSize = 11;
    const lineHeight = fontSize * 1.5;
    const paragraphGap = 10;
    let yPosition = margin;

    doc.setFont("times", "normal");
    doc.setFontSize(fontSize);

    const paragraphs = splitParagraphs(text);

    for (const paragraph of paragraphs) {
      const lines = doc.splitTextToSize(paragraph, contentWidth) as string[];
      const paragraphHeight = lines.length * lineHeight;

      if (yPosition + paragraphHeight > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
        doc.setFont("times", "normal");
        doc.setFontSize(fontSize);
      }

      (doc.text as any)(lines, margin, yPosition);
      yPosition += paragraphHeight + paragraphGap;
    }

    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="cover_letter.pdf"',
      },
    });
  } catch (err: any) {
    console.error("COVER_LETTER_PDF ERROR:", err);
    return NextResponse.json(
      { error: "PDF generation failed", details: err.message },
      { status: 500 }
    );
  }
}
