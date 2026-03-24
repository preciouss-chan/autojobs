import type {
  AtsAnalysis,
  ChangedBullet,
  MissingKeyword,
  Resume,
  ResumeBulletAnalysis,
  StructuredJobSignals,
  TailorResponse,
} from "@/app/lib/schemas";

type ResumeSection = "experience" | "projects";

type ResumeBulletRecord = {
  id: string;
  section: ResumeSection;
  sectionLabel: string;
  index: number;
  originalText: string;
  normalizedText: string;
  detectedKeywords: string[];
  domainCategory: string;
  hasMetrics: boolean;
  hasAchievement: boolean;
  sectionWeight: number;
  recencyWeight: number;
  score: number;
  reasons: string[];
};

type SelectedBullet = ResumeBulletRecord & {
  matchedSignals: string[];
};

type AcceptedRewrite = {
  id: string;
  revised: string;
  reason: string;
  matchedSignals: string[];
};

type RewriteMap = Record<string, { revised: string; reason?: string; matched_signals?: string[] }>;

const SECTION_WEIGHTS: Record<ResumeSection, number> = {
  experience: 1.2,
  projects: 1,
};

const COMMON_STOPWORDS = new Set([
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
  "into",
  "is",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "with",
  "using",
  "use",
  "used",
  "you",
  "your",
  "our",
  "their",
  "team",
  "teams",
  "work",
  "role",
  "roles",
  "experience",
  "responsible",
  "responsibility",
]);

const TECH_ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  node: "nodejs",
  "node.js": "nodejs",
  "react.js": "react",
  "next.js": "nextjs",
  nextjs: "nextjs",
  postgres: "postgresql",
  postgresql: "postgresql",
  aws: "amazon web services",
  ai: "artificial intelligence",
  ml: "machine learning",
  llm: "large language models",
  apis: "api",
};

const KNOWN_TECH_TERMS = uniq([
  ...Object.keys(TECH_ALIASES),
  ...Object.values(TECH_ALIASES),
  "python",
  "typescript",
  "javascript",
  "java",
  "sql",
  "c",
  "c++",
  "c#",
  "kotlin",
  "react",
  "react-native",
  "next.js",
  "nextjs",
  "flask",
  "django",
  "django rest",
  "bootstrap",
  "matplotlib",
  "sklearn",
  "scikit-learn",
  "pandas",
  "git",
  "unity",
  "android studio",
  "openai",
  "gpt-3.5",
  "aws",
  "colyseus",
  "vr",
  "rest api",
]);

