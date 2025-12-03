import { Express, Request, Response } from "express";
import { z } from "zod";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { generateTokenPair, verifyRefreshToken } from "./jwt-utils";
import { 
  storeRefreshToken, 
  isRefreshTokenValid, 
  revokeRefreshToken,
  revokeAllUserRefreshTokens 
} from "./refresh-token-service";
import { requireAuth } from "./auth-middleware";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupJWTAuth(app: Express) {
  /**
   * POST /api/auth/register
   * Register a new user and return JWT tokens
   */
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        username: z.string().min(3),
        password: z.string().min(6),
        name: z.string().optional(),
        email: z.string().email(),
        phone: z.string().optional(),
      });

      const { username, password, name, email, phone } = schema.parse(req.body);

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const user = await storage.createUser({
        name: name ?? email ?? username,
        email: email,
        phone: phone ?? "",
        password: await hashPassword(password),
        role: "resident",
        isActive: true,
        isApproved: true,
      } as any);

      // Generate JWT tokens
      const tokens = generateTokenPair({
        userId: user.id,
        email: user.email,
        role: user.role,
        globalRole: user.globalRole || undefined,
      });

      // Store refresh token
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      const refreshPayload = verifyRefreshToken(tokens.refreshToken);
      if (refreshPayload) {
        await storeRefreshToken(user.id, refreshPayload.tokenId, expiresAt);
      }

      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          globalRole: user.globalRole,
        },
        ...tokens,
      });
    } catch (error: any) {
      if (error?.issues) {
        return res.status(400).json({
          message: "Validation error",
          details: error.issues,
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  /**
   * POST /api/auth/login
   * Login with email/password or access code and return JWT tokens
   */
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      let user;

      // Check if it's an access code login (6 digits)
      if (/^\d{6}$/.test(username)) {
        user = await storage.getUserByAccessCode(username);
        if (!user) {
          return res.status(401).json({ message: "Invalid access code" });
        }
      } else {
        // Regular email/password login
        user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return res.status(401).json({ message: "Invalid credentials" });
        }
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(403).json({ message: "Account is inactive" });
      }

      // Check if provider is approved
      if (user.role === "provider" && !user.isApproved) {
        return res.status(403).json({ message: "Provider account pending approval" });
      }

      // Generate JWT tokens
      const tokens = generateTokenPair({
        userId: user.id,
        email: user.email,
        role: user.role,
        globalRole: user.globalRole || undefined,
      });

      // Store refresh token
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      const refreshPayload = verifyRefreshToken(tokens.refreshToken);
      if (refreshPayload) {
        await storeRefreshToken(user.id, refreshPayload.tokenId, expiresAt);
      }

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          globalRole: user.globalRole,
        },
        ...tokens,
      });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  /**
   * POST /api/auth/refresh
   * Refresh access token using refresh token
   */
  app.post("/api/auth/refresh", async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({ message: "Refresh token is required" });
      }

      // Verify refresh token
      const payload = verifyRefreshToken(refreshToken);
      if (!payload) {
        return res.status(401).json({ message: "Invalid refresh token" });
      }

      // Check if token is valid in database
      const isValid = await isRefreshTokenValid(payload.tokenId, payload.userId);
      if (!isValid) {
        return res.status(401).json({ message: "Refresh token is invalid or expired" });
      }

      // Get user
      const user = await storage.getUser(payload.userId);
      if (!user || !user.isActive) {
        return res.status(401).json({ message: "User not found or inactive" });
      }

      // Revoke old refresh token (token rotation)
      await revokeRefreshToken(payload.tokenId);

      // Generate new token pair
      const tokens = generateTokenPair({
        userId: user.id,
        email: user.email,
        role: user.role,
        globalRole: user.globalRole || undefined,
      });

      // Store new refresh token
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      const newRefreshPayload = verifyRefreshToken(tokens.refreshToken);
      if (newRefreshPayload) {
        await storeRefreshToken(user.id, newRefreshPayload.tokenId, expiresAt);
      }

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          globalRole: user.globalRole,
        },
        ...tokens,
      });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  /**
   * POST /api/auth/logout
   * Logout and revoke refresh token
   */
  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;

      if (refreshToken) {
        const payload = verifyRefreshToken(refreshToken);
        if (payload) {
          await revokeRefreshToken(payload.tokenId);
        }
      }

      res.json({ message: "Logged out successfully" });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  /**
   * POST /api/auth/logout-all
   * Logout from all devices by revoking all refresh tokens
   */
  app.post("/api/auth/logout-all", async (req: Request, res: Response) => {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      await revokeAllUserRefreshTokens(userId);

      res.json({ message: "Logged out from all devices" });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  /**
   * GET /api/auth/me
   * Get current user information from JWT token
   */
  app.get("/api/auth/me", requireAuth, async (req: Request, res: Response) => {
    const user = await storage.getUser(req.auth!.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      globalRole: user.globalRole,
      phone: user.phone,
      isActive: user.isActive,
      isApproved: user.isApproved,
    });
  });
}
