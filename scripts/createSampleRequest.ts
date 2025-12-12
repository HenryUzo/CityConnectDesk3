import { PrismaClient } from "@prisma/client";
import { config as loadEnv } from "dotenv";

loadEnv();

const prisma = new PrismaClient({
  log: ["query", "info"],
});

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "resident@cityconnect.local" },
  });
  if (!user) {
    throw new Error("Seed resident user not found");
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, status: "ACTIVE" },
    include: { estate: true },
  });
  if (!membership || !membership.estate) {
    throw new Error("No ACTIVE membership found for seed resident");
  }

  const request = await prisma.serviceRequest.create({
    data: {
      residentId: user.id,
      estateId: membership.estateId,
      serviceCategoryId: null,
      serviceId: null,
      title: "Sample request from CLI",
      description:
        "This is a sample service request created by npm run dev:create-request",
      status: "PENDING",
    },
  });

  console.log("Created sample service request:");
  console.log(JSON.stringify(request, null, 2));
}

main()
  .catch((error) => {
    console.error("Failed to create sample request:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
