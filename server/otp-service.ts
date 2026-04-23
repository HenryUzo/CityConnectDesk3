import { randomInt, createHash } from "crypto";
import jwt from "jsonwebtoken";
import { and, eq, or } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import { comparePasswords } from "./auth-utils";
import { sendOtp } from "./otp-provider";
import { providerRequestSchema } from "@shared/admin-schema";
import {
  estates,
  memberships,
  otpChallenges,
  pendingRegistrations,
  users,
  type InsertProviderRequest,
  type InsertUser,
  type OtpChallenge,
  type PendingRegistration,
  type User,
} from "@shared/schema";

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 30 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const VERIFICATION_TOKEN_EXPIRY = "15m";
type OtpPurpose = "signup_verify" | "login_verify";
type OtpChannel = "sms" | "email";

type SignupPayload = Record<string, unknown> & {
  role?: string;
  password?: string;
  email?: string;
  phone?: string;
  estateAccessMode?: string;
};

type LoginStartInput = {
  identifier?: string;
  email?: string;
  username?: string;
  accessCode?: string;
  password?: string;
};

type ChallengeResponse = {
  challengeId: string;
  expiresIn: number;
  resendAvailableIn: number;
  maskedDestination: string;
  pendingRegistrationId?: string | null;
  userId?: string | null;
  debugCode?: string;
};

type VerificationResponse = {
  verified: true;
  verificationToken: string;
  pendingRegistrationId: string | null;
  userId: string | null;
};

type VerificationTokenPayload = {
  challengeId: string;
  purpose: OtpPurpose;
  pendingRegistrationId?: string | null;
  userId?: string | null;
};

function getJwtSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  return process.env.JWT_SECRET;
}

function normalizeEmail(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizePhone(value?: string | null) {
  return String(value || "").trim();
}

function chooseOtpDestination(input: { phone?: string | null; email?: string | null }) {
  const email = normalizeEmail(input.email);
  if (email) {
    return {
      channel: "email" as const,
      destination: email,
    };
  }

  const phone = normalizePhone(input.phone);
  if (phone) {
    return {
      channel: "sms" as const,
      destination: phone,
    };
  }

  throw new Error("A phone number or email address is required for OTP verification");
}

function maskDestination(destination: string, channel: OtpChannel) {
  if (channel === "email") {
    const [local, domain] = destination.split("@");
    if (!local || !domain) return destination;
    const prefix = local.slice(0, 2);
    const suffix = local.slice(-1);
    return `${prefix}${"*".repeat(Math.max(local.length - 3, 2))}${suffix}@${domain}`;
  }

  const trimmed = destination.replace(/\s+/g, "");
  if (trimmed.length <= 4) return trimmed;
  return `${trimmed.slice(0, 4)}${"*".repeat(Math.max(trimmed.length - 7, 3))}${trimmed.slice(-3)}`;
}

function hashOtpCode(code: string) {
  return createHash("sha256")
    .update(`${code}:${getJwtSecret()}`)
    .digest("hex");
}

function generateOtpCode() {
  return String(randomInt(100000, 1000000));
}

function getFutureDate(ms: number) {
  return new Date(Date.now() + ms);
}

function getVerificationToken(payload: VerificationTokenPayload) {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: VERIFICATION_TOKEN_EXPIRY,
    issuer: "cityconnect",
    audience: "cityconnect-otp",
  });
}

function verifyVerificationToken(token: string) {
  return jwt.verify(token, getJwtSecret(), {
    issuer: "cityconnect",
    audience: "cityconnect-otp",
  }) as VerificationTokenPayload;
}

function buildResidentDisplayName(payload: SignupPayload) {
  const firstName = String(payload.firstName || "").trim();
  const lastName = String(payload.lastName || "").trim();
  return (
    String(payload.name || "").trim() ||
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    normalizeEmail(String(payload.email || "")) ||
    normalizePhone(String(payload.phone || ""))
  );
}

