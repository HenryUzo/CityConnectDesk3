import express, { type Request, Response, NextFunction } from "express";
import { sql } from "drizzle-orm";
import { db } from "./db";
import cookieParser from "cookie-parser";
// import cors from "cors"; // not needed for same-origin; uncomment only if you actually use it
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

app.set("trust proxy", 1);

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));

// ---------------------------------------------------------
// Request logging for /api responses (truncated for brevity)
// ---------------------------------------------------------
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }
      log(logLine);
    }
  });

  next();
});

// ---------------------------------------------------------
// SCHEMA GUARD: ensure missing columns exist (idempotent)
// ---------------------------------------------------------
async function ensureServiceRequestsColumns() {
  // Safe to run every boot; IF NOT EXISTS prevents errors
  await db.execute(sql`
    ALTER TABLE service_requests
      ADD COLUMN IF NOT EXISTS admin_notes        text,
      ADD COLUMN IF NOT EXISTS assigned_at        timestamp NULL,
      ADD COLUMN IF NOT EXISTS closed_at          timestamp NULL,
      ADD COLUMN IF NOT EXISTS close_reason       text,
      ADD COLUMN IF NOT EXISTS billed_amount      numeric(10,2) DEFAULT '0',
      ADD COLUMN IF NOT EXISTS payment_status     text DEFAULT 'pending';
  `);
}

// If you ever need CORS for the Replit preview host, uncomment and configure:
// app.use(cors({
//   origin: (origin, cb) => {
//     if (!origin) return cb(null, true);
//     try {
//       const u = new URL(origin);
//       if (u.hostname.endsWith(".replit.dev") || origin === "https://cityconnect.replit.app") {
//         return cb(null, true);
//       }
//     } catch {}
//     return cb(new Error("CORS blocked for origin: " + origin));
//   },
//   credentials: true,
//   methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
//   allowedHeaders: ["Content-Type", "Authorization", "x-estate-id"],
// }));
// app.options("*", cors({ /* same config as above */ }));

// ---------------------------------------------------------
// Boot sequence
// ---------------------------------------------------------
(async () => {
  try {
    // 1) Ensure DB schema has the columns your code expects
    await ensureServiceRequestsColumns();
    log("[DB] Schema guard OK");
  } catch (e) {
    console.error("[DB] Schema guard failed:", e);
    // continue to start so you can still see the app and logs;
    // remove 'throw' if you prefer hard-fail:
    // throw e;
  }

  // 2) Register routes (API + SSR)
  const server = await registerRoutes(app);

  // 3) Error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });

  // 4) Vite/Static
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // 5) Listen (Replit requires PORT; default 5000)
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    }
  );
})();
