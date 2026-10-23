"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { JobDetails, PostJobErrorCode, PostJobResponse } from "@/types/job";
import { POST_JOB_ERROR_MESSAGES } from "@/lib/errorMessages";
import { clearSession, loginPath } from "@/lib/auth/session";
import { AppWindow, ArrowLeft, AlertTriangle, Check, CheckCircle2, House } from "lucide-react";
import ErrorAlert from "../components/ErrorAlert";
import LogoutButton from "../components/LogoutButton";
import SiteHeader from "../components/SiteHeader";
import { matchCategory, matchRole, findCategoryByRole } from "@/lib/jobCategories";
import { resolveLocation } from "@/lib/locations";
import { loadLocations } from "@/lib/locations/client";
import { matchJobType } from "@/lib/jobTypes";
import { matchEducation } from "@/lib/education";
import { isIsoDate } from "@/lib/date";
import JobLocationForm from "./JobLocationForm";

// Post Job failures that a fresh app login fixes (it supplies the ikman.lk session the automation reuses).
const RELOGIN_CODES: PostJobErrorCode[] = ["POST_NOT_LOGGED_IN", "POST_SESSION_EXPIRED", "POST_AUTH_FAILED"];

// Drop the current session first — otherwise the home page sees the old cookie and skips the
// login popup — then come back here after logging in.
async function logInAgain() {
  clearSession();
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  window.location.href = loginPath("/job-form");
}

/** A location tab's label: its town, else its district. */
function tabLabel(form: Record<string, string>, idx: number): string {
  return form.town || form.district || `Location ${idx + 1}`;
}

/** The next tab after `from` (wrapping around) that hasn't been posted yet, or null if none is left. */
function nextOpenTab(from: number, done: Set<number>, count: number): number | null {
  for (let step = 1; step < count; step++) {
    const idx = (from + step) % count;
    if (!done.has(idx)) return idx;
  }
  return null;
}

const EMPTY_JOB: JobDetails = {
  posterTitle: "",
  jobRole: "",
  jobCategory: null,
  locations: [],
  employerName: "",
  employerWebsite: null,
  description: "",
  jobType: null,
  requiredExperience: null,
  requiredEducation: null,
  salaryFrom: null,
  salaryTo: null,
  applicationDeadline: null,
  applicationPhone: null,
};

