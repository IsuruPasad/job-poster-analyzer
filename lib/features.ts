// Deployment-dependent features. Values are fixed at build time in next.config.ts.

const POST_JOB_METHODS = ["extension", "browser", "off"] as const;
export type PostJobMethod = (typeof POST_JOB_METHODS)[number];

/**
 * How "Post Job" posts: "extension" (the ikman Job Poster browser extension fills ikman.lk's form
 * in the user's own browser, extension/ — the default on Vercel), "browser" (the Playwright
 * automation on the server machine, automation/ — the default elsewhere) or "off". Unknown values mean "off".
 */
export const POST_JOB_METHOD: PostJobMethod = POST_JOB_METHODS.find((m) => m === process.env.POST_JOB_METHOD) ?? "off";
