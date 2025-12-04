import { NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs";
import path from "path";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});

// load resume JSON
const resumePath = path.join(process.cwd(), "data", "resume.json");
const resume = JSON.parse(fs.readFileSync(resumePath, "utf8"));

export async function POST(req: Request) {
  try {
    const { jobDescription } = await req.json();

    if (!jobDescription) {
      return NextResponse.json({ error: "Missing jobDescription" }, { status: 400 });
    }

    const prompt = `
You are an expert resume writer...
(keep the same prompt from before)
    `;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    const content = completion.choices[0].message?.content;
    const parsed = JSON.parse(content);

    return NextResponse.json(parsed);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error", details: String(err) });
  }
}

