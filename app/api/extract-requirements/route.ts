import { NextResponse } from "next/server";
import OpenAI from "openai";
import { checkRateLimit, RATE_LIMIT_PRESETS, getIdentifierFromRequest } from "@/lib/rate-limit";
import {
  ExtractRequirementsRequestSchema,
  JobRequirementsSchema,
  ErrorResponseSchema,
} from "@/app/lib/schemas";
import type { JobRequirements } from "@/app/lib/schemas";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    // Apply rate limiting using IP-based identifier
    const identifier = getIdentifierFromRequest(req);
    const rateLimitResult = checkRateLimit(
      identifier,
      "extract-requirements",
      RATE_LIMIT_PRESETS.EXTRACT_REQUIREMENTS.limit,
      RATE_LIMIT_PRESETS.EXTRACT_REQUIREMENTS.windowMs
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

    const apiKey = req.headers.get("X-OpenAI-API-Key") || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        ErrorResponseSchema.parse({
          error: "OpenAI API key is required. Please set it in extension settings or environment variable.",
        }),
        { status: 401 }
      );
    }

    const body = await req.json();
    const { jobDescription } = ExtractRequirementsRequestSchema.parse(body);


    const client = new OpenAI({
      apiKey: apiKey,
    });

    const prompt = `You are an expert at analyzing job descriptions and extracting structured requirements.

=== JOB DESCRIPTION ===
${jobDescription}
=== END JOB DESCRIPTION ===

Analyze this job description and extract structured requirements. Be precise and specific.

Return ONLY a JSON object with this exact structure:
{
  "title": "Job title/role name",
  "seniority_level": "Junior|Mid|Senior|Lead|Manager (pick one)",
  "required_skills": ["skill1", "skill2", "skill3"],
  "nice_to_have_skills": ["skill1", "skill2"],
  "required_tools_frameworks": ["tool/framework1", "tool/framework2"],
  "key_responsibilities": ["responsibility1", "responsibility2", "responsibility3"],
  "experience_years": 3,
  "domain": "e.g., Web Development, Data Science, DevOps, Mobile, etc.",
  "team_focus": "e.g., Backend, Frontend, Full-stack, Infrastructure, etc."
}

Rules:
- required_skills: Only list skills explicitly mentioned or strongly implied as required
- nice_to_have_skills: List skills mentioned as "nice to have", "preferred", "bonus", or obviously optional
- required_tools_frameworks: Specific libraries, frameworks, platforms (e.g., React, PostgreSQL, Docker, Kubernetes)
- experience_years: Extract if mentioned (e.g., "3+ years"), otherwise null
- Categorize skills broadly (e.g., "Python", "TypeScript", "React", not "JavaScript framework experience")
- Be specific about domain and team focus from the job description context`;

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
      const validated = JobRequirementsSchema.parse(parsed);
      return NextResponse.json(validated);
    } catch (parseErr: unknown) {
      console.error("Failed to parse/validate job requirements response:", parseErr);
      return NextResponse.json(
        ErrorResponseSchema.parse({
          error: "Failed to parse job requirements from API response",
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
    console.error("EXTRACT_REQUIREMENTS ERROR:", err);
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
