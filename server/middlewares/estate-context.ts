import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import type { Membership } from "@shared/schema";

function membershipIsActive(membership: Membership) {
  const isActiveFlag = membership.isActive ?? true;
  if (!isActiveFlag) return false;
  const status = (membership.status ?? "").toLowerCase();
  if (status && status !== "active") return false;
  return status === "active" || status === "";
}

export async function resolveActiveEstateContext(req: Request, res: Response, next: NextFunction) {
  if (!req.auth) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const headerEstate = typeof req.headers["x-estate-id"] === "string" ? req.headers["x-estate-id"].trim() : undefined;
  const queryEstate = typeof req.query.estateId === "string" ? req.query.estateId.trim() : undefined;
  let estateId = headerEstate || queryEstate;

  if (!estateId) {
    const memberships = await storage.getMembershipsForUser(req.auth.userId);
    const primary = memberships.find(m => m.isPrimary && membershipIsActive(m));
    if (primary) {
      estateId = primary.estateId;
    } else {
      const fallback = memberships.find(membershipIsActive);
      estateId = fallback?.estateId;
    }
  }

  if (!estateId) {
    return res.status(400).json({
      message: "No active estate context. Provide x-estate-id or set a primary estate.",
    });
  }

  req.auth.activeEstateId = estateId;
  next();
}

export async function requireActiveEstateMembership(req: Request, res: Response, next: NextFunction) {
  if (!req.auth) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const estateId = req.auth.activeEstateId;
  if (!estateId) {
    return res.status(400).json({
      message: "No active estate context. Provide x-estate-id or set a primary estate.",
    });
  }

  const membership = await storage.getMembershipByUserAndEstate(req.auth.userId, estateId);
  if (!membership) {
    return res.status(403).json({ message: "Your estate membership is not active." });
  }

  if (!membershipIsActive(membership)) {
    return res.status(403).json({ message: "Your estate membership is not active." });
  }

  req.auth.membership = {
    id: membership.id,
    estateId: membership.estateId,
    userId: membership.userId,
    status: membership.status,
    isActive: membership.isActive,
    isPrimary: membership.isPrimary,
    role: membership.role,
  };

  next();
}
