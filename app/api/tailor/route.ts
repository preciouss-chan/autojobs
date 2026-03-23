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
  analyzeAtsOptimization,
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

const MIN_COVER_LETTER_WORDS = 180;
const GENERIC_COVER_LETTER_PHRASES = [
  "i am writing to express my interest",
  "i am excited about the opportunity",
  "solid foundation",
  "hands-on experience",
  "eager to contribute",
  "thank you for considering my application",
  "i look forward to the opportunity",
  "add value to your team",
];

function countWords(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function countGenericPhrases(value: string): number {
  const normalized = value.toLowerCase();
  return GENERIC_COVER_LETTER_PHRASES.filter((phrase) => normalized.includes(phrase)).length;
}

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

  let normalized = paragraphs.join("\n\n");

  normalized = normalized.replace(/^(dear hiring manager,?\s*)+/i, "").trim();

  normalized = normalized
    .replace(/\n{3,}/g, "\n\n")
    .replace(
      /(?:\n\n|\n)?(?:sincerely,?|best,?|kind regards,?|thanks,?)(?:\s+[A-Za-z][^\n]*)?(?:\n+[A-Za-z][^\n]*)*\s*$/i,
      ""
    )
    .trim();

  if (!normalized) {
    normalized = "Thank you for considering my application.";
  }

  return `Dear Hiring Manager,\n\n${normalized}\n\nSincerely,\n${candidateName}`;
}