function normalizeSignupPayload(input: SignupPayload) {
  const role = input.role === "provider" ? "provider" : "resident";
  const email = normalizeEmail(String(input.email || ""));
  const username = String(input.username || email || "").trim();
  const phone = normalizePhone(String(input.phone || ""));
  const { channel, destination } = chooseOtpDestination({ phone, email });

  const normalizedPayload: SignupPayload = {
    ...input,
    role,
    email,
    username,
    phone,
  };

  if (!normalizedPayload.name && role === "resident") {
    normalizedPayload.name = buildResidentDisplayName(normalizedPayload);
  }

  return {
    payload: normalizedPayload,
    contactChannel: channel,
    contactValue: destination,
  };
}

async function invalidatePendingChallenges(destination: string, purpose: OtpPurpose) {
  await db
    .update(otpChallenges)
    .set({
      status: "cancelled",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(otpChallenges.destination, destination),
        eq(otpChallenges.purpose, purpose),
        eq(otpChallenges.status, "pending"),
      ),
    );
}

async function ensureUniqueSignupIdentity(payload: SignupPayload) {
  const email = normalizeEmail(String(payload.email || ""));
  const username = String(payload.username || "").trim();
  const phone = normalizePhone(String(payload.phone || ""));

  if (email) {
    const existingByEmail = await storage.getUserByEmail(email);
    if (existingByEmail) {
      throw new Error("User already exists");
    }
  }

  if (username) {
    const existingByUsername = await storage.getUserByUsername(username);
    if (existingByUsername) {
      throw new Error("Username already exists");
    }
  }

  if (phone) {
    const [existingByPhone] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phone, phone))
      .limit(1);
    if (existingByPhone) {
      throw new Error("A user with that phone number already exists");
    }
  }
}

export async function resolveRegistrationEstateId(params: {
  inviteCode?: string | null;
  estateId?: string | null;
  estateAccessMode?: string | null;
}) {
  const trimmedInvite = String(params.inviteCode || "").trim();
  const trimmedEstateId = String(params.estateId || "").trim();
  const accessMode = String(params.estateAccessMode || "").trim().toLowerCase();

  if (accessMode === "none") {
    return null;
  }

  if (accessMode === "access_code") {
    if (!trimmedInvite) {
      throw new Error("Access code is required");
    }
    if (trimmedEstateId) {
      throw new Error("Do not select an estate when using an access code");
    }
  }

  if (accessMode === "open_estate") {
    if (!trimmedEstateId) {
      throw new Error("Select an estate to continue");
    }
    if (trimmedInvite) {
      throw new Error("Do not provide an access code when selecting an estate");
    }
  }

  if (trimmedInvite && trimmedEstateId) {
    throw new Error("Provide either an access code or select an estate");
  }

  if (trimmedInvite) {
    const [estate] = await db
      .select({
        id: estates.id,
        accessType: estates.accessType,
      })
      .from(estates)
      .where(eq(estates.accessCode, trimmedInvite))
      .limit(1);

    if (!estate) {
      throw new Error("Invalid access code");
    }

    const accessType = String(estate.accessType || "").toLowerCase();
    if (accessType && accessType !== "open" && accessType !== "code") {
      throw new Error("Access code not allowed for this estate");
    }

    return estate.id;
  }

  if (trimmedEstateId) {
    const [estate] = await db
      .select({
        id: estates.id,
        accessType: estates.accessType,
      })
      .from(estates)
      .where(eq(estates.id, trimmedEstateId))
      .limit(1);

    if (!estate) {
      throw new Error("Estate not found");
    }

    const accessType = String(estate.accessType || "").toLowerCase();
    if (accessType && accessType !== "open" && accessType !== "code") {
      throw new Error("Estate does not allow open registration");
    }

    return estate.id;
  }

  return null;
}

