// server/index.ts
import express, { type Request, type Response, type NextFunction } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

// ⬇️ Import your API routers and mount them explicitly
import adminRoutes from "./admin-routes";
import superAdminRoutes from "./super-admin-routes";

const app = express();
app.set("trust proxy", 1);

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// ──────────────────────────────────────────────────────────
// CORS (safe defaults for dev; keep credentials if you use cookies)
// If client and server share origin (reverse-proxy), this won’t hurt.
// If they’re on different hosts/ports (Replit dev), this is REQUIRED.
// ──────────────────────────────────────────────────────────
// ...after cookieParser()
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    try {
      const u = new URL(origin);
      // Allow your dev preview hosts + prod host:
      if (
        u.hostname.endsWith(".replit.dev") ||
        origin === "https://cityconnect.replit.app"
      ) {
        return cb(null, true);
      }
    } catch {}
    return cb(new Error("CORS blocked for origin: " + origin));
  },
  credentials: true, // <-- cookies allowed
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-estate-id", "x-user-id", "x-user-email"],
}));
app.options("*", cors());
// ──────────────────────────────────────────────────────────
/** Request logging for /api responses (trimmed to avoid noisy logs) */
// ──────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: unknown;

  const originalJson = res.json.bind(res);
  res.json = (body: any, ...rest: any[]) => {
    capturedJsonResponse = body;
    // @ts-expect-error forwarding variadic args
    return originalJson(body, ...rest);
  };

  res.on("finish", () => {
    if (!path.startsWith("/api")) return;
    const duration = Date.now() - start;
    let line = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
    if (capturedJsonResponse) {
      try {
        line += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      } catch {}
    }
    if (line.length > 80) line = line.slice(0, 79) + "…";
    log(line);
  });

  next();
});

// Lightweight health probes
app.get("/health", (_req, res) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});

// When mounted under /api/admin, this becomes /api/admin/health
// (admin-routes already has its own /health too once mounted below)

// ──────────────────────────────────────────────────────────
// Schema guard: ensure columns exist (idempotent)
// ──────────────────────────────────────────────────────────
async function ensureServiceRequestsColumns() {
  await db.execute(sql`
    ALTER TABLE service_requests
      ADD COLUMN IF NOT EXISTS admin_notes      text,
      ADD COLUMN IF NOT EXISTS assigned_at      timestamp NULL,
      ADD COLUMN IF NOT EXISTS closed_at        timestamp NULL,
      ADD COLUMN IF NOT EXISTS close_reason     text,
      ADD COLUMN IF NOT EXISTS billed_amount    numeric(10,2) DEFAULT '0',
      ADD COLUMN IF NOT EXISTS payment_status   text DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS preferred_time   timestamp NULL;
  `);
}

// ──────────────────────────────────────────────────────────
// Boot sequence
// ──────────────────────────────────────────────────────────
(async () => {
  try {
    await ensureServiceRequestsColumns();
    log("[DB] Schema guard OK");
  } catch (e) {
    console.error("[DB] Schema guard failed:", e);
    // keep running so you can see logs and fix in place
  }

  // ⬇️ Mount your API *before* Vite/SSR:
  app.use("/api/admin", adminRoutes);
  app.use("/api/super-admin", superAdminRoutes);

  // Register the rest of your routes (SSR/API defined in ./routes)
  const server = await registerRoutes(app);

  // ────────────────────────────────────────────────────────
  // Global error handler — do NOT throw/rethrow
  // ────────────────────────────────────────────────────────
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err?.status || err?.statusCode || 500;
    const message = err?.message || "Internal Server Error";
    console.error("[UNHANDLED ERROR]", { status, message, stack: err?.stack });
    if (!res.headersSent) res.status(status).json({ error: message });
  });

  // Dev: Vite middleware; Prod: static assets
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    // In production, ensure frontend build is accessible at client/dist
    await import("./prepare-static").then(m => m.prepareStaticFiles()).catch(console.error);
    serveStatic(app);
  }

  // Replit/Render/Heroku style port
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({ port, host: "0.0.0.0", reusePort: true }, () =>
    log(`serving on port ${port}`)
  );
})();
