import { db } from "./db";
import { refreshTokens } from "@shared/schema";
import { eq, and, lt } from "drizzle-orm";

/**
 * Store a refresh token in the database
 */
export async function storeRefreshToken(userId: string, tokenId: string, expiresAt: Date) {
  await db.insert(refreshTokens).values({
    userId,
    tokenId,
    expiresAt,
    isRevoked: false,
  });
}

/**
 * Check if a refresh token is valid (exists, not revoked, not expired)
 */
export async function isRefreshTokenValid(tokenId: string, userId: string): Promise<boolean> {
  const [token] = await db
    .select()
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.tokenId, tokenId),
        eq(refreshTokens.userId, userId),
        eq(refreshTokens.isRevoked, false)
      )
    )
    .limit(1);

  if (!token) {
    return false;
  }

  // Check if token is expired
  if (token.expiresAt < new Date()) {
    return false;
  }

  return true;
}

/**
 * Revoke a refresh token
 */
export async function revokeRefreshToken(tokenId: string) {
  await db
    .update(refreshTokens)
    .set({
      isRevoked: true,
      revokedAt: new Date(),
    })
    .where(eq(refreshTokens.tokenId, tokenId));
}

/**
 * Revoke all refresh tokens for a user (useful for logout from all devices)
 */
export async function revokeAllUserRefreshTokens(userId: string) {
  await db
    .update(refreshTokens)
    .set({
      isRevoked: true,
      revokedAt: new Date(),
    })
    .where(
      and(
        eq(refreshTokens.userId, userId),
        eq(refreshTokens.isRevoked, false)
      )
    );
}

/**
 * Clean up expired refresh tokens from the database
 * This should be run periodically (e.g., via cron job or scheduled task)
 * 
 * @returns Promise<void> The number of deleted tokens is not returned to avoid exposing database internals
 */
export async function cleanupExpiredTokens() {
  const now = new Date();
  const result = await db
    .delete(refreshTokens)
    .where(lt(refreshTokens.expiresAt, now));
  
  return result;
}
