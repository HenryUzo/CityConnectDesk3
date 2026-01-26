import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
try {
  const users = await prisma.user.findMany({ take: 5, select: { id: true, email: true, name: true, isApproved: true, isActive: true } });
  console.log('Existing users:', JSON.stringify(users, null, 2));
} catch(e) {
  console.error('ERROR fetching users:', e.message);
} finally {
  await prisma.$disconnect();
}
