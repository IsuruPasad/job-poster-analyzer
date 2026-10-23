import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // How "Post Job" posts (lib/features.ts): "extension" through the user's browser extension,
    // "browser" by driving a visible Playwright browser on the server machine, or "off". A
    // serverless host can't run that browser (no browser, no screen), so Vercel defaults to
    // "extension". Inlined at build time into server and browser code alike.
    POST_JOB_METHOD: process.env.POST_JOB_METHOD ?? (process.env.VERCEL ? "extension" : "browser"),
  },
  // The extension's download route zips these files at request time.
  outputFileTracingIncludes: {
    "/extension/download": ["./extension/**/*"],
  },
};

export default nextConfig;