async function createChallengeRecord(input: {
  purpose: OtpPurpose;
  channel: OtpChannel;
  destination: string;
  pendingRegistrationId?: string | null;
  userId?: string | null;
}) {
  const code = generateOtpCode();
  const challenge = await storage.createOtpChallenge({
    purpose: input.purpose,
    channel: input.channel,
    destination: input.destination,
    pendingRegistrationId: input.pendingRegistrationId || null,
    userId: input.userId || null,
    codeHash: hashOtpCode(code),
    status: "pending",
    attemptCount: 0,
    maxAttempts: OTP_MAX_ATTEMPTS,
    expiresAt: getFutureDate(OTP_EXPIRY_MS),
    lastSentAt: new Date(),
  } as any);

  await sendOtp({
    channel: input.channel,
    destination: input.destination,
    code,
    purpose: input.purpose,
  });

  return { challenge, code };
}

function shouldExposeOtpDebugCode() {
  return process.env.NODE_ENV !== "production";
}

function buildChallengeResponse(
  challenge: OtpChallenge,
  options?: { debugCode?: string },
): ChallengeResponse {
  return {
    challengeId: challenge.id,
    expiresIn: Math.max(0, Math.ceil((new Date(challenge.expiresAt).getTime() - Date.now()) / 1000)),
    resendAvailableIn: Math.max(
      0,
      Math.ceil(
        (new Date(challenge.lastSentAt || new Date()).getTime() + OTP_RESEND_COOLDOWN_MS - Date.now()) /
          1000,
      ),
    ),
    maskedDestination: maskDestination(challenge.destination, challenge.channel),
    pendingRegistrationId: challenge.pendingRegistrationId || null,
    userId: challenge.userId || null,
    debugCode: shouldExposeOtpDebugCode() ? options?.debugCode : undefined,
  };
}

export async function startSignupOtp(input: SignupPayload): Promise<ChallengeResponse> {
  const { payload, contactChannel, contactValue } = normalizeSignupPayload(input);
  await ensureUniqueSignupIdentity(payload);

  const password = String(payload.password || "");
  if (!password) {
    throw new Error("Password is required");
  }

  const resolvedEstateId =
    payload.role === "resident"
      ? await resolveRegistrationEstateId({
          inviteCode: String(payload.inviteCode || ""),
          estateId: String(payload.estateId || ""),
          estateAccessMode: String(payload.estateAccessMode || ""),
        })
      : null;

  const passwordHash = await import("./auth-utils").then(({ hashPassword }) => hashPassword(password));

  const pendingPayload = {
    ...payload,
    email: normalizeEmail(String(payload.email || "")),
    phone: normalizePhone(String(payload.phone || "")),
    passwordHash,
    password: undefined,
    resolvedEstateId,
  };

  await db
    .update(pendingRegistrations)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(
      and(
        eq(pendingRegistrations.contactValue, contactValue),
        eq(pendingRegistrations.status, "pending"),
      ),
    );

  await invalidatePendingChallenges(contactValue, "signup_verify");

  const pendingRegistration = await storage.createPendingRegistration({
    role: payload.role === "provider" ? "provider" : "resident",
    payload: pendingPayload,
    contactChannel,
    contactValue,
    status: "pending",
    expiresAt: getFutureDate(OTP_EXPIRY_MS),
  } as any);

  const { challenge, code } = await createChallengeRecord({
    purpose: "signup_verify",
    channel: contactChannel,
    destination: contactValue,
    pendingRegistrationId: pendingRegistration.id,
  });

  return buildChallengeResponse(challenge, { debugCode: code });
}

async function findUserByIdentifier(input: LoginStartInput) {
  const accessCode = String(input.accessCode || "").trim();
  if (accessCode) {
    return storage.getUserByAccessCode(accessCode);
  }

  const identifier = normalizeEmail(String(input.email || input.username || input.identifier || ""));
  const rawIdentifier = String(input.email || input.username || input.identifier || "").trim();
  if (!identifier && !rawIdentifier) return undefined;

  const byStorage = await storage.getUserByUsername(rawIdentifier);
  if (byStorage) return byStorage;

  const [row] = await db
    .select()
    .from(users)
    .where(
      or(
        eq(users.email, identifier),
        eq(users.phone, rawIdentifier),
        eq(users.username, rawIdentifier),
        eq(users.name, rawIdentifier),
      ),
    )
    .limit(1);

  return row as User | undefined;
}

