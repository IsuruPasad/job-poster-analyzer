import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { JobDetails } from "@/types/job";
import { JOB_CATEGORIES, matchCategory, matchRole, findCategoryByRole } from "@/lib/jobCategories";
import { DISTRICTS, matchDistrict, matchTown, findDistrictByTown } from "@/lib/locations";
import { JOB_TYPES, matchJobType } from "@/lib/jobTypes";
import { EDUCATION_LEVELS, matchEducation } from "@/lib/education";
import { isIsoDate } from "@/lib/date";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

function buildExtractionPrompt(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `You are an expert at reading job posting posters and extracting structured information from them. The poster content may be written in English, Sinhala, or Tamil — or a mix of these languages. Today's date is ${today} — use it to resolve any relative deadline ("within 2 weeks", "apply by end of this month") or a deadline missing its year.

Analyze the image carefully and extract the following details:

Return ONLY a valid JSON object (no markdown, no code blocks, no extra text) with this exact structure:
{
  "posterTitle": "A clean, professional English title for this job posting (generate/infer this)",
  "jobRole": "The single closest matching job role, copied EXACTLY (character-for-character) from the roles listed under the chosen jobCategory in the taxonomy below",
  "jobCategory": "The single closest matching category, copied EXACTLY (character-for-character) from the \"category\" names in the taxonomy below, or null if the job's industry/category truly cannot be determined from the poster",
  "locations": "An array of every distinct location this exact job is advertised for. Each entry is {\"district\": ..., \"town\": ...}, both chosen from the Sri Lanka district/town taxonomy below (or null if not determinable). Almost always a single-element array. Only include more than one entry when the poster explicitly lists multiple separate locations/branches hiring for this SAME role — never split a single address into multiple entries. Return [] if no location is mentioned at all.",
  "employerName": "Name of the company or employer",
  "employerWebsite": "Employer website URL if visible in the poster, or null if not mentioned",
  "description": "A structured 2-3 sentence professional job description summary generated from all details visible in the image",
  "jobType": "One of exactly these values: ${JOB_TYPES.join(", ")} — copied exactly, or null if not mentioned",
  "requiredExperience": "Work experience requirement (e.g. '2+ years', 'No experience required', 'Freshers welcome') or null if not mentioned",
  "requiredEducation": "The single closest matching education level, mapped from whatever the poster states (e.g. O/L -> Ordinary Level, A/L -> Advanced Level, Bachelor's/BSc/BA -> Degree, Master's/MSc/MBA -> Master, PhD -> Doctorate, HND/Higher National Diploma -> Higher Diploma) to one of exactly these values: ${EDUCATION_LEVELS.join(", ")} — copied exactly, or null if not mentioned",
  "salaryFrom": "The lower bound of the monthly salary range as stated (numbers/currency as shown, e.g. 'LKR 50,000'). If the poster gives a single fixed salary rather than a range, put it here. Null if no salary is mentioned",
  "salaryTo": "The upper bound of the monthly salary range as stated, or null if the poster gives only a single fixed salary (not a range) or no salary at all",
  "applicationDeadline": "Application deadline date converted to ISO format YYYY-MM-DD (e.g. 2025-06-30), or null if not mentioned or not resolvable to a full date"
}

Job category / job role taxonomy (JSON array of { category, roles }) — jobCategory and jobRole MUST be chosen from here:
${JSON.stringify(JOB_CATEGORIES)}

Sri Lanka district / town taxonomy (JSON array of { district, towns }) — each location's district and town MUST be chosen from here:
${JSON.stringify(DISTRICTS)}

Rules:
- If the image is NOT a job poster, or is too unclear to read, return exactly: {"error": "brief explanation of the issue"}
- jobCategory and jobRole must be copied exactly from the taxonomy above — never invent, translate, or reword them
- jobRole must be one of the roles listed under the chosen jobCategory in the taxonomy
- If a category's "roles" list is empty, use that category's exact name as the jobRole too
- Only set jobCategory to null if you genuinely cannot infer a suitable category — in that case still pick the closest matching jobRole from anywhere in the taxonomy
- Each location's "district" must be copied exactly from the district taxonomy above; "town" must be one of the towns listed under that district (or null if the poster only gives a district/area, not a specific town) — never invent or translate these
- The district/town taxonomy's town lists are NOT exhaustive (only popular main towns) — if the poster's town isn't in the list for its district, set town to null but still set district if it's determinable
- locations must always be a JSON array of {district, town} objects (never strings, never null) — use [] when no location is mentioned at all
- jobType must be copied exactly from its list above (e.g. "Contractual", not "Contract") — never invent a variation, and use null if the poster doesn't clearly indicate one of those exact types
- requiredEducation must be mapped to the closest exact value in its list above (e.g. "O/L" -> "Ordinary Level") — never return the poster's own wording or an abbreviation, and use null if no education requirement is mentioned or it doesn't map to any of those values
- salaryFrom/salaryTo: a stated range (e.g. "50,000 - 80,000") splits across both; a single fixed figure goes in salaryFrom only, with salaryTo null — never put a single figure in salaryTo alone
- applicationDeadline must be a full YYYY-MM-DD date — resolve day/month-only or relative deadlines using today's date above; if it can't be resolved to a specific date, use null rather than guessing
- For other fields not found in the poster, use null
- Translate any non-English content to English in your response
- posterTitle and description should always be generated in English
- Keep all extracted text faithful to what is shown, just translated to English (except jobCategory/jobRole/district/town/requiredEducation, which must match the taxonomies verbatim)`;
}

