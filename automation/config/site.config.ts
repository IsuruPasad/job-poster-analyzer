// Everything about the TARGET job site lives here — URL, login, and which form
// field maps to which selector. Change the site or its form without touching
// automation/postJob.ts.

export interface SiteConfig {
  /** Page that has the "post a job" form. */
  baseUrl: string;

  auth: {
    required: boolean;
    usernameSelector: string;
    passwordSelector: string;
    submitSelector: string;
    username: string;
    password: string;
  };

  /** JobDetails field name -> CSS selector of its input on the target form. */
  fieldSelectors: Partial<Record<string, string>>;

  submitButtonSelector: string;
}

export const siteConfig: SiteConfig = {
  baseUrl: process.env.JOB_SITE_URL ?? "https://ikman.lk/en",

  auth: {
    required: process.env.JOB_SITE_LOGIN_REQUIRED === "true",
    usernameSelector: "#username",
    passwordSelector: "#password",
    submitSelector: "button[type=submit]",
    username: process.env.JOB_SITE_USERNAME ?? "",
    password: process.env.JOB_SITE_PASSWORD ?? "",
  },

  // TODO: fill in once the real "post an ad" page and its form fields are known.
  // Left empty for now, so postJob.ts just opens/navigates and stops there.
  fieldSelectors: {},

  submitButtonSelector: "",
};
