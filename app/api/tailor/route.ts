import { NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs";
import path from "path";

// Fallback resume path
const resumePath = path.join(process.cwd(), "data", "resume.json");

export async function POST(req: Request) {
  try {
    // Get API key from header or fallback to environment variable
    const apiKey = req.headers.get("X-OpenAI-API-Key") || process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key is required. Please set it in extension settings or environment variable." },
        { status: 401 }
      );
    }

    const client = new OpenAI({
      apiKey: apiKey,
    });

    const { jobDescription, resume: providedResume } = await req.json();

    if (!jobDescription) {
      return NextResponse.json(
        { error: "Missing jobDescription" },
        { status: 400 }
      );
    }

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
    
    const prompt = `You are tailoring a resume and writing a cover letter for ${candidateName}.

=== CANDIDATE'S RESUME ===
${JSON.stringify(resume, null, 2)}
=== END RESUME ===

=== JOB DESCRIPTION ===
${jobDescription}
=== END JOB DESCRIPTION ===

TASK 1: TAILOR THE RESUME
- Extract keywords from the job description (technologies, skills, responsibilities)
- Rewrite bullets to incorporate these keywords naturally
- Add metrics and quantifiable achievements
- Keep it to ONE PAGE (3-5 bullets per experience, 2-3 per project)
- Update summary to be 2-3 sentences matching job requirements

TASK 2: WRITE A COVER LETTER
CRITICAL RULES:
1. Identify which projects/experiences from the resume MATCH the job requirements:
   - If job mentions AI/ML/chatbots → mention "Rizz Chatbot" (fine-tuned GPT-3.5)
   - If job mentions games/Unity/game dev → mention "Flappy Bird with Super Powers" (Unity game)
   - If job mentions VR/immersive → mention "Dreamscape Learn" (VR lab operator)
   - If job mentions web dev/React/Python/full-stack → mention "Apply Boost" (Flask + Next.js)
   - If job mentions automation/finance → mention "Automated Budget App"
   
2. ONLY mention 2-3 experiences/projects that are ACTUALLY relevant to THIS job
3. Reference them BY NAME with SPECIFIC details (what you built, technologies used, results)
4. Connect YOUR experience to THEIR requirements explicitly
5. Keep it 250-350 words, focused and compelling
6. End with "Sincerely," then blank line, then "${candidateName}"

Return JSON:
{
  "updated_summary": "2-3 sentence summary with job keywords",
  "project_edits": {
    "ProjectName": ["bullet with keywords", "bullet with metrics", "bullet with details"]
  },
  "experience_edits": {
    "CompanyName": ["bullet 1", "bullet 2", "bullet 3", "bullet 4"]
  },
  "skills_to_add": {
    "languages": ["relevant languages from job"],
    "frameworks_libraries": ["relevant frameworks"],
    "tools": ["relevant tools"]
  },
  "cover_letter": "Full cover letter text. MUST mention specific project/experience names. MUST reference specific job requirements. Start with 'Dear Hiring Manager,' end with 'Sincerely,' then newline then '${candidateName}'"
}`;
    
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" }
    });

    const jsonString = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(jsonString);
    console.log(parsed);
    return NextResponse.json(parsed);

  } catch (err: any) {
    console.error("API ERROR:", err);
    return NextResponse.json(
      { error: "Server error", details: err.message || String(err) },
      { status: 500 }
    );
  }
}

