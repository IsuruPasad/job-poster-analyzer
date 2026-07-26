import { JobDetails } from "@/types/job";
import {
  Briefcase,
  Building2,
  Clock,
  GraduationCap,
  CalendarDays,
  Banknote,
  FileText,
  Star,
} from "lucide-react";

interface JobDetailsCardProps {
  data: JobDetails;
}

interface FieldProps {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  highlight?: boolean;
}

function Field({ icon, label, value, highlight }: FieldProps) {
  if (!value) return null;
  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl transition-colors ${highlight
        ? "bg-indigo-50 border border-indigo-100"
        : "bg-gray-50 border border-gray-100"
        }`}
    >
      <div className={`mt-0.5 flex-shrink-0 ${highlight ? "text-indigo-600" : "text-gray-500"}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
        <p className={`text-sm font-medium leading-snug ${highlight ? "text-indigo-800" : "text-gray-800"}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

function JobTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    "Full Time": "bg-green-100 text-green-800 border-green-200",
    "Part Time": "bg-blue-100 text-blue-800 border-blue-200",
    Internship: "bg-amber-100 text-amber-800 border-amber-200",
    Contract: "bg-purple-100 text-purple-800 border-purple-200",
  };
  const cls = colors[type] || "bg-gray-100 text-gray-800 border-gray-200";
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${cls}`}>
      {type}
    </span>
  );
}

export default function JobDetailsCard({ data }: JobDetailsCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-br from-indigo-600 to-violet-600 px-6 py-6 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-bold leading-tight truncate">{data.posterTitle}</h2>
            <p className="text-indigo-200 text-sm mt-1 flex items-center gap-1.5">
              <Building2 size={13} />
              {data.employerName}
            </p>
          </div>
          {data.jobType && <JobTypeBadge type={data.jobType} />}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Description */}
        {data.description && (
          <div className="bg-gradient-to-br from-gray-50 to-indigo-50/30 border border-gray-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText size={15} className="text-indigo-500" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{data.description}</p>
          </div>
        )}

        {/* Key Fields Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            icon={<Briefcase size={16} />}
            label="Job Role"
            value={data.jobRole}
            highlight
          />
          <Field
            icon={<Star size={16} />}
            label="Experience Required"
            value={data.requiredExperience}
          />
          <Field
            icon={<GraduationCap size={16} />}
            label="Education Required"
            value={data.requiredEducation}
          />
          <Field
            icon={<Banknote size={16} />}
            label="Salary"
            value={
              data.salaryFrom && data.salaryTo
                ? `${data.salaryFrom} - ${data.salaryTo}`
                : data.salaryFrom || data.salaryTo
            }
          />
          <Field
            icon={<CalendarDays size={16} />}
            label="Application Deadline"
            value={data.applicationDeadline}
          />
          <Field
            icon={<Clock size={16} />}
            label="Job Type"
            value={data.jobType}
          />
        </div>
      </div>
    </div>
  );
}
