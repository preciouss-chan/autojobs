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

    const prompt = `
You are an expert resume writer and cover letter writer. Tailor the following JSON resume to match the job description AND write a compelling, highly personalized cover letter.

CRITICAL RESUME REQUIREMENTS:
1. **EXACTLY ONE PAGE - NEVER EXCEED**: The resume MUST fit on exactly one page. This is non-negotiable. Prioritize the most important and relevant content. If you need to be selective, choose quality over quantity.
2. **USE KEYWORDS**: Extract and incorporate important keywords, technologies, and phrases directly from the job description into the resume bullets and summary.
3. **DETAILED BUT CONCISE BULLETS**: Each experience entry should have 3-5 detailed bullets. Each bullet should be substantial, impactful, and concise. Avoid wordiness - be direct and powerful.
4. **KEYWORD INTEGRATION**: Naturally weave job description keywords into bullet points. If the job mentions "React", "Python", "API development", "testing", etc., incorporate these terms into relevant bullets.
5. **QUANTIFY ACHIEVEMENTS**: Add numbers, metrics, and quantifiable results wherever possible (e.g., "improved performance by 30%", "handled 200+ users", "reduced load time by 50%").
6. **RELEVANT DETAILS**: Expand on experiences that are most relevant to the job. Add technical details, methodologies, and specific accomplishments, but keep it concise.
7. **SUMMARY**: Write a compelling 2-3 sentence summary (not 3-4) that incorporates key job requirements and keywords. Keep it brief but impactful.
8. **PRIORITIZE**: If space is tight, prioritize the most relevant experiences and projects. It's better to have fewer, highly relevant bullets than to overflow to a second page.

RESUME EDITING INSTRUCTIONS:
- For each experience entry, provide 3-5 detailed bullets (prioritize most relevant experiences if space is tight):
  * Use keywords from the job description
  * Show quantifiable impact
  * Highlight relevant technical skills
  * Demonstrate achievements relevant to the role
  * Keep bullets concise but impactful (one line each, avoid wordiness)
- For projects, provide 2-3 detailed bullets with similar focus
- Update the summary to be 2-3 sentences (not longer) incorporating job keywords
- Add relevant skills from the job description to the skills sections
- CRITICAL: Ensure the total content fits on exactly one page. If you must choose, prioritize the most relevant experiences and projects.

RULES FOR COVER LETTER:
- Write a professional cover letter that is SPECIFICALLY tailored to this exact job description
- Reference specific requirements, technologies, or responsibilities mentioned in the job description
- Connect the candidate's experience directly to what the job is asking for
- Use the candidate's name from the resume: ${resume.name || "the candidate"}
- The cover letter must be at least 250-400 words
- Format: Start with "Dear Hiring Manager," then body paragraphs, then "Sincerely," followed by a NEW LINE, then the candidate's name on the next line
- Make it compelling, specific, and show genuine interest in THIS particular role

COVER LETTER FORMATTING REQUIREMENTS:
- End with "Sincerely," (with comma)
- Then a blank line
- Then the candidate's full name on the next line
- Example format:
  "...looking forward to discussing this opportunity further.
  
  Sincerely,
  
  ${resume.name || "Candidate Name"}"

RESUME:
${JSON.stringify(resume)}

JOB DESCRIPTION:
${jobDescription}

ANALYSIS INSTRUCTIONS:
1. Extract ALL important keywords, technologies, skills, and requirements from the job description
2. Identify which experiences/projects are most relevant to the job
3. Expand those relevant sections with MORE bullets (4-6 per experience, 3-4 per project)
4. Incorporate job keywords naturally into bullet points
5. Add quantifiable metrics and achievements
6. Ensure the resume is comprehensive and will fill a full page
7. Write a cover letter that explicitly connects the candidate's background to the job requirements

Return JSON exactly in this structure:
{
  "updated_summary": "Write a 3-4 sentence summary incorporating key job requirements and keywords. Make it compelling and specific.",
  "project_edits": {
    "ProjectName1": ["Bullet 1 with keywords and details", "Bullet 2 with keywords and details", "Bullet 3 with keywords and details", "Bullet 4 with keywords and details"],
    "ProjectName2": ["Bullet 1", "Bullet 2", "Bullet 3"]
  },
  "experience_edits": {
    "CompanyName1": ["Bullet 1 with keywords, metrics, and details", "Bullet 2 with keywords, metrics, and details", "Bullet 3 with keywords, metrics, and details", "Bullet 4 with keywords, metrics, and details", "Bullet 5 with keywords, metrics, and details", "Bullet 6 with keywords, metrics, and details"],
    "CompanyName2": ["Bullet 1", "Bullet 2", "Bullet 3", "Bullet 4"]
  },
  "skills_to_add": {
    "languages": ["Add all relevant languages from job description"],
    "frameworks_libraries": ["Add all relevant frameworks/libraries from job description"],
    "tools": ["Add all relevant tools from job description"]
  },
  "cover_letter": "Write a highly personalized cover letter here that directly addresses the job description requirements, references specific technologies/requirements mentioned, and connects the candidate's experience to what the role needs. End with 'Sincerely,' followed by a blank line, then the candidate's name."
}
`;
    
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

