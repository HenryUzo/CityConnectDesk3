#!/usr/bin/env node
/**
 * Helper function to map Drizzle role to Prisma enum
 * Used in storage.ts and sync scripts
 */

export function mapRoleToPrismaEnum(drizzleRole: string | undefined | null): string {
  if (!drizzleRole) return "RESIDENT";
  
  const lower = drizzleRole.toLowerCase();
  
  // Map snake_case Drizzle roles to UPPER_CASE Prisma enums
  const roleMap: Record<string, string> = {
    "resident": "RESIDENT",
    "provider": "PROVIDER",
    "admin": "ADMIN",
    "super_admin": "SUPER_ADMIN",
    "estate_admin": "ESTATE_ADMIN",
    "moderator": "MODERATOR",
    "support": "SUPPORT",
  };
  
  return roleMap[lower] || "RESIDENT";
}

// Test it
console.log("Testing role mapping:");
console.log("  resident ->", mapRoleToPrismaEnum("resident"));
console.log("  super_admin ->", mapRoleToPrismaEnum("super_admin"));
console.log("  estate_admin ->", mapRoleToPrismaEnum("estate_admin"));
console.log("  admin ->", mapRoleToPrismaEnum("admin"));
