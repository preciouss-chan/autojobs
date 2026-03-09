import { NextResponse } from "next/server";
import OpenAI from "openai";
import { checkRateLimit, RATE_LIMIT_PRESETS, getIdentifierFromRequest } from "@/lib/rate-limit";
import { ChatResponseSchema, ErrorResponseSchema } from "@/app/lib/schemas";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  try {
    // Apply rate limiting using IP-based identifier
    const identifier = getIdentifierFromRequest(req);
    const rateLimitResult = checkRateLimit(
      identifier,
      "chat",
      RATE_LIMIT_PRESETS.CHAT.limit,
      RATE_LIMIT_PRESETS.CHAT.windowMs
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

    // Get API key from header or fallback to environment variable
    const apiKey = req.headers.get("X-OpenAI-API-Key") || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        ErrorResponseSchema.parse({
          error: "OpenAI API key is required. Please set it in extension settings or environment variable.",
        }),
        { status: 401 }
      );
    }

    const client = new OpenAI({
      apiKey: apiKey,
    });

    const { message, jobDescription, resume, chatHistory } = await req.json();

    // Validate required message field
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json(
        ErrorResponseSchema.parse({
          error: "Message is required and must be a non-empty string",
        }),
        { status: 400 }
      );
    }

    // Build system prompt with context
    const candidateName = resume?.name || "the candidate";
    
    let systemPrompt = `You are ${candidateName}, a job applicant. You will answer application questions AS IF YOU ARE THIS PERSON.

CRITICAL: Write EVERYTHING in FIRST PERSON. The user will copy-paste your answers directly. Use "I", "my", "me".`;
    
    if (jobDescription) {
      systemPrompt += `

=== THE JOB I'M APPLYING FOR ===
${jobDescription.substring(0, 3000)}
=== END JOB DESCRIPTION ===`;
    }
    
    if (resume) {
      systemPrompt += `

=== MY BACKGROUND (USE THIS DATA IN EVERY RESPONSE) ===
Name: ${candidateName}`;
      if (resume.contact) {
        systemPrompt += `\nEmail: ${resume.contact.email || ""}`;
      }
      if (resume.summary) {
        systemPrompt += `\nSummary: ${resume.summary}`;
      }
      if (resume.education && resume.education.length > 0) {
        systemPrompt += `\n\nEducation:`;
        resume.education.forEach((edu: any) => {
          systemPrompt += `\n- ${edu.degree || ""} from ${edu.institution || ""}${edu.graduation_year ? ` (graduating ${edu.graduation_year})` : ""}${edu.gpa ? `, GPA: ${edu.gpa}` : ""}`;
        });
      }
      if (resume.experience && resume.experience.length > 0) {
        systemPrompt += `\n\nMy Work Experience:`;
        resume.experience.forEach((exp: any) => {
          systemPrompt += `\n\n${exp.role} at ${exp.company} (${exp.dates || ""})`;
          if (exp.bullets && exp.bullets.length > 0) {
            exp.bullets.forEach((bullet: string) => {
              systemPrompt += `\n  • ${bullet}`;
            });
          }
        });
      }
      if (resume.projects && resume.projects.length > 0) {
        systemPrompt += `\n\nMy Projects:`;
        resume.projects.forEach((proj: any) => {
          systemPrompt += `\n\n${proj.name}${proj.date ? ` (${proj.date})` : ""}`;
          if (proj.bullets && proj.bullets.length > 0) {
            proj.bullets.forEach((bullet: string) => {
              systemPrompt += `\n  • ${bullet}`;
            });
          }
        });
      }
      if (resume.skills) {
        systemPrompt += `\n\nMy Technical Skills:`;
        if (resume.skills.languages && resume.skills.languages.length > 0) {
          systemPrompt += `\n- Languages: ${resume.skills.languages.join(", ")}`;
        }
        if (resume.skills.frameworks_libraries && resume.skills.frameworks_libraries.length > 0) {
          systemPrompt += `\n- Frameworks: ${resume.skills.frameworks_libraries.join(", ")}`;
        }
        if (resume.skills.tools && resume.skills.tools.length > 0) {
          systemPrompt += `\n- Tools: ${resume.skills.tools.join(", ")}`;
        }
      }
      systemPrompt += `\n=== END MY BACKGROUND ===`;
    }
    
    systemPrompt += `

HOW TO ANSWER:
1. ALWAYS use first person ("I built...", "My experience at...", "I'm excited about...")
2. ALWAYS mention SPECIFIC projects/experiences from MY BACKGROUND above by name
3. ALWAYS reference SPECIFIC details from the job description (company name, technologies, requirements)
4. Be conversational and genuine - sound like a real person talking
5. Keep answers 2-5 sentences unless the question needs more detail
6. Connect MY specific experience to THEIR specific requirements

EXAMPLES OF GOOD ANSWERS:
- "I'm excited about this role because I see you're using React and Python - I built Apply Boost using exactly that stack..."
- "At Dreamscape Learn, I operated VR systems for 200+ students daily, which taught me..."
- "My Rizz Chatbot project involved fine-tuning GPT-3.5, which directly relates to your AI requirements..."

NEVER give generic answers. ALWAYS be specific with names, numbers, and details from my background.`;

    // Build messages array
    const messages: any[] = [
      { role: "system", content: systemPrompt }
    ];

    // Add chat history (last few messages for context)
    if (chatHistory && chatHistory.length > 0) {
      // Only add last 6 messages (3 exchanges) to keep context manageable
      const recentHistory = chatHistory.slice(-6);
      messages.push(...recentHistory);
    }

    // Add current message
    messages.push({ role: "user", content: message });

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      temperature: 0.4, // Lower for more deterministic interview answers
      max_tokens: 600, // Increased for more detailed answers
    });

    const assistantMessage =
      response.choices[0]?.message?.content ||
      "I apologize, but I couldn't generate a response.";

    try {
      const validated = ChatResponseSchema.parse({
        response: assistantMessage,
        has_context: !!jobDescription,
      });
      return NextResponse.json(validated);
    } catch (parseErr: unknown) {
      console.error("Failed to validate chat response:", parseErr);
      return NextResponse.json(
        ErrorResponseSchema.parse({
          error: "Failed to process chat response",
          details:
            parseErr instanceof Error ? parseErr.message : String(parseErr),
        }),
        { status: 500 }
      );
    }

  } catch (err: unknown) {
    console.error("Chat API ERROR:", err);
    const errorMessage =
      err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      ErrorResponseSchema.parse({
        error: "Server error",
        details: errorMessage,
      }),
      { status: 500 }
    );
  }
}

