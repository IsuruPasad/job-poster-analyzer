"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import ImageUploader from "./components/ImageUploader";
import Loader from "./components/Loader";
import { ApiResponse } from "@/types/job";
import { ScanSearch, Sparkles } from "lucide-react";

type AppState = "idle" | "loading";

export default function Home() {
  const router = useRouter();
  const [appState, setAppState] = useState<AppState>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleImageSelect = useCallback((file: File) => {
    setSelectedFile(file);
  }, []);

  const handleExtract = async () => {
    if (!selectedFile) return;

    setAppState("loading");

    try {
      const formData = new FormData();
      formData.append("image", selectedFile);

      const res = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });

      const json: ApiResponse = await res.json();

      if (json.success) {
        sessionStorage.setItem("jobData", JSON.stringify(json.data));
        sessionStorage.setItem("extractionSuccess", "true");
        sessionStorage.removeItem("extractionError");
      } else {
        sessionStorage.removeItem("jobData");
        sessionStorage.setItem("extractionSuccess", "false");
        sessionStorage.setItem("extractionError", json.error);
      }
    } catch {
      sessionStorage.removeItem("jobData");
      sessionStorage.setItem("extractionSuccess", "false");
      sessionStorage.setItem("extractionError", "A network error occurred. Please check your connection and try again.");
    }

    router.push("/job-form");
  };

  const isLoading = appState === "loading";

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-violet-50/20">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/60 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-xl">
            <ScanSearch size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-none">Job Poster Analyzer</h1>
            <p className="text-xs text-gray-400 mt-0.5">AI-powered extraction · English, Sinhala & Tamil</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-indigo-600 font-medium bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-full">
            <Sparkles size={12} />
            Powered by Gemini
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Left: Upload panel */}
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Extract Job Details</h2>
              <p className="text-sm text-gray-500 mt-1">
                Upload a job poster image and our AI will automatically extract all key information.
              </p>
            </div>

            <ImageUploader
              onImageSelect={handleImageSelect}
              disabled={isLoading}
            />

            {selectedFile && !isLoading && (
              <button
                onClick={handleExtract}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-semibold rounded-xl transition-all duration-150 shadow-md shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ScanSearch size={18} />
                Extract Job Details
              </button>
            )}

            {/* Tips */}
            {!selectedFile && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                <p className="text-xs font-semibold text-amber-700 mb-2">💡 Tips for best results</p>
                <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
                  <li>Use a clear, well-lit photo of the poster</li>
                  <li>Ensure all text is visible and not cut off</li>
                  <li>Supports English, Sinhala, and Tamil posters</li>
                  <li>Higher resolution images give better results</li>
                </ul>
              </div>
            )}
          </div>

          {/* Right: Status panel */}
          <div className="lg:sticky lg:top-24">
            {!isLoading && (
              <div className="border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center bg-white/50">
                <ScanSearch size={40} className="text-gray-200 mx-auto mb-4" />
                <p className="text-sm text-gray-400">Extracted job details will appear on the next page</p>
              </div>
            )}

            {isLoading && (
              <div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
                <Loader />
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
