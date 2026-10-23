"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ErrorAlert from "../components/ErrorAlert";
import ImageUploader, { type FileProblem } from "../components/ImageUploader";
import Loader from "../components/Loader";
import LogoutButton from "../components/LogoutButton";
import SiteHeader from "../components/SiteHeader";
import { ApiResponse, ExtractErrorCode } from "@/types/job";
import { resizeImageForUpload } from "@/lib/image";
import { EXTRACT_ERROR_MESSAGES } from "@/lib/errorMessages";
import { MAX_UPLOAD_BYTES, formatBytes } from "@/lib/uploadLimits";
import { House, Lightbulb, ScanSearch } from "lucide-react";

type AppState = "idle" | "loading";

// Longer than the server's own worst case for a slow AI provider, so the server's
// more specific error normally arrives first.
const REQUEST_TIMEOUT_MS = 180_000;

function fileSummary(file: File) {
  return { name: file.name, type: file.type || "(none)", size: formatBytes(file.size) };
}

export default function UploadPage() {
  const router = useRouter();
  const [appState, setAppState] = useState<AppState>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  // A problem with the chosen file, caught before anything was uploaded — shown here, not on the job form.
  const [fileProblem, setFileProblem] = useState<FileProblem | null>(null);

  const handleImageSelect = useCallback((file: File) => {
    setSelectedFile(file);
    setFileProblem(null);
  }, []);

  const handleInvalidFile = useCallback((problem: FileProblem, file: File) => {
    console.warn(`[extract] ${problem.code}: ${problem.message}`, fileSummary(file));
    setFileProblem(problem);
  }, []);

  const handleClear = useCallback(() => {
    setSelectedFile(null);
    setFileProblem(null);
  }, []);

  // Extraction failures still go on to the job form (banner + blank fields for manual entry).
  // The banner gets only the generic message; the technical details go to the console.
  const finishWithError = (code: ExtractErrorCode, details: { technical?: unknown } & Record<string, unknown>, message = EXTRACT_ERROR_MESSAGES[code]) => {
    console.error(`[extract] ✖ ${code}: ${details.technical ?? message}`, details);
    sessionStorage.removeItem("jobData");
    sessionStorage.setItem("extractionSuccess", "false");
    sessionStorage.setItem("extractionError", message);
    sessionStorage.setItem("extractionErrorCode", code);
    router.push("/job-form");
  };

  const handleExtract = async () => {
    if (!selectedFile) return;

    setFileProblem(null);
    setAppState("loading");

    const fileToUpload = await resizeImageForUpload(selectedFile);
    // Resizing falls back to the original file when it can't (or needn't) shrink it.
    if (fileToUpload.size > MAX_UPLOAD_BYTES) {
      handleInvalidFile(
        {
          code: "FILE_TOO_LARGE",
          message: `This image is still too large to upload after resizing (${formatBytes(fileToUpload.size)}; the maximum is ${formatBytes(MAX_UPLOAD_BYTES)}). Please use a smaller image.`,
        },
        fileToUpload
      );
      setAppState("idle");
      return;
    }

    const formData = new FormData();
    formData.append("image", fileToUpload);
    const upload = { original: fileSummary(selectedFile), uploaded: fileSummary(fileToUpload) };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch("/api/extract", { method: "POST", body: formData, signal: controller.signal });
    } catch (err) {
      if (controller.signal.aborted) {
        return finishWithError("REQUEST_TIMEOUT", {
          technical: `No response from /api/extract within ${REQUEST_TIMEOUT_MS / 1000} s`,
          ...upload,
          error: err,
        });
      }
      return finishWithError("NETWORK_ERROR", {
        technical: `fetch(/api/extract) failed: ${err instanceof Error ? err.message : err}`,
        ...upload,
        online: navigator.onLine,
        error: err,
      });
    } finally {
      clearTimeout(timer);
    }

    let json: ApiResponse;
    try {
      json = await res.json();
    } catch (err) {
      return finishWithError("BAD_SERVER_RESPONSE", {
        technical: `/api/extract returned a non-JSON response (HTTP ${res.status} ${res.statusText})`,
        ...upload,
        contentType: res.headers.get("content-type"),
        error: err,
      });
    }

    if (!json.success) {
      return finishWithError(json.code, { httpStatus: res.status, ...upload, ...json.details }, json.error);
    }

    sessionStorage.setItem("jobData", JSON.stringify(json.data));
    sessionStorage.setItem("extractionSuccess", "true");
    sessionStorage.removeItem("extractionError");
    sessionStorage.removeItem("extractionErrorCode");
    router.push("/job-form");
  };

  const isLoading = appState === "loading";

  return (
    <main className="flex-1 flex flex-col bg-ikman-bg text-ikman-ink">
      <SiteHeader>
        <nav className="flex items-center gap-4 sm:gap-6">
          <Link href="/" aria-label="Home" className="inline-flex items-center gap-1.5 text-sm text-white hover:underline">
            <House size={18} />
            <span className="hidden sm:inline">Home</span>
          </Link>
          <LogoutButton />
        </nav>
      </SiteHeader>

      <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Left: Upload panel */}
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-bold">Extract Job Details</h1>
              <p className="text-sm text-ikman-muted mt-1">
                Upload a job poster image and our AI will automatically extract all key information.
              </p>
            </div>

            <ImageUploader
              onImageSelect={handleImageSelect}
              onInvalidFile={handleInvalidFile}
              onClear={handleClear}
              disabled={isLoading}
            />

            {fileProblem && (
              <ErrorAlert
                title="This file can't be used"
                message={fileProblem.message}
                code={fileProblem.code}
                onDismiss={() => setFileProblem(null)}
              />
            )}

            {selectedFile && !isLoading && (
              <button
                onClick={handleExtract}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-ikman-green hover:bg-ikman-green-dark active:scale-[0.98] text-white font-bold rounded transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ScanSearch size={18} />
                Extract Job Details
              </button>
            )}

            {/* Tips */}
            {!selectedFile && (
              <div className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="p-1.5 rounded-md bg-ikman-yellow/20 text-ikman-brown">
                    <Lightbulb size={16} />
                  </span>
                  <p className="text-sm font-bold">Tips for best results</p>
                </div>
                <ul className="text-sm text-ikman-muted space-y-1 list-disc list-inside">
                  <li>Use a clear, well-lit photo of the poster</li>
                  <li>Ensure all text is visible and not cut off</li>
                  <li>Supports English, Sinhala, and Tamil posters</li>
                  <li>Higher resolution images give better results</li>
                </ul>
              </div>
            )}
          </div>

          {/* Right: Status panel */}
          <div className="lg:sticky lg:top-6">
            {!isLoading && (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center bg-white/60">
                <ScanSearch size={40} className="text-gray-300 mx-auto mb-4" />
                <p className="text-sm text-ikman-muted">Extracted job details will appear on the next page</p>
              </div>
            )}

            {isLoading && (
              <div className="bg-white rounded-lg shadow-sm">
                <Loader />
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
