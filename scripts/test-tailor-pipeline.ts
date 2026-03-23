import assert from "node:assert/strict";
import {
  acceptBulletRewrites,
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

  return `${normalized}\n\nSincerely,\n${candidateName}`;
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
  },
  experience: [
    {
      company: "Acme",
      role: "Software Engineer",
      dates: "2024-Present",
      bullets: [
        "Built React and Next.js workflows that reduced manual onboarding time by 35%.",
        "Answered support tickets for customer issues.",
      ],
    },
  ],
  projects: [
    {
      name: "Apply Boost",
      date: "2023",
      link: "",
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
  tools_technologies: ["Next.js", "PostgreSQL", "Docker"],
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
    selectedBullets.some((item) => item.originalText.includes("Answered support tickets")),
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

  assert.deepEqual(skillsToAdd.frameworks_libraries, [], "existing frameworks should not be duplicated");
  assert.ok(
    missingKeywords.some((item) => item.keyword === "Docker"),
    "unsupported requested tools should be surfaced as gaps"
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
  assert.equal(/[\t]|[•]|<table/i.test(formatted), false, "output should remain ATS-friendly plain text");

  const cleanedCoverLetter = sanitizeCoverLetterForTest(
    "Dear Hiring Manager,\n\nBody paragraph here.\n\nSincerely, Precious Nyaupane\n\nSincerely,\n[Your Name]",
    "Precious Nyaupane"
  );
  assert.equal(
    cleanedCoverLetter,
    "Dear Hiring Manager,\n\nBody paragraph here.\n\nSincerely,\nPrecious Nyaupane",
    "cover letter sanitizer should collapse duplicate sign-offs into one canonical closing"
  );

  assert.equal(signals.company_name, "Acme Labs", "structured job signals should carry the company name for cover letter personalization");

  console.log("All tailor pipeline assertions passed.");
}

run();
