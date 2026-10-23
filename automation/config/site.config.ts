// Everything about the TARGET job site lives here — URL, login, and which form
// field maps to which selector. Change the site or its form without touching
// automation/postJob.ts.
//
// Selectors below were captured with `npx playwright codegen https://ikman.lk/en`
// (log in, click through to the job-posting form) rather than guessed — ikman.lk's
// login and category/district/town pickers are accessible-role based (links/buttons/
// textboxes by name), not plain CSS ids, so postJob.ts uses page.getByRole(...) to
// match these instead of page.fill(selector, value).

export interface SiteConfig {
  /** Page that has the "post a job" form. */
  baseUrl: string;

  auth: {
    /** Env-var login for the login form — only used when postJob gets neither a session nor credentials, i.e. `npm run automate:post-job`. */
    required: boolean;
    username: string;
    password: string;
  };

  /**
   * ikman.lk's own login cookies (set by its web app after login). The "Post Job" button loads
   * the user's app session into these, so the browser starts already logged in.
   */
  sessionCookies: {
    token: string;
    accountId: string;
  };

  login: {
    loginLinkName: string;
    continueWithEmailButtonName: string;
    emailFieldName: string;
    passwordFieldName: string;
    submitButtonName: string;
  };

  /** Button that starts a new ad from the homepage/header. */
  postAdButtonName: string;
  /** Button on the ad-type chooser that starts a job listing specifically. */
  postJobEntryButtonName: string;

  /**
   * data-testid hooks of ikman.lk's shared location selector (Post Ad / Home modal — not the
   * SERP location filter). Options carry data-option-key = ikman.lk location id. See
   * automation/locationSelector.ts.
   */
  locationPicker: {
    /** Opens the selector on Post Ad; data-disabled="true" when disabled. */
    trigger: string;
    /** Root of the selector — visible once it's ready. */
    content: string;
    /** Shown instead when the location list failed to load. */
    loadError: string;
    /** Level 1: districts. */
    primaryColumn: string;
    /** Level 2: one opened district's cities (its data-option-key is the district id). */
    secondaryColumn: string;
    /** One clickable location (a <button>). */
    option: string;
    /** Footer "Show" button, and the ad-count overlay that blocks clicks — only on pages with a footer. */
    apply: string;
    loading: string;
  };

  /**
   * Labels/names for the main job-post form fields, captured the same way as everything
   * else here (`npx playwright codegen`) rather than guessed. `jobRole`/`jobType`/
   * `requiredEducation` are custom react-select-style comboboxes (an "open menu" control
   * inside a `role=combobox` container, then the option picked by its text) — not native
   * `<select>` elements — so postJob.ts opens each one before clicking the option text.
   */
  jobForm: {
    roleComboboxLabel: string;
    titleFieldName: string;
    descriptionFieldName: string;
    jobTypeComboboxLabel: string;
    /** Matched as a substring — the full accessible name includes trailing unit text (e.g. "(years)") not confirmed verbatim. */
    experienceFieldNamePrefix: string;
    educationComboboxLabel: string;
    salaryFromFieldName: string;
    salaryToFieldName: string;
    employerNameFieldName: string;
    /** "How do you want to receive applications?" is a required section with two checkbox options — checking this one reveals the phone input below it. */
    applicationPhoneCheckboxLabel: string;
    applicationPhoneFieldPlaceholder: string;
  };

  // TODO: not recorded yet — employer website, application phone, the deadline date
  // picker (a custom calendar widget, not a native <input type="date">; needs a recording
  // that navigates months to figure out how to land on an arbitrary target date, not just
  // the day-in-the-current-month click seen so far), and the final submit button.
  fieldSelectors: Partial<Record<string, string>>;

  submitButtonSelector: string;
}

export const siteConfig: SiteConfig = {
  baseUrl: process.env.JOB_SITE_URL ?? "https://ikman.lk/en",

  auth: {
    required: process.env.JOB_SITE_LOGIN_REQUIRED === "true",
    username: process.env.JOB_SITE_USERNAME ?? "",
    password: process.env.JOB_SITE_PASSWORD ?? "",
  },

  sessionCookies: {
    token: "sessionToken",
    accountId: "__user",
  },

  login: {
    loginLinkName: "Login",
    continueWithEmailButtonName: "Continue with Email",
    emailFieldName: "Email",
    passwordFieldName: "Password",
    submitButtonName: "Login",
  },

  postAdButtonName: "POST YOUR AD",
  postJobEntryButtonName: "Post a job in Sri Lanka",

  locationPicker: {
    trigger: "location-selector-button",
    content: "location-selector-content",
    loadError: "location-selector-load-error",
    primaryColumn: "location-selector-primary-column",
    secondaryColumn: "location-selector-secondary-column",
    option: "location-selector-option",
    apply: "location-selector-apply",
    loading: "location-selector-loading",
  },

  jobForm: {
    roleComboboxLabel: "Role",
    titleFieldName: "Title",
    descriptionFieldName: "Describe the job in detail",
    jobTypeComboboxLabel: "Job type",
    experienceFieldNamePrefix: "Required work experience",
    educationComboboxLabel: "Required education",
    salaryFromFieldName: "From",
    salaryToFieldName: "To",
    employerNameFieldName: "Employer",
    applicationPhoneCheckboxLabel: "Phone (up to 3)",
    applicationPhoneFieldPlaceholder: "Enter phone number",
  },

  fieldSelectors: {},

  submitButtonSelector: "",
};
