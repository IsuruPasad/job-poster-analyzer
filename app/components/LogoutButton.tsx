"use client";

import { LogOut } from "lucide-react";
import { logout } from "@/lib/auth/api";

// White-on-green header link style; icon-only below `sm`.
export default function LogoutButton() {
  return (
    <button
      type="button"
      onClick={() => logout()}
      aria-label="Logout"
      className="inline-flex items-center gap-1.5 text-sm text-white hover:underline"
    >
      <LogOut size={18} />
      <span className="hidden sm:inline">Logout</span>
    </button>
  );
}
