import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { ensureDevAuth, requireAuth } from "./auth-middleware";
import { generateTokenPair, verifyRefreshToken } from "./jwt-utils";
import {
  completeLoginVerification,
  completeSignupRegistration,
  requestOtpFromPendingRegistration,
  resendOtpChallenge,
  startLoginOtp,
  startSignupOtp,
  verifyOtpChallenge,
} from "./otp-service";
import {
  loginStartSchema,
  otpRequestSchema,
  otpResendSchema,
  otpVerifySchema,
  registerCompleteSchema,
} from "./otp-routes";

const router = Router();

const MobileRegisterSchema = z
  .object({
    username: z.string().trim().min(1).optional(),
    email: z.string().trim().email().optional(),
    password: z.string().min(8),
    name: z.string().trim().min(1).optional(),
    phone: z.string().trim().optional(),
    inviteCode: z.string().trim().optional(),
    estateId: z.string().trim().optional(),
    estateAccessMode: z.enum(["access_code", "open_estate", "none"]).optional(),
    role: z.enum(["resident", "provider"]).default("resident"),
    companyId: z.string().trim().optional(),
    newCompanyName: z.string().trim().optional(),
    newCompanyDescription: z.string().trim().optional(),
  })
  .refine((value) => Boolean(value.email || value.username), {
    message: "Email or username is required",
    path: ["email"],
  })
  .superRefine((value, ctx) => {
    if (value.role !== "resident") return;

    if (value.estateAccessMode === "access_code" && !String(value.inviteCode || "").trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Access code is required",
        path: ["inviteCode"],
      });
    }

    if (value.estateAccessMode === "open_estate" && !String(value.estateId || "").trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select an estate",
        path: ["estateId"],
      });
    }
  });

const MobileRefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

function sanitizeUser(user: any) {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
}

function createAuthResponse(user: any) {
  const tokens = generateTokenPair({
    userId: String(user.id),
    email: String(user.email || ""),
    role: String(user.role || "resident"),
    globalRole: user.globalRole ? String(user.globalRole) : undefined,
  });

  return {
    user: sanitizeUser(user),
    ...tokens,
  };
}

router.post("/login", async (req: Request, res: Response) => {
  try {
    const parsed = loginStartSchema.parse(req.body || {});
    const result = await startLoginOtp(parsed);
    return res.status(202).json(result);
  } catch (error: any) {
    if (error?.issues) {
      return res.status(400).json({ message: "Validation error", details: error.issues });
    }
    const message = String(error?.message || "Failed to start login");
    const status = /invalid credentials|inactive/i.test(message) ? 401 : 500;
    return res.status(status).json({ message });
  }
});

router.post("/register", async (req: Request, res: Response) => {
  try {
    const parsed = MobileRegisterSchema.parse(req.body || {});
    const result = await startSignupOtp(parsed as Record<string, unknown>);
    return res.status(202).json(result);
  } catch (error: any) {
    if (error?.issues) {
      return res.status(400).json({ message: "Validation error", details: error.issues });
    }

    const message = String(error?.message || "Failed to start registration");
    const status = /invalid|estate|exists|access code|provide either/i.test(message) ? 400 : 500;
    return res.status(status).json({ message });
  }
});

router.post("/login/start", async (req: Request, res: Response) => {
  try {
    const parsed = loginStartSchema.parse(req.body || {});
    const result = await startLoginOtp(parsed);
    return res.status(202).json(result);
  } catch (error: any) {
    if (error?.issues) {
      return res.status(400).json({ message: "Validation error", details: error.issues });
    }
    const message = String(error?.message || "Failed to start login");
    const status = /invalid credentials|inactive/i.test(message) ? 401 : 500;
    return res.status(status).json({ message });
  }
});

router.post("/login/verify", async (req: Request, res: Response) => {
  try {
    const parsed = otpVerifySchema.parse(req.body || {});
    const { user } = await completeLoginVerification(parsed);
    return res.json(createAuthResponse(user));
  } catch (error: any) {
    if (error?.issues) {
      return res.status(400).json({ message: "Validation error", details: error.issues });
    }
    const message = String(error?.message || "Failed to verify login");
    const status = /invalid|expired|too many|not found/i.test(message) ? 400 : 500;
    return res.status(status).json({ message });
  }
});

router.post("/register/complete", async (req: Request, res: Response) => {
  try {
    const parsed = registerCompleteSchema.parse(req.body || {});
    const user = await completeSignupRegistration(parsed);
    return res.status(201).json(createAuthResponse(user));
  } catch (error: any) {
    if (error?.issues) {
      return res.status(400).json({ message: "Validation error", details: error.issues });
    }
    const message = String(error?.message || "Failed to complete registration");
    const status = /invalid|expired|exists|not found|verification/i.test(message) ? 400 : 500;
    return res.status(status).json({ message });
  }
});

router.post("/otp/request", async (req: Request, res: Response) => {
  try {
    const parsed = otpRequestSchema.parse(req.body || {});
    if (parsed.purpose !== "signup_verify" || !parsed.pendingRegistrationId) {
      return res.status(400).json({ message: "pendingRegistrationId is required for signup OTP" });
    }
    const result = await requestOtpFromPendingRegistration({
      pendingRegistrationId: parsed.pendingRegistrationId,
    });
    return res.status(202).json(result);
  } catch (error: any) {
    if (error?.issues) {
      return res.status(400).json({ message: "Validation error", details: error.issues });
    }
    return res.status(500).json({ message: error?.message || "Failed to request OTP" });
  }
});

router.post("/otp/verify", async (req: Request, res: Response) => {
  try {
    const parsed = otpVerifySchema.parse(req.body || {});
    const result = await verifyOtpChallenge(parsed.challengeId, parsed.code);
    return res.json(result);
  } catch (error: any) {
    if (error?.issues) {
      return res.status(400).json({ message: "Validation error", details: error.issues });
    }
    const message = String(error?.message || "Failed to verify OTP");
    const status = /invalid|expired|too many|not found/i.test(message) ? 400 : 500;
    return res.status(status).json({ message });
  }
});

router.post("/otp/resend", async (req: Request, res: Response) => {
  try {
    const parsed = otpResendSchema.parse(req.body || {});
    const result = await resendOtpChallenge(parsed.challengeId);
    return res.status(202).json(result);
  } catch (error: any) {
    if (error?.issues) {
      return res.status(400).json({ message: "Validation error", details: error.issues });
    }
    const message = String(error?.message || "Failed to resend OTP");
    const status = /wait|active|not found|expired/i.test(message) ? 400 : 500;
    return res.status(status).json({ message });
  }
});

router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const { refreshToken } = MobileRefreshSchema.parse(req.body || {});
    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      return res.status(401).json({ message: "Invalid or expired refresh token" });
    }

    const user = await storage.getUser(payload.userId);
    if (!user || user.isActive === false) {
      return res.status(401).json({ message: "User not found" });
    }

    return res.json(createAuthResponse(user));
  } catch (error: any) {
    if (error?.issues) {
      return res.status(400).json({ message: "Validation error", details: error.issues });
    }
    return res.status(500).json({ message: error?.message || "Failed to refresh token" });
  }
});

router.post("/logout", (_req: Request, res: Response) => {
  return res.status(204).send();
});

router.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const auth = ensureDevAuth(req);
    const userId = auth?.userId || auth?.id;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({ user: sanitizeUser(user) });
  } catch (error: any) {
    return res.status(500).json({ message: error?.message || "Failed to load user" });
  }
});

export default router;
