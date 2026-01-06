import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs"; // Ensure we're using Node.js runtime

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

    // Initialize OpenAI client inside the function
    const client = new OpenAI({
      apiKey: apiKey,
    });
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Read PDF file as buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Use require for pdf-parse (works better in Next.js API routes)
    // pdf-parse v2.4+ uses ES modules but we can use require with the PDFParse class
    const pdfParseModule = require("pdf-parse");
    const PDFParse = pdfParseModule.PDFParse || pdfParseModule;
    
    // Create instance and get text
    const pdfParser = new PDFParse({ data: buffer });
    const pdfData = await pdfParser.getText();
    const extractedText = pdfData.text;

    if (!extractedText || extractedText.trim().length === 0) {
      return NextResponse.json(
        { error: "Could not extract text from PDF. Please ensure the PDF contains readable text." },
        { status: 400 }
      );
    }

    // Use OpenAI to extract structured data from the text
    const prompt = `
You are an expert at extracting structured data from resumes. 

Extract the resume information from the following text and convert it to JSON format.

RESUME TEXT:
${extractedText}

Return ONLY a JSON object with this exact structure:
{
  "name": "",
  "contact": {
    "phone": "",
    "email": "",
    "linkedin": "",
    "github": ""
  },
  "summary": "",
  "projects": [
    {
      "name": "",
      "date": "",
      "link": "",
      "bullets": []
    }
  ],
  "experience": [
    {
      "company": "",
      "role": "",
      "dates": "",
      "bullets": []
    }
  ],
  "education": [
    {
      "degree": "",
      "institution": "",
      "graduation_year": "",
      "gpa": ""
    }
  ],
  "skills": {
    "languages": [],
    "frameworks_libraries": [],
    "tools": []
  }
}

Extract all information accurately. If a field is not present, use an empty string or empty array.
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

    return NextResponse.json(parsed);

  } catch (err: any) {
    console.error("PARSE_RESUME ERROR:", err);
    const errorMessage = err.message || String(err);
    const errorStack = err.stack || "";
    console.error("Error stack:", errorStack);
    
    return NextResponse.json(
      { 
        error: "Server error", 
        details: errorMessage,
        // Include stack in development
        ...(process.env.NODE_ENV === "development" && { stack: errorStack })
      },
      { status: 500 }
    );
  }
}

