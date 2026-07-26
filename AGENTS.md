<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project: Job Poster Analyzer

Next.js (App Router) + TypeScript + Tailwind app that turns a photo of a job-posting poster (English, Sinhala, or Tamil) into structured job-listing data, using Gemini vision, then lets a human review/correct the result in a form before (eventually) posting it.

## Request flow

1. `app/page.tsx` — user uploads a poster image (`app/components/ImageUploader.tsx`), then POSTs it to `/api/extract`.
2. `app/api/extract/route.ts` — sends the (client-resized, see Performance below) image + a prompt to Gemini, trying models fastest-first through `MODELS` and falling back on 404/429, parses the JSON reply into a `JobDetails` object, normalizes `jobCategory`/`jobRole` against the taxonomy (see below), and returns it.
3. The client stores the result in `sessionStorage` (`jobData`, `extractionSuccess`, `extractionError`) and navigates to `/job-form`.
4. `app/job-form/page.tsx` — reads `sessionStorage`, renders an editable form pre-filled with the extracted data. If the poster advertises the same role across multiple locations, one tab per location is shown (see below); otherwise the form renders directly with no tabs. Fields the AI couldn't determine are highlighted green and left for manual entry. **The "Post Job" submit button is currently a no-op placeholder** — there is no backend persistence yet.

There is no database — `sessionStorage` is the only state between the two pages.

## Directory map

- `app/page.tsx` — upload screen.
- `app/api/extract/route.ts` — Gemini call + response validation/normalization. Extraction prompt lives here.
- `app/job-form/page.tsx` — editable review form: owns the top-level state (an array of per-location field maps, `jobForms`), the location tab bar, and the extraction-status banners.
- `app/job-form/JobLocationForm.tsx` — the actual "About the Job" + "About the Employer" fields (category/role dropdowns, location, title, description, etc.) for ONE location. Rendered once per tab — this is the piece that must stay identical across tabs; per-location differences come entirely from the `data`/`onChange` props passed in, not from the component itself.
- `app/components/ImageUploader.tsx`, `Loader.tsx`, `ErrorAlert.tsx` — upload page UI pieces.
- `app/components/JobDetailsCard.tsx` — a read-only summary card component. **Currently unused/unwired** (not imported anywhere) — don't assume it's live UI.
- `types/job.ts` — the `JobDetails` shape shared by the API and the form; also `ApiResponse`/`ExtractResponse`/`ExtractErrorResponse`.
- `data/job-categories.json` — the job category ⇄ job role taxonomy (see below).
- `lib/jobCategories.ts` — typed helpers over that JSON.
- `data/sri-lanka-locations.json` — the district ⇄ town taxonomy (see below).
- `lib/locations.ts` — typed helpers over that JSON.
- `lib/jobTypes.ts` — the fixed Job Type list (see below). Plain constant, not JSON-backed — it's a small closed enum, not something expected to need external editing the way categories/locations are.
- `lib/education.ts` — the fixed Required Education level list (see below). Same plain-constant treatment as `lib/jobTypes.ts`.

## Domain: job category / job role taxonomy

Ikman-style job listings must have a job category, and (usually) a job role that belongs to that category — it's a fixed two-level hierarchy, not free text.

- **Source of truth:** `data/job-categories.json` — an array of `{ category: string, roles: string[] }`. `roles` is `[]` for categories that have no distinct sub-roles (e.g. "Cashier", "Cleaner", "Supervisor"); in that case the category name itself is the only valid role.
- **Helpers:** `lib/jobCategories.ts` exports `getCategoryNames()`, `getRolesForCategory(category)`, `matchCategory(input)`, `matchRole(category, input)`, `findCategoryByRole(role)`. These do case-insensitive matching and return the canonical spelling from the JSON.
- **To add/rename/remove a category or role:** edit `data/job-categories.json` only. Both the extraction prompt (`app/api/extract/route.ts`) and the form dropdowns (`app/job-form/page.tsx`) read this file live — nothing else needs to change.
- **Rule for any code touching category/role:** never hardcode a category or role list inline anywhere else in the app — always go through `lib/jobCategories.ts` / `data/job-categories.json`, and always validate/normalize a category or role against this taxonomy before trusting it (an AI extraction or a stale cached value can contain a value outside the list — treat a non-match as "unknown", not an error).
- In the UI, the Job Role `<select>` is populated from the currently selected Job Category and is disabled/empty until a category is chosen.

