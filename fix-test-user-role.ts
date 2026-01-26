import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function updateTestUserRole() {
  try {
    // Update test user to have admin role
    const updated = await prisma.user.update({
      where: { email: "testuser@example.com" },
      data: { globalRole: "SUPER_ADMIN" },
    });

    console.log("✅ Updated test user successfully:");
    console.log(`  Email: ${updated.email}`);
    console.log(`  Global Role: ${updated.globalRole}`);
    console.log(`  Is Approved: ${updated.isApproved}`);
    console.log(`  Is Active: ${updated.isActive}`);
  } catch (error: any) {
    if (error.code === "P2025") {
      console.log("❌ Test user not found. Creating new one with admin role...");
      const { hashPassword } = await import("./server/auth-utils");
      const hashed = await hashPassword("TestPass123!");
      const created = await prisma.user.create({
        data: {
          email: "testuser@example.com",
          name: "Test User",
          firstName: "Test",
          lastName: "User",
          phone: "+1234567890",
          passwordHash: hashed,
          globalRole: "SUPER_ADMIN",
          isApproved: true,
          isActive: true,
        },
      });
      console.log("✅ Created new test user with admin role:");
      console.log(`  Email: ${created.email}`);
      console.log(`  Global Role: ${created.globalRole}`);
    } else {
      console.error("Error updating user:", error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

updateTestUserRole();
