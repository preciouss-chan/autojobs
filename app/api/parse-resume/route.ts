import { NextResponse } from "next/server";
import OpenAI from "openai";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";
import { ResumeSchema, ErrorResponseSchema } from "@/app/lib/schemas";
import { LLM_CONFIG } from "@/app/lib/llm-config";

export const runtime = "nodejs";

// Credit cost for resume parsing (after first free use)
const PARSE_RESUME_CREDIT_COST = 5;

export async function POST(req: Request): Promise<NextResponse> {
  try {
    // Require authentication
    const session = await auth();
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any)?.id;
    if (!userId) {
      return NextResponse.json({ error: "User ID not found" }, { status: 401 });
    }

    // Apply rate limiting per user
    const rateLimitResult = checkRateLimit(
      session.user.email,
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

    // Check if user has already used their free resume parse
    const credits = await prisma.credits.findUnique({
      where: { userId },
    });

    if (!credits) {
      return NextResponse.json({ error: "Credits not found" }, { status: 404 });
    }

    // If not first time, check credit balance
    if (credits.usedFreeResumeParse) {
      if (credits.balance < PARSE_RESUME_CREDIT_COST) {
        return NextResponse.json(
          {
            error: "Insufficient credits",
            required: PARSE_RESUME_CREDIT_COST,
            available: credits.balance,
            message: `This operation requires ${PARSE_RESUME_CREDIT_COST} credits but you only have ${credits.balance}`,
          },
          { status: 402 } // Payment required
        );
      }
    }

    // Get API key from header or fallback to environment variable
    const apiKey = req.headers.get("X-OpenAI-API-Key") || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        ErrorResponseSchema.parse({
          error: "OpenAI API key is required. Please set it in extension settings or environment variable.",
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

     // Use require for pdf-parse
     const { PDFParse } = require("pdf-parse");
     
     // Parse PDF and extract text
     let extractedText: string = "";
     try {
       const parser = new PDFParse(uint8Array);
       await parser.load();
       const result = await parser.getText();
       extractedText = result.text || "";
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
      
      // Deduct credits after successful parsing (if not first time)
      try {
        if (credits.usedFreeResumeParse) {
          // Subsequent parses: deduct 5 credits
          await prisma.credits.update({
            where: { userId },
            data: {
              balance: {
                decrement: PARSE_RESUME_CREDIT_COST,
              },
              lastDeductedAt: new Date(),
            },
          });

          // Record transaction
          await prisma.transaction.create({
            data: {
              userId,
              type: "deduction",
              amount: -PARSE_RESUME_CREDIT_COST,
              reason: "resume_parsing",
            },
          });

          console.log(`Deducted ${PARSE_RESUME_CREDIT_COST} credits for user ${userId}`);
        } else {
          // First time: mark as used free parse, no deduction
          await prisma.credits.update({
            where: { userId },
            data: {
              usedFreeResumeParse: true,
            },
          });

          // Record transaction for audit trail
          await prisma.transaction.create({
            data: {
              userId,
              type: "grant",
              amount: 0,
              reason: "free_resume_parsing",
            },
          });

          console.log(`Used free resume parse for user ${userId}`);
        }
      } catch (creditError: unknown) {
        console.error("Failed to update credits:", creditError);
        // Don't fail the request if credit deduction fails, just log it
      }
      
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

