// What to extract from a job poster, and how to turn the model's reply into JobDetails.
// Provider-neutral: the same prompt and schema go to whichever model lib/ai selects.
import { JobDetails } from "@/types/job";
import { AIError } from "@/lib/ai";
import { JOB_CATEGORIES, matchCategory, matchRole, findCategoryByRole } from "@/lib/jobCategories";
import { getLocationTaxonomy, resolveLocation, type LocationData } from "@/lib/locations";
import { JOB_TYPES, matchJobType } from "@/lib/jobTypes";
import { EDUCATION_LEVELS, matchEducation } from "@/lib/education";
import { isIsoDate } from "@/lib/date";
import { DESCRIPTION_LANGUAGES, buildJobDescription, matchDescriptionLanguage } from "@/lib/jobDescription";

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: "null" }] });
const nullableString = nullable({ type: "string" });
const stringList = { type: "array", items: { type: "string" } };

// Content for the description template (lib/jobDescription.ts). Absent values are "" / [] rather
// than null, to keep the schema's union-type count down.
const DESCRIPTION_DETAILS_SCHEMA = {
  type: "object",
  properties: {
    language: { type: "string", enum: [...DESCRIPTION_LANGUAGES] },
    walkInInterview: { type: "boolean" },
    position: { type: "string" },
    qualifications: stringList,
    requirements: stringList,
    responsibilities: stringList,
    benefits: stringList,
    interviewDate: { type: "string" },
    interviewTime: { type: "string" },
    interviewLocation: { type: "string" },
    interviewAddress: { type: "string" },
    contactPhone: { type: "string" },
    email: { type: "string" },
    address: { type: "string" },
  },
  required: [
    "language",
    "walkInInterview",
    "position",
    "qualifications",
    "requirements",
    "responsibilities",
    "benefits",
    "interviewDate",
    "interviewTime",
    "interviewLocation",
    "interviewAddress",
    "contactPhone",
    "email",
    "address",
  ],
  additionalProperties: false,
};

// The provider guarantees the reply has exactly this shape. Free-text fields are still
// normalized against the category/location lists — the schema only pins down the small fixed enums.
export const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    error: nullableString,
    posterTitle: nullableString,
    jobRole: nullableString,
    jobCategory: nullableString,
    locations: {
      type: "array",
      items: {
        type: "object",
        properties: { district: nullableString, town: nullableString },
        required: ["district", "town"],
        additionalProperties: false,
      },
    },
    employerName: nullableString,
    employerWebsite: nullableString,
    descriptionDetails: DESCRIPTION_DETAILS_SCHEMA,
    jobType: nullable({ type: "string", enum: [...JOB_TYPES] }),
    requiredExperience: nullableString,
    requiredEducation: nullable({ type: "string", enum: [...EDUCATION_LEVELS] }),
    salaryFrom: nullableString,
    salaryTo: nullableString,
    applicationDeadline: nullableString,
  },
  required: [
    "error",
    "posterTitle",
    "jobRole",
    "jobCategory",
    "locations",
    "employerName",
    "employerWebsite",
    "descriptionDetails",
    "jobType",
    "requiredExperience",
    "requiredEducation",
    "salaryFrom",
    "salaryTo",
    "applicationDeadline",
  ],
  additionalProperties: false,
};

// ikman.lk's own district/town names, so the extracted location can be selected in the form
// and clicked in ikman.lk's posting UI as-is.
function locationListSection(locationData: LocationData | null): string {
  if (!locationData) {
    return `The Sri Lanka district/town list is unavailable right now — return "locations": [].`;
  }
  return `Sri Lanka district / town list from ikman.lk (JSON array of { district, towns }) — each location's district and town MUST be chosen from here:
${JSON.stringify(getLocationTaxonomy(locationData))}`;
}

/**
 * The extraction instructions. Same output for the same location data, so providers can cache it
 * — keep per-request values (today's date) in extractionPrompt() instead.
 */