// Try models in order, fastest first — fall back to a heavier/older model only if one is
// unavailable (404, e.g. not enabled on this API key) or rate-limited (429). Flash-Lite tiers
// are built for exactly this kind of low-latency structured extraction task.
const MODELS = ["gemini-2.5-flash-lite", "gemini-2.0-flash-lite", "gemini-2.0-flash", "gemini-flash-latest"];

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
    const extractionPrompt = buildExtractionPrompt();

    for (const modelName of MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent([extractionPrompt, imagePart]);
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

    // Normalize the model's free-text category/role against the fixed taxonomy so the
    // form's cascading dropdowns always receive an exact, known pair (or a blank to fill in manually).
    let jobCategory = matchCategory(parsed.jobCategory as string | null);
    let jobRole = matchRole(jobCategory, parsed.jobRole as string | null);
    if (!jobRole) {
      const inferredCategory = findCategoryByRole(parsed.jobRole as string | null);
      if (inferredCategory) {
        jobCategory = inferredCategory;
        jobRole = matchRole(inferredCategory, parsed.jobRole as string | null);
      }
    }

    // Normalize each location's district/town against the fixed taxonomy, same treatment as
    // jobCategory/jobRole above: an exact match is kept, anything else falls back to null so
    // the form's dropdowns never receive a value outside the known list.
    const rawLocations = Array.isArray(parsed.locations) ? (parsed.locations as unknown[]) : [];
    const seenLocations = new Set<string>();
    const locations = rawLocations
      .filter((loc): loc is Record<string, unknown> => typeof loc === "object" && loc !== null)
      .map((loc) => {
        let district = matchDistrict(loc.district as string | null);
        let town = matchTown(district, loc.town as string | null);
        if (!town) {
          const inferredDistrict = findDistrictByTown(loc.town as string | null);
          if (inferredDistrict) {
            district = inferredDistrict;
            town = matchTown(inferredDistrict, loc.town as string | null);
          }
        }
        return { district, town };
      })
      .filter((loc) => loc.district || loc.town)
      .filter((loc) => {
        const key = `${loc.district ?? ""}|${loc.town ?? ""}`.toLowerCase();
        if (seenLocations.has(key)) return false;
        seenLocations.add(key);
        return true;
      });

    const jobData: JobDetails = {
      posterTitle: (parsed.posterTitle as string) || "Job Opportunity",
      jobRole: jobRole || "",
      jobCategory,
      locations,
      employerName: (parsed.employerName as string) || "Not specified",
      employerWebsite: (parsed.employerWebsite as string | null) ?? null,
      description: (parsed.description as string) || "",
      jobType: matchJobType(parsed.jobType as string | null),
      requiredExperience: (parsed.requiredExperience as string | null) ?? null,
      requiredEducation: matchEducation(parsed.requiredEducation as string | null),
      salaryFrom: (parsed.salaryFrom as string | null) ?? null,
      salaryTo: (parsed.salaryTo as string | null) ?? null,
      applicationDeadline: isIsoDate(parsed.applicationDeadline) ? parsed.applicationDeadline : null,
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
