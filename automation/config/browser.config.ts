// How Playwright itself runs — browser engine, headed/headless, timeouts, slow-mo.
// Separate from site.config.ts: this changes when you're tweaking automation
// behavior (e.g. watch it run), not when the target site's form changes.

export interface BrowserConfig {
  engine: "chromium" | "firefox" | "webkit";
  headless: boolean;
  slowMo: number;
  navigationTimeoutMs: number;
  actionTimeoutMs: number;
}

export const browserConfig: BrowserConfig = {
  engine: (process.env.PLAYWRIGHT_BROWSER as BrowserConfig["engine"]) ?? "chromium",
  headless: process.env.PLAYWRIGHT_HEADLESS === "true",
  slowMo: Number(process.env.PLAYWRIGHT_SLOWMO ?? 0),
  navigationTimeoutMs: Number(process.env.PLAYWRIGHT_NAV_TIMEOUT_MS ?? 30_000),
  actionTimeoutMs: Number(process.env.PLAYWRIGHT_ACTION_TIMEOUT_MS ?? 10_000),
};
