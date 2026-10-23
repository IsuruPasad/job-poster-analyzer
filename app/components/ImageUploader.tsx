"use client";

import { useCallback, useState } from "react";
import { Upload, ImageIcon, X } from "lucide-react";
import { ACCEPTED_IMAGE_TYPES, MAX_SELECTED_BYTES, formatBytes, validateImageFile } from "@/lib/uploadLimits";
import type { ExtractErrorCode } from "@/types/job";

export interface FileProblem {
  code: ExtractErrorCode;
  message: string;
}

interface ImageUploaderProps {
  onImageSelect: (file: File, previewUrl: string) => void;
  /** Called instead of onImageSelect when the chosen file can't be used (wrong type, too big, damaged, …). */
  onInvalidFile: (problem: FileProblem, file: File) => void;
  /** Called when the selected image is removed (✕ button, or it turned out to be unreadable). */
  onClear: () => void;
  disabled?: boolean;
}

export default function ImageUploader({ onImageSelect, onInvalidFile, onClear, disabled }: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const fileName = file?.name;

  const handleFile = useCallback(
    (selected: File) => {
      const problem = validateImageFile(selected, MAX_SELECTED_BYTES);
      if (problem) {
        onInvalidFile(problem, selected);
        return;
      }
      const url = URL.createObjectURL(selected);
      setPreview((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return url;
      });
      setFile(selected);
      onImageSelect(selected, url);
    },
    [onImageSelect, onInvalidFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    // Reset so choosing the same file again (e.g. after fixing it) still fires onChange.
    e.target.value = "";
    if (selected) handleFile(selected);
  };

  const clearImage = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFile(null);
    onClear();
  };

  // The browser couldn't decode it even though the type looked right — a damaged or mislabeled file.
  const handlePreviewError = () => {
    const damaged = file;
    clearImage();
    if (damaged) {
      onInvalidFile(
        { code: "FILE_UNREADABLE", message: `"${damaged.name}" couldn't be opened — the file may be damaged. Please choose another image.` },
        damaged
      );
    }
  };

  return (
    <div className="w-full">
      {preview ? (
        <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-white shadow-sm">
          <img
            src={preview}
            alt="Uploaded job poster"
            onError={handlePreviewError}
            className="w-full max-h-96 object-contain"
          />
          <div className="absolute top-3 right-3 flex gap-2">
            <button
              type="button"
              onClick={clearImage}
              disabled={disabled}
              className="bg-white/90 backdrop-blur-sm text-gray-600 hover:text-red-500 border border-gray-200 rounded-full p-1.5 shadow transition-colors disabled:opacity-50"
              title="Remove image"
            >
              <X size={16} />
            </button>
          </div>
          {fileName && (
            <div className="bg-white/90 backdrop-blur-sm px-4 py-2 flex items-center gap-2 border-t border-gray-200">
              <ImageIcon size={14} className="text-ikman-green flex-shrink-0" />
              <span className="text-xs text-gray-600 truncate">{fileName}</span>
            </div>
          )}
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-all duration-200
            ${isDragging
              ? "border-ikman-green bg-ikman-green/5 scale-[1.01]"
              : "border-gray-300 bg-white hover:border-ikman-green hover:bg-ikman-green/5"
            }
            ${disabled ? "opacity-50 pointer-events-none" : ""}
          `}
        >
          <input
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(",")}
            onChange={handleInputChange}
            disabled={disabled}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="flex flex-col items-center gap-4">
            <div className={`p-4 rounded-full text-ikman-green transition-colors ${isDragging ? "bg-ikman-green/20" : "bg-ikman-green/10"}`}>
              <Upload size={32} />
            </div>
            <div>
              <p className="text-base font-medium text-ikman-ink">
                {isDragging ? "Drop your job poster here" : "Drag & drop your job poster"}
              </p>
              <p className="text-sm text-ikman-muted mt-1">or click to browse files</p>
            </div>
            <p className="text-xs text-ikman-muted bg-ikman-bg px-3 py-1.5 rounded-full">
              JPEG, PNG, WebP — max {formatBytes(MAX_SELECTED_BYTES)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
