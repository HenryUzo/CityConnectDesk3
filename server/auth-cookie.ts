import type { CookieOptions } from "express";

export const ADMIN_COOKIE_NAME = "admin_jwt";

export function cookieOptsProd(): CookieOptions {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: true,        // we're on HTTPS at cityconnect.replit.app
    sameSite: "lax",     // same-origin is fine; use "none" only if cross-site
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    // IMPORTANT: do NOT set `domain` unless you know you need a parent domain.
    // Leaving it unset makes it attach to the current host (correct for Replit custom domain).
  };
}
