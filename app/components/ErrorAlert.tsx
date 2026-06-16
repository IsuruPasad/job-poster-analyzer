import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorAlertProps {
  message: string;
  onRetry: () => void;
}

export default function ErrorAlert({ message, onRetry }: ErrorAlertProps) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex flex-col items-center text-center gap-4">
      <div className="p-3 bg-red-100 rounded-full">
        <AlertCircle size={24} className="text-red-600" />
      </div>
      <div>
        <h3 className="font-semibold text-red-800 mb-1">Could not extract job details</h3>
        <p className="text-sm text-red-600 leading-relaxed max-w-sm">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-xl transition-colors"
      >
        <RefreshCw size={14} />
        Try another image
      </button>
    </div>
  );
}
