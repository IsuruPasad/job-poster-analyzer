"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { JobDetails } from "@/types/job";
import { ScanSearch, Sparkles, ArrowLeft, AlertTriangle, CheckCircle2 } from "lucide-react";
import { matchCategory, matchRole, findCategoryByRole } from "@/lib/jobCategories";
import { matchDistrict, matchTown, findDistrictByTown } from "@/lib/locations";
import { matchJobType } from "@/lib/jobTypes";
import { matchEducation } from "@/lib/education";
import JobLocationForm from "./JobLocationForm";

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
};

export default function JobFormPage() {
  const router = useRouter();
  // One flat field map per detected location. A single-location (or no-location) poster
  // is just an array of length 1, rendered without a tab bar.
  const [jobForms, setJobForms] = useState<Record<string, string>[]>([]);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [extractionSuccess, setExtractionSuccess] = useState<boolean | null>(null);
  const [extractionError, setExtractionError] = useState<string>("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const success = sessionStorage.getItem("extractionSuccess");
    const error = sessionStorage.getItem("extractionError") || "";
    const raw = sessionStorage.getItem("jobData");

    setExtractionSuccess(success === "true");
    setExtractionError(error);

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

    // Gemini's own generated title — kept only as a fallback for when jobRole couldn't be
    // matched to the taxonomy, since "{jobRole} - {location}" needs a real jobRole to build.
    const fallbackTitle = base.posterTitle;

    const detectedLocations = job.locations && job.locations.length > 0 ? job.locations : [{ district: null, town: null }];
    setJobForms(
      detectedLocations.map((loc) => {
        // Same taxonomy normalization as jobCategory/jobRole above — guards against stale
        // cached values (or a district/town rename) producing an unknown dropdown selection.
        let district = matchDistrict(loc.district) || "";
        let town = matchTown(district, loc.town) || "";
        if (!town && loc.town) {
          const inferredDistrict = findDistrictByTown(loc.town);
          if (inferredDistrict) {
            district = inferredDistrict;
            town = matchTown(inferredDistrict, loc.town) || "";
          }
        }

        // Title format: "{jobRole} - {location}", or just "{jobRole}" without a location.
        const location = town || district;
        const posterTitle = base.jobRole ? (location ? `${base.jobRole} - ${location}` : base.jobRole) : fallbackTitle;

        return { ...base, district, town, posterTitle };
      })
    );
    setActiveTabIndex(0);
    setMounted(true);
  }, []);

  const updateActiveForm = (id: string, value: string) => {
    setJobForms((prev) => prev.map((form, i) => (i === activeTabIndex ? { ...form, [id]: value } : form)));
  };

  if (!mounted) return null;

  const activeForm = jobForms[activeTabIndex] || {};

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-violet-50/20">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/60 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-xl">
            <ScanSearch size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-none">Job Poster Analyzer</h1>
            <p className="text-xs text-gray-400 mt-0.5">AI-powered extraction · English, Sinhala & Tamil</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-indigo-600 font-medium bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-full">
            <Sparkles size={12} />
            Powered by Gemini
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Back button */}
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium mb-6 transition-colors group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          Analyze another poster
        </button>

        {/* Extraction status banner */}
        {extractionSuccess === true && (
          <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 mb-6">
            <CheckCircle2 size={18} className="text-indigo-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-indigo-800">Details extracted successfully</p>
              <p className="text-xs text-indigo-600 mt-0.5">
                Fields with a <span className="font-semibold text-green-700">green background</span> could not be determined from the image — please fill them in manually.
              </p>
            </div>
          </div>
        )}

        {extractionSuccess === false && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6">
            <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Could not extract details from image</p>
              {extractionError && (
                <p className="text-xs text-amber-700 mt-0.5">{extractionError}</p>
              )}
              <p className="text-xs text-amber-700 mt-1">
                All fields are highlighted in <span className="font-semibold text-green-700">green</span> — please fill in the job details manually.
              </p>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-2 mb-6 text-xs text-gray-500">
          <span className="inline-block w-4 h-4 rounded bg-green-100 border border-green-300" />
          <span>Green fields could not be extracted — fill them in manually</span>
        </div>

        <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
          {/* Location tabs — only shown when the poster advertises this role across multiple locations */}
          {jobForms.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {jobForms.map((form, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveTabIndex(idx)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${idx === activeTabIndex
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                >
                  {form.town || form.district || `Location ${idx + 1}`}
                </button>
              ))}
            </div>
          )}

          <JobLocationForm data={activeForm} onChange={updateActiveForm} />

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pb-10">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-sm"
            >
              ← Back
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors shadow-md shadow-indigo-200 text-sm"
            >
              Post Job
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
