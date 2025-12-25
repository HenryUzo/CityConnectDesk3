import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { hashPassword, comparePasswords } from "./auth-utils";

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

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      const normalized = username?.trim() ?? "";
      const isAccessCode = /^\d{6}$/.test(normalized);
      try {
        const user = isAccessCode
          ? await storage.getUserByAccessCode(normalized)
          : await storage.getUserByUsername(normalized);

        if (!user || !(await comparePasswords(password, user.password))) {
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

  app.post("/api/register", async (req, res, next) => {
    try {
  const { username, password, name, email, phone } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({
      message: "Username and password are required",
    });
  }

  const existingUser = await storage.getUserByUsername(username);
  if (existingUser) {
    return res.status(400).send("Username already exists");
  }

  const passwordHash = await hashPassword(password);
  const user = await storage.createUser({
    name: name ?? email ?? username,
    email: email ?? username,
    phone: phone ?? "",
    password: passwordHash,
    role: "resident",
    isActive: true,
    isApproved: true,
  } as any);

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    res.status(200).json(req.user);
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
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });
}
