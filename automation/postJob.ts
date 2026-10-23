import { chromium, firefox, webkit, type Browser, type BrowserContext } from "playwright";
import { siteConfig } from "./config/site.config";
import { browserConfig } from "./config/browser.config";
import { IkmanCredentials, IkmanSession } from "../types/auth";
import { toLocalSriLankanPhone } from "../lib/phone";
import { PostJobError } from "./errors";
import { resolveLocationChoice, selectJobLocation } from "./locationSelector";

const engines = { chromium, firefox, webkit };

/**
 * Runs the job-posting automation steps: open the target site, log in if
 * configured, fill whatever form fields are mapped in site.config.ts, and
 * submit. Add new steps here — selectors/URLs stay in automation/config/.
 *
 * How it logs in to ikman.lk, in priority order:
 * 1. `login.session` — the user's app session (the same ikman.lk token from POST /v1/sessions),
 *    loaded into the browser as ikman.lk's own login cookies, so the login form is skipped.
 *    This is what the job form's "Post Job" uses.
 * 2. `login.credentials` — email/password typed into ikman.lk's login form.
 * 3. siteConfig.auth's .env.local credentials — for `npm run automate:post-job`, which has no session.
 */
export interface PostJobLogin {
  session?: IkmanSession;
  credentials?: IkmanCredentials;
}

export interface PostJobRun {
  /**
   * Resolves once the user closes the automation's browser window (after finishing the ad by
   * hand), or the browser exits. Never rejects.
   */
  windowClosed: Promise<void>;
}

