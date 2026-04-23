import { NextResponse } from "next/server";
import OpenAI from "openai";
import { checkRateLimit, getIdentifierFromRequest, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";
import { ResumeSchema, ErrorResponseSchema } from "@/app/lib/schemas";
import { LLM_CONFIG } from "@/app/lib/llm-config";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const identifier = getIdentifierFromRequest(req);
    const rateLimitResult = checkRateLimit(
      identifier,
      "parse-resume",
      RATE_LIMIT_PRESETS.PARSE_RESUME.limit,
      RATE_LIMIT_PRESETS.PARSE_RESUME.windowMs
    );

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: `Too many requests. Please try again in ${rateLimitResult.retryAfter} seconds.`,
          retryAfter: rateLimitResult.retryAfter,
        },
        { status: 429, headers: { "Retry-After": String(rateLimitResult.retryAfter) } }
      );
    }

    // Get API key from header or fallback to environment variable
    const apiKey = req.headers.get("X-OpenAI-API-Key") || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        ErrorResponseSchema.parse({
          error: "OpenAI API key is required. Add it in the dashboard or set OPENAI_API_KEY on the server.",
        }),
        { status: 401 }
      );
    }

    // Initialize OpenAI client inside the function
    const client = new OpenAI({
      apiKey: apiKey,
    });
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        ErrorResponseSchema.parse({
          error: "No file provided",
        }),
        { status: 400 }
      );
    }

     // Read PDF file as buffer
     const arrayBuffer = await file.arrayBuffer();
     const buffer = Buffer.from(arrayBuffer);
     const uint8Array = new Uint8Array(buffer);

      if (
        typeof globalThis.DOMMatrix === "undefined" ||
        typeof globalThis.ImageData === "undefined"
      ) {
        const canvasModule = await import("canvas");
        const { DOMMatrix, ImageData } = canvasModule;

        if (typeof globalThis.DOMMatrix === "undefined") {
          globalThis.DOMMatrix = DOMMatrix as unknown as typeof globalThis.DOMMatrix;
        }
        if (typeof globalThis.ImageData === "undefined") {
          globalThis.ImageData = ImageData as unknown as typeof globalThis.ImageData;
        }
      }

      const { PDFParse } = await import("pdf-parse");
      const { getData } = await import("pdf-parse/worker");
      PDFParse.setWorker(getData());
     
      // Parse PDF and extract text
       let extractedText: string = "";
       try {
        const parser = new PDFParse({ data: uint8Array });
        const result = await parser.getText();
        extractedText = result.text || "";
        await parser.destroy();
       } catch (pdfErr) {
        console.error("PDF parsing failed:", pdfErr);
        return NextResponse.json(
         ErrorResponseSchema.parse({
           error: "Could not extract text from PDF. Please ensure the PDF contains readable text.",
           details: pdfErr instanceof Error ? pdfErr.message : String(pdfErr),
         }),
         { status: 400 }
       );
     }

    if (!extractedText || extractedText.trim().length === 0) {
      return NextResponse.json(
        ErrorResponseSchema.parse({
          error: "Could not extract text from PDF. Please ensure the PDF contains readable text.",
        }),
        { status: 400 }
      );
    }

    // Use OpenAI to extract structured data from the text
    const prompt = `
You are an expert at extracting structured data from resumes. 

Extract the resume information from the following text and convert it to JSON format.

RESUME TEXT:
${extractedText}

Return ONLY a JSON object with this exact structure:
{
  "name": "",
  "contact": {
    "phone": "",
    "email": "",
    "linkedin": "",
    "github": ""
  },
  "summary": "",
  "projects": [
    {
      "name": "",
      "date": "",
      "link": "",
      "bullets": []
    }
  ],
  "experience": [
    {
      "company": "",
      "role": "",
      "dates": "",
      "bullets": []
    }
  ],
  "education": [
    {
      "degree": "",
      "institution": "",
      "graduation_year": "",
      "gpa": ""
    }
  ],
  "skills": {
    "languages": [],
    "frameworks_libraries": [],
    "tools": []
  }
}

Extract all information accurately. If a field is not present, use an empty string or empty array.
`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: LLM_CONFIG.DETERMINISTIC.temperature, // Use consistent temperature for structured parsing
      response_format: { type: "json_object" }
    });

    const jsonString = response.choices[0]?.message?.content || "{}";
    
    try {
      const parsed = JSON.parse(jsonString);
      const validated = ResumeSchema.parse(parsed);

      return NextResponse.json(validated);
    } catch (parseErr: unknown) {
      console.error("Failed to parse/validate resume response:", parseErr);
      return NextResponse.json(
        ErrorResponseSchema.parse({
          error: "Failed to parse resume from PDF. Please ensure it contains all required fields.",
          details: parseErr instanceof Error ? parseErr.message : String(parseErr),
        }),
        { status: 500 }
      );
    }

  } catch (err: unknown) {
    console.error("PARSE_RESUME ERROR:", err);
    const errorMessage =
      err instanceof Error ? err.message : String(err);
    const errorStack =
      err instanceof Error ? err.stack || "" : "";
    console.error("Error stack:", errorStack);

    return NextResponse.json(
      ErrorResponseSchema.parse({
        error: "Server error",
        details: errorMessage,
        ...(process.env.NODE_ENV === "development" && { stack: errorStack }),
      }),
      { status: 500 }
    );
  }
}
