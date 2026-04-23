import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { comparePasswords } from "./auth-utils";
import { db } from "./db";
import { userDeviceSessions } from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  completeLoginVerification,
  completeSignupRegistration,
  requestOtpFromPendingRegistration,
  startLoginOtp,
  startSignupOtp,
  verifyOtpChallenge,
  resendOtpChallenge,
} from "./otp-service";
import {
  loginStartSchema,
  otpRequestSchema,
  otpResendSchema,
  otpVerifySchema,
  registerCompleteSchema,
} from "./otp-routes";
import { verifyGoogleCredential } from "./google-auth";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(async (req, _res, next) => {
    try {
      const userId = (req.user as any)?.id;
      const sessionId = (req as any).sessionID as string | undefined;
      if (userId && sessionId) {
        await db
          .insert(userDeviceSessions)
          .values({
            userId,
            sessionId,
            userAgent: req.get("user-agent") || null,
            ipAddress: req.ip || null,
            lastSeenAt: new Date(),
            revokedAt: null,
          })
          .onConflictDoUpdate({
            target: userDeviceSessions.sessionId,
            set: {
              userId,
              userAgent: req.get("user-agent") || null,
              ipAddress: req.ip || null,
              lastSeenAt: new Date(),
              revokedAt: null,
            },
          });
      }
    } catch (error) {
      console.warn("[auth] Failed to upsert user device session:", (error as Error).message);
    }
    next();
  });

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      const normalized = username?.trim() ?? "";
      const isAccessCode = /^\d{6}$/.test(normalized);
      try {
        const user = isAccessCode
          ? await storage.getUserByAccessCode(normalized)
          : await storage.getUserByUsername(normalized);

        if (!user) {
          return done(null, false);
        }

        if (!isAccessCode && !(await comparePasswords(password, user.password))) {
          return done(null, false);
        }

        return done(null, user);
      } catch (error) {
        return done(error as Error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user || false);
    } catch (err) {
      // Ensure errors during deserialization are passed to passport
      done(err as any);
    }
  });

  function attachSession(user: SelectUser, req: any, res: any, next: any, status = 200) {
    req.login(user, (err: unknown) => {
      if (err) return next(err);
      const sessionId = req.sessionID as string | undefined;
      const userId = (req.user as any)?.id;
      if (sessionId && userId) {
        db
          .insert(userDeviceSessions)
          .values({
            userId,
            sessionId,
            userAgent: req.get("user-agent") || null,
            ipAddress: req.ip || null,
            lastSeenAt: new Date(),
            revokedAt: null,
          })
          .onConflictDoUpdate({
            target: userDeviceSessions.sessionId,
            set: {
              userId,
              userAgent: req.get("user-agent") || null,
              ipAddress: req.ip || null,
              lastSeenAt: new Date(),
              revokedAt: null,
            },
          })
          .finally(() => res.status(status).json({ user }));
        return;
      }
      res.status(status).json({ user });
    });
  }

  async function handleRegisterStart(req: any, res: any) {
    const payload = {
      ...(req.body || {}),
      username: req.body?.username || req.body?.email,
      role: req.body?.role === "provider" ? "provider" : "resident",
    };
    const result = await startSignupOtp(payload);
    res.status(202).json(result);
  }

  async function handleLoginStart(req: any, res: any) {
    const parsed = loginStartSchema.parse(req.body || {});
    const result = await startLoginOtp(parsed);
    res.status(202).json(result);
  }

  async function handleGoogleLogin(req: any, res: any, next: any) {
    const credential = String(req.body?.credential || "");
    const selectedRole = String(req.body?.role || "").trim();
    if (!credential) {
      return res.status(400).json({ error: "Google sign-in response is required" });
    }

    let profile: Awaited<ReturnType<typeof verifyGoogleCredential>>;
    try {
      profile = await verifyGoogleCredential(credential);
    } catch (error) {
      const message = (error as Error).message || "Google sign-in could not be verified";
      const isServerConfigError =
        message.includes("GOOGLE_CLIENT_ID") ||
        message.includes("verification keys") ||
        message.includes("verify Google sign-in right now");
      return res.status(isServerConfigError ? 500 : 401).json({ error: message });
    }

    const user = await storage.getUserByEmail(profile.email);

    if (!user) {
      return res.status(401).json({
        error: "No CityConnect account is linked to this Google email. Sign in with email first.",
      });
    }

    if (user.isActive === false) {
      return res.status(403).json({ error: "Account is inactive" });
    }

    if (
      (selectedRole === "resident" || selectedRole === "provider") &&
      user.role !== selectedRole
    ) {
      const actualRole = user.role === "provider" ? "provider" : "resident";
      return res.status(403).json({
        error: `This Google account is registered as a ${actualRole}. Switch role and try again.`,
      });
    }

    await storage.updateUser(user.id, { lastLoginAt: new Date() } as any).catch(() => undefined);
    attachSession(user, req, res, next, 200);
  }

  app.post("/api/register", async (req, res, next) => {
    try {
      await handleRegisterStart(req, res);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/otp/request", async (req, res, next) => {
    try {
      const parsed = otpRequestSchema.parse(req.body || {});
      if (parsed.purpose !== "signup_verify" || !parsed.pendingRegistrationId) {
        return res.status(400).json({ message: "pendingRegistrationId is required for signup OTP" });
      }
      const result = await requestOtpFromPendingRegistration({
        pendingRegistrationId: parsed.pendingRegistrationId,
      });
      res.status(202).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/otp/verify", async (req, res, next) => {
    try {
      const parsed = otpVerifySchema.parse(req.body || {});
      const result = await verifyOtpChallenge(parsed.challengeId, parsed.code);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/otp/resend", async (req, res, next) => {
    try {
      const parsed = otpResendSchema.parse(req.body || {});
      const result = await resendOtpChallenge(parsed.challengeId);
      res.status(202).json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/register/complete", async (req, res, next) => {
    try {
      const parsed = registerCompleteSchema.parse(req.body || {});
      const user = await completeSignupRegistration(parsed);
      attachSession(user, req, res, next, 201);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    const normalizedUsername =
      req.body?.username ??
      req.body?.email ??
      req.body?.identifier ??
      req.body?.accessCode;

    req.body = {
      ...req.body,
      username: normalizedUsername,
      password: req.body?.password,
    };

    passport.authenticate("local", (err: unknown, user: SelectUser | false) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      attachSession(user, req, res, next, 200);
    })(req, res, next);
  });

  app.post("/api/auth/login/start", async (req, res, next) => {
    try {
      await handleLoginStart(req, res);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/login/verify", async (req, res, next) => {
    try {
      const parsed = otpVerifySchema.parse(req.body || {});
      const { user } = await completeLoginVerification(parsed);
      attachSession(user, req, res, next, 200);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/google", async (req, res, next) => {
    try {
      await handleGoogleLogin(req, res, next);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/auth/refresh", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    res.json({
      accessToken: req.sessionID,
      user: req.user,
      refreshToken: req.sessionID,
    });
  });

  app.post("/api/logout", (req, res, next) => {
    const sessionId = (req as any).sessionID as string | undefined;
    const markRevokedPromise = sessionId
      ? db
          .update(userDeviceSessions)
          .set({ revokedAt: new Date(), lastSeenAt: new Date() })
          .where(eq(userDeviceSessions.sessionId, sessionId))
      : Promise.resolve();

    markRevokedPromise
      .catch((error: unknown) => {
        console.warn("[auth] Failed to mark session revoked:", (error as Error).message);
      })
      .finally(() => {
        req.logout((err) => {
          if (err) return next(err);
          res.sendStatus(200);
        });
      });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const session = req.session as any;
    if (session?.impersonatorId) {
      return res.json({
        ...req.user,
        isImpersonating: true,
        impersonatedBy: {
          id: session.impersonatorId,
          email: session.impersonatorEmail,
        },
      });
    }
    res.json(req.user);
  });
}
