import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${derived.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  const normalizedSupplied = String(supplied ?? "");
  const normalizedStored = String(stored ?? "");

  if (!normalizedStored) {
    return false;
  }

  const parts = normalizedStored.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    // Graceful fallback for legacy/plain-text records so login fails closed
    // without throwing a server error on malformed password data.
    return normalizedSupplied === normalizedStored;
  }

  const [hash, salt] = parts;

  try {
    const hashedBuf = Buffer.from(hash, "hex");
    if (!hashedBuf.length) {
      return false;
    }
    const suppliedBuf = (await scryptAsync(normalizedSupplied, salt, 64)) as Buffer;
    if (hashedBuf.length !== suppliedBuf.length) {
      return false;
    }
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch {
    return false;
  }
}