const PROFESSIONAL_SKILL_PATTERNS: Record<string, RegExp[]> = {
  teamwork: [/\bteam(work)?\b/i, /cross-functional/i, /collaborat/i, /worked with/i],
  communication: [/communicat/i, /present/i, /feedback/i, /stakeholder/i],
  leadership: [/led\b/i, /mentored/i, /owned/i, /coordinated/i],
  "problem-solving": [/diagnos/i, /resolved/i, /troubleshoot/i, /improv/i, /optimized/i],
  adaptability: [/fast-paced/i, /quickly/i, /time-sensitive/i, /high-stakes/i],
  "customer support": [/support(ed|ing)?/i, /customer/i, /user feedback/i],
};

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeTerm(value: string): string {
  const normalized = normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/[^a-z0-9+#./\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return TECH_ALIASES[normalized] || normalized;
}

function tokenize(value: string): string[] {
  return normalizeTerm(value)
    .split(/\s+/)
    .filter((token) => token.length > 1 && !COMMON_STOPWORDS.has(token));
}

function titleCaseLabel(value: string): string {
  return value
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function extractMetricTokens(text: string): string[] {
  return uniq(text.match(/\b\d[\d.,]*(?:%|x|\+)?\b/g) ?? []);
}

function hasMetrics(text: string): boolean {
  return extractMetricTokens(text).length > 0;
}

function hasAchievementLanguage(text: string): boolean {
  return /\b(increased|reduced|improved|launched|delivered|generated|optimized|scaled|automated|boosted|saved|grew|accelerated|led|built|developed|designed|implemented)\b/i.test(text);
}

function estimateRecencyWeight(dates: string): number {
  if (!dates.trim()) {
    return 0.5;
  }

  const currentYear = new Date().getFullYear();
  if (/present|current/i.test(dates)) {
    return 1;
  }

  const years = dates.match(/\b(20\d{2}|19\d{2})\b/g)?.map((value) => Number(value)) ?? [];
  const latestYear = years.length > 0 ? Math.max(...years) : null;

  if (!latestYear) {
    return 0.55;
  }

  const delta = currentYear - latestYear;
  if (delta <= 1) {
    return 0.95;
  }
  if (delta <= 3) {
    return 0.8;
  }
  if (delta <= 5) {
    return 0.65;
  }
  return 0.45;
}

function collectSignalTerms(signals: StructuredJobSignals): string[] {
  return uniq([
    signals.company_name,
    ...signals.required_skills,
    ...signals.preferred_skills,
    ...signals.minimum_qualification_keywords,
    ...signals.preferred_qualification_keywords,
    ...signals.tools_technologies,
    ...signals.responsibilities,
    ...signals.domain_keywords,
    ...signals.seniority_signals,
    signals.title,
    signals.team_focus,
  ]);
}

function collectPriorityKeywords(signals: StructuredJobSignals): string[] {
  return uniq([
    signals.title,
    ...signals.required_skills,
    ...signals.minimum_qualification_keywords,
    ...signals.tools_technologies,
    ...signals.preferred_skills.slice(0, 4),
    ...signals.preferred_qualification_keywords.slice(0, 4),
  ]).filter((term) => normalizeTerm(term).length > 1);
}

function phraseMatches(text: string, phrases: string[]): string[] {
  const normalizedText = normalizeTerm(text);
  return uniq(
    phrases.filter((phrase) => {
      const normalizedPhrase = normalizeTerm(phrase);
      return normalizedPhrase.length > 1 && normalizedText.includes(normalizedPhrase);
    })
  );
}

function tokenOverlapScore(text: string, phrases: string[]): number {
  const textTokens = new Set(tokenize(text));
  const phraseTokens = uniq(phrases.flatMap((phrase) => tokenize(phrase)));

  if (textTokens.size === 0 || phraseTokens.length === 0) {
    return 0;
  }

  let overlap = 0;
  for (const token of phraseTokens) {
    if (textTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap / phraseTokens.length;
}

function detectDomainCategory(text: string, signals: StructuredJobSignals): string {
  const matches = phraseMatches(text, signals.domain_keywords);
  if (matches.length > 0) {
    return matches[0];
  }

  const toolMatch = phraseMatches(text, signals.tools_technologies);
  if (toolMatch.length > 0) {
    return toolMatch[0];
  }

  return signals.team_focus || "general";
}

function deriveDetectedKeywords(text: string, signals: StructuredJobSignals): string[] {
  const exactMatches = phraseMatches(text, collectSignalTerms(signals));
  const tokenMatches = collectSignalTerms(signals).filter((term) => {
    const termTokens = tokenize(term);
    if (termTokens.length === 0) {
      return false;
    }

    const textTokens = new Set(tokenize(text));
    return termTokens.some((token) => textTokens.has(token));
  });

  return uniq([...exactMatches, ...tokenMatches]).slice(0, 8);
}

function buildBulletId(section: ResumeSection, label: string, index: number): string {
  return `${section}:${label}:${index}`;
}

function scoreBullet(text: string, signals: StructuredJobSignals, section: ResumeSection, dates: string): {
  score: number;
  reasons: string[];
  matchedSignals: string[];
} {
  const matchedSignals = deriveDetectedKeywords(text, signals);
  const requiredMatches = phraseMatches(text, signals.required_skills);
  const toolMatches = phraseMatches(text, signals.tools_technologies);
  const responsibilityMatches = phraseMatches(text, signals.responsibilities);
  const semanticScore = tokenOverlapScore(text, collectSignalTerms(signals));
  const recencyWeight = estimateRecencyWeight(dates);
  const sectionWeight = SECTION_WEIGHTS[section];

  let score = requiredMatches.length * 3;
  score += toolMatches.length * 2;
  score += responsibilityMatches.length * 1.5;
  score += semanticScore * 4;
  score += sectionWeight;
  score += recencyWeight;

  const reasons: string[] = [];
  if (requiredMatches.length > 0) {
    reasons.push(`matches required skills: ${requiredMatches.join(", ")}`);
  }
  if (toolMatches.length > 0) {
    reasons.push(`aligns with tools: ${toolMatches.join(", ")}`);
  }
  if (responsibilityMatches.length > 0) {
    reasons.push(`supports responsibilities: ${responsibilityMatches.join(", ")}`);
  }
  if (semanticScore >= 0.2) {
    reasons.push("strong overall relevance to the job signals");
  }
  if (recencyWeight >= 0.8) {
    reasons.push("comes from recent experience");
  }

  return {
    score: Number(score.toFixed(2)),
    reasons,
    matchedSignals,
  };
}

export function parseResumeForTailoring(
  resume: Resume,
  signals: StructuredJobSignals
): ResumeBulletRecord[] {
  const records: ResumeBulletRecord[] = [];

  for (const exp of resume.experience) {
    exp.bullets.forEach((bullet, index) => {
      const scored = scoreBullet(bullet, signals, "experience", exp.dates);
      records.push({
        id: buildBulletId("experience", exp.company, index),
        section: "experience",
        sectionLabel: exp.company,
        index,
        originalText: bullet,
        normalizedText: normalizeTerm(bullet),
        detectedKeywords: scored.matchedSignals,
        domainCategory: detectDomainCategory(bullet, signals),
        hasMetrics: hasMetrics(bullet),
        hasAchievement: hasAchievementLanguage(bullet),
        sectionWeight: SECTION_WEIGHTS.experience,
        recencyWeight: estimateRecencyWeight(exp.dates),
        score: scored.score,
        reasons: scored.reasons,
      });
    });
  }

  for (const project of resume.projects) {
    project.bullets.forEach((bullet, index) => {
      const scored = scoreBullet(bullet, signals, "projects", project.date);
      records.push({
        id: buildBulletId("projects", project.name, index),
        section: "projects",
        sectionLabel: project.name,
        index,
        originalText: bullet,
        normalizedText: normalizeTerm(bullet),
        detectedKeywords: scored.matchedSignals,
        domainCategory: detectDomainCategory(bullet, signals),
        hasMetrics: hasMetrics(bullet),
        hasAchievement: hasAchievementLanguage(bullet),
        sectionWeight: SECTION_WEIGHTS.projects,
        recencyWeight: estimateRecencyWeight(project.date),
        score: scored.score,
        reasons: scored.reasons,
      });
    });
  }

  return records.sort((left, right) => right.score - left.score);
}

export function buildBulletAnalysis(records: ResumeBulletRecord[]): ResumeBulletAnalysis[] {
  const topThreshold = records.length > 0 ? Math.max(records[0].score * 0.45, 2.6) : 2.6;

  return records.map((record, index) => ({
    id: record.id,
    section: record.section,
    section_label: record.sectionLabel,
    index: record.index,
    original_text: record.originalText,
    detected_keywords: record.detectedKeywords,
    domain_category: record.domainCategory,
    has_metrics: record.hasMetrics,
    has_achievement: record.hasAchievement,
    score: record.score,
    decision: index < 6 && record.score >= topThreshold && record.detectedKeywords.length > 0 ? "rewrite" : "keep",
    reasons: record.reasons,
  }));
}

export function selectBulletsForRewrite(records: ResumeBulletRecord[]): SelectedBullet[] {
  const analysis = buildBulletAnalysis(records);

  return analysis
    .filter((item) => item.decision === "rewrite")
    .map((item) => {
      const record = records.find((candidate) => candidate.id === item.id);
      if (!record) {
        return null;
      }

      return {
        ...record,
        matchedSignals: item.detected_keywords,
      };
    })
    .filter((value): value is SelectedBullet => value !== null);
}

function collectResumeEvidenceTerms(resume: Resume): Set<string> {
  const terms = new Set<string>();
  const addTokens = (value: string): void => {
    tokenize(value).forEach((token) => terms.add(token));
    const normalized = normalizeTerm(value);
    if (normalized) {
      terms.add(normalized);
    }
  };

  if (resume.summary) {
    addTokens(resume.summary);
  }

  resume.skills.languages.forEach(addTokens);
  resume.skills.frameworks_libraries.forEach(addTokens);
  resume.skills.tools.forEach(addTokens);
  resume.skills.professional_skills.forEach(addTokens);
  resume.skills.target_role_keywords.forEach(addTokens);

  resume.experience.forEach((exp) => {
    addTokens(exp.role);
    addTokens(exp.company);
    exp.bullets.forEach(addTokens);
  });

  resume.projects.forEach((project) => {
    addTokens(project.name);
    project.technologies.forEach(addTokens);
    project.bullets.forEach(addTokens);
  });

  return terms;
}

export function inferTargetRoleKeywords(
  resume: Resume,
  signals: StructuredJobSignals
): string[] {
  const existingTerms = new Set(
    [
      ...resume.skills.languages,
      ...resume.skills.frameworks_libraries,
      ...resume.skills.tools,
      ...resume.skills.professional_skills,
      ...resume.skills.target_role_keywords,
    ].map((item) => normalizeTerm(item))
  );

  return uniq([
    signals.title,
    ...signals.required_skills,
    ...signals.minimum_qualification_keywords,
    ...signals.tools_technologies,
    ...signals.preferred_skills,
    ...signals.preferred_qualification_keywords,
    ...signals.domain_keywords,
    ...signals.responsibilities.slice(0, 6),
  ]).filter((term) => {
    const normalized = normalizeTerm(term);
    return normalized.length > 1 && !existingTerms.has(normalized);
  });
}

function collectProjectTechnologyTerms(resume: Resume, signals: StructuredJobSignals): string[] {
  const candidates = new Map<string, string>();
  const register = (term: string): void => {
    const normalized = normalizeTerm(term);
    if (!normalized) {
      return;
    }
    if (!candidates.has(normalized)) {
      candidates.set(normalized, term);
    }
  };

  const searchableTerms = uniq([
    ...KNOWN_TECH_TERMS,
    ...signals.required_skills,
    ...signals.tools_technologies,
    ...signals.preferred_skills,
    ...resume.skills.languages,
    ...resume.skills.frameworks_libraries,
    ...resume.skills.tools,
  ]);

  resume.projects.forEach((project) => {
    project.technologies.forEach(register);
    project.bullets.forEach((bullet) => {
      phraseMatches(bullet, searchableTerms).forEach(register);
    });
  });

  return Array.from(candidates.values());
}

function inferProfessionalSkills(resume: Resume, signals: StructuredJobSignals): string[] {
  const text = [
    resume.summary,
    ...resume.experience.flatMap((item) => [item.role, ...item.bullets]),
    ...resume.projects.flatMap((item) => item.bullets),
  ].join(" \n ");

  const inferred = new Set<string>();

  for (const [skill, patterns] of Object.entries(PROFESSIONAL_SKILL_PATTERNS)) {
    if (patterns.some((pattern) => pattern.test(text))) {
      inferred.add(titleCaseLabel(skill));
    }
  }

  const jobProfessionalTerms = uniq([
    ...signals.required_skills,
    ...signals.preferred_skills,
    ...signals.minimum_qualification_keywords,
    ...signals.preferred_qualification_keywords,
    ...signals.responsibilities,
  ]).filter((term) => !KNOWN_TECH_TERMS.includes(normalizeTerm(term)));

  jobProfessionalTerms.forEach((term) => {
    if (termSupported(term, collectResumeEvidenceTerms(resume))) {
      inferred.add(titleCaseLabel(term));
      return;
    }

    if (tokenOverlapScore(text, [term]) >= 0.5) {
      inferred.add(titleCaseLabel(term));
      return;
    }

    const normalizedTerm = normalizeTerm(term);
    const mappedPatterns = PROFESSIONAL_SKILL_PATTERNS[normalizedTerm];
    if (mappedPatterns && mappedPatterns.some((pattern) => pattern.test(text))) {
      inferred.add(titleCaseLabel(term));
    }
  });

  return Array.from(inferred);
}

function collectSignalTokenSet(signals: StructuredJobSignals): Set<string> {
  return new Set(collectSignalTerms(signals).flatMap((term) => tokenize(term)));
}

function containsUnsupportedSignalTokens(
  original: string,
  revised: string,
  signalTokens: Set<string>
): boolean {
  const originalTokens = new Set(tokenize(original));
  const revisedTokens = tokenize(revised);

  const newlyAdded = revisedTokens.filter((token) => !originalTokens.has(token));
  return newlyAdded.some((token) => signalTokens.has(token));
}

function changesMetrics(original: string, revised: string): boolean {
  const originalMetrics = new Set(extractMetricTokens(original));
  const revisedMetrics = new Set(extractMetricTokens(revised));

  if (originalMetrics.size === 0) {
    return revisedMetrics.size > 0;
  }

  for (const metric of revisedMetrics) {
    if (!originalMetrics.has(metric)) {
      return true;
    }
  }

  return false;
}

function hasAdequateContentOverlap(original: string, revised: string): boolean {
  const originalTokens = new Set(tokenize(original));
  const revisedTokens = new Set(tokenize(revised));

  if (originalTokens.size === 0 || revisedTokens.size === 0) {
    return false;
  }

  let overlap = 0;
  for (const token of originalTokens) {
    if (revisedTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap / originalTokens.size >= 0.45;
}

export function acceptBulletRewrites(
  selectedBullets: SelectedBullet[],
  rewriteMap: RewriteMap,
  signals: StructuredJobSignals
): AcceptedRewrite[] {
  const accepted: AcceptedRewrite[] = [];
  const signalTokens = collectSignalTokenSet(signals);

  for (const bullet of selectedBullets) {
    const rewrite = rewriteMap[bullet.id];
    if (!rewrite?.revised) {
      continue;
    }

    const revised = normalizeWhitespace(rewrite.revised);
    if (!revised || revised === normalizeWhitespace(bullet.originalText)) {
      continue;
    }

    if (containsUnsupportedSignalTokens(bullet.originalText, revised, signalTokens)) {
      continue;
    }

    if (changesMetrics(bullet.originalText, revised)) {
      continue;
    }

    if (!hasAdequateContentOverlap(bullet.originalText, revised)) {
      continue;
    }

    accepted.push({
      id: bullet.id,
      revised,
      reason: rewrite.reason || bullet.reasons[0] || "Improved clarity and keyword alignment.",
      matchedSignals: rewrite.matched_signals ?? bullet.matchedSignals,
    });
  }

  return accepted;
}

function termSupported(term: string, evidenceTerms: Set<string>): boolean {
  const normalized = normalizeTerm(term);
  if (!normalized) {
    return true;
  }

  if (evidenceTerms.has(normalized)) {
    return true;
  }

  return tokenize(term).every((token) => evidenceTerms.has(token));
}

export function inferSupportedSkillsToAdd(
  resume: Resume,
  signals: StructuredJobSignals
): TailorResponse["skills_to_add"] {
  const evidenceTerms = collectResumeEvidenceTerms(resume);
  const existingSkills = new Set(
    [
      ...resume.skills.languages,
      ...resume.skills.frameworks_libraries,
      ...resume.skills.tools,
      ...resume.skills.professional_skills,
    ].map((skill) => normalizeTerm(skill))
  );

  const result: TailorResponse["skills_to_add"] = {
    languages: [],
    frameworks_libraries: [],
    tools: [],
    professional_skills: [],
    target_role_keywords: [],
  };

  const languageTerms = new Set(["javascript", "typescript", "python", "java", "sql", "go", "rust", "ruby", "php", "swift", "kotlin", "c", "c++", "c#"]);

  const maybeAdd = (skill: string): void => {
    const normalized = normalizeTerm(skill);
    if (!normalized || existingSkills.has(normalized) || !termSupported(skill, evidenceTerms)) {
      return;
    }

    if (languageTerms.has(normalized)) {
      result.languages.push(skill);
    } else if (skill.includes(".") || skill.includes("React") || skill.includes("Next") || skill.includes("Node") || skill.includes("Vue") || skill.includes("Angular") || skill.includes("Django") || skill.includes("Flask")) {
      result.frameworks_libraries.push(skill);
    } else if (!KNOWN_TECH_TERMS.includes(normalized) && signals.responsibilities.some((item) => normalizeTerm(item) === normalized)) {
      result.professional_skills.push(titleCaseLabel(skill));
    } else {
      result.tools.push(skill);
    }
    existingSkills.add(normalized);
  };

  collectProjectTechnologyTerms(resume, signals).forEach(maybeAdd);
  [
    ...signals.required_skills,
    ...signals.minimum_qualification_keywords,
    ...signals.tools_technologies,
    ...signals.preferred_skills,
    ...signals.preferred_qualification_keywords,
  ].forEach(maybeAdd);
  inferProfessionalSkills(resume, signals).forEach((skill) => {
    const normalized = normalizeTerm(skill);
    if (!normalized || existingSkills.has(normalized)) {
      return;
    }
    result.professional_skills.push(skill);
    existingSkills.add(normalized);
  });

  result.target_role_keywords = inferTargetRoleKeywords(resume, signals);

  return {
    languages: uniq(result.languages),
    frameworks_libraries: uniq(result.frameworks_libraries),
    tools: uniq(result.tools),
    professional_skills: uniq(result.professional_skills),
    target_role_keywords: uniq(result.target_role_keywords),
  };
}

export function findMissingKeywords(
  resume: Resume,
  signals: StructuredJobSignals
): MissingKeyword[] {
  const evidenceTerms = collectResumeEvidenceTerms(resume);
  const gaps: MissingKeyword[] = [];

  const inspect = (
    terms: string[],
    category: MissingKeyword["category"],
    reasonPrefix: string
  ): void => {
    for (const term of uniq(terms)) {
      if (!term || termSupported(term, evidenceTerms)) {
        continue;
      }

      gaps.push({
        keyword: term,
        category,
        reason: `${reasonPrefix}; no direct support found in the current resume.`,
      });
    }
  };

  inspect(signals.required_skills, "required_skill", "Required skill is missing");
  inspect(signals.preferred_skills, "preferred_skill", "Preferred skill is not currently supported");
  inspect(signals.tools_technologies, "tool", "Requested tool or technology is not currently supported");
  inspect(signals.responsibilities.slice(0, 6), "responsibility", "Responsibility is not directly evidenced");
  inspect(signals.domain_keywords.slice(0, 6), "domain", "Domain keyword is not directly evidenced");

  return gaps.slice(0, 12);
}

export function buildBulletEditMaps(
  resume: Resume,
  acceptedRewrites: AcceptedRewrite[]
): {
  experienceEdits: TailorResponse["experience_edits"];
  projectEdits: TailorResponse["project_edits"];
} {
  const experienceEdits: TailorResponse["experience_edits"] = {};
  const projectEdits: TailorResponse["project_edits"] = {};

  const grouped = new Map<string, AcceptedRewrite[]>();
  for (const rewrite of acceptedRewrites) {
    const [section, label] = rewrite.id.split(":");
    const key = `${section}:${label}`;
    const list = grouped.get(key) ?? [];
    list.push(rewrite);
    grouped.set(key, list);
  }

  for (const [groupKey, rewrites] of grouped.entries()) {
    const [section, label] = groupKey.split(":");
    if (section === "experience") {
      const entry = resume.experience.find((item) => item.company === label);
      if (!entry) {
        continue;
      }

      const bullets = [...entry.bullets];
      rewrites.forEach((rewrite) => {
        const index = Number(rewrite.id.split(":").pop());
        if (!Number.isNaN(index) && bullets[index]) {
          bullets[index] = rewrite.revised;
        }
      });
      experienceEdits[label] = bullets;
      continue;
    }

    const project = resume.projects.find((item) => item.name === label);
    if (!project) {
      continue;
    }

    const bullets = [...project.bullets];
    rewrites.forEach((rewrite) => {
      const index = Number(rewrite.id.split(":").pop());
      if (!Number.isNaN(index) && bullets[index]) {
        bullets[index] = rewrite.revised;
      }
    });
    projectEdits[label] = bullets;
  }

  return {
    experienceEdits,
    projectEdits,
  };
}

export function buildChangedBullets(
  selectedBullets: SelectedBullet[],
  acceptedRewrites: AcceptedRewrite[]
): ChangedBullet[] {
  const selectedById = new Map(selectedBullets.map((item) => [item.id, item]));

  return acceptedRewrites.map((rewrite) => {
    const original = selectedById.get(rewrite.id);
    return {
      id: rewrite.id,
      section: original?.section ?? "experience",
      section_label: original?.sectionLabel ?? "",
      index: original?.index ?? 0,
      original: original?.originalText ?? "",
      revised: rewrite.revised,
      matched_signals: rewrite.matchedSignals,
      reason: rewrite.reason,
    };
  });
}

export function applyResponseToResume(resume: Resume, response: TailorResponse): Resume {
  const nextResume: Resume = structuredClone(resume);

  if (response.updated_summary.trim()) {
    nextResume.summary = response.updated_summary.trim();
  }

  for (const [company, bullets] of Object.entries(response.experience_edits)) {
    const entry = nextResume.experience.find((item) => item.company === company);
    if (entry && bullets.length === entry.bullets.length) {
      entry.bullets = [...bullets];
    }
  }

  for (const [projectName, bullets] of Object.entries(response.project_edits)) {
    const project = nextResume.projects.find((item) => item.name === projectName);
    if (project && bullets.length === project.bullets.length) {
      project.bullets = [...bullets];
    }
  }

  const mergeSkillList = (target: string[], additions: string[]): string[] => {
    const seen = new Set(target.map((item) => normalizeTerm(item)));
    const merged = [...target];
    additions.forEach((item) => {
      const normalized = normalizeTerm(item);
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        merged.push(item);
      }
    });
    return merged;
  };

  nextResume.skills.languages = mergeSkillList(
    nextResume.skills.languages,
    response.skills_to_add.languages
  );
  nextResume.skills.frameworks_libraries = mergeSkillList(
    nextResume.skills.frameworks_libraries,
    response.skills_to_add.frameworks_libraries
  );
  nextResume.skills.tools = mergeSkillList(nextResume.skills.tools, response.skills_to_add.tools);
  nextResume.skills.professional_skills = mergeSkillList(
    nextResume.skills.professional_skills,
    response.skills_to_add.professional_skills
  );
  nextResume.skills.target_role_keywords = mergeSkillList(
    nextResume.skills.target_role_keywords,
    response.skills_to_add.target_role_keywords
  );

  return nextResume;
}

export function formatResumeAsText(resume: Resume): string {
  const lines: string[] = [];

  lines.push(resume.name);
  lines.push([
    resume.contact.email,
    resume.contact.phone,
    resume.contact.linkedin,
    resume.contact.github,
  ].filter(Boolean).join(" | "));
  lines.push("");

  if (resume.summary.trim()) {
    lines.push("SUMMARY");
    lines.push(resume.summary.trim());
    lines.push("");
  }

  lines.push("SKILLS");
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
  if (resume.skills.target_role_keywords.length > 0) {
    lines.push(`Target Role Keywords: ${resume.skills.target_role_keywords.join(", ")}`);
  }
  lines.push("");

  if (resume.experience.length > 0) {
    lines.push("EXPERIENCE");
    resume.experience.forEach((item) => {
      lines.push(`${item.role} | ${item.company}${item.dates ? ` | ${item.dates}` : ""}`);
      item.bullets.forEach((bullet) => lines.push(`- ${bullet}`));
      lines.push("");
    });
  }

  if (resume.projects.length > 0) {
    lines.push("PROJECTS");
    resume.projects.forEach((item) => {
      lines.push(`${item.name}${item.date ? ` | ${item.date}` : ""}`);
      item.bullets.forEach((bullet) => lines.push(`- ${bullet}`));
      lines.push("");
    });
  }

  if (resume.education.length > 0) {
    lines.push("EDUCATION");
    resume.education.forEach((item) => {
      const detailParts = [item.degree, item.institution, item.graduation_year].filter(Boolean);
      lines.push(detailParts.join(" | "));
      if (item.gpa) {
        lines.push(`GPA: ${item.gpa}`);
      }
      lines.push("");
    });
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function extractSectionText(resume: Resume): {
  summary: string;
  skills: string;
  experience: string;
  projects: string;
} {
  return {
    summary: resume.summary || "",
    skills: [
      ...resume.skills.languages,
      ...resume.skills.frameworks_libraries,
      ...resume.skills.tools,
      ...resume.skills.professional_skills,
      ...resume.skills.target_role_keywords,
    ].join(" "),
    experience: resume.experience.flatMap((item) => [item.role, item.company, ...item.bullets]).join(" "),
    projects: resume.projects.flatMap((item) => [item.name, ...item.bullets]).join(" "),
  };
}

function detectFormattingWarnings(resumeText: string): string[] {
  const warnings: string[] = [];
  if (/[•	]/.test(resumeText)) {
    warnings.push("Avoid non-standard bullets or tab-based spacing in ATS exports.");
  }
  if (/[❌✔⚡🎯]/.test(resumeText)) {
    warnings.push("Remove icons or decorative symbols that ATS parsers may skip.");
  }
  if (/<table|\|\s+\|/i.test(resumeText)) {
    warnings.push("Avoid table-like formatting; keep content in plain text sections.");
  }
  return warnings;
}

export function analyzeAtsOptimization(
  resume: Resume,
  signals: StructuredJobSignals,
  missingKeywords: MissingKeyword[]
): AtsAnalysis {
  const sections = extractSectionText(resume);
  const priorityKeywords = collectPriorityKeywords(signals);
  const matchedKeywords = priorityKeywords.filter((term) =>
    [sections.summary, sections.skills, sections.experience, sections.projects]
      .some((sectionText) => phraseMatches(sectionText, [term]).length > 0)
  );

  const sectionCoverage = {
    summary: phraseMatches(sections.summary, priorityKeywords),
    skills: phraseMatches(sections.skills, priorityKeywords),
    experience: phraseMatches(sections.experience, priorityKeywords),
    projects: phraseMatches(sections.projects, priorityKeywords),
  };

  const normalizedTitle = normalizeTerm(signals.title);
  const roleTerms = resume.experience.map((item) => item.role).join(" ");
  const titleAlignment = !normalizedTitle
    ? "partial"
    : phraseMatches(roleTerms, [signals.title]).length > 0
      ? "strong"
      : tokenOverlapScore(roleTerms, [signals.title]) >= 0.4
        ? "partial"
        : "weak";

  let score = 35;
  score += Math.round((matchedKeywords.length / Math.max(priorityKeywords.length, 1)) * 35);
  score += Math.min(sectionCoverage.summary.length, 3) * 5;
  score += Math.min(sectionCoverage.skills.length, 4) * 3;
  score += Math.min(sectionCoverage.experience.length, 5) * 3;
  score += titleAlignment === "strong" ? 10 : titleAlignment === "partial" ? 5 : 0;
  score -= Math.min(missingKeywords.length, 6) * 2;
  score = Math.max(0, Math.min(100, score));

  const formattingWarnings = detectFormattingWarnings(formatResumeAsText(resume));
  const optimizationTips: string[] = [];

  if (titleAlignment !== "strong" && signals.title) {
    optimizationTips.push(`Align your summary and recent role descriptions more clearly to the target title "${signals.title}" when truthful.`);
  }
  if (sectionCoverage.summary.length < Math.min(2, priorityKeywords.length)) {
    optimizationTips.push("Use the summary to reflect the target role and 2-3 of the strongest supported hard skills naturally.");
  }
  if (sectionCoverage.skills.length < Math.min(3, priorityKeywords.length)) {
    optimizationTips.push("Surface proven technical keywords in the skills section so ATS can match them quickly.");
  }
  if (sectionCoverage.experience.length < Math.min(4, priorityKeywords.length)) {
    optimizationTips.push("Place important keywords inside accomplishment bullets, not only in the skills section.");
  }
  if (missingKeywords.some((item) => item.category === "required_skill" || item.category === "tool")) {
    optimizationTips.push("Keep unsupported keywords out of the resume body and address them only if you can add truthful evidence later.");
  }
  if (formattingWarnings.length === 0) {
    optimizationTips.push("Resume output remains plain-text and ATS-friendly: simple headings, standard bullets, and no complex layout artifacts.");
  }

  return {
    score,
    target_job_title: signals.title,
    title_alignment: titleAlignment,
    matched_keywords: matchedKeywords,
    keyword_gaps: uniq(missingKeywords.map((item) => item.keyword)),
    section_coverage: sectionCoverage,
    formatting_warnings: formattingWarnings,
    optimization_tips: optimizationTips.slice(0, 6),
  };
}

export function buildImprovementNotes(response: {
  changedBullets: ChangedBullet[];
  missingKeywords: MissingKeyword[];
  skillsToAdd: TailorResponse["skills_to_add"];
  updatedSummary: string;
  atsAnalysis?: AtsAnalysis;
}): string[] {
  const notes: string[] = [];

  if (response.updatedSummary.trim()) {
    notes.push("Refined the summary to better reflect the target role and strongest supported qualifications.");
  }
  if (response.changedBullets.length > 0) {
    notes.push(`Rewrote ${response.changedBullets.length} high-relevance bullets while keeping the original facts and metrics intact.`);
  }

  const surfacedSkillsCount =
    response.skillsToAdd.languages.length +
    response.skillsToAdd.frameworks_libraries.length +
    response.skillsToAdd.tools.length +
    response.skillsToAdd.professional_skills.length +
    response.skillsToAdd.target_role_keywords.length;
  if (surfacedSkillsCount > 0) {
    notes.push(`Surfaced ${surfacedSkillsCount} existing capabilities in the skills section where the resume already supported them.`);
  }

  if (response.missingKeywords.length > 0) {
    notes.push("Separated unsupported requirements into explicit gaps instead of injecting unverified keywords into the resume.");
  }
  if (response.atsAnalysis) {
    notes.push(`ATS alignment score: ${response.atsAnalysis.score}/100 with ${response.atsAnalysis.matched_keywords.length} priority keywords matched naturally across the resume.`);
  }

  if (notes.length === 0) {
    notes.push("Kept the resume largely unchanged because the strongest content was already aligned and truthful.");
  }

  return notes;
}

export function buildTargetedSummary(
  resume: Resume,
  signals: StructuredJobSignals,
  skillsToAdd: TailorResponse["skills_to_add"],
  bulletAnalysis: ResumeBulletAnalysis[]
): string {
  const strongestBullets = bulletAnalysis
    .filter((item) => item.detected_keywords.length > 0)
    .slice(0, 2);

  const topSkills = uniq([
    ...signals.required_skills,
    ...signals.tools_technologies,
    ...skillsToAdd.languages,
    ...skillsToAdd.frameworks_libraries,
    ...skillsToAdd.tools,
  ]).slice(0, 4);

  const openingParts = [
    resume.education[0]?.degree ? `${resume.education[0].degree} candidate` : "Candidate",
    signals.title ? `targeting ${signals.title} roles` : "with hands-on software experience",
  ];

  const firstSentence = `${openingParts.join(" ")} with experience in ${topSkills.join(", ") || "software development"}.`;

  const evidenceSentence = strongestBullets.length > 0
    ? `Highlights include ${strongestBullets
        .map((item) => item.original_text.replace(/^[A-Z]/, (char) => char.toLowerCase()).replace(/\.$/, ""))
        .join(" and ")}.`
    : "Brings project and hands-on experience that aligns with the role requirements.";

  const softSkills = skillsToAdd.professional_skills.slice(0, 3);
  const closingSentence = softSkills.length > 0
    ? `Also brings ${softSkills.join(", ").toLowerCase()} backed by real work across projects and experience.`
    : signals.team_focus
      ? `Interested in contributing to ${signals.team_focus.toLowerCase()} work with a strong ATS-aligned skills profile.`
      : "Interested in contributing with relevant, ATS-aligned experience and skills.";

  return [firstSentence, evidenceSentence, closingSentence].join(" ");
}
