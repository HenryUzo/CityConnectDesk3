import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const ALLOWED_IMAGE_TYPES = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

const DATA_URL_PATTERN = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([\s\S]+)$/i;
const INVENTORY_UPLOAD_PATH_PATTERN = /^\/uploads\/inventory\/[a-zA-Z0-9._-]+$/;

export const MAX_INVENTORY_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_INVENTORY_IMAGES = 6;

export const uploadsRootDir = path.resolve(process.cwd(), "uploads");
export const inventoryUploadsDir = path.join(uploadsRootDir, "inventory");
export const inventoryUploadsPublicPrefix = "/uploads/inventory";

type PersistImageParams = {
  buffer: Buffer;
  mimeType: string;
  storeId: string;
  uploaderId: string;
};

function normalizeMimeType(value: string) {
  const normalized = String(value || "").toLowerCase().trim();
  return normalized === "image/jpg" ? "image/jpeg" : normalized;
}

function sanitizeSegment(value: string, fallback: string) {
  const sanitized = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return sanitized || fallback;
}

function decodeDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } {
  const match = dataUrl.match(DATA_URL_PATTERN);
  if (!match) {
    throw new Error("Unsupported image payload format.");
  }

  const mimeType = normalizeMimeType(match[1] || "");
  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
    throw new Error("Unsupported image type. Use JPG, PNG, or WEBP.");
  }

  const base64Content = (match[2] || "").replace(/\s/g, "");
  if (!base64Content) {
    throw new Error("Image payload is empty.");
  }

  const buffer = Buffer.from(base64Content, "base64");
  if (!buffer.length) {
    throw new Error("Image payload is empty.");
  }

  return { mimeType, buffer };
}

export async function ensureInventoryUploadsDir() {
  await fs.mkdir(inventoryUploadsDir, { recursive: true });
}

export async function persistInventoryImage({
  buffer,
  mimeType,
  storeId,
  uploaderId,
}: PersistImageParams) {
  const normalizedMimeType = normalizeMimeType(mimeType);
  const extension = ALLOWED_IMAGE_TYPES.get(normalizedMimeType);
  if (!extension) {
    throw new Error("Unsupported image type. Use JPG, PNG, or WEBP.");
  }

  if (!buffer.length) {
    throw new Error("Image file is empty.");
  }
  if (buffer.length > MAX_INVENTORY_IMAGE_BYTES) {
    throw new Error(
      `Image exceeds size limit (${Math.floor(MAX_INVENTORY_IMAGE_BYTES / (1024 * 1024))}MB max).`,
    );
  }

  await ensureInventoryUploadsDir();

  const fileName = `${sanitizeSegment(storeId, "store")}-${sanitizeSegment(
    uploaderId,
    "user",
  )}-${Date.now()}-${randomUUID().slice(0, 8)}.${extension}`;

  const targetPath = path.join(inventoryUploadsDir, fileName);
  await fs.writeFile(targetPath, buffer);

  return {
    fileName,
    mimeType: normalizedMimeType,
    byteSize: buffer.length,
    url: `${inventoryUploadsPublicPrefix}/${fileName}`,
  };
}

function isValidImageReference(value: string) {
  if (INVENTORY_UPLOAD_PATH_PATTERN.test(value)) return true;
  if (/^https?:\/\/[^\s]+$/i.test(value)) return true;
  return false;
}

type NormalizeImageParams = {
  images: unknown;
  storeId: string;
  uploaderId: string;
  maxImages?: number;
};

export async function normalizeAndPersistInventoryImages({
  images,
  storeId,
  uploaderId,
  maxImages = MAX_INVENTORY_IMAGES,
}: NormalizeImageParams): Promise<string[] | undefined> {
  if (images === undefined) return undefined;
  if (images === null) return [];
  if (!Array.isArray(images)) {
    throw new Error("Images must be an array.");
  }

  const normalized: string[] = [];

  for (const entry of images) {
    if (normalized.length >= maxImages) break;
    if (typeof entry !== "string") {
      throw new Error("Invalid image reference provided.");
    }

    const trimmed = entry.trim();
    if (!trimmed) continue;

    if (isValidImageReference(trimmed)) {
      if (!normalized.includes(trimmed)) normalized.push(trimmed);
      continue;
    }

    if (DATA_URL_PATTERN.test(trimmed)) {
      const { mimeType, buffer } = decodeDataUrl(trimmed);
      const persisted = await persistInventoryImage({
        buffer,
        mimeType,
        storeId,
        uploaderId,
      });
      if (!normalized.includes(persisted.url)) normalized.push(persisted.url);
      continue;
    }

    throw new Error("Unsupported image reference format. Upload image files first.");
  }

  return normalized;
}
