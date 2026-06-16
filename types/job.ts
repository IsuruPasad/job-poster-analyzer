export interface JobDetails {
  posterTitle: string;
  jobRole: string;
  jobCategory: string | null;
  location: string | null;
  employerName: string;
  employerWebsite: string | null;
  description: string;
  jobType: string | null;
  requiredExperience: string | null;
  requiredEducation: string | null;
  salary: string | null;
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
