import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { JobDetails } from "@/types/job";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const EXTRACTION_PROMPT = `You are an expert at reading job posting posters and extracting structured information from them. The poster content may be written in English, Sinhala, or Tamil — or a mix of these languages.

Analyze the image carefully and extract the following details:

Return ONLY a valid JSON object (no markdown, no code blocks, no extra text) with this exact structure:
{
  "posterTitle": "A clean, professional English title for this job posting (generate/infer this)",
  "jobRole": "The specific job position/role being advertised",
  "jobCategory": "The industry/category this job belongs to (e.g. 'IT & Software', 'Sales & Marketing', 'Healthcare', 'Construction', 'Education', 'Finance', 'Hospitality') or null if not determinable",
  "location": "The job location or city/district mentioned, or null if not mentioned",
  "employerName": "Name of the company or employer",
  "employerWebsite": "Employer website URL if visible in the poster, or null if not mentioned",
  "description": "A structured 2-3 sentence professional job description summary generated from all details visible in the image",
  "jobType": "One of: Full Time, Part Time, Internship, Contract, or null if not mentioned",
  "requiredExperience": "Work experience requirement (e.g. '2+ years', 'No experience required', 'Freshers welcome') or null if not mentioned",
  "requiredEducation": "Education requirement (e.g. 'O/L', 'A/L', 'Diploma', 'Bachelor's Degree', 'HND') or null if not mentioned",
  "salary": "Salary information as stated in the poster, or null if not mentioned",
  "applicationDeadline": "Application deadline date as stated, or null if not mentioned"
}

Rules:
- If the image is NOT a job poster, or is too unclear to read, return exactly: {"error": "brief explanation of the issue"}
- For fields not found in the poster, use null
- Translate any non-English content to English in your response
- posterTitle and description should always be generated in English
- Keep all extracted text faithful to what is shown, just translated to English`;

// Try models in order — fall back if one is unavailable or rate-limited
const MODELS = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-flash-latest"];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No image provided." },
        { status: 400 }
      );
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: "Unsupported file type. Please upload a JPEG, PNG, or WebP image." },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "Image too large. Please upload an image smaller than 10MB." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    const imagePart = {
      inlineData: {
        mimeType: file.type as string,
        data: base64,
      },
    };

    let lastError: Error | null = null;
    let text: string | null = null;

    for (const modelName of MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent([EXTRACTION_PROMPT, imagePart]);
        text = result.response.text().trim();
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const msg = lastError.message;
        // Only try next model on not-found or rate-limit errors
        if (msg.includes("404") || msg.includes("not found") || msg.includes("429")) {
          continue;
        }
        throw lastError;
      }
    }

    if (!text) {
      const msg = lastError?.message ?? "";
      if (msg.includes("429") || msg.includes("quota") || msg.includes("Too Many Requests")) {
        return NextResponse.json(
          { success: false, error: "AI service rate limit reached. Please wait a moment and try again." },
          { status: 429 }
        );
      }
      throw lastError;
    }

    let parsed: Record<string, unknown>;
    try {
      // Strip markdown code blocks if Gemini wraps the response
      const cleaned = text.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { success: false, error: "Failed to parse AI response. Please try again." },
        { status: 500 }
      );
    }

    if (parsed.error) {
      return NextResponse.json(
        { success: false, error: parsed.error as string },
        { status: 422 }
      );
    }

    const jobData: JobDetails = {
      posterTitle: (parsed.posterTitle as string) || "Job Opportunity",
      jobRole: (parsed.jobRole as string) || "Not specified",
      jobCategory: (parsed.jobCategory as string | null) ?? null,
      location: (parsed.location as string | null) ?? null,
      employerName: (parsed.employerName as string) || "Not specified",
      employerWebsite: (parsed.employerWebsite as string | null) ?? null,
      description: (parsed.description as string) || "",
      jobType: (parsed.jobType as string | null) ?? null,
      requiredExperience: (parsed.requiredExperience as string | null) ?? null,
      requiredEducation: (parsed.requiredEducation as string | null) ?? null,
      salary: (parsed.salary as string | null) ?? null,
      applicationDeadline: (parsed.applicationDeadline as string | null) ?? null,
    };

    return NextResponse.json({ success: true, data: jobData });
  } catch (err: unknown) {
    console.error("Extraction error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";

    if (message.includes("API_KEY") || message.includes("PERMISSION_DENIED")) {
      return NextResponse.json(
        { success: false, error: "Invalid or missing Gemini API key. Please check your configuration." },
        { status: 500 }
      );
    }

    if (message.includes("429") || message.includes("quota") || message.includes("Too Many Requests")) {
      return NextResponse.json(
        { success: false, error: "AI service rate limit reached. Please wait a moment and try again." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { success: false, error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
