import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../server/auth-utils';

const prisma = new PrismaClient();

async function main() {
  console.log('Seed start: creating baseline CityConnect data');

  const passwordHash = await hashPassword(process.env.DEMO_PASSWORD ?? 'password123');

  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@cityconnect.local' },
    update: {
      isApproved: true,
      isActive: true,
      passwordHash,
    },
    create: {
      email: 'admin@cityconnect.local',
      passwordHash,
      name: 'CityConnect Super Admin',
      globalRole: 'SUPER_ADMIN',
      isApproved: true,
      isActive: true,
    },
  });

  const estate = await prisma.estate.upsert({
    where: { slug: 'victoria-garden-city' },
    update: {},
    create: {
      name: 'Victoria Garden City',
      slug: 'victoria-garden-city',
      city: 'Lagos',
      state: 'Lagos',
      country: 'Nigeria',
      accessType: 'CODE',
      accessCode: 'VGC-ACCESS-1234',
    },
  });

  await prisma.membership.upsert({
    where: {
      userId_estateId_role: {
        userId: superAdmin.id,
        estateId: estate.id,
        role: 'ESTATE_ADMIN',
      },
    },
    update: {
      status: 'ACTIVE',
      isPrimary: true,
    },
    create: {
      userId: superAdmin.id,
      estateId: estate.id,
      role: 'ESTATE_ADMIN',
      status: 'ACTIVE',
      isPrimary: true,
    },
  });

  const resident = await prisma.user.upsert({
    where: { email: 'resident@cityconnect.local' },
    update: {
      isApproved: true,
      isActive: true,
      passwordHash,
    },
    create: {
      email: 'resident@cityconnect.local',
      passwordHash,
      name: 'Sample Resident',
      isApproved: true,
      isActive: true,
    },
  });

  await prisma.membership.upsert({
    where: {
      userId_estateId_role: {
        userId: resident.id,
        estateId: estate.id,
        role: 'RESIDENT',
      },
    },
    update: {
      status: 'ACTIVE',
      isPrimary: true,
    },
    create: {
      userId: resident.id,
      estateId: estate.id,
      role: 'RESIDENT',
      status: 'ACTIVE',
      isPrimary: true,
    },
  });

  await prisma.wallet.upsert({
    where: { userId: resident.id },
    update: {
      balance: '25000',
    },
    create: {
      userId: resident.id,
      balance: '25000',
    },
  });

  console.log('Seed complete');
}

main()
  .catch((error) => {
    console.error('Seed error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
