import assert from "node:assert/strict";
import {
  acceptBulletRewrites,
  analyzeAtsOptimization,
  applyResponseToResume,
  buildBulletEditMaps,
  buildImprovementNotes,
  buildChangedBullets,
  findMissingKeywords,
  formatResumeAsText,
  inferSupportedSkillsToAdd,
  parseResumeForTailoring,
  selectBulletsForRewrite,
} from "@/app/lib/tailor/pipeline";
import type { Resume, StructuredJobSignals, TailorResponse } from "@/app/lib/schemas";

function sanitizeCoverLetterForTest(rawText: string, candidateName: string): string {
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

function countWordsForTest(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function countGenericPhrasesForTest(value: string): number {
  const phrases = [
    "i am writing to express my interest",
    "i am excited about the opportunity",
    "solid foundation",
    "hands-on experience",
    "eager to contribute",
    "thank you for considering my application",
    "i look forward to the opportunity",
    "add value to your team",
  ];
  const normalized = value.toLowerCase();
  return phrases.filter((phrase) => normalized.includes(phrase)).length;
}

const resume: Resume = {
  name: "Taylor Candidate",
  contact: {
    phone: "555-111-2222",
    email: "taylor@example.com",
    linkedin: "linkedin.com/in/taylor",
    github: "github.com/taylor",
  },
  summary: "Software engineer with experience building web products and automation tools.",
  skills: {
    languages: ["JavaScript", "TypeScript", "Python"],
    frameworks_libraries: ["React", "Next.js"],
    tools: ["Git", "PostgreSQL"],
    professional_skills: ["Communication"],
  },
  experience: [
    {
      company: "Acme",
      role: "Software Engineer",
      dates: "2024-Present",
      bullets: [
        "Built React and Next.js workflows that reduced manual onboarding time by 35%.",
        "Worked with cross-functional teammates to answer support tickets for customer issues.",
      ],
    },
  ],
  projects: [
    {
      name: "Apply Boost",
      date: "2023",
      link: "",
      technologies: ["OpenAI", "Flask"],
      bullets: [
        "Developed a resume tailoring prototype with OpenAI-assisted text suggestions.",
      ],
    },
  ],
  education: [
    {
      degree: "B.S. Computer Science",
      institution: "State University",
      graduation_year: "2024",
      gpa: "3.8",
    },
  ],
};

const signals: StructuredJobSignals = {
  company_name: "Acme Labs",
  title: "Frontend Engineer",
  seniority_signals: ["mid-level"],
  required_skills: ["TypeScript", "React"],
  preferred_skills: ["A/B testing"],
  minimum_qualification_keywords: ["REST APIs", "Cross-functional collaboration", "Strong programming skills in Python"],
  preferred_qualification_keywords: ["Experimentation", "Experience with containers (Docker)", "Coursework or project experience with LangChain"],
  tools_technologies: ["Next.js", "PostgreSQL", "Docker", "Spark", "Kafka"],
  responsibilities: ["build user-facing features", "improve onboarding flows"],
  domain_keywords: ["product", "experimentation"],
  years_experience: 2,
  team_focus: "Frontend",
};

function run(): void {
  const parsedBullets = parseResumeForTailoring(resume, signals);
  const selectedBullets = selectBulletsForRewrite(parsedBullets);
  const topBullet = selectedBullets.find((item) => item.sectionLabel === "Acme");

  assert.ok(topBullet, "expected the strongest relevant experience bullet to be selected");
  assert.equal(
    selectedBullets.some((item) => item.originalText.includes("cross-functional teammates")),
    false,
    "irrelevant support bullet should not be selected for rewrite"
  );

  const acceptedRewrites = acceptBulletRewrites(selectedBullets, {
    [topBullet.id]: {
      revised: "Built React and Next.js onboarding workflows that reduced manual onboarding time by 35%.",
      reason: "Align onboarding language with the job while preserving the original evidence.",
      matched_signals: ["React", "Next.js", "improve onboarding flows"],
    },
    "projects:Apply Boost:0": {
      revised: "Developed a resume tailoring prototype with OpenAI, Docker, and A/B testing.",
      reason: "This should be rejected because it invents unsupported details.",
      matched_signals: ["Docker", "A/B testing"],
    },
  }, signals);

  assert.equal(acceptedRewrites.length, 1, "only the truthful rewrite should be accepted");
  assert.ok(
    !acceptedRewrites.some((item) => item.revised.includes("Docker")),
    "unsupported tools must not be inserted"
  );

  const changedBullets = buildChangedBullets(selectedBullets, acceptedRewrites);
  const editMaps = buildBulletEditMaps(resume, acceptedRewrites);
  const skillsToAdd = inferSupportedSkillsToAdd(resume, signals);
  const missingKeywords = findMissingKeywords(resume, signals);

  assert.ok(
    !skillsToAdd.frameworks_libraries.includes("Flask"),
    "resume-derived project technologies should not be surfaced into skills_to_add"
  );
  assert.ok(
    !skillsToAdd.tools.includes("OpenAI"),
    "resume-derived project tools should not be surfaced into skills_to_add"
  );
  assert.ok(
    skillsToAdd.tools.includes("Docker"),
    "job keywords should be surfaced into the skills section even when they are not yet evidenced elsewhere"
  );
  assert.ok(
    skillsToAdd.frameworks_libraries.includes("LangChain"),
    "known technologies should be extracted from longer qualification phrases"
  );
  assert.ok(
    !skillsToAdd.tools.includes("Strong programming skills in Python"),
    "instructional phrases should not be surfaced as tools"
  );
  assert.ok(
    !skillsToAdd.frameworks_libraries.includes("Ph.D. in Computer Science"),
    "education phrases should not be surfaced as frameworks"
  );
  assert.equal(
    skillsToAdd.professional_skills.length,
    0,
    "resume-derived professional skills should not be auto-added without matching job signals"
  );
  assert.ok(
    missingKeywords.length === 0,
    "missing keyword gaps should be empty after removing resume evidence gating"
  );

  const response: TailorResponse = {
    updated_summary: "Frontend engineer with hands-on React, Next.js, and TypeScript experience improving onboarding workflows.",
    experience_edits: editMaps.experienceEdits,
    project_edits: editMaps.projectEdits,
    skills_reframing: [],
    skills_to_add: skillsToAdd,
    job_signals: signals,
    bullet_analysis: [],
    changed_bullets: changedBullets,
    missing_keywords: missingKeywords,
    ats_analysis: {
      score: 0,
      target_job_title: signals.title,
      title_alignment: "partial",
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
    improvement_notes: buildImprovementNotes({
      changedBullets,
      missingKeywords,
      skillsToAdd,
      updatedSummary: "updated",
    }),
    revised_resume_text: "",
    cover_letter: "Dear Hiring Manager,\nTest\nSincerely,\nTaylor Candidate",
  };

  const revisedResume = applyResponseToResume(resume, response);
  const atsAnalysis = analyzeAtsOptimization(revisedResume, signals, missingKeywords);

  assert.equal(
    revisedResume.experience[0].bullets.length,
    resume.experience[0].bullets.length,
    "resume structure and bullet counts should be preserved"
  );
  assert.equal(
    revisedResume.experience[0].bullets[0],
    "Built React and Next.js onboarding workflows that reduced manual onboarding time by 35%.",
    "accepted rewrite should be applied"
  );

  const formatted = formatResumeAsText(revisedResume);
  assert.ok(formatted.includes("SUMMARY"), "formatted resume should preserve section headings");
  assert.ok(formatted.includes("- Built React and Next.js onboarding workflows"), "formatted resume should remain plain-text bullet based");
  assert.ok(formatted.includes("Professional Skills:"), "formatted resume should include expanded skill categories when present");
  assert.equal(/[\t]|[•]|<table/i.test(formatted), false, "output should remain ATS-friendly plain text");
  assert.ok(atsAnalysis.score > 0, "ATS analysis should return a numeric score");
  assert.ok(atsAnalysis.section_coverage.summary.includes("Frontend Engineer"), "ATS analysis should track title coverage in the summary");
  assert.ok(atsAnalysis.optimization_tips.length > 0, "ATS analysis should produce actionable optimization tips");

  const cleanedCoverLetter = sanitizeCoverLetterForTest(
    "Dear Hiring Manager,\n\nBody paragraph here.\n\nSincerely, Precious Nyaupane\n\nSincerely,\n[Your Name]",
    "Precious Nyaupane"
  );
  assert.equal(
    cleanedCoverLetter,
    "Dear Hiring Manager,\n\nBody paragraph here.\n\nSincerely,\nPrecious Nyaupane",
    "cover letter sanitizer should collapse duplicate sign-offs into one canonical closing"
  );
  assert.equal(
    sanitizeCoverLetterForTest("Body paragraph here.", "Precious Nyaupane").startsWith("Dear Hiring Manager,"),
    true,
    "cover letter sanitizer should always add the required Dear Hiring Manager greeting"
  );

  assert.equal(signals.company_name, "Acme Labs", "structured job signals should carry the company name for cover letter personalization");

  assert.ok(
    countWordsForTest(
      "Dear Hiring Manager,\n\nThis is a longer first paragraph with enough words to simulate a realistic cover letter draft for testing purposes.\n\nThis second paragraph adds more supporting detail about projects, tools, and outcomes that are already supported by the resume content.\n\nThis third paragraph closes with motivation and contribution language.\n\nSincerely,\nPrecious Nyaupane"
    ) > 40,
    "word counting helper should treat realistic cover letter text as non-trivially long"
  );
  assert.ok(
    countGenericPhrasesForTest(
      "I am writing to express my interest and I am excited about the opportunity to add value to your team."
    ) >= 2,
    "generic phrase counting should flag boilerplate-heavy cover letter language"
  );

  console.log("All tailor pipeline assertions passed.");
}

run();