## Domain: district / town taxonomy (location)

Location is captured as two cascading levels, same pattern as job category/role: **L1 = district** (one of Sri Lanka's 25 administrative districts), **L2 = town** (a popular main town/area within that district — NOT exhaustive, just the well-known ones).

- **Source of truth:** `data/sri-lanka-locations.json` — an array of `{ district: string, towns: string[] }`. `towns` lists only popular main towns per district; if a poster's actual town isn't listed, `town` is left `null`/unset rather than adding one-off entries to the taxonomy.
- **Helpers:** `lib/locations.ts` exports `getDistrictNames()`, `getTownsForDistrict(district)`, `matchDistrict(input)`, `matchTown(district, input)`, `findDistrictByTown(town)` — same shape and case-insensitive-match behavior as `lib/jobCategories.ts`.
- **To add/rename a district or town:** edit `data/sri-lanka-locations.json` only. Both the extraction prompt (`app/api/extract/route.ts`) and the form's District/Town dropdowns (`app/job-form/JobLocationForm.tsx`) read this file live.
- **Rule for any code touching district/town:** never hardcode a district or town list elsewhere — always go through `lib/locations.ts` / `data/sri-lanka-locations.json`, and always validate/normalize against this taxonomy before trusting a value (same "unknown, not an error" treatment as job category/role).
- In the UI, the Town `<select>` is populated from the currently selected District and is disabled/empty until a district is chosen.

## Domain: job type

Job Type is a fixed 5-value enum (not a taxonomy needing future growth), sourced once from `lib/jobTypes.ts`: `JOB_TYPES = ["Full Time", "Part Time", "Contractual", "Internship", "Temporary"]`, plus `matchJobType(input)` for the same case-insensitive-match-or-null normalization used everywhere else. Rendered as a plain `<select>` (via `JobLocationForm`'s generic `type: "select"` field support in `ABOUT_JOB_FIELDS`) — no cascading dependency, unlike category/role or district/town. An unmatched/unmentioned value normalizes to `null`/blank (green, needs manual selection), never a free-text value outside these 5.

## Domain: required education

Required Education is the same kind of fixed enum as Job Type, sourced from `lib/education.ts`: `EDUCATION_LEVELS = ["Ordinary Level", "Advanced Level", "Certificate", "Diploma", "Higher Diploma", "Degree", "Master", "Doctorate", "Skilled Apprentice"]`, plus `matchEducation(input)`. Also a plain `<select>` via `ABOUT_JOB_FIELDS`'s generic `type: "select"` support. The extraction prompt explicitly maps common poster wording/abbreviations to these values (e.g. "O/L" -> "Ordinary Level", "Bachelor's/BSc" -> "Degree", "PhD" -> "Doctorate") rather than asking Gemini to invent its own phrasing — anything that doesn't map cleanly normalizes to `null`/blank.

## Domain: salary range

Salary is captured as a range, not one free-text field: `JobDetails.salaryFrom` / `salaryTo` (`types/job.ts`, both `string | null`). A stated range splits across both; a single fixed figure (not a range) goes in `salaryFrom` only, `salaryTo` stays `null` — never the reverse. Rendered as two side-by-side text inputs via `JobLocationForm`'s generic `type: "range"` field support (`ABOUT_JOB_FIELDS`, `rangeIds: [fromId, toId]`) — no fixed value list here (unlike Job Type/Education), just free text, since salary figures/currency vary too much to enumerate.

## Domain: application deadline (date picker)

`applicationDeadline` (`types/job.ts`) is stored as an ISO `YYYY-MM-DD` string or `null` — the exact format a native `<input type="date">` requires to display a value and open the browser's calendar picker. `lib/date.ts` exports `isIsoDate(value)`, used both server-side (`app/api/extract/route.ts`, to null out anything Gemini returns that isn't already exact ISO) and client-side (`app/job-form/page.tsx`, same defensive check on load). The extraction prompt is given today's date at request time (computed per-request in `buildExtractionPrompt()`, not baked in at module load) so it can resolve relative deadlines ("within 2 weeks") or a day/month stated without a year; if it can't resolve a full date, it must return `null` rather than guess. Rendered via `JobLocationForm`'s `type: "date"` field support (`ABOUT_JOB_FIELDS`) — a plain native date input, no custom calendar widget.

## Domain: multi-location job postings

A single poster can advertise the same role across several branches/cities (e.g. "Cashier needed — Colombo, Kandy, Galle"). `JobDetails.locations: JobLocation[]` (`types/job.ts`, `JobLocation = { district: string | null; town: string | null }`) holds every distinct location the extraction detected — `[]` if none, one entry for the normal single-location case, multiple entries when the poster explicitly lists more than one.

- `app/api/extract/route.ts` asks Gemini for `locations` as an array of `{district, town}` objects (both chosen from the district/town taxonomy above) and is explicit that a single address should never be split into multiple entries — only genuinely separate branches/cities count.
- `app/job-form/page.tsx` turns `locations` into one flat field-map per location (`jobForms: Record<string, string>[]`), all seeded from the same extracted data except `district`/`town`. When there's more than one, a pill-style tab bar (tab label = that location's live `town` value, falling back to `district`) is rendered above the form and the currently active tab's field map is what's shown/edited.
- `app/job-form/JobLocationForm.tsx` is the single definition of what a location's form looks like — every tab renders this same component against its own slice of `jobForms`, so per-location edits (e.g. a different salary at one branch, or picking a different district/town) never leak into other tabs. Don't fork this component per-tab or duplicate its JSX inline in the page — add fields here and every tab picks it up.
- Employer info (name/website) is part of each location's field map too (per the page's current field layout), so it's independently editable per tab, not shared globally.
- **Poster title format:** each tab's `posterTitle` is generated client-side in `app/job-form/page.tsx` as `"{jobRole} - {town || district}"` (e.g. "Accounts Assistant - Colombo"), or just `jobRole` when that tab has no district/town. This overrides Gemini's own free-text title whenever jobRole matched the taxonomy; Gemini's original title is kept only as a fallback for the (rare) case jobRole didn't match anything. This only runs once at load time — editing jobRole/district/town afterward does not regenerate the title, so a manual edit to the Title field is never clobbered.