export default function JobFormPage() {
  const router = useRouter();
  // One flat field map per detected location. A single-location (or no-location) poster
  // is just an array of length 1, rendered without a tab bar.
  const [jobForms, setJobForms] = useState<Record<string, string>[]>([]);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [extractionSuccess, setExtractionSuccess] = useState<boolean | null>(null);
  const [extractionError, setExtractionError] = useState<string>("");
  const [extractionErrorCode, setExtractionErrorCode] = useState<string>("");
  const [mounted, setMounted] = useState(false);
  // The tab whose "Post Job" run is in progress (the automation, then the user finishing the
  // ad in its window), and the tabs whose run finished — the window was closed.
  const [postingTab, setPostingTab] = useState<number | null>(null);
  const [doneTabs, setDoneTabs] = useState<Set<number>>(new Set());
  const posting = postingTab !== null;
  // Generic message + code only — the technical detail is logged to the console.
  const [postError, setPostError] = useState<{ code: PostJobErrorCode; message: string } | null>(null);

  useEffect(() => {
    const success = sessionStorage.getItem("extractionSuccess");
    const error = sessionStorage.getItem("extractionError") || "";
    const raw = sessionStorage.getItem("jobData");

    setExtractionSuccess(success === "true");
    setExtractionError(error);
    setExtractionErrorCode(sessionStorage.getItem("extractionErrorCode") || "");

    let job: JobDetails = EMPTY_JOB;
    if (raw) {
      try {
        job = JSON.parse(raw) as JobDetails;
      } catch {
        // ignore parse errors, use empty
      }
    }

    // Flatten every JobDetails field except `locations` into a shared string map —
    // each location tab starts as a copy of this, with its own `district`/`town` values.
    const base: Record<string, string> = {};
    (Object.keys(EMPTY_JOB) as (keyof JobDetails)[]).forEach((key) => {
      if (key === "locations") return;
      const val = job[key];
      base[key] = val != null ? String(val) : "";
    });

    // Normalize against the category/role taxonomy — extracted data should already be an
    // exact match, but this keeps stale cached values (or a category/role rename) from
    // producing a dropdown selection that doesn't exist.
    let category = matchCategory(base.jobCategory) || "";
    let role = matchRole(category, base.jobRole) || "";
    if (!role && base.jobRole) {
      const inferredCategory = findCategoryByRole(base.jobRole);
      if (inferredCategory) {
        category = inferredCategory;
        role = matchRole(inferredCategory, base.jobRole) || "";
      }
    }
    base.jobCategory = category;
    base.jobRole = role;

    // Same defensive normalization for jobType/requiredEducation — an unmatched/stale value
    // falls back to blank so the dropdown never shows a selection outside the fixed list.
    base.jobType = matchJobType(base.jobType) || "";
    base.requiredEducation = matchEducation(base.requiredEducation) || "";

    // The date input only renders a value in exact YYYY-MM-DD format — anything else
    // (e.g. a pre-date-picker cached value) is dropped rather than shown broken/blank-but-wrong.
    base.applicationDeadline = isIsoDate(base.applicationDeadline) ? base.applicationDeadline : "";

    // The AI's own generated title — kept only as a fallback for when jobRole couldn't be
    // matched to the taxonomy, since "{jobRole} - {location}" needs a real jobRole to build.
    const fallbackTitle = base.posterTitle;

    const detectedLocations = job.locations && job.locations.length > 0 ? job.locations : [{ district: null, town: null }];
    setJobForms(
      detectedLocations.map((loc) => {
        // Extraction already mapped these onto ikman.lk's names; re-checked below once the
        // location tree has loaded.
        const district = loc.district ?? "";
        const town = loc.town ?? "";

        // Title format: "{jobRole} - {location}", or just "{jobRole}" without a location.
        const location = town || district;
        const posterTitle = base.jobRole ? (location ? `${base.jobRole} - ${location}` : base.jobRole) : fallbackTitle;

        return { ...base, district, town, posterTitle };
      })
    );
    setActiveTabIndex(0);
    setMounted(true);

    // Re-check every tab's district/town against ikman.lk's current location tree, so a stale
    // cached value can't leave a selection the dropdowns (or ikman.lk's posting UI) don't have.
    // On failure JobLocationForm shows the load error itself.
    loadLocations()
      .then((locationData) =>
        setJobForms((forms) =>
          forms.map((form) => {
            const resolved = resolveLocation(locationData, { district: form.district, town: form.town });
            return { ...form, district: resolved.district ?? "", town: resolved.town ?? "" };
          })
        )
      )
      .catch(() => {});
  }, []);

  const updateActiveForm = (id: string, value: string) => {
    setJobForms((prev) => prev.map((form, i) => (i === activeTabIndex ? { ...form, [id]: value } : form)));
  };

  const handlePostJob = async () => {
    const failWith = (code: PostJobErrorCode, details: { technical?: unknown } & Record<string, unknown>, message = POST_JOB_ERROR_MESSAGES[code]) => {
      console.error(`[post-job] ✖ ${code}: ${details.technical ?? message}`, details);
      setPostError({ code, message });
    };

    const postedTab = activeTabIndex;
    setPostingTab(postedTab);
    setPostError(null);
    try {
      let res: Response;
      try {
        res = await fetch("/api/post-job", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // No credentials sent: the route reuses the app session cookie as the ikman.lk login.
          // It answers once the automation's browser window has been closed.
          body: JSON.stringify({ job: jobForms[postedTab] || {} }),
        });
      } catch (err) {
        return failWith("NETWORK_ERROR", {
          technical: `fetch(/api/post-job) failed: ${err instanceof Error ? err.message : err}`,
          online: navigator.onLine,
          error: err,
        });
      }

      let data: PostJobResponse;
      try {
        data = await res.json();
      } catch (err) {
        return failWith("BAD_SERVER_RESPONSE", {
          technical: `/api/post-job returned a non-JSON response (HTTP ${res.status} ${res.statusText})`,
          contentType: res.headers.get("content-type"),
          error: err,
        });
      }

      if (!data.success) {
        return failWith(data.code, { httpStatus: res.status, ...data.details }, data.error);
      }

      // The ikman.lk window was closed: with several locations, move on to the next one not done yet.
      const done = new Set(doneTabs).add(postedTab);
      setDoneTabs(done);
      const next = nextOpenTab(postedTab, done, jobForms.length);
      if (next !== null) {
        setActiveTabIndex(next);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } finally {
      setPostingTab(null);
    }
  };

  if (!mounted) return null;

  const activeForm = jobForms[activeTabIndex] || {};
  const upNext = postingTab !== null ? nextOpenTab(postingTab, new Set(doneTabs).add(postingTab), jobForms.length) : null;

  return (
    <main className="flex-1 flex flex-col bg-ikman-bg text-ikman-ink">
      <SiteHeader>
        <nav className="flex items-center gap-4 sm:gap-6">
          <Link href="/" aria-label="Home" className="inline-flex items-center gap-1.5 text-sm text-white hover:underline">
            <House size={18} />
            <span className="hidden sm:inline">Home</span>
          </Link>
          <LogoutButton />
        </nav>
      </SiteHeader>

      <div className="max-w-3xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Back button */}
        <button
          onClick={() => router.push("/upload")}
          className="flex items-center gap-2 text-sm text-ikman-green hover:underline font-bold mb-4 group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          Analyze another poster
        </button>

        <h1 className="text-2xl font-bold mb-6">Review Job Details</h1>

        {/* Extraction status banner */}
        {extractionSuccess === true && (
          <div className="flex items-start gap-3 bg-white border-l-4 border-ikman-green rounded-lg shadow-sm px-4 py-3 mb-6">
            <CheckCircle2 size={18} className="text-ikman-green flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold">Details extracted successfully</p>
              <p className="text-xs text-ikman-muted mt-0.5">
                Fields with a <span className="font-bold text-ikman-green">green background</span> could not be determined from the image — please fill them in manually.
              </p>
            </div>
          </div>
        )}

        {extractionSuccess === false && (
          <div className="flex items-start gap-3 bg-white border-l-4 border-ikman-yellow rounded-lg shadow-sm px-4 py-3 mb-6">
            <AlertTriangle size={18} className="text-ikman-brown flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-ikman-brown">Could not extract details from image</p>
              {extractionError && (
                <p className="text-xs mt-0.5">{extractionError}</p>
              )}
              {extractionErrorCode && (
                <p className="text-[11px] font-mono text-ikman-muted mt-1">
                  Error code: {extractionErrorCode} — full details are in the browser console
                </p>
              )}
              <p className="text-xs text-ikman-muted mt-1">
                All fields are highlighted in <span className="font-bold text-ikman-green">green</span> — please fill in the job details manually.
              </p>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-2 mb-6 text-xs text-ikman-muted">
          <span className="inline-block w-4 h-4 rounded bg-ikman-green/10 border border-ikman-green/50" />
          <span>Green fields could not be extracted — fill them in manually</span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handlePostJob();
          }}
          className="space-y-6"
        >
          {/* Location tabs — only shown when the poster advertises this role across multiple locations */}
          {jobForms.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {jobForms.map((form, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveTabIndex(idx)}
                  className={`px-4 py-2 rounded-full text-sm font-bold border transition-colors ${idx === activeTabIndex
                    ? "bg-ikman-green border-ikman-green text-white"
                    : "bg-white border-gray-300 text-ikman-ink hover:border-ikman-green hover:text-ikman-green"
                    }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {doneTabs.has(idx) && <Check size={14} aria-hidden />}
                    {tabLabel(form, idx)}
                    {doneTabs.has(idx) && <span className="sr-only">(done)</span>}
                  </span>
                </button>
              ))}
            </div>
          )}

          <JobLocationForm data={activeForm} onChange={updateActiveForm} />

          {postingTab !== null && (
            <div role="status" className="flex items-start gap-3 bg-white border-l-4 border-ikman-green rounded-lg shadow-sm px-4 py-3">
              <AppWindow size={18} className="text-ikman-green flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold">
                  Posting{jobForms.length > 1 ? ` ${tabLabel(jobForms[postingTab] || {}, postingTab)}` : ""} in a separate ikman.lk window
                </p>
                <p className="text-xs text-ikman-muted mt-0.5">
                  Check the ad there and post it, then close that window
                  {upNext !== null ? ` — this page will move on to ${tabLabel(jobForms[upNext] || {}, upNext)}.` : "."}
                </p>
              </div>
            </div>
          )}

          {postError && (
            <ErrorAlert title="Couldn't post the job" message={postError.message} code={postError.code}>
              {RELOGIN_CODES.includes(postError.code) && (
                <button type="button" onClick={logInAgain} className="mt-2 text-sm font-bold text-ikman-red underline">
                  Log in again
                </button>
              )}
            </ErrorAlert>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pb-10">
            <button
              type="button"
              onClick={() => router.push("/upload")}
              className="flex-1 px-6 py-3 bg-white border border-gray-300 text-ikman-ink font-bold rounded hover:bg-ikman-bg transition-colors text-sm"
            >
              ← Back
            </button>
            <button
              type="submit"
              disabled={posting}
              className="flex-1 px-6 py-3 bg-ikman-yellow hover:bg-ikman-yellow-dark active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed text-ikman-brown font-bold uppercase rounded transition-all duration-150 text-sm"
            >
              {posting ? "Posting..." : "Post Job"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
