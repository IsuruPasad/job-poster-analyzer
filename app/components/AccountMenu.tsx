"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { fetchAccount } from "@/lib/auth/api";
import LogoutButton from "./LogoutButton";

// Header controls for a logged-in user. Loads the account behind the persisted token on
// mount without blocking the page; a dead token is caught by authFetch's 401 handling.
export default function AccountMenu() {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    fetchAccount()
      .then((account) => setName(account.profile.name))
      .catch(() => {});
  }, []);

  return (
    <div className="flex items-center gap-4 sm:gap-6 text-white">
      {name && (
        <span className="hidden md:inline-flex items-center gap-1.5 text-sm">
          <UserRound size={18} />
          {name}
        </span>
      )}
      <LogoutButton />
      <Link
        href="/upload"
        className="inline-flex items-center px-4 sm:px-5 py-2 text-sm bg-ikman-yellow hover:bg-ikman-yellow-dark active:scale-[0.98] text-ikman-brown font-bold uppercase rounded transition-all duration-150"
      >
        Post<span className="hidden sm:inline">&nbsp;a Job</span>
      </Link>
    </div>
  );
}
