import Link from "next/link";
import { Download, House } from "lucide-react";
import SiteHeader from "../components/SiteHeader";

export const metadata = { title: "Install the ikman Job Poster extension" };

// How to install extension/ (served zipped by ./download/route.ts). It isn't on the Chrome Web
// Store, so it's loaded unpacked from the downloaded folder.
const STEPS = [
  "Download the extension and unzip it. You get a folder called ikman-job-poster-extension.",
  "In Chrome, open chrome://extensions (copy it into the address bar).",
  "Turn on Developer mode (top right).",
  "Click Load unpacked and choose the ikman-job-poster-extension folder.",
  "Reload the job form, then click Post Job.",
];

export default function ExtensionPage() {
  return (
    <main className="flex-1 flex flex-col bg-ikman-bg text-ikman-ink">
      <SiteHeader>
        <Link href="/" aria-label="Home" className="inline-flex items-center gap-1.5 text-sm text-white hover:underline">
          <House size={18} />
          <span className="hidden sm:inline">Home</span>
        </Link>
      </SiteHeader>

      <div className="max-w-2xl w-full mx-auto px-4 sm:px-6 py-10">
        <div className="bg-white rounded-lg shadow-sm p-6 space-y-5">
          <div>
            <h1 className="text-2xl font-bold">ikman Job Poster extension</h1>
            <p className="text-sm text-ikman-muted mt-1">
              Post Job hands the reviewed job to this Chrome extension. It opens ikman.lk&apos;s post-ad form in a new tab and fills it
              in, using your own ikman.lk login. You check the ad and click Post ad yourself. Works in Chrome and Edge on a computer.
            </p>
          </div>

          <a
            href="/extension/download"
            className="inline-flex items-center gap-2 px-6 py-3 bg-ikman-yellow hover:bg-ikman-yellow-dark text-ikman-brown font-bold uppercase rounded text-sm"
          >
            <Download size={18} />
            Download the extension
          </a>

          <ol className="list-decimal list-inside space-y-2 text-sm">
            {STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>

          <p className="text-xs text-ikman-muted">
            After an update, download it again, replace the folder, and click the reload icon on the extension in chrome://extensions.
          </p>
        </div>
      </div>
    </main>
  );
}
