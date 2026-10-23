"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ClipboardCheck, Eye, EyeOff, Loader2, ScanSearch, Send, X } from "lucide-react";
import { isValidEmail } from "@/lib/email";
import { LoginError, login } from "@/lib/auth/api";
import { DEFAULT_AFTER_LOGIN, safeRedirect } from "@/lib/auth/session";

const REQUIRED_MESSAGE = "You must fill out this field.";
// Bad-credential responses; anything else (5xx, timeout, 404 from a misconfigured gateway) is a generic failure.
const INVALID_CREDENTIAL_STATUSES = [400, 401, 403, 422];

const BENEFITS = [
  { icon: ScanSearch, text: "Turn job poster photos into ready-to-post ads." },
  { icon: ClipboardCheck, text: "Review and correct the extracted job details." },
  { icon: Send, text: "Post jobs to ikman.lk in a few clicks." },
];

interface LoginModalProps {
  redirectUrl: string | null;
  onClose: () => void;
}

// Mounted only while open, so every open starts with a fresh form.
export default function LoginModal({ redirectUrl, onClose }: LoginModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const pressedBackdrop = useRef(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [emailBlurred, setEmailBlurred] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    // After showModal, not via autoFocus — the dialog is still closed when React would apply that.
    emailRef.current?.focus();
  }, []);

  const close = () => dialogRef.current?.close(); // fires the dialog's onClose -> unmount

  const emailError = !email.trim() ? REQUIRED_MESSAGE : !isValidEmail(email) ? "Please enter a valid email address." : null;
  const passwordError = password ? null : REQUIRED_MESSAGE;
  // Required errors wait for a submit; a malformed email is also flagged once the field is left.
  const showEmailError = submitted || (emailBlurred && email.trim()) ? emailError : null;
  const showPasswordError = submitted ? passwordError : null;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
    if (emailError || passwordError) {
      (emailError ? emailRef : passwordRef).current?.focus();
      return;
    }

    setSubmitting(true);
    setLoginError(null);
    try {
      await login(email.trim(), password);
      // Full load (not router.push) so the proxy sees the new cookie; replace so Back doesn't return to login.
      window.location.replace(safeRedirect(redirectUrl, DEFAULT_AFTER_LOGIN));
    } catch (err) {
      setLoginError(
        err instanceof LoginError && INVALID_CREDENTIAL_STATUSES.includes(err.status)
          ? "Invalid email or password."
          : "Something went wrong. Please try again."
      );
      setPassword("");
      setSubmitted(false);
      setSubmitting(false);
      passwordRef.current?.focus();
    }
  };

  const inputClasses = (invalid: boolean) =>
    `w-full px-3 py-2.5 text-sm bg-white text-ikman-ink border rounded outline-none transition-colors placeholder:text-gray-400 focus:ring-1 ${
      invalid
        ? "border-ikman-red focus:ring-ikman-red"
        : "border-gray-300 focus:border-ikman-green focus:ring-ikman-green"
    }`;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onMouseDown={(e) => {
        pressedBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (pressedBackdrop.current && e.target === e.currentTarget) close();
      }}
      aria-labelledby="login-title"
      className="m-auto w-[calc(100%-2rem)] max-w-3xl rounded-md bg-white p-0 text-ikman-ink shadow-xl backdrop:bg-black/75"
    >
      <div className="relative grid grid-cols-1 md:grid-cols-2">
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 p-1.5 text-gray-500 hover:text-ikman-ink transition-colors"
        >
          <X size={24} />
        </button>

        <div className="px-6 pt-7 md:my-6 md:px-8 md:py-2 md:border-r md:border-ikman-border">
          <h2 id="login-title" className="text-lg font-bold">
            Log in to ikman
          </h2>
          <p className="mt-2 text-sm text-ikman-muted">
            Use your ikman.lk account to turn job posters into ikman.lk job ads.
          </p>
          <ul className="hidden md:block mt-8 space-y-7">
            {BENEFITS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-4 text-sm text-ikman-muted">
                <span className="flex-shrink-0 p-2.5 rounded-full bg-ikman-green/10 text-ikman-green">
                  <Icon size={20} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <form noValidate onSubmit={handleSubmit} className="px-6 pt-5 pb-7 md:px-8 md:pt-14 md:pb-8 space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-sm mb-1.5">
              Email
            </label>
            <input
              ref={emailRef}
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setEmailBlurred(true)}
              aria-invalid={!!showEmailError}
              aria-describedby={showEmailError ? "login-email-error" : undefined}
              className={inputClasses(!!showEmailError)}
            />
            {showEmailError && (
              <p id="login-email-error" className="mt-1 text-xs text-ikman-red">
                {showEmailError}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="login-password" className="block text-sm mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                ref={passwordRef}
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!showPasswordError}
                aria-describedby={showPasswordError ? "login-password-error" : undefined}
                className={`${inputClasses(!!showPasswordError)} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((shown) => !shown)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-ikman-ink transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {showPasswordError && (
              <p id="login-password-error" className="mt-1 text-xs text-ikman-red">
                {showPasswordError}
              </p>
            )}
          </div>

          {loginError && (
            <p role="alert" className="text-sm text-ikman-red bg-red-50 border border-red-200 rounded px-3 py-2">
              {loginError}
            </p>
          )}

          {/* Faded while the form is incomplete (like ikman.lk), but still clickable so an empty submit shows the errors. */}
          <button
            type="submit"
            disabled={submitting}
            className={`w-full flex items-center justify-center gap-2 py-2.5 bg-ikman-green hover:bg-ikman-green-dark text-white font-bold rounded transition-colors disabled:cursor-wait ${
              emailError || passwordError ? "opacity-50" : ""
            }`}
          >
            {submitting && <Loader2 size={18} className="animate-spin" />}
            {submitting ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </dialog>
  );
}
