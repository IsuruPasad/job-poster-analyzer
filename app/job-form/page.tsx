"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { JobDetails } from "@/types/job";
import { ScanSearch, Sparkles, ArrowLeft, AlertTriangle, CheckCircle2 } from "lucide-react";

const EMPTY_JOB: JobDetails = {
  posterTitle: "",
  jobRole: "",
  jobCategory: null,
  location: null,
  employerName: "",
  employerWebsite: null,
  description: "",
  jobType: null,
  requiredExperience: null,
  requiredEducation: null,
  salary: null,
  applicationDeadline: null,
};

interface FormField {
  id: keyof JobDetails;
  label: string;
  placeholder: string;
  type?: "textarea";
}

const ABOUT_JOB_FIELDS: FormField[] = [
  { id: "jobCategory", label: "Job Category", placeholder: "e.g. IT & Software, Sales & Marketing" },
  { id: "location", label: "Location", placeholder: "e.g. Colombo, Kandy" },
  { id: "jobRole", label: "Job Role", placeholder: "e.g. Software Engineer, Sales Executive" },
  { id: "posterTitle", label: "Title for the Ad", placeholder: "e.g. Driver for hire in Colombo" },
  { id: "description", label: "Description", placeholder: "Describe the job in detail", type: "textarea" },
  { id: "jobType", label: "Job Type", placeholder: "e.g. Full Time, Part Time, Contract" },
  { id: "requiredExperience", label: "Required Work Experience (years)", placeholder: "e.g. 2+ years, No experience required" },
  { id: "requiredEducation", label: "Required Education", placeholder: "e.g. A/L, Diploma, Bachelor's Degree" },
  { id: "salary", label: "Salary per Month", placeholder: "e.g. LKR 50,000 – 80,000" },
  { id: "applicationDeadline", label: "Application Deadline", placeholder: "e.g. 30-06-2025" },
];

const ABOUT_EMPLOYER_FIELDS: FormField[] = [
  { id: "employerName", label: "Employer", placeholder: "Company or employer name" },
  { id: "employerWebsite", label: "Employer Website", placeholder: "e.g. https://www.example.com" },
];

export default function JobFormPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<Record<string, string>>({});
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

    // Flatten JobDetails into a string map for the form
    const flat: Record<string, string> = {};
    (Object.keys(EMPTY_JOB) as (keyof JobDetails)[]).forEach((key) => {
      const val = job[key];
      flat[key] = val != null ? String(val) : "";
    });
    setFormData(flat);
    setMounted(true);
  }, []);

  const handleChange = (id: string, value: string) => {
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const isEmpty = (id: string) => !formData[id] || formData[id].trim() === "";

  const fieldClasses = (id: string) =>
    `w-full px-3 py-2.5 rounded-lg border text-sm text-gray-800 focus:outline-none focus:ring-2 transition-colors ${isEmpty(id)
      ? "bg-green-50 border-green-300 focus:ring-green-300 placeholder-green-400"
      : "bg-white border-gray-300 focus:ring-indigo-300 placeholder-gray-400"
    }`;

  if (!mounted) return null;

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
          {/* About the Job */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60">
              <h2 className="text-base font-bold text-gray-800">About the Job</h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              {ABOUT_JOB_FIELDS.map((field) =>
                field.type === "textarea" ? (
                  <div key={field.id}>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">
                      {field.label}
                    </label>
                    <textarea
                      rows={6}
                      placeholder={field.placeholder}
                      value={formData[field.id] || ""}
                      onChange={(e) => handleChange(field.id, e.target.value)}
                      className={`${fieldClasses(field.id)} resize-y`}
                    />
                    <p className="text-xs text-gray-400 mt-1 text-right">
                      {formData[field.id]?.length ?? 0}/5000
                    </p>
                  </div>
                ) : (
                  <div key={field.id}>
                    <label className="block text-sm font-medium text-gray-600 mb-1.5">
                      {field.label}
                    </label>
                    <input
                      type="text"
                      placeholder={field.placeholder}
                      value={formData[field.id] || ""}
                      onChange={(e) => handleChange(field.id, e.target.value)}
                      className={fieldClasses(field.id)}
                    />
                  </div>
                )
              )}
            </div>
          </section>

          {/* About the Employer */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60">
              <h2 className="text-base font-bold text-gray-800">About the Employer</h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              {ABOUT_EMPLOYER_FIELDS.map((field) => (
                <div key={field.id}>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">
                    {field.label}
                  </label>
                  <input
                    type="text"
                    placeholder={field.placeholder}
                    value={formData[field.id] || ""}
                    onChange={(e) => handleChange(field.id, e.target.value)}
                    className={fieldClasses(field.id)}
                  />
                </div>
              ))}
            </div>
          </section>

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
