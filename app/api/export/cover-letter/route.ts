import { NextResponse } from "next/server";
import { jsPDF } from "jspdf";

export const runtime = "nodejs";

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ").trim())
    .filter((paragraph) => paragraph.length > 0);
}

function normalizeCoverLetterText(text: string): string[] {
  const cleaned = text.replace(/\r/g, "").trim();
  const signoffMatch = cleaned.match(/([\s\S]*?)(?:\n\s*\n)?(Sincerely,?|Best,?)\s*\n+(.+)$/i);

  if (!signoffMatch) {
    return splitParagraphs(cleaned);
  }

  const body = splitParagraphs(signoffMatch[1]);
  const closing = signoffMatch[2].replace(/\s+/g, " ").trim();
  const name = signoffMatch[3].replace(/\s+/g, " ").trim();

  return [...body, closing, name];
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
    const fontSize = 12;
    const lineHeight = fontSize * 1.4;
    const paragraphGap = 5;
    const closingGap = 4;
    let yPosition = margin;

    doc.setFont("times", "normal");
    doc.setFontSize(fontSize);

    const paragraphs = normalizeCoverLetterText(text);

    for (const [index, paragraph] of paragraphs.entries()) {
      const lines = doc.splitTextToSize(paragraph, contentWidth) as string[];
      const paragraphHeight = lines.length * lineHeight;

      if (yPosition + paragraphHeight > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
        doc.setFont("times", "normal");
        doc.setFontSize(fontSize);
      }

      doc.text(lines, margin, yPosition);
      const isClosingLine = /^(Sincerely,?|Best,?|Thanks,?)$/i.test(paragraph);
      yPosition += paragraphHeight + (isClosingLine ? closingGap : paragraphGap);

      if (index === paragraphs.length - 2 && isClosingLine) {
        yPosition -= 1;
      }
    }

    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="cover_letter.pdf"',
      },
    });
  } catch (err: unknown) {
    console.error("COVER_LETTER_PDF ERROR:", err);
    return NextResponse.json(
      {
        error: "PDF generation failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
