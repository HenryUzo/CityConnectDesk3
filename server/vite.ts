// server/vite.ts
import type { Express } from "express";
import type { Server } from "node:http";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { createServer as createViteServer, createLogger } from "vite";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "web") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

function isReplitPreviewEnv() {
  // Heuristics for Replit / janeway preview envs
  return Boolean(
    process.env.REPL_ID ||
      process.env.REPLIT_DB_URL ||
      process.env.REPLIT_PROJECT_SLUG ||
      process.env.REPL_OWNER ||
      process.env.REPL_SLUG
  );
}

export async function setupVite(app: Express, httpServer: Server) {
  // Allow turning HMR off entirely if needed
  const disableHMR =
    process.env.DISABLE_VITE_HMR === "1" ||
    process.env.DISABLE_VITE_HMR === "true";

  // On Replit previews the page is HTTPS, so HMR must use WSS and clientPort 443.
  // Locally, we keep Vite defaults.
  const hmrConfig =
    disableHMR
      ? false
      : isReplitPreviewEnv()
      ? {
          server: httpServer,
          protocol: "wss" as const,
          clientPort: 443,
        }
      : {
          server: httpServer,
        };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    appType: "custom",
    customLogger: {
      ...viteLogger,
      // Don't kill the process on a client build warning/error — just log it.
      error: (msg, options) => {
        viteLogger.error(msg, options);
      },
    },
    server: {
      middlewareMode: true,
      watch: { usePolling: true, interval: 120 }, // container-friendly
      hmr: hmrConfig,
      allowedHosts: true,
    },
  });

  // Mount Vite dev middlewares
  app.use(vite.middlewares);

  // Serve index.html only for navigation requests (text/html) to avoid
  // returning HTML for JS/CSS module requests which causes MIME errors.
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    // Only handle GET navigation requests that accept HTML
    const accept = (req.headers.accept || "").toString();
    if (req.method !== "GET" || !accept.includes("text/html")) {
      return next();
    }

    try {
      const clientTemplate = path.resolve(
        // @ts-ignore - import.meta.dirname provided by ts-node/tsx on this project
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );

      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      // cache-bust the entry for good measure
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );

      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // In production we should serve the built assets from client/dist
  const distPath = path.resolve(
    // @ts-ignore - import.meta.dirname provided by ts-node/tsx on this project
    import.meta.dirname,
    "..",
    "client",
    "dist"
  );

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}. Run "vite build" (or your project build script) first.`
    );
  }

  app.use(express.static(distPath, { index: false }));

  // SPA fallback — add any app routes you deep-link to
  app.get(
    [
      "/",
      "/resident",
      "/resident/*",
      "/admin-dashboard",
      "/admin/*",
      "/app/*",
    ],
    (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    }
  );
}
