const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

/**
 * Downscales an image client-side before upload, so Gemini spends less time on a
 * phone-camera photo far larger than it needs to be to read poster text. Falls back
 * to the original file untouched if decoding fails (e.g. HEIC isn't decodable via
 * createImageBitmap in most browsers) or the image is already small enough.
 */
export async function resizeImageForUpload(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));

    if (scale >= 1) {
      bitmap.close();
      return file;
    }

    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    );
    if (!blob) return file;

    const resizedName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], resizedName, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
