import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  ErrorResponseSchema,
  StructuredJobSignalsSchema,
  TailorRequestSchema,
  TailorResponseSchema,
} from "@/app/lib/schemas";
import type {
  JobRequirements,
  Resume,
  StructuredJobSignals,
  TailorResponse,
} from "@/app/lib/schemas";
import { LLM_CONFIG } from "@/app/lib/llm-config";
import {
  acceptBulletRewrites,
  applyResponseToResume,
  buildBulletAnalysis,
  buildBulletEditMaps,
  buildChangedBullets,
  buildImprovementNotes,
  findMissingKeywords,
  formatResumeAsText,
  inferSupportedSkillsToAdd,
  parseResumeForTailoring,
  selectBulletsForRewrite,
} from "@/app/lib/tailor/pipeline";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, RATE_LIMIT_PRESETS } from "@/lib/rate-limit";
import { getUserId } from "@/lib/token";

const TAILOR_CREDIT_COST = 1;
const resumePath = path.join(process.cwd(), "data", "resume.json");

type TailoringDraft = {
  updated_summary: string;
  bullet_rewrites: Array<{
    id: string;
    revised: string;
    reason?: string;
    matched_signals?: string[];
  }>;
  cover_letter: string;
};

function sanitizeCoverLetter(rawText: string, candidateName: string): string {
  const cleaned = rawText
    .replace(/\[your name\]/gi, candidateName)
    .replace(/your name/gi, candidateName)
    .replace(/\r/g, "")
    .trim();

  const paragraphs = cleaned
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const normalized = paragraphs.join("\n\n");
  const hasClosing = /sincerely,?$/im.test(normalized) || /best,?$/im.test(normalized);
  const hasName = new RegExp(candidateName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(normalized);

  if (hasClosing && hasName) {
    return normalized;
  }

  const withoutDanglingClosing = normalized.replace(/\n\n?(sincerely,?|best,?)\s*$/i, "").trim();
  return `${withoutDanglingClosing}\n\nSincerely,\n${candidateName}`;
}

function buildResumeEvidenceContext(resume: Resume): string {
  const lines: string[] = [];

  if (resume.summary.trim()) {
    lines.push(`Summary: ${resume.summary.trim()}`);
  }

  if (resume.skills.languages.length > 0) {
    lines.push(`Languages: ${resume.skills.languages.join(", ")}`);
  }
  if (resume.skills.frameworks_libraries.length > 0) {
    lines.push(`Frameworks/Libraries: ${resume.skills.frameworks_libraries.join(", ")}`);
  }
  if (resume.skills.tools.length > 0) {
    lines.push(`Tools: ${resume.skills.tools.join(", ")}`);
  }

  resume.experience.forEach((item) => {
    lines.push(`${item.role} | ${item.company} | ${item.dates}`);
    item.bullets.forEach((bullet) => lines.push(`- ${bullet}`));
  });

  resume.projects.forEach((item) => {
    lines.push(`${item.name} | ${item.date}`);
    item.bullets.forEach((bullet) => lines.push(`- ${bullet}`));
  });

  return lines.join("\n");
}

function buildRequirementsContext(jobRequirements?: JobRequirements): string {
  if (!jobRequirements) {
    return "";
  }

  return [
    "Existing extracted requirements:",
    `- Title: ${jobRequirements.title}`,
    `- Seniority: ${jobRequirements.seniority_level}`,
    `- Required skills: ${jobRequirements.required_skills.join(", ")}`,
    `- Nice to have: ${jobRequirements.nice_to_have_skills.join(", ")}`,
    `- Tools/frameworks: ${jobRequirements.required_tools_frameworks.join(", ")}`,
    `- Responsibilities: ${jobRequirements.key_responsibilities.join(" | ")}`,
    `- Experience years: ${jobRequirements.experience_years ?? "not specified"}`,
    `- Domain: ${jobRequirements.domain}`,
    `- Team focus: ${jobRequirements.team_focus}`,
  ].join("\n");
}

async function extractStructuredJobSignals(
  client: OpenAI,
  jobDescription: string,
  jobRequirements?: JobRequirements
): Promise<StructuredJobSignals> {
  const prompt = `Extract structured hiring signals from this job description.

${buildRequirementsContext(jobRequirements)}

Job description:
${jobDescription}

Return only valid JSON with this exact shape:
{
  "title": "",
  "seniority_signals": [""],
  "required_skills": [""],
  "preferred_skills": [""],
  "tools_technologies": [""],
  "responsibilities": [""],
  "domain_keywords": [""],
  "years_experience": null,
  "team_focus": ""
}

Rules:
- Only extract requirements explicitly stated or strongly implied.
- Keep phrases short and ATS-friendly.
- Put optional or bonus skills only in preferred_skills.
- tools_technologies should contain named tools, platforms, frameworks, libraries, and databases.
- responsibilities should be action-oriented phrases.
- domain_keywords should describe industry/problem-space terms.
- Do not invent requirements.`;

  const response = await client.chat.completions.create({
    model: LLM_CONFIG.DEFAULTS.model,
    messages: [{ role: "user", content: prompt }],
    temperature: LLM_CONFIG.DETERMINISTIC.temperature,
    response_format: { type: "json_object" },
  });

  const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
  return StructuredJobSignalsSchema.parse(parsed);
}

async function generateTailoringDraft(
  client: OpenAI,
  resume: Resume,
  signals: StructuredJobSignals,
  selectedBullets: ReturnType<typeof selectBulletsForRewrite>
): Promise<TailoringDraft> {
  const candidateName = resume.name?.trim() || "Candidate";
  const bulletInventory = selectedBullets.map((bullet) => ({
    id: bullet.id,
    section: bullet.section,
    label: bullet.sectionLabel,
    index: bullet.index,
    original: bullet.originalText,
    matched_signals: bullet.matchedSignals,
    reasons: bullet.reasons,
    has_metrics: bullet.hasMetrics,
  }));

  const prompt = `You are improving a resume conservatively for ATS alignment.

Candidate resume evidence:
${buildResumeEvidenceContext(resume)}

Structured job signals:
${JSON.stringify(signals, null, 2)}

Selected bullets eligible for rewriting:
${JSON.stringify(bulletInventory, null, 2)}

Tasks:
1. Rewrite only the selected bullets.
2. Update the summary in 2-3 sentences so it is specific, truthful, and ATS-friendly.
3. Write a concise, specific cover letter.

Candidate name for the signature: ${candidateName}

Non-negotiable rules:
- Do not add new tools, technologies, metrics, achievements, responsibilities, or industries.
- Do not add a keyword unless that exact idea is already supported by the same bullet or the resume summary.
- Keep every rewritten bullet as a single plain-text bullet line.
- Preserve the factual meaning of the original bullet.
- Prefer minimal edits, stronger action verbs, and clearer outcomes.
- If a bullet is already strong, return it unchanged.
- Keep the output clean and ATS-friendly.
- End the cover letter with exactly:
  Sincerely,
  ${candidateName}
- Never use placeholders like [Your Name], [Name], or Candidate Name.

Return only valid JSON with this shape:
{
  "updated_summary": "",
  "bullet_rewrites": [
    {
      "id": "experience:Company:0",
      "revised": "",
      "reason": "",
      "matched_signals": [""]
    }
  ],
  "cover_letter": ""
}`;

  const response = await client.chat.completions.create({
    model: LLM_CONFIG.DEFAULTS.model,
    messages: [{ role: "user", content: prompt }],
    temperature: LLM_CONFIG.DETERMINISTIC.temperature,
    response_format: { type: "json_object" },
  });

  const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
  return {
    updated_summary: String(parsed.updated_summary || "").trim(),
    bullet_rewrites: Array.isArray(parsed.bullet_rewrites) ? parsed.bullet_rewrites : [],
    cover_letter: sanitizeCoverLetter(String(parsed.cover_letter || "").trim(), candidateName),
  };
}

async function deductCredits(userId: string): Promise<void> {
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

    await prisma.transaction.create({
      data: {
        userId,
        type: "deduction",
        amount: -TAILOR_CREDIT_COST,
        reason: "resume_tailoring",
      },
    });
  } catch (error: unknown) {
    console.error("Failed to deduct credits:", error);
  }
}

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    let userEmail: string | null = null;

    if (authHeader) {
      userId = getUserId(authHeader, undefined);
    }

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

    const rateLimitResult = checkRateLimit(
      userEmail || userId,
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
        { status: 402 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        ErrorResponseSchema.parse({
          error: "OpenAI API key not configured on server. Please set OPENAI_API_KEY environment variable.",
        }),
        { status: 401 }
      );
    }

    const client = new OpenAI({ apiKey });
    const body = await req.json();
    const parsedRequest = TailorRequestSchema.safeParse(body);

    if (!parsedRequest.success) {
      return NextResponse.json(
        ErrorResponseSchema.parse({
          error: "Invalid tailor request",
          details: parsedRequest.error.message,
        }),
        { status: 400 }
      );
    }

    const { jobDescription, jobRequirements, resume: providedResume } = parsedRequest.data;

    let resume = providedResume;
    if (!resume && fs.existsSync(resumePath)) {
      resume = JSON.parse(fs.readFileSync(resumePath, "utf8")) as Resume;
    }

    if (!resume) {
      return NextResponse.json(
        ErrorResponseSchema.parse({
          error: "No resume provided and default resume file not found.",
        }),
        { status: 400 }
      );
    }

    const signals = await extractStructuredJobSignals(client, jobDescription, jobRequirements);
    const parsedResume = parseResumeForTailoring(resume, signals);
    const bulletAnalysis = buildBulletAnalysis(parsedResume);
    const selectedBullets = selectBulletsForRewrite(parsedResume);
    const tailoringDraft = await generateTailoringDraft(client, resume, signals, selectedBullets);
    const acceptedRewrites = acceptBulletRewrites(
      selectedBullets,
      Object.fromEntries(
        tailoringDraft.bullet_rewrites.map((item) => [item.id, item])
      ),
      signals
    );
    const changedBullets = buildChangedBullets(selectedBullets, acceptedRewrites);
    const editMaps = buildBulletEditMaps(resume, acceptedRewrites);
    const skillsToAdd = inferSupportedSkillsToAdd(resume, signals);
    const missingKeywords = findMissingKeywords(resume, signals);

    const responseDraft: TailorResponse = {
      updated_summary: tailoringDraft.updated_summary || resume.summary,
      experience_edits: editMaps.experienceEdits,
      project_edits: editMaps.projectEdits,
      skills_reframing: changedBullets.map((item) => ({
        category: item.section === "projects" ? "tools" : "experience",
        original: item.original,
        tailored: item.revised,
        evidence: item.section_label,
      })),
      skills_to_add: skillsToAdd,
      job_signals: signals,
      bullet_analysis: bulletAnalysis,
      changed_bullets: changedBullets,
      missing_keywords: missingKeywords,
      improvement_notes: [],
      revised_resume_text: "",
      cover_letter: tailoringDraft.cover_letter,
    };

    const revisedResume = applyResponseToResume(resume, responseDraft);
    responseDraft.revised_resume_text = formatResumeAsText(revisedResume);
    responseDraft.improvement_notes = buildImprovementNotes({
      changedBullets,
      missingKeywords,
      skillsToAdd,
      updatedSummary: responseDraft.updated_summary,
    });

    const validated = TailorResponseSchema.parse(responseDraft);
    await deductCredits(userId);

    return NextResponse.json(validated);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack || "" : "";

    console.error("TAILOR ERROR:", err);

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
