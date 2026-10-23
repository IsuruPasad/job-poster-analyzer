import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Briefcase, ClipboardCheck, Languages, Send, Upload } from "lucide-react";
import { DEFAULT_AFTER_LOGIN, REDIRECT_PARAM, SESSION_COOKIE, safeRedirect } from "@/lib/auth/session";
import AccountMenu from "./components/AccountMenu";
import LoginButton from "./components/LoginButton";
import SiteHeader from "./components/SiteHeader";

const STEPS = [
  {
    icon: Upload,
    title: "Upload the poster",
    text: "Snap or upload a photo of any printed job poster.",
  },
  {
    icon: ClipboardCheck,
    title: "Review the details",
    text: "AI fills in the job form for you. Check it and complete anything it couldn't read.",
  },
  {
    icon: Send,
    title: "Post to ikman.lk",
    text: "ikman.lk's post-ad form opens already filled in. Check it and click Post ad.",
  },
];

// Public landing page, and also where logging in happens (via the login popup).
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const loggedIn = !!(await cookies()).get(SESSION_COOKIE)?.value;
  const param = (await searchParams)[REDIRECT_PARAM];
  const redirectUrl = typeof param === "string" ? param : null;

  // Sent here to log in but already logged in: skip the popup and go where they were headed.
  if (loggedIn && redirectUrl !== null) redirect(safeRedirect(redirectUrl, DEFAULT_AFTER_LOGIN));

  return (
    <main className="flex-1 flex flex-col bg-ikman-bg text-ikman-ink">
      <SiteHeader>{loggedIn ? <AccountMenu /> : <LoginButton redirectUrl={redirectUrl} />}</SiteHeader>

      {/* Hero */}
      <section className="bg-ikman-green text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 pb-12 sm:pt-8 sm:pb-14 flex flex-col items-center text-center gap-4">
          <span className="inline-flex items-center gap-1.5 text-sm bg-ikman-green-dark px-3 py-1 rounded-full">
            <Briefcase size={14} />
            For ikman.lk Jobs
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight">
            Turn a job poster photo into an ikman.lk job ad
          </h1>
          <p className="text-lg text-white/90 max-w-xl">
            Upload a poster in English, Sinhala or Tamil. AI reads the role, location, salary and more, then you
            review it and post.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-12">
        <h2 className="text-xl font-bold mb-6">How it works</h2>
        <ol className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="bg-white rounded-lg shadow-sm p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-md bg-ikman-green/10 text-ikman-green">
                  <Icon size={20} />
                </div>
                <span className="text-xs font-semibold text-gray-400">Step {i + 1}</span>
              </div>
              <h3 className="font-bold mb-1">{title}</h3>
              <p className="text-sm text-gray-600">{text}</p>
            </li>
          ))}
        </ol>

        <div className="mt-6 bg-white rounded-lg shadow-sm p-5 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-ikman-yellow/20 text-ikman-brown">
              <Languages size={20} />
            </div>
            <p className="font-bold">Reads posters in three languages</p>
          </div>
          <p className="text-sm text-gray-600 sm:ml-auto">English · සිංහල · தமிழ்</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto bg-white border-t border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 text-xs text-gray-500">
          Job Poster Analyzer · Internal tool for creating ikman.lk job listings
        </div>
      </footer>
    </main>
  );
}
