import { db } from "../db";
import { storage } from "../storage";
import { memberships, serviceRequests } from "@shared/schema";
import { and, count, eq, inArray } from "drizzle-orm";

type ProviderMatch = {
  id: string;
  businessName: string;
  rating: number;
  jobs: number;
  estateMatch: boolean;
  badges: string[];
};

export async function getProviderMatches(params: {
  category: string;
  estateId?: string | null;
  urgency?: string | null;
  limit?: number;
  userId?: string | null;
}): Promise<ProviderMatch[]> {
  const requestedEstateId = typeof params.estateId === "string" && params.estateId.trim()
    ? params.estateId.trim()
    : undefined;
  let activeEstateId = requestedEstateId;
  if (!activeEstateId && params.userId) {
    const membershipsForUser = await storage.getMembershipsForUser(params.userId);
    const primary = membershipsForUser.find((m) => m.isPrimary && m.isActive && m.status === "active");
    activeEstateId = primary?.estateId;
  }

  const providers = await storage.getProviders({
    approved: true,
    category: params.category,
  });

  const verifiedProviders = (providers || []).filter((p: any) => p?.isActive !== false && p?.isApproved === true);
  const providerIds = verifiedProviders.map((p: any) => p.id).filter(Boolean);

  if (providerIds.length === 0) {
    return [];
  }

  const completedJobRows = await db
    .select({ providerId: serviceRequests.providerId, completedJobs: count() })
    .from(serviceRequests)
    .where(and(inArray(serviceRequests.providerId, providerIds as any), eq(serviceRequests.status, "completed")))
    .groupBy(serviceRequests.providerId);

  const completedJobsByProvider = new Map<string, number>();
  for (const r of completedJobRows) {
    const pid = (r as any).providerId as string | null;
    if (!pid) continue;
    completedJobsByProvider.set(pid, Number((r as any).completedJobs ?? 0));
  }

  let estateMatchedIds = new Set<string>();
  if (activeEstateId) {
    const membershipRows = await db
      .select({ userId: memberships.userId })
      .from(memberships)
      .where(
        and(
          eq(memberships.estateId, activeEstateId),
          eq(memberships.isActive, true),
          eq(memberships.status, "active"),
          inArray(memberships.userId, providerIds as any),
        ),
      );
    estateMatchedIds = new Set(membershipRows.map((m: { userId: string }) => m.userId));
  }

  const preview = verifiedProviders
    .map((p: any) => {
      const ratingNum = Number(p.rating ?? 0);
      const completedJobs = completedJobsByProvider.get(p.id) ?? 0;
      const isEstateMatch = activeEstateId ? estateMatchedIds.has(p.id) : false;

      const badges: string[] = [];
      if (isEstateMatch) badges.push("Estate recommended");
      if (ratingNum >= 4.5) badges.push("Top rated");
      if (completedJobs >= 25) badges.push("Experienced");

      const fastResponder = Boolean((p.metadata as any)?.fastResponder);
      if (fastResponder) badges.push("Fast responder");

      return {
        id: String(p.id),
        businessName: String(p.name ?? p.businessName ?? ""),
        rating: Number.isFinite(ratingNum) ? ratingNum : 0,
        jobs: completedJobs,
        estateMatch: isEstateMatch,
        badges,
      };
    })
    .sort((a: any, b: any) => {
      if (a.estateMatch !== b.estateMatch) return a.estateMatch ? -1 : 1;
      if (b.rating !== a.rating) return b.rating - a.rating;
      return (b.jobs ?? 0) - (a.jobs ?? 0);
    });

  const limit = Number.isFinite(params.limit as number) ? Math.max(1, Math.floor(params.limit as number)) : 4;
  return preview.slice(0, limit);
}
