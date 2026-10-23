"use client";

import { useState } from "react";
import LoginModal from "./LoginModal";

interface LoginButtonProps {
  // Set when a protected page sent the user here: the popup opens straight away and
  // returns them there after login.
  redirectUrl: string | null;
}

export default function LoginButton({ redirectUrl }: LoginButtonProps) {
  const [open, setOpen] = useState(redirectUrl !== null);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center px-5 py-2 text-sm bg-ikman-yellow hover:bg-ikman-yellow-dark active:scale-[0.98] text-ikman-brown font-bold uppercase rounded transition-all duration-150"
      >
        Login
      </button>
      {open && <LoginModal redirectUrl={redirectUrl} onClose={() => setOpen(false)} />}
    </>
  );
}
