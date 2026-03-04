import { NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import {
  TailorRequestSchema,
  TailorResponseSchema,
  ErrorResponseSchema,
} from "@/app/lib/schemas";
import type { JobRequirements } from "@/app/lib/schemas";

// Fallback resume path
const resumePath = path.join(process.cwd(), "data", "resume.json");

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  try {
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
Focus on alignment:
1. Reference the job title and key 2-3 requirements explicitly
2. Pick 2-3 experiences/projects from resume that directly match job requirements
3. For each selected experience, mention:
   - The project/company name
   - A specific technology or framework used
   - A concrete outcome or metric achieved
4. Explain why you're seeking THIS specific role/company
5. Keep it 250-350 words, professional and compelling
6. Format: Start with "Dear Hiring Manager," and end with "Sincerely," then newline then "${candidateName}"

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
      response_format: { type: "json_object" },
    });

    const jsonString = response.choices[0]?.message?.content || "{}";
    
    try {
      const parsed = JSON.parse(jsonString);
      const validated = TailorResponseSchema.parse(parsed);
      console.log("TAILOR RESPONSE:", validated);
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