export function buildExtractionSystemPrompt(locationData: LocationData | null): string {
  return `You are an expert at reading job posting posters and extracting structured information from them. The poster content may be written in English, Sinhala, or Tamil — or a mix of these languages. The user message gives today's date — use it to resolve any relative deadline ("within 2 weeks", "apply by end of this month") or a deadline missing its year.

Analyze the image carefully and fill in these fields:
{
  "error": "null for a readable job poster; otherwise a brief explanation of the issue (see Rules)",
  "posterTitle": "A clean, professional English title for this job posting (generate/infer this)",
  "jobRole": "The single closest matching job role, copied EXACTLY (character-for-character) from the roles listed under the chosen jobCategory in the taxonomy below",
  "jobCategory": "The single closest matching category, copied EXACTLY (character-for-character) from the \\"category\\" names in the taxonomy below, or null if the job's industry/category truly cannot be determined from the poster",
  "locations": "An array of every distinct location this exact job is advertised for. Each entry is {\\"district\\": ..., \\"town\\": ...}, both chosen from the Sri Lanka district/town list below (or null if not determinable). Almost always a single-element array. Only include more than one entry when the poster explicitly lists multiple separate locations/branches hiring for this SAME role — never split a single address into multiple entries. Return [] if no location is mentioned at all.",
  "employerName": "Name of the company or employer",
  "employerWebsite": "Employer website URL if visible in the poster, or null if not mentioned",
  "descriptionDetails": "The content of the ad's description, which the app lays out in a fixed template — see the descriptionDetails rules below",
  "jobType": "One of exactly these values: ${JOB_TYPES.join(", ")} — copied exactly, or null if not mentioned",
  "requiredExperience": "Work experience requirement (e.g. '2+ years', 'No experience required', 'Freshers welcome') or null if not mentioned",
  "requiredEducation": "The single closest matching education level, mapped from whatever the poster states (e.g. O/L -> Ordinary Level, A/L -> Advanced Level, Bachelor's/BSc/BA -> Degree, Master's/MSc/MBA -> Master, PhD -> Doctorate, HND/Higher National Diploma -> Higher Diploma) to one of exactly these values: ${EDUCATION_LEVELS.join(", ")} — copied exactly, or null if not mentioned",
  "salaryFrom": "The lower bound of the monthly salary range as stated (numbers/currency as shown, e.g. 'LKR 50,000'). If the poster gives a single fixed salary rather than a range, put it here. Null if no salary is mentioned",
  "salaryTo": "The upper bound of the monthly salary range as stated, or null if the poster gives only a single fixed salary (not a range) or no salary at all",
  "applicationDeadline": "Application deadline date converted to ISO format YYYY-MM-DD (e.g. 2025-06-30), or null if not mentioned or not resolvable to a full date"
}

Job category / job role taxonomy (JSON array of { category, roles }) — jobCategory and jobRole MUST be chosen from here:
${JSON.stringify(JOB_CATEGORIES)}

${locationListSection(locationData)}

Rules:
- If the image is NOT a job poster, or is too unclear to read, set "error" to a brief explanation of the issue, every other field to null, locations to [], and descriptionDetails' text fields to "" and lists to []. Otherwise "error" must be null
- jobCategory and jobRole must be copied exactly from the taxonomy above — never invent, translate, or reword them
- jobRole must be one of the roles listed under the chosen jobCategory in the taxonomy
- If a category's "roles" list is empty, use that category's exact name as the jobRole too
- Only set jobCategory to null if you genuinely cannot infer a suitable category — in that case still pick the closest matching jobRole from anywhere in the taxonomy
- Each location's "district" must be copied exactly from the district list above; "town" must be one of the towns listed under that district — never invent or translate these
- If the poster names only a district (no specific town or area), set town to null
- If the poster's town isn't listed under its district, set town to null but still set the district
- locations must always be a JSON array of {district, town} objects (never strings, never null) — use [] when no location is mentioned at all
- jobType must be copied exactly from its list above (e.g. "Contractual", not "Contract") — never invent a variation, and use null if the poster doesn't clearly indicate one of those exact types
- requiredEducation must be mapped to the closest exact value in its list above (e.g. "O/L" -> "Ordinary Level") — never return the poster's own wording or an abbreviation, and use null if no education requirement is mentioned or it doesn't map to any of those values
- salaryFrom/salaryTo: a stated range (e.g. "50,000 - 80,000") splits across both; a single fixed figure goes in salaryFrom only, with salaryTo null — never put a single figure in salaryTo alone
- applicationDeadline must be a full YYYY-MM-DD date — resolve day/month-only or relative deadlines using today's date; if it can't be resolved to a specific date, use null rather than guessing
- For other fields not found in the poster, use null
- Translate any non-English content to English in your response — every field outside descriptionDetails (including employerName) is in English; descriptionDetails follows its own language rule below
- posterTitle should always be generated in English
- Keep all extracted text faithful to what is shown, just translated to English (except jobCategory/jobRole/district/town/requiredEducation, which must match the lists verbatim)

descriptionDetails rules (the app adds the headings, emojis, bullet symbols and standard sentences itself, so return plain content only — no headings, emojis, bullet symbols or numbering):
- language: the main language of the poster — "English", "Sinhala" or "Tamil" (for a mixed-language poster, the one most of its text is written in)
- walkInInterview: true only if the poster invites candidates to come in person for an interview (a walk-in interview at a stated place and/or date), otherwise false
- Write every text value in descriptionDetails in that language: for Sinhala or Tamil keep the poster's own wording (don't translate it to English); for English, translate any Sinhala/Tamil parts to English
- position: the job title only, as the poster names it (e.g. "Heavy Vehicle Driver" / "බර වාහන රියදුරු") — not a headline like "Drivers wanted" / "රියදුරන් අවශ්‍යයි" / "ஓட்டுநர்கள் தேவை"
- qualifications: education and professional qualifications asked for (e.g. "Passed G.C.E. O/L", "NVQ Level 4 in Electrical", "A degree in Accounting"), one per item
- requirements: everything else asked of the candidate (experience, skills, age limit, languages, driving licence, etc.), one per item
- responsibilities: the duties of the job, one per item
- benefits: what the employer offers (salary, allowances, incentives, meals, accommodation, transport, EPF/ETF, etc.), one per item. Leave out generic phrases like "attractive salary package" — a standard benefits sentence is always added
- The lists hold only what the poster states, one short point per item — never invent points; use [] when the poster gives none
- interviewDate, interviewTime, interviewLocation (the venue's name), interviewAddress (the venue's address): as stated on the poster for a walk-in interview, in words rather than YYYY-MM-DD (e.g. "Saturday, 1st November 2026"), adding the year if the poster leaves it out (use today's date); "" if not stated or not a walk-in interview
- contactPhone: the phone/WhatsApp number(s) given for enquiries or applications, as written (separate several with " / "); email: the contact email; address: the employer's address — "" if not shown
- Never put the employer's website in descriptionDetails — it goes in employerWebsite`;
}

