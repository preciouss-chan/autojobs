import { NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";
import {
  TailorRequestSchema,
  TailorResponseSchema,
  ErrorResponseSchema,
} from "@/app/lib/schemas";
import type { JobRequirements } from "@/app/lib/schemas";
import { LLM_CONFIG } from "@/app/lib/llm-config";

// Credit cost for tailoring (1 credit per application)
const TAILOR_CREDIT_COST = 1;

// Fallback resume path
const resumePath = path.join(process.cwd(), "data", "resume.json");

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    // Get authenticated user for rate limiting
    const session = await auth();
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any)?.id;
    if (!userId) {
      return NextResponse.json({ error: "User ID not found" }, { status: 401 });
    }

    // Apply rate limiting
    const rateLimitResult = checkRateLimit(
      session.user.email,
      "tailor",
      RATE_LIMIT_PRESETS.TAILOR.limit,
      RATE_LIMIT_PRESETS.TAILOR.windowMs
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

    // Check credit balance before processing
    const credits = await prisma.credits.findUnique({
      where: { userId },
    });

    if (!credits) {
      return NextResponse.json({ error: "Credits not found" }, { status: 404 });
    }

    if (credits.balance < TAILOR_CREDIT_COST) {
      return NextResponse.json(
        {
          error: "Insufficient credits",
          required: TAILOR_CREDIT_COST,
          available: credits.balance,
          message: `This operation requires ${TAILOR_CREDIT_COST} credits but you only have ${credits.balance}`,
        },
        { status: 402 } // Payment required
      );
    }

    // Get API key from environment variable
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        ErrorResponseSchema.parse({
          error: "OpenAI API key not configured on server. Please set OPENAI_API_KEY environment variable.",
        }),
        { status: 401 }
      );
    }

    const client = new OpenAI({
      apiKey: apiKey,
    });

    const body = await req.json();
    const { jobDescription, jobRequirements, resume: providedResume } =
      TailorRequestSchema.parse(body);

    // Use provided resume or fallback to file
    let resume;
    if (providedResume) {
      resume = providedResume;
    } else {
      // Fallback to default resume file
      if (fs.existsSync(resumePath)) {
        resume = JSON.parse(fs.readFileSync(resumePath, "utf8"));
      } else {
        return NextResponse.json(
          { error: "No resume provided and default resume file not found" },
          { status: 400 }
        );
      }
    }

    const candidateName = resume.name || "Candidate";

    // Build requirements context from extracted requirements if provided
    let requirementsContext = "";
    if (jobRequirements) {
      const req_typed = jobRequirements as JobRequirements;
      requirementsContext = `
=== EXTRACTED JOB REQUIREMENTS ===
Title: ${req_typed.title}
Seniority: ${req_typed.seniority_level}
Required Skills: ${req_typed.required_skills.join(", ")}
Nice-to-Have Skills: ${req_typed.nice_to_have_skills.join(", ")}
Tools/Frameworks: ${req_typed.required_tools_frameworks.join(", ")}
Key Responsibilities: ${req_typed.key_responsibilities.join(", ")}
Experience Required: ${req_typed.experience_years ? req_typed.experience_years + "+ years" : "Not specified"}
Domain: ${req_typed.domain}
Team Focus: ${req_typed.team_focus}
=== END REQUIREMENTS ===`;
    }

    const prompt = `You are tailoring a resume and writing a cover letter for ${candidateName}.

=== CANDIDATE'S RESUME ===
${JSON.stringify(resume, null, 2)}
=== END RESUME ===

${requirementsContext}

=== JOB DESCRIPTION ===
${jobDescription}
=== END JOB DESCRIPTION ===

TASK 1: TAILOR THE RESUME
- Match resume content to job requirements (prioritize required skills over nice-to-have)
- Rewrite experience bullets to highlight relevant technologies and responsibilities
- Add specific metrics and quantifiable achievements where applicable
- Keep experience section to 3-5 bullets per position (one page format)
- Keep projects section to 2-3 bullets per project
- Update summary to be 2-3 sentences, opening with how you match the job title/seniority level
- Highlight skills that appear in both resume and job requirements

TASK 2: WRITE A COVER LETTER
Write a genuine, conversational cover letter that doesn't sound AI-generated:
1. Start with a specific, personalized opener (NOT generic phrases like "I am excited to apply")
2. Pick ONLY the 1-2 most relevant accomplishments from the resume that directly match job requirements
3. For the main accomplishment, go deep:
   - Tell the story of what you built/did (be specific)
   - Mention the technology you used and WHY it mattered
   - Include the concrete outcome or metric
4. Connect it naturally to why THIS job appeals to you (not generic reasons like "opportunity to work")
5. Close with genuine interest - what specifically attracts you to the role/company
6. Use natural language, contractions (you're, I'm), and conversational tone
7. Avoid buzzwords like "passionate," "synergize," "leverage," "drive"
8. Keep it 200-300 words (shorter = better for ATS)
9. Format: Start with "Dear Hiring Manager," and end with "Sincerely," then newline then "${candidateName}"

Return ONLY valid JSON (no markdown, no code blocks):
{
  "updated_summary": "2-3 sentence summary tailored to job requirements",
  "project_edits": {
    "ProjectName": ["rewritten bullet", "rewritten bullet", ...]
  },
  "experience_edits": {
    "CompanyName": ["rewritten bullet", "rewritten bullet", ...]
  },
  "skills_to_add": {
    "languages": ["skill from job requirements"],
    "frameworks_libraries": ["framework from job requirements"],
    "tools": ["tool from job requirements"]
  },
  "cover_letter": "Full cover letter text with 'Dear Hiring Manager,' at start and 'Sincerely,\\n${candidateName}' at end"
}`;
    
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: LLM_CONFIG.FOCUSED.temperature, // Use consistent temperature for focused tasks
      response_format: { type: "json_object" },
    });

    const jsonString = response.choices[0]?.message?.content || "{}";
    
    try {
      const parsed = JSON.parse(jsonString);
      const validated = TailorResponseSchema.parse(parsed);
      console.log("TAILOR RESPONSE:", validated);
      
      // Deduct credits after successful tailoring
      try {
        await prisma.credits.update({
          where: { userId },
          data: {
            balance: {
              decrement: TAILOR_CREDIT_COST,
            },
            lastDeductedAt: new Date(),
          },
        });

        // Record transaction
        await prisma.transaction.create({
          data: {
            userId,
            type: "deduction",
            amount: -TAILOR_CREDIT_COST,
            reason: "resume_tailoring",
          },
        });

        console.log(`Deducted ${TAILOR_CREDIT_COST} credits for user ${userId}`);
      } catch (creditError: unknown) {
        console.error("Failed to deduct credits:", creditError);
        // Don't fail the request if credit deduction fails, just log it
      }

      return NextResponse.json(validated);
    } catch (parseErr: unknown) {
      console.error("Failed to parse/validate tailor response:", parseErr);
      return NextResponse.json(
        ErrorResponseSchema.parse({
          error: "Failed to parse tailoring response from API",
          details: parseErr instanceof Error ? parseErr.message : String(parseErr),
        }),
        { status: 500 }
      );
    }
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error ? err.message : String(err);
    const errorStack =
      err instanceof Error ? err.stack || "" : "";
    console.error("TAILOR ERROR:", err);
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

