import { PrismaClient } from '@prisma/client';
import { randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scryptAsync(password, salt, 64));
  return `${derived.toString('hex')}.${salt}`;
}

const prisma = new PrismaClient();
(async () => {
  try {
    const testPassword = 'TestPass123!';
    const hashedPassword = await hashPassword(testPassword);
    
    const user = await prisma.user.create({
      data: {
        id: 'test-user-001',
        email: 'testuser@example.com',
        phone: '+1234567890',
        name: 'Test User',
        firstName: 'Test',
        lastName: 'User',
        passwordHash: hashedPassword,
        globalRole: 'RESIDENT',
        isApproved: true,
        isActive: true,
      }
    });
    
    console.log('✓ Created test user:');
    console.log('  Email:', user.email);
    console.log('  Password:', testPassword);
    console.log('  ID:', user.id);
  } catch(e) {
    console.error('ERROR creating user:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