async function polishCoverLetterTone(
  client: OpenAI,
  coverLetter: string,
  resume: Resume,
  signals: StructuredJobSignals,
  candidateName: string
): Promise<string> {
  const companyName = signals.company_name?.trim();
  const polishPrompt = `Rewrite this cover letter so it sounds more human, relaxed, and believable without changing the facts.

Candidate resume evidence:
${buildResumeEvidenceContext(resume)}

Structured job signals:
${JSON.stringify(signals, null, 2)}

Current cover letter:
${coverLetter}

Rules:
- Keep all claims truthful and grounded in the resume.
- Keep the overall length roughly similar.
- Keep 2-3 body paragraphs before the closing.
- Start with exactly: Dear Hiring Manager,
- Mention ${companyName || "the company"} naturally only if the company name is provided.
- Avoid generic phrases like "I am writing to express my interest," "solid foundation," "hands-on experience," "eager to contribute," and "add value to your team."
- Replace broad claims with concrete, resume-backed specifics.
- Use simple, clear language instead of polished corporate wording.
- Make it sound like a smart candidate talking plainly and confidently.
- Avoid sounding ceremonial, overly polished, or salesy.
- Prefer shorter, more natural sentences over long complex ones.
- End with exactly:
Sincerely,
${candidateName}

Return only the full cover letter text.`;

  const response = await client.chat.completions.create({
    model: LLM_CONFIG.DEFAULTS.model,
    messages: [{ role: "user", content: polishPrompt }],
    temperature: LLM_CONFIG.DETERMINISTIC.temperature,
  });

  return sanitizeCoverLetter(response.choices[0]?.message?.content || coverLetter, candidateName);
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
  if (resume.skills.professional_skills.length > 0) {
    lines.push(`Professional Skills: ${resume.skills.professional_skills.join(", ")}`);
  }

  resume.experience.forEach((item) => {
    lines.push(`${item.role} | ${item.company} | ${item.dates}`);
    item.bullets.forEach((bullet) => lines.push(`- ${bullet}`));
  });

  resume.projects.forEach((item) => {
    lines.push(`${item.name} | ${item.date}`);
    if (item.technologies.length > 0) {
      lines.push(`Technologies: ${item.technologies.join(", ")}`);
    }
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

function sanitizeCompanyName(value: string): string {
  return value
    .replace(/^company\s*[:\-]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
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
  "company_name": "",
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
- company_name should be the employer name if it is identifiable from the description, otherwise "".
- Do not invent requirements.`;

  const response = await client.chat.completions.create({
    model: LLM_CONFIG.DEFAULTS.model,
    messages: [{ role: "user", content: prompt }],
    temperature: LLM_CONFIG.DETERMINISTIC.temperature,
    response_format: { type: "json_object" },
  });

  const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
  const validated = StructuredJobSignalsSchema.parse(parsed);
  return {
    ...validated,
    company_name: sanitizeCompanyName(validated.company_name),
  };
}

async function generateTailoringDraft(
  client: OpenAI,
  resume: Resume,
  signals: StructuredJobSignals,
  selectedBullets: ReturnType<typeof selectBulletsForRewrite>
): Promise<TailoringDraft> {
  const candidateName = resume.name?.trim() || "Candidate";
  const companyName = signals.company_name?.trim();
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

  const companyInstruction = companyName
    ? `Company name to mention naturally in the cover letter: ${companyName}`
    : "Company name was not confidently identified from the job description.";

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
3. Write a specific, polished cover letter.

Candidate name for the signature: ${candidateName}
${companyInstruction}

Non-negotiable rules:
- Do not add new tools, technologies, metrics, achievements, responsibilities, or industries.
- Do not add a keyword unless that exact idea is already supported by the same bullet or the resume summary.
- Keep every rewritten bullet as a single plain-text bullet line.
- Preserve the factual meaning of the original bullet.
- Prefer minimal edits, stronger action verbs, and clearer outcomes.
- If a bullet is already strong, return it unchanged.
- Keep the output clean and ATS-friendly.
- Make the summary ATS-aware: mirror the target title and strongest supported hard skills naturally, without copying the job description verbatim.
- Favor keywords that appear in the title, required skills, tools/technologies, and recurring responsibilities.
- Balance hard skills with soft-skill evidence only when those soft skills are already shown by the resume bullets.
- If a company name is provided, mention ${companyName || "the employer"} naturally in the opening or closing so the letter feels specific to that application.
- If no company name is provided, do not invent one.
- Make the cover letter roughly 180-260 words.
- Start the cover letter with exactly: Dear Hiring Manager,
- Paragraph 1: specific interest in the role and why this company/team is compelling.
- Paragraph 2: one concrete, relevant example from experience or projects with technologies and outcomes already supported by the resume.
- Paragraph 3: optional short closing paragraph about what else you would bring or why the team is a fit.
- Avoid generic filler like "I am writing to express my interest" or "I am excited about the opportunity" unless the sentence contains real specifics.
- Keep the tone warm, direct, and confident rather than overly formal or grandiose.
- Use simple words and natural phrasing a strong candidate would actually send.
- Do not sound like marketing copy or an essay.
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
  let coverLetter = sanitizeCoverLetter(String(parsed.cover_letter || "").trim(), candidateName);

  if (countWords(coverLetter) < MIN_COVER_LETTER_WORDS) {
    const expandPrompt = `Expand this cover letter so it feels complete and job-specific without changing the facts.

Candidate resume evidence:
${buildResumeEvidenceContext(resume)}

Structured job signals:
${JSON.stringify(signals, null, 2)}

Current cover letter draft:
${coverLetter}

Requirements:
- Keep all claims truthful and grounded in the resume.
- Mention ${companyName || "the company"} naturally only if supported by the extracted company name.
- Expand to roughly 180-260 words.
- Keep 2-3 body paragraphs before the closing.
- Start with exactly: Dear Hiring Manager,
- Add more specificity, detail, and motivation; do not add fake achievements.
- Keep the tone natural, conversational, and easy to read.
- Use simpler wording and avoid complex or overly polished phrases.
- End with exactly:
Sincerely,
${candidateName}

Return only the full cover letter text.`;

    const expandedResponse = await client.chat.completions.create({
      model: LLM_CONFIG.DEFAULTS.model,
      messages: [{ role: "user", content: expandPrompt }],
      temperature: LLM_CONFIG.DETERMINISTIC.temperature,
    });

    coverLetter = sanitizeCoverLetter(
      expandedResponse.choices[0]?.message?.content || coverLetter,
      candidateName
    );
  }

  if (countGenericPhrases(coverLetter) >= 2) {
    coverLetter = await polishCoverLetterTone(
      client,
      coverLetter,
      resume,
      signals,
      candidateName
    );
  }

  return {
    updated_summary: String(parsed.updated_summary || "").trim(),
    bullet_rewrites: Array.isArray(parsed.bullet_rewrites) ? parsed.bullet_rewrites : [],
    cover_letter: coverLetter,
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
      ats_analysis: {
        score: 0,
        target_job_title: "",
        title_alignment: "weak",
        matched_keywords: [],
        keyword_gaps: [],
        section_coverage: {
          summary: [],
          skills: [],
          experience: [],
          projects: [],
        },
        formatting_warnings: [],
        optimization_tips: [],
      },
      improvement_notes: [],
      revised_resume_text: "",
      cover_letter: tailoringDraft.cover_letter,
    };

    const revisedResume = applyResponseToResume(resume, responseDraft);
    responseDraft.ats_analysis = analyzeAtsOptimization(
      revisedResume,
      signals,
      missingKeywords
    );
    responseDraft.revised_resume_text = formatResumeAsText(revisedResume);
    responseDraft.improvement_notes = buildImprovementNotes({
      changedBullets,
      missingKeywords,
      skillsToAdd,
      updatedSummary: responseDraft.updated_summary,
      atsAnalysis: responseDraft.ats_analysis,
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
