type DataUrlValidationResult = {
  mimeType: string;
  byteSize: number;
};

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function validateDataUrl(
  dataUrl: string,
  opts?: { maxBytes?: number },
): DataUrlValidationResult {
  if (!dataUrl || typeof dataUrl !== "string") {
    throw new Error("Invalid image payload.");
  }
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid image data URL format.");
  }
  const mimeType = String(match[1] || "").toLowerCase().trim();
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error("Unsupported image type.");
  }
  const base64 = (match[2] || "").replace(/\s/g, "");
  if (!base64) {
    throw new Error("Image data is empty.");
  }

  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const byteSize = Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
  const maxBytes = opts?.maxBytes ?? 0;
  if (maxBytes > 0 && byteSize > maxBytes) {
    throw new Error("Image exceeds size limit.");
  }

  return { mimeType, byteSize };
}

export const IMAGE_LIMITS = {
  maxImagesPerMessage: 3,
  maxImageBytes: 2.5 * 1024 * 1024,
};
