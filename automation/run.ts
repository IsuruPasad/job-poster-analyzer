// Manual test entry point: `npm run automate:post-job`.
// Fills in a sample JobDetails so you can verify the browser navigates, fills,
// and clicks correctly before this is wired up to the app's "Post Job" button.

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local present — fall back to already-exported env vars
}

// jobCategory/jobRole/district/town/jobType/requiredEducation are set to values confirmed
// to actually match ikman.lk's pickers (captured via `npx playwright codegen`) — jobRole in
// particular must belong to jobCategory (see data/job-categories.json), since the Role
// combobox on the real form only offers roles under whichever category was already picked.
// Leaving any of these unset skips the corresponding postJob.ts step entirely (see the
// `if (job.x)` guards there).
const sampleJob: Record<string, string> = {
  posterTitle: "Accountant - Nugegoda",
  jobRole: "Accountant",
  jobCategory: "Accounting & Finance",
  district: "Colombo",
  town: "Nugegoda",
  employerName: "Sample Employer",
  description: "Sample job description for testing the automation.",
  jobType: "Full Time",
  requiredExperience: "3 years",
  requiredEducation: "Ordinary Level",
  salaryFrom: "Rs. 10,000",
  salaryTo: "Rs. 99,998",
  applicationPhone: "0771234567",
};

// A static top-of-file `import` would be hoisted and evaluated before the
// process.loadEnvFile call above — including site.config.ts, which reads
// JOB_SITE_USERNAME/PASSWORD/LOGIN_REQUIRED from process.env at module-eval time —
// silently leaving those env vars unset. This project isn't set up for ESM (no
// "type": "module" in package.json), so top-level await isn't available either;
// a dynamic import kicked off after loadEnvFile has already run keeps the order correct.
import("./postJob")
  .then(({ postJob }) => postJob(sampleJob))
  .then(() => console.log("postJob finished"))
  .catch((error) => {
    console.error("postJob failed:", error);
    process.exitCode = 1;
  });
