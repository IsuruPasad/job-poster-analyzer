// Manual test entry point: `npm run automate:post-job`.
// Fills in a sample JobDetails so you can verify the browser navigates, fills,
// and clicks correctly before this is wired up to the app's "Post Job" button.

import { postJob } from "./postJob";

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local present — fall back to already-exported env vars
}

const sampleJob: Record<string, string> = {
  posterTitle: "Cashier - Colombo",
  jobRole: "Cashier",
  employerName: "Sample Employer",
  description: "Sample job description for testing the automation.",
};

postJob(sampleJob)
  .then(() => console.log("postJob finished"))
  .catch((error) => {
    console.error("postJob failed:", error);
    process.exitCode = 1;
  });
