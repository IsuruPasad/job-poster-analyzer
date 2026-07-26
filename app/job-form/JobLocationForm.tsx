import { useMemo } from "react";
import { getCategoryNames, getRolesForCategory } from "@/lib/jobCategories";
import { getDistrictNames, getTownsForDistrict } from "@/lib/locations";
import { JOB_TYPES } from "@/lib/jobTypes";
import { EDUCATION_LEVELS } from "@/lib/education";

export interface FormField {
  id: string;
  label: string;
  placeholder: string;
  type?: "textarea" | "select" | "range";
  options?: string[];
  /** For type "range": the two field ids and placeholders, e.g. [salaryFrom, salaryTo]. */
  rangeIds?: [string, string];
  rangePlaceholders?: [string, string];
}

export const ABOUT_JOB_FIELDS: FormField[] = [
  { id: "posterTitle", label: "Title for the Ad", placeholder: "e.g. Driver for hire in Colombo" },
  { id: "description", label: "Description", placeholder: "Describe the job in detail", type: "textarea" },
  { id: "jobType", label: "Job Type", placeholder: "Select a job type", type: "select", options: JOB_TYPES },
  { id: "requiredExperience", label: "Required Work Experience (years)", placeholder: "e.g. 2+ years, No experience required" },
  { id: "requiredEducation", label: "Required Education", placeholder: "Select a required education level", type: "select", options: EDUCATION_LEVELS },
  {
    id: "salary",
    label: "Salary per Month",
    placeholder: "",
    type: "range",
    rangeIds: ["salaryFrom", "salaryTo"],
    rangePlaceholders: ["From (e.g. LKR 50,000)", "To (e.g. LKR 80,000)"],
  },
  { id: "applicationDeadline", label: "Application Deadline", placeholder: "e.g. 30-06-2025" },
];

export const ABOUT_EMPLOYER_FIELDS: FormField[] = [
  { id: "employerName", label: "Employer", placeholder: "Company or employer name" },
  { id: "employerWebsite", label: "Employer Website", placeholder: "e.g. https://www.example.com" },
];

interface JobLocationFormProps {
  data: Record<string, string>;
  onChange: (id: string, value: string) => void;
}

/**
 * Renders the "About the Job" + "About the Employer" sections for a single location.
 * Used once for a single-location poster, or once per tab when a poster advertises
 * the same role across multiple locations — each tab gets an independent copy of this form.
 */
export default function JobLocationForm({ data, onChange }: JobLocationFormProps) {
  const categoryNames = useMemo(() => getCategoryNames(), []);
  const roleOptions = useMemo(() => getRolesForCategory(data.jobCategory), [data.jobCategory]);
  const districtNames = useMemo(() => getDistrictNames(), []);
  const townOptions = useMemo(() => getTownsForDistrict(data.district), [data.district]);

  const handleCategoryChange = (newCategory: string) => {
    const roles = getRolesForCategory(newCategory);
    const keepRole = roles.includes(data.jobRole) ? data.jobRole : "";
    onChange("jobCategory", newCategory);
    onChange("jobRole", keepRole);
  };

  const handleDistrictChange = (newDistrict: string) => {
    const towns = getTownsForDistrict(newDistrict);
    const keepTown = towns.includes(data.town) ? data.town : "";
    onChange("district", newDistrict);
    onChange("town", keepTown);
  };

  const isEmpty = (id: string) => !data[id] || data[id].trim() === "";

  const fieldClasses = (id: string) =>
    `w-full px-3 py-2.5 rounded-lg border text-sm text-gray-800 focus:outline-none focus:ring-2 transition-colors ${isEmpty(id)
      ? "bg-green-50 border-green-300 focus:ring-green-300 placeholder-green-400"
      : "bg-white border-gray-300 focus:ring-indigo-300 placeholder-gray-400"
    }`;

  return (
    <div className="space-y-6">
      {/* About the Job */}
      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60">
          <h2 className="text-base font-bold text-gray-800">About the Job</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          {/* Job Category */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Job Category</label>
            <select
              value={data.jobCategory || ""}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className={fieldClasses("jobCategory")}
            >
              <option value="">Select a category</option>
              {categoryNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Job Role */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Job Role</label>
            <select
              value={data.jobRole || ""}
              onChange={(e) => onChange("jobRole", e.target.value)}
              disabled={!data.jobCategory}
              className={`${fieldClasses("jobRole")} ${!data.jobCategory ? "bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed" : ""}`}
            >
              <option value="">
                {data.jobCategory ? "Select a role" : "Select a job category first"}
              </option>
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>

          {/* District (L1) */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">District</label>
            <select
              value={data.district || ""}
              onChange={(e) => handleDistrictChange(e.target.value)}
              className={fieldClasses("district")}
            >
              <option value="">Select a district</option>
              {districtNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Town (L2) */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Town</label>
            <select
              value={data.town || ""}
              onChange={(e) => onChange("town", e.target.value)}
              disabled={!data.district}
              className={`${fieldClasses("town")} ${!data.district ? "bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed" : ""}`}
            >
              <option value="">
                {data.district ? "Select a town" : "Select a district first"}
              </option>
              {townOptions.map((town) => (
                <option key={town} value={town}>
                  {town}
                </option>
              ))}
            </select>
          </div>

          {ABOUT_JOB_FIELDS.map((field) => {
            if (field.type === "textarea") {
              return (
                <div key={field.id}>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">
                    {field.label}
                  </label>
                  <textarea
                    rows={6}
                    placeholder={field.placeholder}
                    value={data[field.id] || ""}
                    onChange={(e) => onChange(field.id, e.target.value)}
                    className={`${fieldClasses(field.id)} resize-y`}
                  />
                  <p className="text-xs text-gray-400 mt-1 text-right">
                    {data[field.id]?.length ?? 0}/5000
                  </p>
                </div>
              );
            }

            if (field.type === "range" && field.rangeIds) {
              const [fromId, toId] = field.rangeIds;
              const [fromPlaceholder, toPlaceholder] = field.rangePlaceholders ?? ["From", "To"];
              return (
                <div key={field.id}>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">
                    {field.label}
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      placeholder={fromPlaceholder}
                      value={data[fromId] || ""}
                      onChange={(e) => onChange(fromId, e.target.value)}
                      className={fieldClasses(fromId)}
                    />
                    <input
                      type="text"
                      placeholder={toPlaceholder}
                      value={data[toId] || ""}
                      onChange={(e) => onChange(toId, e.target.value)}
                      className={fieldClasses(toId)}
                    />
                  </div>
                </div>
              );
            }

            if (field.type === "select") {
              return (
                <div key={field.id}>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">
                    {field.label}
                  </label>
                  <select
                    value={data[field.id] || ""}
                    onChange={(e) => onChange(field.id, e.target.value)}
                    className={fieldClasses(field.id)}
                  >
                    <option value="">{field.placeholder}</option>
                    {(field.options ?? []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              );
            }

            return (
              <div key={field.id}>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">
                  {field.label}
                </label>
                <input
                  type="text"
                  placeholder={field.placeholder}
                  value={data[field.id] || ""}
                  onChange={(e) => onChange(field.id, e.target.value)}
                  className={fieldClasses(field.id)}
                />
              </div>
            );
          })}
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
                value={data[field.id] || ""}
                onChange={(e) => onChange(field.id, e.target.value)}
                className={fieldClasses(field.id)}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
