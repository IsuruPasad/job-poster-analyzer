/** A district (L1) + popular town within it (L2). Either can be null if not determinable. */
export interface JobLocation {
  district: string | null;
  town: string | null;
}

export interface JobDetails {
  posterTitle: string;
  jobRole: string;
  jobCategory: string | null;
  /** Every distinct location this job is advertised for. Empty if none mentioned; more than one means the same role is open across multiple branches/cities. */
  locations: JobLocation[];
  employerName: string;
  employerWebsite: string | null;
  description: string;
  jobType: string | null;
  requiredExperience: string | null;
  requiredEducation: string | null;
  /** Lower/upper bound of the monthly salary range. If the poster gives a single fixed figure (not a range), it goes in salaryFrom and salaryTo is null. */
  salaryFrom: string | null;
  salaryTo: string | null;
  applicationDeadline: string | null;
}

export interface ExtractResponse {
  success: true;
  data: JobDetails;
}

export interface ExtractErrorResponse {
  success: false;
  error: string;
}

export type ApiResponse = ExtractResponse | ExtractErrorResponse;
