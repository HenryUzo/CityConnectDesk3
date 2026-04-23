import { createPublicKey, verify as verifySignature, type JsonWebKey } from "crypto";

type GoogleJwtHeader = {
  alg?: string;
  kid?: string;
  typ?: string;
};

type GoogleJwtPayload = {
  iss?: string;
  aud?: string;
  exp?: number;
  iat?: number;
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
};

type GoogleJwk = JsonWebKey & {
  kid?: string;
  alg?: string;
};

type GoogleJwksResponse = {
  keys?: GoogleJwk[];
};

export type VerifiedGoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
};

let cachedKeys: GoogleJwk[] | null = null;
let cachedKeysExpiresAt = 0;

function base64UrlDecode(value: string) {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), "=");
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64");
}

function parseJwtPart<T>(value: string): T {
  return JSON.parse(base64UrlDecode(value).toString("utf8")) as T;
}

function getAllowedClientIds() {
  const raw = String(process.env.GOOGLE_CLIENT_ID || "").trim();
  if (!raw) {
    throw new Error("GOOGLE_CLIENT_ID environment variable is required");
  }

  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getMaxAgeFromCacheControl(value: string | null) {
  const match = String(value || "").match(/max-age=(\d+)/i);
  return match ? Number(match[1]) * 1000 : 60 * 60 * 1000;
}

async function getGoogleJwks() {
  if (cachedKeys && Date.now() < cachedKeysExpiresAt) {
    return cachedKeys;
  }

  const response = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  if (!response.ok) {
    throw new Error("Unable to verify Google sign-in right now");
  }

  const body = (await response.json()) as GoogleJwksResponse;
  if (!Array.isArray(body.keys) || body.keys.length === 0) {
    throw new Error("Google sign-in verification keys are unavailable");
  }

  cachedKeys = body.keys;
  cachedKeysExpiresAt = Date.now() + getMaxAgeFromCacheControl(response.headers.get("cache-control"));
  return cachedKeys;
}

export async function verifyGoogleCredential(credential: string): Promise<VerifiedGoogleProfile> {
  const token = String(credential || "").trim();
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid Google sign-in response");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = parseJwtPart<GoogleJwtHeader>(encodedHeader);
  const payload = parseJwtPart<GoogleJwtPayload>(encodedPayload);

  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("Invalid Google sign-in response");
  }

  const keys = await getGoogleJwks();
  const jwk = keys.find((key) => key.kid === header.kid);
  if (!jwk) {
    cachedKeys = null;
    throw new Error("Google sign-in verification key was not found");
  }

  const signingInput = Buffer.from(`${encodedHeader}.${encodedPayload}`);
  const signature = base64UrlDecode(encodedSignature);
  const publicKey = createPublicKey({ key: jwk as JsonWebKey, format: "jwk" });
  const isValidSignature = verifySignature("RSA-SHA256", signingInput, publicKey, signature);

  if (!isValidSignature) {
    throw new Error("Invalid Google sign-in response");
  }

  const allowedClientIds = getAllowedClientIds();
  const issuer = String(payload.iss || "");
  const audience = String(payload.aud || "");
  const expiresAt = Number(payload.exp || 0);
  const issuedAt = Number(payload.iat || 0);
  const now = Math.floor(Date.now() / 1000);

  if (issuer !== "accounts.google.com" && issuer !== "https://accounts.google.com") {
    throw new Error("Invalid Google sign-in issuer");
  }

  if (!allowedClientIds.includes(audience)) {
    throw new Error("Invalid Google sign-in audience");
  }

  if (!expiresAt || expiresAt <= now) {
    throw new Error("Google sign-in has expired. Try again.");
  }

  if (issuedAt && issuedAt > now + 300) {
    throw new Error("Invalid Google sign-in timestamp");
  }

  const email = String(payload.email || "").trim().toLowerCase();
  const emailVerified = payload.email_verified === true || payload.email_verified === "true";
  const sub = String(payload.sub || "").trim();

  if (!sub || !email) {
    throw new Error("Google sign-in did not return a usable profile");
  }

  if (!emailVerified) {
    throw new Error("Google account email is not verified");
  }

  return {
    sub,
    email,
    emailVerified,
    name: payload.name,
    givenName: payload.given_name,
    familyName: payload.family_name,
    picture: payload.picture,
  };
}
