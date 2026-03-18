import { NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";
import { getUserId } from "@/lib/token";
import {
  TailorRequestSchema,
  TailorResponseSchema,
  ErrorResponseSchema,
} from "@/app/lib/schemas";
import type { JobRequirements, Resume, TailorResponse } from "@/app/lib/schemas";
import { LLM_CONFIG } from "@/app/lib/llm-config";

// Credit cost for tailoring (1 credit per application)
const TAILOR_CREDIT_COST = 1;

// Fallback resume path
const resumePath = path.join(process.cwd(), "data", "resume.json");

const WEAK_BULLET_PATTERNS = [
  /\bhelped\b/i,
  /\bworked on\b/i,
  /\bresponsible for\b/i,
  /\bvarious\b/i,
  /\bsignificantly\b/i,
  /\benhanc(?:e|ing|ed)\b/i,
  /\bimprov(?:e|ing|ed) operational efficiency\b/i,
];

const STRONG_VERB_PATTERN = /^(built|engineered|developed|deployed|designed|implemented|integrated|optimized|created|launched|automated|led|maintained|conducted|diagnosed|configured|generated)\b/i;

const TECH_STOPWORDS = new Set([
  "A",
  "An",
  "And",
  "Built",
  "Conducted",
  "Created",
  "Developed",
  "Deployed",
  "Designed",
  "Engineered",
  "For",
  "Generated",
  "Implemented",
  "Improved",
  "In",
  "Integrated",
  "Maintained",
  "Of",
  "On",
  "Optimized",
  "Support",
  "Supporting",
  "The",
  "Using",
  "With",
]);

function extractTechTokens(text: string): string[] {
  const matches = text.match(/\b(?:[A-Z][A-Za-z0-9.+#/-]*|[A-Za-z0-9.+#/-]*\.[A-Za-z0-9.+#/-]+)\b/g) ?? [];

  return Array.from(
    new Set(
      matches.filter((token) => token.length > 1 && !TECH_STOPWORDS.has(token))
    )
  );
}

function hasMetrics(text: string): boolean {
  return /(\d[\d,.]*\s?(?:%|\+|x|ms|s|sec|seconds?|minutes?|hours?|users?|students?|pods?|beta|apis?))/i.test(text);
}

function scoreBulletQuality(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return -100;
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  const techTokens = extractTechTokens(trimmed);
  let score = 0;

  if (STRONG_VERB_PATTERN.test(trimmed)) {
    score += 2;
  }

  if (hasMetrics(trimmed)) {
    score += 3;
  }

  score += Math.min(techTokens.length, 4);

  if (words.length >= 10 && words.length <= 32) {
    score += 1;
  }

  if (/\b(reduced|increased|generated|achieving|supporting|optimized|launched|improving)\b/i.test(trimmed)) {
    score += 1;
  }

  for (const pattern of WEAK_BULLET_PATTERNS) {
    if (pattern.test(trimmed)) {
      score -= 2;
    }
  }

  return score;
}

function shouldUseTailoredBullet(originalBullet: string, tailoredBullet: string): boolean {
  const original = originalBullet.trim();
  const tailored = tailoredBullet.trim();

  if (!tailored) {
    return false;
  }

  const originalScore = scoreBulletQuality(original);
  const tailoredScore = scoreBulletQuality(tailored);
  const originalTechTokens = extractTechTokens(original).map((token) => token.toLowerCase());
  const tailoredTechTokenSet = new Set(
    extractTechTokens(tailored).map((token) => token.toLowerCase())
  );
  const retainsAnyTechEvidence =
    originalTechTokens.length === 0 ||
    originalTechTokens.some((token) => tailoredTechTokenSet.has(token));

  if (hasMetrics(original) && !hasMetrics(tailored)) {
    return false;
  }

  if (!retainsAnyTechEvidence && tailoredScore <= originalScore + 1) {
    return false;
  }

  if (tailored.split(/\s+/).length < Math.max(6, Math.floor(original.split(/\s+/).length * 0.55)) && tailoredScore <= originalScore) {
    return false;
  }

  return tailoredScore >= originalScore - 1;
}

function preserveStrongBullets(
  originalBullets: string[],
  tailoredBullets: string[],
  section: "experience" | "project",
  label: string
): { bullets: string[]; decisions: BulletDecision[] } {
  if (!Array.isArray(tailoredBullets) || tailoredBullets.length === 0) {
    return {
      bullets: originalBullets,
      decisions: originalBullets.map((originalBullet, index) => ({
        section,
        label,
        index,
        decision: "missing_tailored",
        originalScore: scoreBulletQuality(originalBullet),
        tailoredScore: null,
      })),
    };
  }

  const decisions: BulletDecision[] = [];
  const bullets = originalBullets.map((originalBullet, index) => {
    const tailoredBullet = tailoredBullets[index];
    if (!tailoredBullet) {
      decisions.push({
        section,
        label,
        index,
        decision: "missing_tailored",
        originalScore: scoreBulletQuality(originalBullet),
        tailoredScore: null,
      });
      return originalBullet;
    }

    const useTailored = shouldUseTailoredBullet(originalBullet, tailoredBullet);
    decisions.push({
      section,
      label,
      index,
      decision: useTailored ? "used_tailored" : "kept_original",
      originalScore: scoreBulletQuality(originalBullet),
      tailoredScore: scoreBulletQuality(tailoredBullet),
    });

    return useTailored ? tailoredBullet : originalBullet;
  });

  return { bullets, decisions };
}

function applyBulletQualityGuard(
  resume: Resume,
  tailored: TailorResponse,
  jobDescription: string
): GuardResult {
  const guarded: TailorResponse = {
    ...tailored,
    experience_edits: { ...tailored.experience_edits },
    project_edits: { ...tailored.project_edits },
  };
  const decisions: BulletDecision[] = [];
  const jobKeywords = extractJobKeywords(jobDescription);

  for (const exp of resume.experience) {
    const editedBullets = guarded.experience_edits[exp.company];
    if (editedBullets) {
      const result = preserveStrongBullets(
        exp.bullets,
        editedBullets,
        "experience",
        exp.company
      );
      guarded.experience_edits[exp.company] = rankBulletsForRole(result.bullets, jobKeywords);
      decisions.push(...result.decisions);
    }
  }

  for (const project of resume.projects) {
    const editedBullets = guarded.project_edits[project.name];
    if (editedBullets) {
      const result = preserveStrongBullets(
        project.bullets,
        editedBullets,
        "project",
        project.name
      );
      guarded.project_edits[project.name] = rankBulletsForRole(result.bullets, jobKeywords);
      decisions.push(...result.decisions);
    }
  }

  return {
    response: guarded,
    decisions,
  };
}

function buildResumeEvidenceContext(resume: {
  summary?: string;
  skills?: {
    languages?: string[];
    frameworks_libraries?: string[];
    tools?: string[];
  };
  experience?: Array<{
    company?: string;
    role?: string;
    bullets?: string[];
  }>;
  projects?: Array<{
    name?: string;
    bullets?: string[];
  }>;
}): string {
  const evidenceLines: string[] = [];

  if (resume.summary?.trim()) {
    evidenceLines.push(`Summary evidence: ${resume.summary.trim()}`);
  }

  if ((resume.skills?.languages ?? []).length > 0) {
    evidenceLines.push(`Existing languages: ${(resume.skills?.languages ?? []).join(", ")}`);
  }

  if ((resume.skills?.frameworks_libraries ?? []).length > 0) {
    evidenceLines.push(
      `Existing frameworks/libraries: ${(resume.skills?.frameworks_libraries ?? []).join(", ")}`
    );
  }

  if ((resume.skills?.tools ?? []).length > 0) {
    evidenceLines.push(`Existing tools: ${(resume.skills?.tools ?? []).join(", ")}`);
  }

  for (const exp of resume.experience ?? []) {
    const bullets = (exp.bullets ?? []).map((bullet) => `- ${bullet}`).join("\n");
    evidenceLines.push(
      `Experience evidence from ${exp.company ?? "Unknown Company"} (${exp.role ?? "Unknown Role"}):\n${bullets}`
    );
  }

  for (const project of resume.projects ?? []) {
    const bullets = (project.bullets ?? []).map((bullet) => `- ${bullet}`).join("\n");
    evidenceLines.push(`Project evidence from ${project.name ?? "Unknown Project"}:\n${bullets}`);
  }

  return evidenceLines.join("\n\n");
}

function extractJobKeywords(jobDescription: string): string[] {
  const normalized = jobDescription
    .replace(/[^a-zA-Z0-9+#./-\s]/g, " ")
    .toLowerCase();
  const words = normalized.split(/\s+/).filter(Boolean);
  const stopwords = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "in",
    "is",
    "of",
    "on",
    "or",
    "the",
    "to",
    "with",
    "you",
    "your",
    "we",
    "our",
    "will",
    "this",
    "that",
    "role",
    "team",
    "experience",
    "years",
    "looking",
    "join",
    "required",
    "requirements",
    "preferred",
    "nice",
    "have",
  ]);

  return Array.from(new Set(words.filter((word) => word.length > 2 && !stopwords.has(word))));
}

function scoreBulletRelevance(text: string, jobKeywords: string[]): number {
  const normalized = text.toLowerCase();
  let score = 0;

  for (const keyword of jobKeywords) {
    if (normalized.includes(keyword)) {
      score += keyword.length > 6 ? 2 : 1;
    }
  }

  return score;
}

function rankBulletsForRole(bullets: string[], jobKeywords: string[]): string[] {
  return [...bullets].sort((left, right) => {
    const rightScore = scoreBulletQuality(right) + scoreBulletRelevance(right, jobKeywords);
    const leftScore = scoreBulletQuality(left) + scoreBulletRelevance(left, jobKeywords);
    return rightScore - leftScore;
  });
}

function normalizeSkillName(value: string): string {
  return value.trim().toLowerCase().replace(/js/g, "javascript");
}

function buildResumeText(resume: Resume): string {
  const textParts = [
    resume.summary,
    ...(resume.skills.languages ?? []),
    ...(resume.skills.frameworks_libraries ?? []),
    ...(resume.skills.tools ?? []),
    ...resume.experience.flatMap((exp) => [exp.role, exp.company, ...(exp.bullets ?? [])]),
    ...resume.projects.flatMap((project) => [project.name, ...(project.bullets ?? [])]),
    ...resume.education.flatMap((edu) => [edu.degree, edu.institution]),
  ].filter((value): value is string => Boolean(value && value.trim()));

  return textParts.join(" \n ").toLowerCase();
}

function categorizeSkill(
  skill: string,
  resume: Resume,
  source: "required_skills" | "nice_to_have_skills" | "required_tools_frameworks"
): "languages" | "frameworks_libraries" | "tools" {
  const normalizedSkill = normalizeSkillName(skill);
  const languageSet = new Set([
    "javascript",
    "typescript",
    "python",
    "java",
    "c",
    "c++",
    "c#",
    "kotlin",
    "swift",
    "go",
    "rust",
    "ruby",
    "php",
    "sql",
  ]);

  if (languageSet.has(normalizedSkill)) {
    return "languages";
  }

  if (resume.skills.languages.some((item) => normalizeSkillName(item) === normalizedSkill)) {
    return "languages";
  }

  if (
    source === "required_tools_frameworks" ||
    resume.skills.frameworks_libraries.some(
      (item) => normalizeSkillName(item) === normalizedSkill
    )
  ) {
    return "frameworks_libraries";
  }

  return "tools";
}

function inferSupportedSkillsToSurface(
  resume: Resume,
  currentSkillsToAdd: TailorResponse["skills_to_add"],
  jobRequirements?: JobRequirements
): TailorResponse["skills_to_add"] {
  const merged = {
    languages: [...currentSkillsToAdd.languages],
    frameworks_libraries: [...currentSkillsToAdd.frameworks_libraries],
    tools: [...currentSkillsToAdd.tools],
  };

  if (!jobRequirements) {
    return merged;
  }

  const resumeText = buildResumeText(resume);
  const currentSkillSet = new Set(
    [
      ...resume.skills.languages,
      ...resume.skills.frameworks_libraries,
      ...resume.skills.tools,
      ...merged.languages,
      ...merged.frameworks_libraries,
      ...merged.tools,
    ].map((skill) => normalizeSkillName(skill))
  );

  const candidates: Array<{
    skill: string;
    source: "required_skills" | "nice_to_have_skills" | "required_tools_frameworks";
  }> = [
    ...jobRequirements.required_skills.map((skill) => ({
      skill,
      source: "required_skills" as const,
    })),
    ...jobRequirements.required_tools_frameworks.map((skill) => ({
      skill,
      source: "required_tools_frameworks" as const,
    })),
    ...jobRequirements.nice_to_have_skills.map((skill) => ({
      skill,
      source: "nice_to_have_skills" as const,
    })),
  ];

  for (const candidate of candidates) {
    const normalizedSkill = normalizeSkillName(candidate.skill);
    if (!normalizedSkill || currentSkillSet.has(normalizedSkill)) {
      continue;
    }

    if (!resumeText.includes(normalizedSkill)) {
      continue;
    }

    const category = categorizeSkill(candidate.skill, resume, candidate.source);
    merged[category].push(candidate.skill);
    currentSkillSet.add(normalizedSkill);
  }

  return merged;
}

type BulletDecision = {
  section: "experience" | "project";
  label: string;
  index: number;
  decision: "kept_original" | "used_tailored" | "missing_tailored";
  originalScore: number;
  tailoredScore: number | null;
};

type GuardResult = {
  response: TailorResponse;
  decisions: BulletDecision[];
};

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    // Get authenticated user - try JWT token first (extension), then NextAuth session (web)
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    let userEmail: string | null = null;

    // Try JWT token first (extension)
    if (authHeader) {
      userId = getUserId(authHeader, undefined);
    }

    // Fall back to NextAuth session (web)
    if (!userId) {
      const session = await auth();
      if (!session || !session.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      userId = (session.user as { id?: string })?.id ?? null;
      userEmail = session.user.email;
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Apply rate limiting - use userId or userEmail as identifier
    const rateLimitIdentifier = userEmail || userId;
    const rateLimitResult = checkRateLimit(
      rateLimitIdentifier,
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
    const resumeEvidenceContext = buildResumeEvidenceContext(resume);

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

=== APPROVED EVIDENCE INVENTORY ===
${resumeEvidenceContext}
=== END APPROVED EVIDENCE INVENTORY ===

${requirementsContext}

=== JOB DESCRIPTION ===
${jobDescription}
=== END JOB DESCRIPTION ===

NON-NEGOTIABLE RULES:
- Never invent new skills, tools, responsibilities, certifications, industries, metrics, or experience.
- Only use evidence that appears in the resume or approved evidence inventory.
- Reframe existing experience to match the job language when it is an honest translation of the same work.
- If a requirement is unsupported, leave it out instead of pretending the candidate has it.
- Optimize for ATS naturally; avoid obvious copy-pasting from the job description.
- Keep the voice human, specific, and believable.

TASK 1: TAILOR THE RESUME
- Match resume content to job requirements (prioritize required skills over nice-to-have)
- Do not rewrite, shorten, reorder, or replace experience bullets
- Do not rewrite, shorten, reorder, or replace project bullets
- Keep experience and project content exactly as written in the source resume
- Update summary to be 2-3 sentences, opening with how you match the job title/seniority level
- Highlight skills that appear in both resume and job requirements
- Use keywords naturally; do not lift long phrases from the job description
- Focus tailoring on skills surfacing and summary alignment instead of bullet rewriting

TASK 1A: IDENTIFY HONEST REFRAMING OPPORTUNITIES
- Create a skills_reframing list that maps existing resume language to stronger job-aligned phrasing
- Each reframing item must include:
  - category: one of languages, frameworks_libraries, tools, or experience
  - original: exact skill or phrase already present in the resume/evidence inventory
  - tailored: job-aligned wording that honestly describes the same capability
  - evidence: a short citation showing where that capability appears in the resume
- Good reframing example: "stakeholder engagement" -> "community relations" when the work described clearly supports that interpretation
- Bad reframing example: "customer support" -> "enterprise sales" unless the resume explicitly shows sales work

TASK 1B: HANDLE SKILLS RESPONSIBLY
- skills_to_add is only for supported skills missing from the current explicit skills lists
- Only include a skill in skills_to_add if the resume bullets, projects, or summary clearly prove it
- Prefer normalized or ATS-friendly naming for existing capabilities over introducing anything new
- If there is no clear evidence for a skill, leave it out
- Prioritize surfacing employer-requested skills in the skills section when the resume already demonstrates them elsewhere

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
  "project_edits": {},
  "experience_edits": {},
  "skills_reframing": [
    {
      "category": "experience",
      "original": "existing phrase from resume",
      "tailored": "job-aligned phrasing of the same capability",
      "evidence": "where this appears in the resume"
    }
  ],
  "skills_to_add": {
    "languages": ["supported skill missing from skills list"],
    "frameworks_libraries": ["supported framework missing from skills list"],
    "tools": ["supported tool missing from skills list"]
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
      validated.experience_edits = {};
      validated.project_edits = {};
      validated.skills_to_add = inferSupportedSkillsToSurface(
        resume as Resume,
        validated.skills_to_add,
        jobRequirements
      );
      const guardResult = applyBulletQualityGuard(
        resume as Resume,
        validated,
        jobDescription
      );
      console.log("TAILOR BULLET DECISIONS:", guardResult.decisions);
      console.log("TAILOR RESPONSE:", guardResult.response);
      
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

       return NextResponse.json(guardResult.response);
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