/** The per-request text sent alongside the poster image. */
export function extractionPrompt(today: string): string {
  return `Today's date is ${today}. Extract the job details from this poster.`;
}

/**
 * Validates and normalizes the model's reply. `error` is set when the model judged the image
 * unreadable/not a poster. Without location data, locations come back empty (manual entry).
 */
export function toJobDetails(raw: unknown, locationData: LocationData | null): { error: string } | { data: JobDetails } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new AIError("invalid_output", "The model's reply wasn't a JSON object.");
  }
  const parsed = raw as Record<string, unknown>;

  if (parsed.error) {
    return { error: String(parsed.error) };
  }

  const employerWebsite = (parsed.employerWebsite as string | null) ?? null;

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

  // Map each extracted location onto ikman.lk's exact district/town names (see resolveLocation):
  // a town brings its parent district along; a district alone also selects its district-named
  // town when ikman.lk has one; anything unknown falls back to null (manual entry).
  const rawLocations = Array.isArray(parsed.locations) ? (parsed.locations as unknown[]) : [];
  const seenLocations = new Set<string>();
  const locations = (locationData ? rawLocations : [])
    .filter((loc): loc is Record<string, unknown> => typeof loc === "object" && loc !== null)
    .map((loc) => resolveLocation(locationData as LocationData, { district: loc.district as string | null, town: loc.town as string | null }))
    .filter((loc) => loc.district || loc.town)
    .filter((loc) => {
      const key = `${loc.district ?? ""}|${loc.town ?? ""}`.toLowerCase();
      if (seenLocations.has(key)) return false;
      seenLocations.add(key);
      return true;
    });

  return {
    data: {
      posterTitle: (parsed.posterTitle as string) || "Job Opportunity",
      jobRole: jobRole || "",
      jobCategory,
      locations,
      employerName: (parsed.employerName as string) || "Not specified",
      employerWebsite,
      description: toDescription(parsed.descriptionDetails, {
        position: jobRole || (parsed.posterTitle as string) || "",
        website: employerWebsite ?? "",
      }),
      jobType: matchJobType(parsed.jobType as string | null),
      requiredExperience: (parsed.requiredExperience as string | null) ?? null,
      requiredEducation: matchEducation(parsed.requiredEducation as string | null),
      salaryFrom: (parsed.salaryFrom as string | null) ?? null,
      salaryTo: (parsed.salaryTo as string | null) ?? null,
      applicationDeadline: isIsoDate(parsed.applicationDeadline) ? parsed.applicationDeadline : null,
      applicationPhone: null,
    },
  };
}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const textList = (value: unknown) => (Array.isArray(value) ? value.map(text).filter(Boolean) : []);

/**
 * Renders the description template from the model's descriptionDetails. Missing pieces just drop
 * their lines; an unknown language falls back to the English template.
 */
function toDescription(raw: unknown, fallback: { position: string; website: string }): string {
  const d = typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return buildJobDescription({
    language: matchDescriptionLanguage(d.language) ?? "English",
    walkInInterview: d.walkInInterview === true,
    position: text(d.position) || fallback.position,
    qualifications: textList(d.qualifications),
    requirements: textList(d.requirements),
    responsibilities: textList(d.responsibilities),
    benefits: textList(d.benefits),
    interviewDate: text(d.interviewDate),
    interviewTime: text(d.interviewTime),
    interviewLocation: text(d.interviewLocation),
    interviewAddress: text(d.interviewAddress),
    contactPhone: text(d.contactPhone),
    email: text(d.email),
    website: fallback.website,
    address: text(d.address),
  });
}
