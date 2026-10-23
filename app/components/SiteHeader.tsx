import type { ReactNode } from "react";
import Link from "next/link";
import { ScanSearch } from "lucide-react";

// The ikman-green top bar: app wordmark (links home) on the left, page-specific controls on the right.
export default function SiteHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="bg-ikman-green">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 text-white">
          <ScanSearch size={22} />
          <span className="text-lg sm:text-xl font-extrabold tracking-tight">Job Poster Analyzer</span>
        </Link>
        <div className="ml-auto">{children}</div>
      </div>
    </header>
  );
}
