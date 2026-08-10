import { chromium, firefox, webkit } from "playwright";
import { siteConfig } from "./config/site.config";
import { browserConfig } from "./config/browser.config";
import { IkmanCredentials } from "../types/auth";

const engines = { chromium, firefox, webkit };

/**
 * Runs the job-posting automation steps: open the target site, log in if
 * configured, fill whatever form fields are mapped in site.config.ts, and
 * submit. Add new steps here — selectors/URLs stay in automation/config/.
 *
 * `credentials` comes from the user-entered Ikman.lk login on the job-form page and,
 * when present, takes priority over the env-var-based siteConfig.auth (used by the
 * automate:post-job CLI test entry point, which has no user-entered credentials).
 */
export async function postJob(job: Record<string, string>, credentials?: IkmanCredentials): Promise<void> {
  if (!siteConfig.baseUrl) {
    throw new Error("JOB_SITE_URL is not set — configure it in .env.local (see automation/config/site.config.ts).");
  }

  const browser = await engines[browserConfig.engine].launch({
    headless: browserConfig.headless,
    slowMo: browserConfig.slowMo,
  });

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(browserConfig.navigationTimeoutMs);
  page.setDefaultTimeout(browserConfig.actionTimeoutMs);

  try {
    await page.goto(siteConfig.baseUrl);

    const auth = credentials?.email && credentials?.password
      ? { username: credentials.email, password: credentials.password }
      : siteConfig.auth.required
        ? { username: siteConfig.auth.username, password: siteConfig.auth.password }
        : null;

    if (auth) {
      await page.fill(siteConfig.auth.usernameSelector, auth.username);
      await page.fill(siteConfig.auth.passwordSelector, auth.password);
      await page.click(siteConfig.auth.submitSelector);
    }

    for (const [field, selector] of Object.entries(siteConfig.fieldSelectors)) {
      const value = job[field];
      if (value && selector) {
        await page.fill(selector, value);
      }
    }

    if (siteConfig.submitButtonSelector) {
      await page.click(siteConfig.submitButtonSelector);
      await browser.close();
    }
    // No submit button configured yet — leave the window open instead of
    // closing a browser that never got to do anything.
  } catch (error) {
    await browser.close();
    throw error;
  }
}