export async function startLoginOtp(input: LoginStartInput): Promise<ChallengeResponse> {
  const user = await findUserByIdentifier(input);
  if (!user) {
    throw new Error("Invalid credentials");
  }

  const accessCode = String(input.accessCode || "").trim();
  if (!accessCode) {
    const passwordMatches = await comparePasswords(
      String(input.password || ""),
      String(user.password || ""),
    );
    if (!passwordMatches) {
      throw new Error("Invalid credentials");
    }
  }

  if (user.isActive === false) {
    throw new Error("Account is inactive");
  }

  const { channel, destination } = chooseOtpDestination({
    phone: user.phone,
    email: user.email,
  });

  await invalidatePendingChallenges(destination, "login_verify");
  const { challenge, code } = await createChallengeRecord({
    purpose: "login_verify",
    channel,
    destination,
    userId: user.id,
  });

  return buildChallengeResponse(challenge, { debugCode: code });
}

export async function resendOtpChallenge(challengeId: string): Promise<ChallengeResponse> {
  const challenge = await storage.getOtpChallenge(challengeId);
  if (!challenge) {
    throw new Error("OTP challenge not found");
  }

  if (challenge.status !== "pending") {
    throw new Error("OTP challenge is no longer active");
  }

  const lastSent = challenge.lastSentAt ? new Date(challenge.lastSentAt).getTime() : 0;
  const remaining = lastSent + OTP_RESEND_COOLDOWN_MS - Date.now();
  if (remaining > 0) {
    throw new Error(`Please wait ${Math.ceil(remaining / 1000)} seconds before requesting another code`);
  }

  const code = generateOtpCode();
  const updated = await storage.updateOtpChallenge(challenge.id, {
    codeHash: hashOtpCode(code),
    attemptCount: 0,
    expiresAt: getFutureDate(OTP_EXPIRY_MS),
    lastSentAt: new Date(),
    status: "pending",
  } as any);

  if (!updated) {
    throw new Error("Failed to update OTP challenge");
  }

  await sendOtp({
    channel: updated.channel,
    destination: updated.destination,
    code,
    purpose: updated.purpose,
  });

  return buildChallengeResponse(updated, { debugCode: code });
}

export async function verifyOtpChallenge(
  challengeId: string,
  code: string,
): Promise<VerificationResponse> {
  const challenge = await storage.getOtpChallenge(challengeId);
  if (!challenge) {
    throw new Error("OTP challenge not found");
  }

  if (challenge.status !== "pending") {
    throw new Error("OTP challenge is no longer active");
  }

  if (new Date(challenge.expiresAt).getTime() < Date.now()) {
    await storage.updateOtpChallenge(challenge.id, { status: "expired" } as any);
    throw new Error("OTP code has expired");
  }

  if (challenge.attemptCount >= challenge.maxAttempts) {
    await storage.updateOtpChallenge(challenge.id, { status: "locked" } as any);
    throw new Error("Too many invalid attempts");
  }

  if (hashOtpCode(code) !== challenge.codeHash) {
    const nextAttemptCount = challenge.attemptCount + 1;
    await storage.updateOtpChallenge(challenge.id, {
      attemptCount: nextAttemptCount,
      status: nextAttemptCount >= challenge.maxAttempts ? "locked" : challenge.status,
    } as any);
    if (nextAttemptCount >= challenge.maxAttempts) {
      throw new Error("Too many invalid attempts");
    }
    throw new Error("Invalid verification code");
  }

  await storage.updateOtpChallenge(challenge.id, {
    status: "verified",
    verifiedAt: new Date(),
  } as any);

  if (challenge.pendingRegistrationId) {
    await storage.updatePendingRegistration(challenge.pendingRegistrationId, {
      status: "verified",
    } as any);
  }

  return {
    verified: true,
    verificationToken: getVerificationToken({
      challengeId: challenge.id,
      purpose: challenge.purpose,
      pendingRegistrationId: challenge.pendingRegistrationId || null,
      userId: challenge.userId || null,
    }),
    pendingRegistrationId: challenge.pendingRegistrationId || null,
    userId: challenge.userId || null,
  };
}

