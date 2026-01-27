import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkTestUser() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: "testuser@example.com" },
    });

    if (!user) {
      console.log("❌ Test user not found");
      return;
    }

    console.log("✓ Found test user:");
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Name: ${user.name}`);
    console.log(`  Global Role: ${user.globalRole}`);
    console.log(`  Is Approved: ${user.isApproved}`);
    console.log(`  Is Active: ${user.isActive}`);
    console.log(`  Password Hash: ${user.passwordHash?.substring(0, 20)}...`);

    // Check if role is correct
    if (user.globalRole === "RESIDENT") {
      console.log("\n⚠️  User role is RESIDENT but needs to be SUPER_ADMIN or ADMIN for admin endpoints!");
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTestUser();
