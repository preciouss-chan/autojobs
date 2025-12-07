import { NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs";
import path from "path";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const resumePath = path.join(process.cwd(), "data", "resume.json");
const resume = JSON.parse(fs.readFileSync(resumePath, "utf8"));

export async function POST(req: Request) {
  try {
    const { jobDescription } = await req.json();

    if (!jobDescription) {
      return NextResponse.json(
        { error: "Missing jobDescription" },
        { status: 400 }
      );
    }

    const prompt = `
You are an expert resume writer. Tailor the following JSON resume to match the job description.

RULES:
- Return ONLY JSON.
- Return STRICTLY a JSON object.
- Do NOT output explanations.
- Only return updated bullets, skill additions, and cover letter.

RESUME:
${JSON.stringify(resume)}

JOB DESCRIPTION:
${jobDescription}

Return JSON exactly in this structure:
{
  "updated_summary": "",
  "project_edits": {},
  "experience_edits": {},
  "skills_to_add": {
    "languages": [],
    "frameworks_libraries": [],
    "tools": []
  },
  "cover_letter": ""
}
`;
    
    const response = await client.responses.create({
      model: "gpt-4o-mini",
      input: prompt,
      text: {
        format: {
          type: "json_object"
        }
      }
    });

    const jsonString = response.output_text;
    const parsed = JSON.parse(jsonString);

    return NextResponse.json(parsed);

  } catch (err: any) {
    console.error("API ERROR:", err);
    return NextResponse.json(
      { error: "Server error", details: err.message || String(err) },
      { status: 500 }
    );
  }
}

