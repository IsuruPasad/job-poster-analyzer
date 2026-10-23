import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createZip } from "@/lib/zip";

// Serves extension/ as a zip with one top-level folder, ready for Chrome's "Load unpacked" once
// unzipped. Zipped per request from the files themselves (next.config.ts's
// outputFileTracingIncludes ships them with this route), so the download is never out of date.
const FOLDER = "ikman-job-poster-extension";

export async function GET() {
  const root = path.join(process.cwd(), "extension");
  const names = (await readdir(root, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)))
    .sort();
  const entries = await Promise.all(
    names.map(async (name) => ({ name: `${FOLDER}/${name.split(path.sep).join("/")}`, data: await readFile(path.join(root, name)) }))
  );

  return new Response(new Uint8Array(createZip(entries)), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${FOLDER}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
