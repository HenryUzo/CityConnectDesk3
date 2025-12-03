// server/app-routes.ts
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { storage } from "./storage";
import { insertServiceRequestSchema } from "@shared/schema";

const router = Router();

function whoami(req: Request): { id?: string; email?: string } {
  const hdrId = req.header("x-user-id") || undefined;
  const hdrEmail = req.header("x-user-email") || undefined;

  const c = (req as any).cookies || {};
  const cId = c.resident_id || undefined;
  const cEmail = c.resident_email || undefined;

  const q = req.query as Record<string, string | undefined>;
  const qId = q.userId || undefined;
  const qEmail = q.email || undefined;

  const id = hdrId ?? cId ?? qId;
  const email = (hdrEmail ?? cEmail ?? qEmail)?.toLowerCase();

  return { id, email };
}

router.get("/_whoami", (req, res) => {
  const me = whoami(req);
  res.json({ ...me, note: "Set via x-user-id/x-user-email headers, resident_* cookies, or ?userId/&email=" });
});

// DEV helper to quickly set cookies for resident identity
router.post("/dev-login", async (req: Request, res: Response) => {
  const body = z.object({
    userId: z.string().optional(),
    email: z.string().email().optional(),
  }).parse(req.body || {});

  let id = body.userId;
  let email = body.email?.toLowerCase();

  if (!id && !email) {
    return res.status(400).json({ error: "Provide userId or email" });
  }

  if (!id && email) {
    const users = await storage.getUsers();
    const match = users.find((u: any) => String(u.email || "").toLowerCase() === email);
    if (!match) return res.status(404).json({ error: "No Postgres user with that email" });
    id = match.id;
  }
  if (id && !email) {
    const u = await storage.getUser(id);
    if (!u) return res.status(404).json({ error: "No Postgres user with that id" });
    email = String(u.email || "").toLowerCase();
  }

  const cookieOpts = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 3600 * 1000,
    path: "/",
  };
  res.cookie("resident_id", id!, cookieOpts);
  res.cookie("resident_email", email!, cookieOpts);

  res.json({ ok: true, id, email });
});

router.post("/logout", (req, res) => {
  res.clearCookie("resident_id", { path: "/" });
  res.clearCookie("resident_email", { path: "/" });
  res.json({ ok: true });
});

// GET my own requests
const ResidentServiceRequestSchema = z.object({
  category: z.string().min(1),
  description: z.string().min(10),
  urgency: z.enum(["low", "medium", "high", "emergency"]),
  preferredTime: z.string().optional(),
  specialInstructions: z.string().optional(),
  budget: z.string().optional(),
  location: z.string().optional(),
  latitude: z.preprocess(
    (value) => (typeof value === "string" && value.length ? Number(value) : value),
    z.number().optional(),
  ),
  longitude: z.preprocess(
    (value) => (typeof value === "string" && value.length ? Number(value) : value),
    z.number().optional(),
  ),
});

router.post("/service-requests", async (req: Request, res: Response) => {
  try {
    let { id, email } = whoami(req);

    if (!id && !email && process.env.DEV_DEFAULT_RESIDENT_EMAIL) {
      email = process.env.DEV_DEFAULT_RESIDENT_EMAIL.toLowerCase();
      console.warn("[/service-requests] Using DEV_DEFAULT_RESIDENT_EMAIL fallback:", email);
    }

    if (!id && !email) {
      return res.status(401).json({
        error: "Resident identity missing. Use /api/app/dev-login or send x-user-id/x-user-email headers.",
      });
    }

    if (!id && email) {
      const users = await storage.getUsers();
      const match = users.find((u: any) => String(u.email || "").toLowerCase() === email);
      if (!match) {
        return res.status(404).json({ error: "No Postgres user found for that email" });
      }
      id = match.id;
    }

    const parsed = ResidentServiceRequestSchema.parse(req.body || {});
    const user = await storage.getUser(id!);
    if (!user) {
      return res.status(404).json({ error: "Resident not found" });
    }

    const payload = insertServiceRequestSchema.parse({
      category: parsed.category,
      description: parsed.description,
      residentId: id!,
      urgency: parsed.urgency,
      budget: parsed.budget || "Not provided",
      location: parsed.location || user.location || "Not specified",
      latitude: parsed.latitude ?? null,
      longitude: parsed.longitude ?? null,
      preferredTime: parsed.preferredTime
        ? new Date(parsed.preferredTime)
        : null,
      specialInstructions: parsed.specialInstructions || null,
    });

    const created = await storage.createServiceRequest(payload);
    res.status(201).json(created);
  } catch (error: any) {
    if (error?.issues) {
      return res.status(400).json({
        error: "Validation error",
        details: error.issues.map((issue: any) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    console.error("POST /service-requests error", error);
    res.status(500).json({ error: error.message || "Failed to create service request" });
  }
});

router.get("/service-requests/mine", async (req: Request, res: Response) => {
  try {
    let { id, email } = whoami(req);

    // Optional DEV fallback via env
    if (!id && !email && process.env.DEV_DEFAULT_RESIDENT_EMAIL) {
      email = process.env.DEV_DEFAULT_RESIDENT_EMAIL.toLowerCase();
      console.warn("[/service-requests/mine] Using DEV_DEFAULT_RESIDENT_EMAIL fallback:", email);
    }

    if (!id && !email) {
      return res.status(401).json({
        error: "Resident identity missing. Use /api/app/dev-login or send x-user-id/x-user-email headers.",
      });
    }

    if (!id && email) {
      const users = await storage.getUsers();
      const match = users.find((u: any) => String(u.email || "").toLowerCase() === email);
      if (!match) return res.status(404).json({ error: "No Postgres user found for that email" });
      id = match.id;
    }

    const all = await storage.getAllServiceRequests();
    const mine = all.filter((r: any) => r.residentId === id);

    console.log(`[app] /service-requests/mine -> userId=${id} count=${mine.length}`);
    return res.json(mine);
  } catch (e: any) {
    console.error("GET /service-requests/mine error", e);
    res.status(500).json({ error: e.message });
  }
});

// GET single request I own
router.get("/service-requests/:id", async (req: Request, res: Response) => {
  try {
    let { id: myId, email } = whoami(req);

    if (!myId && !email) {
      return res.status(401).json({ error: "Resident identity missing." });
    }
    if (!myId && email) {
      const users = await storage.getUsers();
      const match = users.find((u: any) => String(u.email || "").toLowerCase() === email);
      if (!match) return res.status(404).json({ error: "No Postgres user found for that email" });
      myId = match.id;
    }

    const all = await storage.getAllServiceRequests();
    const row = all.find((r: any) => r.id === req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    if (row.residentId !== myId) return res.status(403).json({ error: "Forbidden" });

    return res.json(row);
  } catch (e: any) {
    console.error("GET /service-requests/:id error", e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