export async function postJob(job: Record<string, string>, login: PostJobLogin = {}): Promise<PostJobRun> {
  if (!siteConfig.baseUrl) {
    throw new PostJobError("POST_CONFIG", "JOB_SITE_URL is not set — configure it in .env.local (see automation/config/site.config.ts).");
  }
  // ikman.lk's Post Ad location selector only accepts a town (city), never a whole district.
  if (!job.district || !job.town) {
    throw new PostJobError("POST_LOCATION_REQUIRED", `Job has no ${!job.district ? "district" : "town"} (district="${job.district ?? ""}", town="${job.town ?? ""}").`);
  }
  // "How do you want to receive applications?" is required on ikman.lk; it's answered with
  // "Phone", so a number is needed (the route falls back to the account's own number).
  if (typeof job.applicationPhone !== "string" || !job.applicationPhone.trim()) {
    throw new PostJobError("POST_PHONE_REQUIRED", "Job has no applicationPhone (the form's phone field is empty and the ikman.lk account has no number to fall back on).");
  }
  const locationChoice = await resolveLocationChoice(job);

  const browser = await engines[browserConfig.engine].launch({
    headless: browserConfig.headless,
    slowMo: browserConfig.slowMo,
  });

  const context = await browser.newContext();
  if (login.session) {
    const url = new URL(siteConfig.baseUrl).origin;
    const { sessionCookies } = siteConfig;
    await context.addCookies([
      { name: sessionCookies.token, value: login.session.token, url },
      ...(login.session.accountId ? [{ name: sessionCookies.accountId, value: login.session.accountId, url }] : []),
    ]);
  }
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(browserConfig.navigationTimeoutMs);
  page.setDefaultTimeout(browserConfig.actionTimeoutMs);

  // The browser is deliberately left open here, whether this finishes or throws — the
  // final submit (and the fields not automated yet) are done by hand, and on a failure it
  // shows exactly where the flow stopped. It's only closed once the user has closed its
  // window (see whenWindowClosed). If the window is closed by hand mid-flow, the in-flight
  // Playwright action doesn't always reject promptly on its own — race the whole sequence
  // against the window closing so this promise always settles instead of leaving the
  // caller (and the "Post Job" button) waiting indefinitely.
  const windowClosed = whenWindowClosed(browser, context);
  const closedUnexpectedly = windowClosed.then((): never => {
    throw new PostJobError("POST_BROWSER_CLOSED", "The browser window was closed before the automation finished.");
  });

  const runSteps = async () => {
    await page.goto(siteConfig.baseUrl);
    const loginLink = page.getByRole("link", { name: siteConfig.login.loginLinkName });

    if (login.session) {
      // Already logged in via the session cookies. Once the header has rendered, a "Login"
      // link means ikman.lk didn't take them — stop rather than post logged out.
      await page.getByRole("button", { name: siteConfig.postAdButtonName, exact: true }).waitFor();
      if (await loginLink.isVisible()) {
        throw new PostJobError("POST_AUTH_FAILED", "ikman.lk still shows the Login link after loading the app's session cookies.");
      }
    } else {
      const auth = login.credentials?.email && login.credentials?.password
        ? { username: login.credentials.email, password: login.credentials.password }
        : siteConfig.auth.required
          ? { username: siteConfig.auth.username, password: siteConfig.auth.password }
          : null;

      if (!auth) {
        throw new PostJobError("POST_CONFIG", "No ikman.lk session or login credentials (for the CLI, set JOB_SITE_USERNAME / JOB_SITE_PASSWORD and JOB_SITE_LOGIN_REQUIRED=true in .env.local).");
      }

      const form = siteConfig.login;
      await loginLink.click();
      await page.getByRole("button", { name: form.continueWithEmailButtonName }).click();
      await page.getByRole("textbox", { name: form.emailFieldName }).fill(auth.username);
      await page.getByRole("textbox", { name: form.passwordFieldName }).fill(auth.password);
      await page.getByRole("button", { name: form.submitButtonName }).click();
    }

    await page.getByRole("button", { name: siteConfig.postAdButtonName, exact: true }).click();
    await page.getByRole("button", { name: siteConfig.postJobEntryButtonName }).click();

    // Category picker buttons are labeled with the category itself (data/job-categories.json).
    // `exact: true` matters: a substring match can hit two buttons, which Playwright rejects.
    if (job.jobCategory) {
      await page.getByRole("button", { name: job.jobCategory, exact: true }).click();
    }

    // Location: open the district, pick the town, by ikman.lk location id (automation/locationSelector.ts).
    await selectJobLocation(page, locationChoice);

    const { jobForm } = siteConfig;
    // Confirms the main form underneath the (now closed) location selector is interactable.
    await page.getByRole("textbox", { name: jobForm.titleFieldName }).waitFor();

    // jobRole/jobType/requiredEducation are custom react-select-style comboboxes: open
    // the menu, then click the option by its text. Values come straight from our own
    // taxonomy (lib/jobCategories.ts, lib/jobTypes.ts, lib/education.ts), which is why
    // this can click by label text with no separate id/selector mapping needed.
    const selectComboboxOption = async (comboboxLabel: string, value: string) => {
      await page.getByRole("combobox", { name: comboboxLabel }).getByLabel("open menu").click();
      await page.getByText(value, { exact: true }).click();
    };

    if (job.jobRole) {
      await selectComboboxOption(jobForm.roleComboboxLabel, job.jobRole);
    }
    if (job.posterTitle) {
      await page.getByRole("textbox", { name: jobForm.titleFieldName }).fill(job.posterTitle);
    }
    if (job.description) {
      await page.getByRole("textbox", { name: jobForm.descriptionFieldName }).fill(job.description);
    }
    if (job.jobType) {
      await selectComboboxOption(jobForm.jobTypeComboboxLabel, job.jobType);
    }
    // requiredExperience is free text (e.g. "2+ years") but the site field is a plain
    // number input — best-effort parse the first number found, same approach as
    // lib/ikman.ts's direct-API `experience` property; skip entirely if none found
    // rather than guessing.
    const experienceNumber = job.requiredExperience?.match(/\d+/)?.[0];
    if (experienceNumber) {
      await page.getByRole("spinbutton", { name: jobForm.experienceFieldNamePrefix }).fill(experienceNumber);
    }
    if (job.requiredEducation) {
      await selectComboboxOption(jobForm.educationComboboxLabel, job.requiredEducation);
    }
    // Salary fields are also plain number inputs — strip any currency/commas/whitespace
    // our free-text salaryFrom/salaryTo might carry.
    const salaryFromNumber = job.salaryFrom?.replace(/\D/g, "");
    if (salaryFromNumber) {
      await page.getByRole("spinbutton", { name: jobForm.salaryFromFieldName }).fill(salaryFromNumber);
    }
    const salaryToNumber = job.salaryTo?.replace(/\D/g, "");
    if (salaryToNumber) {
      await page.getByRole("spinbutton", { name: jobForm.salaryToFieldName }).fill(salaryToNumber);
    }
    if (job.employerName) {
      await page.getByRole("textbox", { name: jobForm.employerNameFieldName, exact: true }).fill(job.employerName);
    }
    // "How do you want to receive applications?" is a required section (email/dashboard
    // vs. phone) — checking "Phone (up to 3)" reveals a phone number input beneath it.
    // Always answered with "Phone" for now (not "Email and employer dashboard"). The checkbox
    // input is visually hidden (sr-only) with its <label> on top intercepting pointer events,
    // so the label text is clicked (natively toggling the checkbox); if that didn't tick it,
    // the checkbox is checked directly, bypassing the pointer check.
    const phoneOption = page.getByRole("checkbox", { name: jobForm.applicationPhoneCheckboxLabel });
    await page.getByText(jobForm.applicationPhoneCheckboxLabel, { exact: true }).click();
    if (!(await phoneOption.isChecked())) await phoneOption.check({ force: true });
    // The input stays disabled until the option is ticked; ikman.lk expects the local 07… format.
    await page.getByPlaceholder(jobForm.applicationPhoneFieldPlaceholder).first().fill(toLocalSriLankanPhone(job.applicationPhone));

    // Not automated yet: employerWebsite, applicationDeadline (a custom calendar widget —
    // needs a recording that navigates months to confirm how to land on an arbitrary
    // target date, not just the single same-month day click seen so far), and the final
    // submit button. fieldSelectors/submitButtonSelector below stay available for whichever
    // of these turn out to be plain CSS-selectable once recorded.
    for (const [field, selector] of Object.entries(siteConfig.fieldSelectors)) {
      const value = job[field];
      if (value && selector) {
        await page.fill(selector, value);
      }
    }

    if (siteConfig.submitButtonSelector) {
      await page.click(siteConfig.submitButtonSelector);
    }
  };

  await Promise.race([runSteps(), closedUnexpectedly]);
  return { windowClosed };
}

/**
 * Resolves when the user closes the automation's browser window, then closes the browser
 * process left behind. Playwright starts Chromium with --no-startup-window, so the process
 * outlives its last window and "disconnected" doesn't fire when the window is closed by hand;
 * closing the window closes all of the context's pages, which does show up.
 */
function whenWindowClosed(browser: Browser, context: BrowserContext): Promise<void> {
  return new Promise((resolve) => {
    let closed = false;
    const done = () => {
      if (closed) return;
      closed = true;
      resolve();
      browser.close().catch(() => {});
    };
    browser.once("disconnected", done);
    const onPageClosed = () => {
      if (context.pages().length === 0) done();
    };
    context.pages().forEach((page) => page.once("close", onPageClosed));
    context.on("page", (page) => page.once("close", onPageClosed));
  });
}