export async function getVerifiedChallengeContext(
  verificationToken: string,
  expected: { purpose: OtpPurpose; challengeId?: string; pendingRegistrationId?: string },
) {
  const payload = verifyVerificationToken(verificationToken);

  if (payload.purpose !== expected.purpose) {
    throw new Error("Verification token purpose mismatch");
  }

  if (expected.challengeId && payload.challengeId !== expected.challengeId) {
    throw new Error("Verification token does not match this challenge");
  }

  if (
    expected.pendingRegistrationId &&
    payload.pendingRegistrationId !== expected.pendingRegistrationId
  ) {
    throw new Error("Verification token does not match this registration");
  }

  const challenge = await storage.getOtpChallenge(payload.challengeId);
  if (!challenge || challenge.status !== "verified") {
    throw new Error("OTP challenge is not verified");
  }

  return {
    challenge,
    pendingRegistrationId: payload.pendingRegistrationId || null,
    userId: payload.userId || null,
  };
}

function buildResidentInsertUser(payload: SignupPayload): InsertUser {
  const email = normalizeEmail(String(payload.email || ""));
  const phone = normalizePhone(String(payload.phone || ""));
  const fallbackEmail = email || `phone-${phone.replace(/\D/g, "") || Date.now()}@cityconnect.local`;
  const locationRecord =
    typeof payload.location === "object" && payload.location
      ? (payload.location as Record<string, unknown>)
      : null;
  const latitudeValue = Number(locationRecord?.latitude);
  const longitudeValue = Number(locationRecord?.longitude);

  return {
    firstName: String(payload.firstName || "").trim() || undefined,
    lastName: String(payload.lastName || "").trim() || undefined,
    name: buildResidentDisplayName(payload),
    email: fallbackEmail,
    username: String(payload.username || fallbackEmail).trim(),
    phone,
    password: String(payload.passwordHash || ""),
    role: "resident",
    isActive: true,
    isApproved: true,
    location:
      typeof payload.location === "string"
        ? payload.location
        : locationRecord
          ? String(locationRecord.address || "")
          : undefined,
    latitude: Number.isFinite(latitudeValue) ? latitudeValue : undefined,
    longitude: Number.isFinite(longitudeValue) ? longitudeValue : undefined,
  } as InsertUser;
}

async function createResidentFromPending(
  pendingRegistration: PendingRegistration,
  payload: SignupPayload,
) {
  const user = await storage.createUser(buildResidentInsertUser(payload));
  const resolvedEstateId = String(payload.resolvedEstateId || "").trim();

  if (resolvedEstateId) {
    const [existingMembership] = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(and(eq(memberships.userId, user.id), eq(memberships.estateId, resolvedEstateId)))
      .limit(1);

    if (!existingMembership) {
      await db.insert(memberships).values({
        userId: user.id,
        estateId: resolvedEstateId,
        role: "resident",
        isPrimary: true,
        isActive: true,
        status: "active",
      } as any);
    }
  }

  await storage.updatePendingRegistration(pendingRegistration.id, { status: "verified" } as any);
  return user;
}

