import mongoose from 'mongoose';
import { AdminUser } from './admin-db';
import { UserRole } from '../shared/admin-schema';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cityconnect-admin';

async function createTestAdmin() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if test admin already exists
    const existing = await AdminUser.findOne({ email: 'testadmin@cityconnect.com' });
    if (existing) {
      console.log('Test admin already exists');
      await mongoose.disconnect();
      return;
    }

    // Create test admin with bcrypt hashed password
    const testAdmin = new AdminUser({
      name: 'Test Super Admin',
      email: 'testadmin@cityconnect.com',
      phone: '+234-800-0000',
      passwordHash: '$2b$12$ddHmNMTnZIrn/RW1RDSCvO0qWgHk6PdH7G9aduujOcEqaA/CqjYeq', // TestAdmin123!
      globalRole: UserRole.SUPER_ADMIN,
      isActive: true,
    });

    await testAdmin.save();
    console.log('Test admin created successfully');
    console.log('Email: testadmin@cityconnect.com');
    console.log('Password: TestAdmin123!');

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error creating test admin:', error);
    process.exit(1);
  }
}

createTestAdmin();
