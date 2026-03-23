import { z } from "zod";

// Resume data structures
export const ContactSchema = z.object({
  phone: z.string().default(""),
  email: z.string().email().or(z.string().default("")),
  linkedin: z.string().default(""),
  github: z.string().default(""),
});

export const ProjectSchema = z.object({
  name: z.string(),
  date: z.string().default(""),
  link: z.string().default(""),
  bullets: z.array(z.string()).default([]),
});

export const ExperienceSchema = z.object({
  company: z.string(),
  role: z.string(),
  dates: z.string().default(""),
  bullets: z.array(z.string()).default([]),
});

export const EducationSchema = z.object({
  degree: z.string().default(""),
  institution: z.string().default(""),
  graduation_year: z.string().default(""),
  gpa: z.string().default(""),
});

export const SkillsSchema = z.object({
  languages: z.array(z.string()).default([]),
  frameworks_libraries: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
});

export const ResumeSchema = z.object({
  name: z.string(),
  contact: ContactSchema,
  summary: z.string().default(""),
  projects: z.array(ProjectSchema).default([]),
  experience: z.array(ExperienceSchema).default([]),
  education: z.array(EducationSchema).default([]),
  skills: SkillsSchema,
});

export type Resume = z.infer<typeof ResumeSchema>;
export type Contact = z.infer<typeof ContactSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Experience = z.infer<typeof ExperienceSchema>;
export type Education = z.infer<typeof EducationSchema>;
export type Skills = z.infer<typeof SkillsSchema>;

// Job requirement structures
export const JobRequirementsSchema = z.object({
  title: z.string(),
  seniority_level: z.string(),
  required_skills: z.array(z.string()),
  nice_to_have_skills: z.array(z.string()),
  required_tools_frameworks: z.array(z.string()),
  key_responsibilities: z.array(z.string()),
  experience_years: z.number().nullable(),
  domain: z.string(),
  team_focus: z.string(),
});

export type JobRequirements = z.infer<typeof JobRequirementsSchema>;

export const StructuredJobSignalsSchema = z.object({
  title: z.string().default(""),
  seniority_signals: z.array(z.string()).default([]),
  required_skills: z.array(z.string()).default([]),
  preferred_skills: z.array(z.string()).default([]),
  tools_technologies: z.array(z.string()).default([]),
  responsibilities: z.array(z.string()).default([]),
  domain_keywords: z.array(z.string()).default([]),
  years_experience: z.number().nullable().default(null),
  team_focus: z.string().default(""),
});

export type StructuredJobSignals = z.infer<typeof StructuredJobSignalsSchema>;

export const ResumeBulletAnalysisSchema = z.object({
  id: z.string(),
  section: z.enum(["experience", "projects"]),
  section_label: z.string(),
  index: z.number().int().nonnegative(),
  original_text: z.string(),
  detected_keywords: z.array(z.string()).default([]),
  domain_category: z.string().default("general"),
  has_metrics: z.boolean().default(false),
  has_achievement: z.boolean().default(false),
  score: z.number().default(0),
  decision: z.enum(["rewrite", "keep"]),
  reasons: z.array(z.string()).default([]),
});

export type ResumeBulletAnalysis = z.infer<typeof ResumeBulletAnalysisSchema>;

export const ChangedBulletSchema = z.object({
  id: z.string(),
  section: z.enum(["experience", "projects"]),
  section_label: z.string(),
  index: z.number().int().nonnegative(),
  original: z.string(),
  revised: z.string(),
  matched_signals: z.array(z.string()).default([]),
  reason: z.string().default(""),
});

export type ChangedBullet = z.infer<typeof ChangedBulletSchema>;

export const MissingKeywordSchema = z.object({
  keyword: z.string(),
  category: z.enum(["required_skill", "preferred_skill", "tool", "responsibility", "domain"]),
  reason: z.string(),
});

export type MissingKeyword = z.infer<typeof MissingKeywordSchema>;

// API Request schemas
export const ParseResumeRequestSchema = z.object({
  file: z.instanceof(File),
});

export const ExtractRequirementsRequestSchema = z.object({
  jobDescription: z.string().min(1, "Job description cannot be empty"),
});

export const TailorRequestSchema = z.object({
  jobDescription: z.string().min(1, "Job description cannot be empty"),
  resume: ResumeSchema.optional(),
  jobRequirements: JobRequirementsSchema.optional(),
});

export const ChatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    })
  ),
  resume: ResumeSchema,
});

// API Response schemas
export const TailorResponseSchema = z.object({
  updated_summary: z.string(),
  project_edits: z.record(z.string(), z.array(z.string())).default({}),
  experience_edits: z.record(z.string(), z.array(z.string())).default({}),
  skills_reframing: z
    .array(
      z.object({
        category: z.enum(["languages", "frameworks_libraries", "tools", "experience"]),
        original: z.string(),
        tailored: z.string(),
        evidence: z.string(),
      })
    )
    .default([]),
  skills_to_add: z
    .object({
      languages: z.array(z.string()).default([]),
      frameworks_libraries: z.array(z.string()).default([]),
      tools: z.array(z.string()).default([]),
    })
    .default(() => ({ languages: [], frameworks_libraries: [], tools: [] })),
  job_signals: StructuredJobSignalsSchema,
  bullet_analysis: z.array(ResumeBulletAnalysisSchema).default([]),
  changed_bullets: z.array(ChangedBulletSchema).default([]),
  missing_keywords: z.array(MissingKeywordSchema).default([]),
  improvement_notes: z.array(z.string()).default([]),
  revised_resume_text: z.string().default(""),
  cover_letter: z.string(),
});

export type TailorResponse = z.infer<typeof TailorResponseSchema>;

export const ChatResponseSchema = z.object({
  response: z.string(),
  has_context: z.boolean().default(true),
});

export type ChatResponse = z.infer<typeof ChatResponseSchema>;

export const ExportPDFRequestSchema = z.object({
  name: z.string(),
  contact: ContactSchema,
  summary: z.string().default(""),
  projects: z.array(ProjectSchema).default([]),
  experience: z.array(ExperienceSchema).default([]),
  education: z.array(EducationSchema).default([]),
  skills: SkillsSchema,
});

export const ErrorResponseSchema = z.object({
  error: z.string(),
  details: z.string().optional(),
  stack: z.string().optional(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