async function createProviderFromPending(
  pendingRegistration: PendingRegistration,
  payload: SignupPayload,
) {
  const parsed = providerRequestSchema.parse({
    ...payload,
    email: normalizeEmail(String(payload.email || "")),
    phone: normalizePhone(String(payload.phone || "")),
    password: undefined,
  });

  const combinedName = (parsed.name || `${parsed.firstName} ${parsed.lastName}`).trim();
  const wantsNewCompany =
    parsed.companyMode === "new" &&
    typeof parsed.newCompanyName === "string" &&
    parsed.newCompanyName.trim();
  let resolvedCompanyId = (parsed.companyId || parsed.company || "").trim();

  const user = await storage.createUser({
    firstName: parsed.firstName,
    lastName: parsed.lastName,
    name: combinedName,
    email: normalizeEmail(parsed.email),
    username: normalizeEmail(parsed.email),
    phone: normalizePhone(parsed.phone || ""),
    password: String(payload.passwordHash || ""),
    role: "provider",
    company: wantsNewCompany ? "" : resolvedCompanyId,
    categories: parsed.categories,
    experience: parsed.experience,
    isActive: true,
    isApproved: false,
    metadata: parsed.description ? { description: parsed.description } : undefined,
  } as InsertUser);

  if (wantsNewCompany) {
    const createdCompany = await storage.createCompany({
      name: parsed.newCompanyName!.trim(),
      description: parsed.newCompanyDescription?.trim(),
      contactEmail: parsed.email,
      phone: parsed.phone || "",
      providerId: user.id,
      submittedAt: new Date(),
      isActive: false,
      details: {},
    } as any);
    resolvedCompanyId = createdCompany.id;
  }

  if (resolvedCompanyId) {
    await storage.updateUser(user.id, { company: resolvedCompanyId } as any);
  }

  await storage.createProviderRequest(
    {
      ...(parsed as InsertProviderRequest),
      name: combinedName,
      company: resolvedCompanyId || parsed.company,
      providerId: user.id,
    } as any,
    user.id,
  );

  await storage.updatePendingRegistration(pendingRegistration.id, { status: "verified" } as any);
  return user;
}

export async function completeSignupRegistration(input: {
  pendingRegistrationId: string;
  verificationToken: string;
}) {
  const pendingRegistration = await storage.getPendingRegistration(input.pendingRegistrationId);
  if (!pendingRegistration) {
    throw new Error("Pending registration not found");
  }

  if (new Date(pendingRegistration.expiresAt).getTime() < Date.now()) {
    await storage.updatePendingRegistration(pendingRegistration.id, { status: "expired" } as any);
    throw new Error("Pending registration has expired");
  }

  await getVerifiedChallengeContext(input.verificationToken, {
    purpose: "signup_verify",
    pendingRegistrationId: pendingRegistration.id,
  });

  const payload = (pendingRegistration.payload || {}) as SignupPayload;
  const email = normalizeEmail(String(payload.email || ""));
  if (email) {
    const existingUser = await storage.getUserByEmail(email);
    if (existingUser) {
      throw new Error("User already exists");
    }
  }

  if (pendingRegistration.role === "provider") {
    return createProviderFromPending(pendingRegistration, payload);
  }

  return createResidentFromPending(pendingRegistration, payload);
}

export async function completeLoginVerification(input: {
  challengeId: string;
  code: string;
}) {
  const verified = await verifyOtpChallenge(input.challengeId, input.code);
  if (!verified.userId) {
    throw new Error("OTP challenge is not linked to a user");
  }

  const user = await storage.getUser(verified.userId);
  if (!user) {
    throw new Error("User not found");
  }

  await storage.updateUser(user.id, { lastLoginAt: new Date() } as any).catch(() => undefined);
  return { verified, user };
}

export async function requestOtpFromPendingRegistration(input: {
  pendingRegistrationId: string;
}) {
  const pendingRegistration = await storage.getPendingRegistration(input.pendingRegistrationId);
  if (!pendingRegistration) {
    throw new Error("Pending registration not found");
  }

  if (pendingRegistration.status === "expired" || new Date(pendingRegistration.expiresAt).getTime() < Date.now()) {
    await storage.updatePendingRegistration(pendingRegistration.id, { status: "expired" } as any);
    throw new Error("Pending registration has expired");
  }

  await invalidatePendingChallenges(pendingRegistration.contactValue, "signup_verify");
  const { challenge, code } = await createChallengeRecord({
    purpose: "signup_verify",
    channel: pendingRegistration.contactChannel,
    destination: pendingRegistration.contactValue,
    pendingRegistrationId: pendingRegistration.id,
  });

  return buildChallengeResponse(challenge, { debugCode: code });
}
