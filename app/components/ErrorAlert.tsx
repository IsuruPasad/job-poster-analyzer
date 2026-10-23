import type { ReactNode } from "react";
import { AlertCircle, X } from "lucide-react";

interface ErrorAlertProps {
  title: string;
  message: string;
  /** Error code (see ExtractErrorCode) — shown small, for matching against the console log. */
  code?: string;
  onDismiss?: () => void;
  /** Extra content under the message, e.g. an action button. */
  children?: ReactNode;
}

export default function ErrorAlert({ title, message, code, onDismiss, children }: ErrorAlertProps) {
  return (
    <div role="alert" className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
      <AlertCircle size={18} className="text-ikman-red flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-ikman-red">{title}</p>
        <p className="text-sm text-ikman-ink mt-0.5 break-words">{message}</p>
        {code && <p className="text-[11px] font-mono text-ikman-muted mt-1">Error code: {code}</p>}
        {children}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="p-0.5 text-gray-400 hover:text-ikman-ink transition-colors"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