## Performance: extraction latency

Two deliberate levers keep the image-to-JSON round trip fast:

- **Client-side image downscaling** (`lib/image.ts`, called from `app/page.tsx` right before upload): phone-camera poster photos are downscaled to a max 1600px on the long edge (JPEG, quality 0.85) before ever leaving the browser — vision-model latency (and upload time) scales with image size, and poster text stays legible well below typical raw photo resolutions. Falls back to the original file untouched if decoding fails (e.g. most browsers can't decode HEIC via `createImageBitmap`) or the image is already small enough — never blocks the upload.
- **`MODELS` in `app/api/extract/route.ts` is ordered fastest-first**, not just by fallback preference: `gemini-2.5-flash-lite` (Google's low-latency tier, built for exactly this kind of simple structured extraction) is tried first, falling back through `gemini-2.0-flash-lite` → `gemini-2.0-flash` → `gemini-flash-latest` only on 404 (model unavailable on this key) or 429 (rate-limited). If revisiting this list, prefer whatever Google's current lowest-latency Flash-Lite tier is — check `ai.google.dev` for the current model lineup, since naming shifts over time (e.g. 2.5 → 3.x Flash-Lite).
- **Heads up, not yet acted on:** `@google/generative-ai` (this project's Gemini SDK, `package.json`) was declared end-of-life in August 2025 in favor of the unified `@google/genai` package — it still works (Google's backend stays wire-compatible), but gets no further bug fixes. Worth migrating eventually, but it's a separate, riskier change from the above (different import/call surface) and wasn't part of the speed work that added this note.

## Environment & running

- Node version is pinned in `.nvmrc` (currently 24.x) — `npm run lint` / `npm run build` fail with a cryptic `SyntaxError` under an older Node picked up by a stale shell. Run `nvm use` first if lint/build errors look like a parser crash rather than a real lint/type error.
- Requires `GEMINI_API_KEY` in `.env.local` (git-ignored).
- `npm run dev` / `npm run build` / `npm run lint` are the standard scripts (see `package.json`).
