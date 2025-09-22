#!/usr/bin/env node

// Admin Database Setup Script
// Run this after setting up MONGODB_URI to create initial admin user

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Import our admin schemas
const { AdminUser, Estate, Membership } = require('../server/admin-db');
const { UserRole } = require('../shared/admin-schema');

async function setupAdmin() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MONGODB_URI environment variable not found');
      console.log('Please add MONGODB_URI to your Replit Secrets first');
      process.exit(1);
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Check if super admin already exists
    const existingSuperAdmin = await AdminUser.findOne({ globalRole: UserRole.SUPER_ADMIN });
    if (existingSuperAdmin) {
      console.log('✅ Super admin already exists:', existingSuperAdmin.email);
      console.log('📧 Email:', existingSuperAdmin.email);
      console.log('🏢 Role:', existingSuperAdmin.globalRole);
      await mongoose.disconnect();
      return;
    }

    // Create default estate
    console.log('🏢 Creating default estate...');
    const defaultEstate = new Estate({
      name: 'Default Estate',
      slug: 'default-estate',
      address: '123 Main Street, City, State 12345',
      phone: '+1-555-0123',
      email: 'admin@defaultestate.com',
      isActive: true,
      settings: {
        timezone: 'UTC',
        currency: 'USD',
        allowMarketplace: true,
        allowServiceRequests: true
      }
    });
    await defaultEstate.save();
    console.log('✅ Default estate created:', defaultEstate.name);

    // Create super admin user
    console.log('👤 Creating super admin user...');
    const adminEmail = 'admin@example.com';
    const adminPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    const superAdmin = new AdminUser({
      email: adminEmail,
      name: 'Super Administrator',
      passwordHash: hashedPassword,
      globalRole: UserRole.SUPER_ADMIN,
      isActive: true,
      isEmailVerified: true,
      profile: {
        firstName: 'Super',
        lastName: 'Administrator',
        phone: '+1-555-0100'
      }
    });
    await superAdmin.save();
    console.log('✅ Super admin created');

    // Create membership for super admin in default estate
    console.log('🔗 Creating admin membership...');
    const membership = new Membership({
      userId: superAdmin._id.toString(),
      estateId: defaultEstate._id.toString(),
      role: UserRole.ESTATE_ADMIN,
      permissions: ['*'], // All permissions
      isActive: true
    });
    await membership.save();
    console.log('✅ Admin membership created');

    // Success message
    console.log('\n🎉 Admin setup completed successfully!');
    console.log('\n📋 Login Credentials for Admin Dashboard:');
    console.log('🌐 URL: /admin-dashboard');
    console.log('📧 Email:', adminEmail);
    console.log('🔐 Password:', adminPassword);
    console.log('\n⚠️  IMPORTANT: Change the default password after first login!');
    
    await mongoose.disconnect();
    console.log('\n✅ Setup complete. You can now access the admin dashboard!');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run setup
if (require.main === module) {
  setupAdmin();
}

module.exports = { setupAdmin };