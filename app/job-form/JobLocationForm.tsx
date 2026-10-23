import { useMemo } from "react";
import { getCategoryNames, getRolesForCategory } from "@/lib/jobCategories";
import { getDistricts, getTowns } from "@/lib/locations";
import { useLocations } from "@/lib/locations/client";
import { JOB_TYPES } from "@/lib/jobTypes";
import { EDUCATION_LEVELS } from "@/lib/education";
import { isValidSriLankanPhone } from "@/lib/phone";

export interface FormField {
  id: string;
  label: string;
  placeholder: string;
  type?: "textarea" | "select" | "range" | "date" | "tel";
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
  { id: "applicationDeadline", label: "Application Deadline", placeholder: "", type: "date" },
  {
    id: "applicationPhone",
    label: "Applications Receive Phone Number",
    placeholder: "e.g. 0771234567",
    type: "tel",
  },
];

const DISABLED_SELECT = "bg-ikman-bg border-ikman-border text-gray-400 cursor-not-allowed";

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
  // District/town options come from ikman.lk's location tree (loaded once via /api/locations).
  const locations = useLocations();
  const locationData = locations.data;
  const districtNames = useMemo(() => (locationData ? getDistricts(locationData).map((d) => d.name) : []), [locationData]);
  const townOptions = useMemo(
    () => (locationData ? getTowns(locationData, data.district).map((t) => t.name) : []),
    [locationData, data.district]
  );

  const handleCategoryChange = (newCategory: string) => {
    const roles = getRolesForCategory(newCategory);
    const keepRole = roles.includes(data.jobRole) ? data.jobRole : "";
    onChange("jobCategory", newCategory);
    onChange("jobRole", keepRole);
  };

  const handleDistrictChange = (newDistrict: string) => {
    const towns = locationData ? getTowns(locationData, newDistrict).map((t) => t.name) : [];
    const keepTown = towns.includes(data.town) ? data.town : "";
    onChange("district", newDistrict);
    onChange("town", keepTown);
  };

  const isEmpty = (id: string) => !data[id] || data[id].trim() === "";

  const fieldClasses = (id: string, invalid = false) =>
    `w-full px-3 py-2.5 rounded border text-sm text-ikman-ink outline-none focus:ring-1 transition-colors ${invalid
      ? "bg-red-50 border-ikman-red focus:ring-ikman-red placeholder:text-gray-400"
      : isEmpty(id)
        ? "bg-ikman-green/10 border-ikman-green/50 focus:border-ikman-green focus:ring-ikman-green placeholder:text-ikman-muted"
        : "bg-white border-gray-300 focus:border-ikman-green focus:ring-ikman-green placeholder:text-gray-400"
    }`;

  return (
    <div className="space-y-6">
      {/* About the Job */}
      <section className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-ikman-border">
          <h2 className="text-base font-bold">About the Job</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          {/* Job Category */}
          <div>
            <label className="block text-sm mb-1.5">Job Category</label>
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
            <label className="block text-sm mb-1.5">Job Role</label>
            <select
              value={data.jobRole || ""}
              onChange={(e) => onChange("jobRole", e.target.value)}
              disabled={!data.jobCategory}
              className={`${fieldClasses("jobRole")} ${!data.jobCategory ? DISABLED_SELECT : ""}`}
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
            <label className="block text-sm mb-1.5">District</label>
            <select
              value={data.district || ""}
              onChange={(e) => handleDistrictChange(e.target.value)}
              disabled={!locationData}
              className={`${fieldClasses("district")} ${!locationData ? DISABLED_SELECT : ""}`}
            >
              <option value="">
                {locations.status === "loading"
                  ? "Loading districts…"
                  : locations.status === "error"
                    ? "Districts unavailable"
                    : "Select a district"}
              </option>
              {districtNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            {locations.status === "error" && (
              <p className="text-xs text-ikman-red mt-1">
                Couldn&apos;t load districts and towns from ikman.lk.{" "}
                <button type="button" onClick={locations.retry} className="font-semibold underline">
                  Try again
                </button>
              </p>
            )}
          </div>

          {/* Town (L2) */}
          <div>
            <label className="block text-sm mb-1.5">Town</label>
            <select
              value={data.town || ""}
              onChange={(e) => onChange("town", e.target.value)}
              disabled={!data.district || !locationData}
              className={`${fieldClasses("town")} ${!data.district || !locationData ? DISABLED_SELECT : ""}`}
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
                  <label className="block text-sm mb-1.5">
                    {field.label}
                  </label>
                  <textarea
                    rows={14}
                    placeholder={field.placeholder}
                    value={data[field.id] || ""}
                    onChange={(e) => onChange(field.id, e.target.value)}
                    className={`${fieldClasses(field.id)} resize-y`}
                  />
                  <p className="text-xs text-ikman-muted mt-1 text-right">
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
                  <label className="block text-sm mb-1.5">
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

            if (field.type === "tel") {
              const value = data[field.id] || "";
              const invalid = value.trim() !== "" && !isValidSriLankanPhone(value);
              return (
                <div key={field.id}>
                  <label className="block text-sm mb-1.5">
                    {field.label}
                  </label>
                  <input
                    type="tel"
                    placeholder={field.placeholder}
                    value={value}
                    onChange={(e) => onChange(field.id, e.target.value)}
                    className={fieldClasses(field.id, invalid)}
                  />
                  {invalid && (
                    <p className="text-xs text-ikman-red mt-1">
                      Enter a valid Sri Lankan phone number, e.g. 0771234567 or +94771234567.
                    </p>
                  )}
                </div>
              );
            }

            if (field.type === "date") {
              return (
                <div key={field.id}>
                  <label className="block text-sm mb-1.5">
                    {field.label}
                  </label>
                  <input
                    type="date"
                    value={data[field.id] || ""}
                    onChange={(e) => onChange(field.id, e.target.value)}
                    className={fieldClasses(field.id)}
                  />
                </div>
              );
            }

            if (field.type === "select") {
              return (
                <div key={field.id}>
                  <label className="block text-sm mb-1.5">
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
                <label className="block text-sm mb-1.5">
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
      <section className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-ikman-border">
          <h2 className="text-base font-bold">About the Employer</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          {ABOUT_EMPLOYER_FIELDS.map((field) => (
            <div key={field.id}>
              <label className="block text-sm mb-1.5">
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
