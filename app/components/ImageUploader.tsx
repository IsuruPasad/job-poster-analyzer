"use client";

import { useCallback, useState } from "react";
import { Upload, ImageIcon, X } from "lucide-react";

interface ImageUploaderProps {
  onImageSelect: (file: File, previewUrl: string) => void;
  disabled?: boolean;
}

export default function ImageUploader({ onImageSelect, disabled }: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const url = URL.createObjectURL(file);
      setPreview(url);
      setFileName(file.name);
      onImageSelect(file, url);
    },
    [onImageSelect]
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
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const clearImage = () => {
    setPreview(null);
    setFileName(null);
  };

  return (
    <div className="w-full">
      {preview ? (
        <div className="relative rounded-2xl overflow-hidden border-2 border-indigo-200 bg-gray-50">
          <img
            src={preview}
            alt="Uploaded job poster"
            className="w-full max-h-96 object-contain"
          />
          <div className="absolute top-3 right-3 flex gap-2">
            <button
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
              <ImageIcon size={14} className="text-indigo-500 flex-shrink-0" />
              <span className="text-xs text-gray-600 truncate">{fileName}</span>
            </div>
          )}
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200
            ${isDragging
              ? "border-indigo-500 bg-indigo-50 scale-[1.01]"
              : "border-gray-300 bg-gray-50 hover:border-indigo-400 hover:bg-indigo-50/50"
            }
            ${disabled ? "opacity-50 pointer-events-none" : ""}
          `}
        >
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            onChange={handleInputChange}
            disabled={disabled}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="flex flex-col items-center gap-4">
            <div className={`p-4 rounded-full transition-colors ${isDragging ? "bg-indigo-100" : "bg-gray-100"}`}>
              <Upload size={32} className={isDragging ? "text-indigo-600" : "text-gray-400"} />
            </div>
            <div>
              <p className="text-base font-medium text-gray-700">
                {isDragging ? "Drop your job poster here" : "Drag & drop your job poster"}
              </p>
              <p className="text-sm text-gray-400 mt-1">or click to browse files</p>
            </div>
            <p className="text-xs text-gray-400 bg-white/70 px-3 py-1.5 rounded-full border border-gray-200">
              JPEG, PNG, WebP, HEIC — max 10 MB
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
