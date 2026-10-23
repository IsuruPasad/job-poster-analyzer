// Poster upload rules, shared by the upload page (checked before uploading) and /api/extract
// (checked again server-side), so both report the same problem the same way.
import type { ImageMediaType } from "@/lib/ai/types";
import type { ExtractErrorCode } from "@/types/job";

/** Formats every AI provider accepts (Gemini has no GIF, Claude has no HEIC). */
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const satisfies readonly ImageMediaType[];
export const ACCEPTED_IMAGE_LABEL = "JPEG, PNG, or WebP";

/** Largest file the picker accepts — it's downscaled in the browser before upload. */
export const MAX_SELECTED_BYTES = 10 * 1024 * 1024;
/** Largest image the server sends to the AI (the strictest provider limit, Claude's 5 MB). */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export function isAcceptedImageType(type: string): type is ImageMediaType {
  return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(type);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Number((bytes / 1024).toFixed(1))} KB`;
  return `${Number((bytes / (1024 * 1024)).toFixed(1))} MB`;
}

/** Why this file can't be extracted from, or null if it's fine. */
export function validateImageFile(
  file: { name: string; type: string; size: number },
  maxBytes: number
): { code: ExtractErrorCode; message: string } | null {
  if (/^image\/hei[cf]$/.test(file.type) || /\.hei[cf]$/i.test(file.name)) {
    return {
      code: "UNSUPPORTED_FILE_TYPE",
      message: "HEIC/HEIF photos aren't supported. Please convert the image to JPEG or PNG and try again.",
    };
  }
  if (!file.type.startsWith("image/")) {
    return {
      code: "FILE_NOT_IMAGE",
      message: `"${file.name}" isn't an image${file.type ? ` (${file.type})` : ""}. Please upload a ${ACCEPTED_IMAGE_LABEL} photo of the poster.`,
    };
  }
  if (!isAcceptedImageType(file.type)) {
    return {
      code: "UNSUPPORTED_FILE_TYPE",
      message: `${file.type.replace("image/", "").toUpperCase()} images aren't supported. Please upload a ${ACCEPTED_IMAGE_LABEL} image.`,
    };
  }
  if (file.size === 0) {
    return { code: "FILE_EMPTY", message: `"${file.name}" is empty (0 bytes). Please choose another image.` };
  }
  if (file.size > maxBytes) {
    return {
      code: "FILE_TOO_LARGE",
      message: `The image is too large (${formatBytes(file.size)}). The maximum size is ${formatBytes(maxBytes)}.`,
    };
  }
  return null;
}
