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
4. `app/job-form/page.tsx` — reads `sessionStorage`, renders an editable form pre-filled with the extracted data. If the poster advertises the same role across multiple locations, one tab per location is shown (see below); otherwise the form renders directly with no tabs. Fields the AI couldn't determine are highlighted green and left for manual entry.
5. Before posting, the user clicks "Authenticate", which POSTs the entered email/password to `app/api/ikman-auth/route.ts` (proxying ikman.lk's real `POST /data/sessions`) — see "Domain: Ikman.lk login credentials" below. "Post Job" stays disabled until this succeeds.
6. "Post Job" POSTs `{ job: jobForms[activeTabIndex], credentials, session }` to `app/api/post-listing/route.ts`, which calls `lib/ikman.ts`'s `postIkmanListing` — a direct server-side call to ikman.lk's real `POST /data/post_listings`, using the bearer token from step 5. See "Domain: posting to ikman.lk" below for the payload mapping and its known gaps (category/location id lookup is unconfigured until `data/ikman-category-map.json`/`data/ikman-location-map.json` are filled in).

There is no database — `sessionStorage` is the only state between the two pages. The Ikman.lk login (email/password) is kept in React state only, never written to `sessionStorage`.

## Directory map

- `app/page.tsx` — upload screen.
- `app/api/extract/route.ts` — Gemini call + response validation/normalization. Extraction prompt lives here.
- `app/job-form/page.tsx` — editable review form: owns the top-level state (an array of per-location field maps, `jobForms`), the location tab bar, and the extraction-status banners.
- `app/job-form/JobLocationForm.tsx` — the actual "About the Job" + "About the Employer" fields (category/role dropdowns, location, title, description, etc.) for ONE location. Rendered once per tab — this is the piece that must stay identical across tabs; per-location differences come entirely from the `data`/`onChange` props passed in, not from the component itself.
- `app/components/ImageUploader.tsx`, `Loader.tsx`, `ErrorAlert.tsx` — upload page UI pieces.
- `app/components/JobDetailsCard.tsx` — a read-only summary card component. **Currently unused/unwired** (not imported anywhere) — don't assume it's live UI.
- `types/job.ts` — the `JobDetails` shape shared by the API and the form; also `ApiResponse`/`ExtractResponse`/`ExtractErrorResponse`.
- `types/auth.ts` — `IkmanCredentials` (email/password) and `IkmanSession` (bearer token from login), see "Domain: Ikman.lk login credentials" and "Domain: posting to ikman.lk" below.
- `app/api/ikman-auth/route.ts` — server-side proxy to ikman.lk's real `POST /data/sessions`, called by the "Authenticate" button.
- `app/api/post-listing/route.ts` — receives `{ job, credentials, session }` from the "Post Job" button and calls `lib/ikman.ts`'s `postIkmanListing`.
- `lib/ikman.ts` — the ikman.lk API client: `authenticateIkman`, `buildAdPayload`, `postIkmanListing`. Both real ikman.lk endpoints (`/data/sessions`, `/data/post_listings`) are called from here only.
- `lib/ikmanMapping.ts` / `data/ikman-category-map.json` / `data/ikman-location-map.json` — our taxonomy names -> ikman.lk's numeric category/location ids, plus the `slugify` used for enum properties. See "Domain: posting to ikman.lk" below.
- `app/api/post-job/route.ts` / `automation/postJob.ts` / `automation/run.ts` / `automation/config/` — the earlier Playwright-based automation (see "Automation (superseded)" below). **No longer called by the UI** — `app/job-form/page.tsx` posts via `lib/ikman.ts`'s direct API client instead. Left in place, not deleted, in case a browser-driven fallback is wanted later.
- `data/job-categories.json` — the job category ⇄ job role taxonomy (see below).
- `lib/jobCategories.ts` — typed helpers over that JSON.
- `data/sri-lanka-locations.json` — the district ⇄ town taxonomy (see below).
- `lib/locations.ts` — typed helpers over that JSON.
- `lib/jobTypes.ts` — the fixed Job Type list (see below). Plain constant, not JSON-backed — it's a small closed enum, not something expected to need external editing the way categories/locations are.
- `lib/education.ts` — the fixed Required Education level list (see below). Same plain-constant treatment as `lib/jobTypes.ts`.
- `lib/phone.ts` — Sri Lankan phone number validation (see below).

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

## Domain: application phone number

`applicationPhone` (`types/job.ts`, `string | null`) is the phone number applicants should call — unlike every other field, it is **never extracted from the poster**: `app/api/extract/route.ts` always sets it to `null`, and the extraction prompt doesn't ask Gemini for it at all. It's always manual entry, which is also why it's never given special-case normalization the way jobType/education/date are — there's no AI value to normalize, just a blank field that's always green until filled in.

- Rendered via `JobLocationForm`'s `type: "tel"` field support (`ABOUT_JOB_FIELDS`), one text input per location tab (same per-location independence as employer name/website — see multi-location section below).
- **Validation:** `lib/phone.ts` exports `isValidSriLankanPhone(value)` — accepts local format (`0` + 9 digits, e.g. `0771234567`) or international format (`+94` + 9 digits, e.g. `+94771234567`), first digit after the prefix non-zero; spaces/dashes are stripped before matching. This is a general format check (mobile + landline), not carrier/prefix-specific.
- A non-empty value that fails validation shows a red border + inline error message (`JobLocationForm.tsx`) instead of the green "needs manual entry" style — `fieldClasses(id, invalid)` takes an `invalid` override for this. Validation is advisory only — it doesn't block form submission.

## Domain: Ikman.lk login credentials

`app/job-form/page.tsx` has its own "Ikman.lk Login" section rendered once at the top of the `<form>`, above the location tabs — a single `credentials: IkmanCredentials` (`types/auth.ts`, `{ email, password }`) state, **not** part of `jobForms`. Unlike every per-location field, this is genuinely global to the page: the same login is used no matter which location tab is active or submitted.

- Kept in plain React state, initialized blank on every page load — **never written to `sessionStorage`** (unlike `jobForms`), since it holds a plaintext password. Re-entering it is required after a full page reload/navigation away; this is intentional, not a bug to fix.
- Rendered directly in `app/job-form/page.tsx` (not `JobLocationForm.tsx`, since it isn't per-location): an `email` input (`type="email"`) validated with `lib/email.ts`'s `isValidEmail(value)`, and a `password` input (`type="password"`, no format validation). Same green-while-empty / red-while-invalid visual convention as the rest of the form, via a small `credentialFieldClasses` helper local to `page.tsx` (deliberately not shared with `JobLocationForm.tsx`'s `fieldClasses` — different props shape, and only two fields need it here).
- **Authenticate button:** below the two inputs, a "Authenticate" button (disabled while empty/invalid-email/in-flight) calls `handleAuthenticate`, which POSTs `{ identifier: credentials.email, password: credentials.password }` to `app/api/ikman-auth/route.ts`. That route proxies ikman.lk's real `POST https://ikman.lk/data/sessions` with body `{"session":{"identifier","password"}}` (server-side, so the browser never talks to ikman.lk directly and the password never appears in client network logs) and returns `{ success, session }` or `{ success: false, error }`.
- `authStatus` (`"idle" | "authenticating" | "success" | "error"`) drives the UI: an inline red error banner (`authError`) on failure, a green "Authenticated" checkmark on success. **"Post Job" is `disabled` unless `authStatus === "success"`** — this is the actual gate, not just a visual hint.
- Editing either the email or password field after authenticating resets `authStatus` back to `"idle"` (and clears `authSession`) — a stale success flag must not survive a credentials change, since it was validated against the old value.
- `authSession: IkmanSession | null` (`{ token, accountId? }`) holds the bearer token from a successful `/api/ikman-auth` call and is sent as `session` in the `/api/post-listing` request body on submit — see "Domain: posting to ikman.lk" below for how it's used.

## Domain: posting to ikman.lk (direct API)

`lib/ikman.ts`'s `postIkmanListing(job, credentials, session)` POSTs directly to ikman.lk's real `POST https://ikman.lk/data/post_listings` with `Authorization: Bearer <session.token>` — reverse-engineered from one captured browser request while posting a job ad, so several parts are best-effort until confirmed against a real response:

- **`buildAdPayload(job, credentials)`** turns one location tab's field map into `{ ad: { category, location, ai_generated: false, type: "for_sale", images: [], extra_images: [], contact_card, properties }, account_phone_numbers: false }`:
  - `category`/`location` are ikman.lk's own numeric ids, resolved via `lib/ikmanMapping.ts`'s `getIkmanCategoryId(job.jobCategory)` / `getIkmanLocationId(job.district, job.town)` from `data/ikman-category-map.json` (`{ "Category Name": id }`) / `data/ikman-location-map.json` (`{ "District": id }` or `{ "District|Town": id }`, town-specific entry tried first). **Both maps start empty** — there's no way to derive ikman.lk's internal ids from our taxonomy names, so `buildAdPayload` returns a `{ success: false, error }` (surfaced in the "Post Job" error banner) for any category/location not yet added to these maps, rather than guessing.
  - `properties` enum values (`item_type`, `employment`, `min_qualification`) use `slugify()` — lowercased, spaces/punctuation to `_` — on our own taxonomy labels (e.g. "Full Time" -> "full_time"). This matched the one sample payload exactly, on the theory that this app's `jobTypes`/`education`/category-role taxonomy was originally transcribed from ikman.lk's own posting form — **not independently confirmed for every value**, just the ones seen so far.
  - `contact_card.email` is `credentials.email` (the logged-in account); `contact_card.phone_numbers` and the `apply_via_multi` property's `phones` both reuse `applicationPhone` — the sample request had two *different* numbers in these two spots, so this may need a distinct "employer contact phone" field later if they're meant to differ.
  - `type: "for_sale"` is hardcoded from the one sample seen — unconfirmed whether job ads ever use a different `type` value.
  - **Not sent at all yet** (no confirmed ikman.lk property `key` for these): `salaryFrom`/`salaryTo`, `applicationDeadline`. `requiredExperience` (free text, e.g. "2+ years") is best-effort parsed to an integer via the first number found in the string (`experience` property), and omitted entirely if none is found — never guessed.
  - `ad-form-version` (a frontend build-hash header seen on the sample request) is **not sent** — no reliable source for its current value from server-side code; if ikman.lk starts rejecting requests, this is the first thing to check.
- `postIkmanListing` sends only `Content-Type`, `Accept`, `Authorization`, and `application-name: web` as headers — browser-fingerprint headers from the sample (`user-agent`, `sec-ch-ua*`, `origin`, `referer`, `device-type`, `dnt`) are deliberately not replicated (this is a server-to-server call, not a browser request).

## Automation (superseded): Playwright-based posting

`automation/postJob.ts`'s `postJob(job, credentials?)` drives a headless Playwright browser against `automation/config/site.config.ts`'s `baseUrl`/selectors — built before the real ikman.lk API (above) was known, and **no longer wired to the UI**. Kept for reference / as a possible fallback, not actively maintained:

- If `credentials` (the user-entered Ikman.lk login) has both `email` and `password`, those are used to log in via form-fill — this took priority over `siteConfig.auth`'s env-var-based username/password (`JOB_SITE_USERNAME`/`JOB_SITE_PASSWORD`/`JOB_SITE_LOGIN_REQUIRED`), which exists only so `npm run automate:post-job` (`automation/run.ts`, no UI credentials available) can still exercise the login flow during manual testing.
- `siteConfig.fieldSelectors` maps `JobDetails` field names to CSS selectors on the target "post an ad" form — was always empty (`TODO` in `site.config.ts`) pending the real ikman.lk form, so `postJob` only ever opened the site and logged in.
- Never hardcode ikman.lk selectors/URLs inline elsewhere — they belong in `automation/config/site.config.ts` only, same "one source of truth" rule as the taxonomies above.

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
