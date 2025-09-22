import { z } from "zod";
import mongoose, { Schema, Document } from "mongoose";

// Core Types and Enums
export const UserRole = {
  SUPER_ADMIN: 'super_admin',
  ESTATE_ADMIN: 'estate_admin', 
  MODERATOR: 'moderator',
  RESIDENT: 'resident',
  PROVIDER: 'provider'
} as const;

export const ServiceCategory = {
  ELECTRICIAN: 'electrician',
  PLUMBER: 'plumber',
  CARPENTER: 'carpenter',
  HVAC_TECHNICIAN: 'hvac_technician',
  PAINTER: 'painter',
  TILER: 'tiler',
  MASON: 'mason',
  ROOFER: 'roofer',
  GARDENER: 'gardener',
  CLEANER: 'cleaner',
  SECURITY_GUARD: 'security_guard',
  COOK: 'cook',
  LAUNDRY_SERVICE: 'laundry_service',
  PEST_CONTROL: 'pest_control',
  WELDER: 'welder',
  MECHANIC: 'mechanic',
  PHONE_REPAIR: 'phone_repair',
  APPLIANCE_REPAIR: 'appliance_repair',
  TAILOR: 'tailor',
  MARKET_RUNNER: 'market_runner'
} as const;

export const ServiceStatus = {
  PENDING: 'pending',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
} as const;

export const OrderStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled'
} as const;

export const UrgencyLevel = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  EMERGENCY: 'emergency'
} as const;

// MongoDB Schema Definitions

// Estates (Tenants)
export interface IEstate extends Document {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  address: string;
  coverage: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  settings: {
    servicesEnabled: string[];
    marketplaceEnabled: boolean;
    paymentMethods: string[];
    deliveryRules: Record<string, any>;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const EstateSchema = new Schema<IEstate>({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: String,
  address: { type: String, required: true },
  coverage: {
    type: { type: String, enum: ['Polygon'], required: true },
    coordinates: { type: [[[Number]]], required: true }
  },
  settings: {
    servicesEnabled: [String],
    marketplaceEnabled: { type: Boolean, default: true },
    paymentMethods: [String],
    deliveryRules: Schema.Types.Mixed
  },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

EstateSchema.index({ coverage: '2dsphere' });

// Users
export interface IUser extends Document {
  _id: string;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  globalRole?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const UserSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  passwordHash: { type: String, required: true },
  globalRole: { type: String, enum: Object.values(UserRole) },
  isActive: { type: Boolean, default: true },
  lastLoginAt: Date
}, { timestamps: true });

// Email uniqueness is handled by schema definition

// Memberships (User-Estate Relationships)
export interface IMembership extends Document {
  _id: string;
  userId: string;
  estateId: string;
  role: string;
  isActive: boolean;
  permissions?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export const MembershipSchema = new Schema<IMembership>({
  userId: { type: String, required: true },
  estateId: { type: String, required: true },
  role: { type: String, enum: Object.values(UserRole), required: true },
  isActive: { type: Boolean, default: true },
  permissions: [String]
}, { timestamps: true });

MembershipSchema.index({ estateId: 1, role: 1 });
MembershipSchema.index({ userId: 1 });
MembershipSchema.index({ userId: 1, estateId: 1 }, { unique: true });

// Providers
export interface IProvider extends Document {
  _id: string;
  userId: string;
  estates: string[];
  categories: string[];
  experience: number;
  rating: number;
  totalJobs: number;
  isApproved: boolean;
  documents?: string[];
  location?: {
    type: 'Point';
    coordinates: [number, number];
  };
  createdAt: Date;
  updatedAt: Date;
}

export const ProviderSchema = new Schema<IProvider>({
  userId: { type: String, required: true },
  estates: [String],
  categories: [{ type: String, enum: Object.values(ServiceCategory) }],
  experience: { type: Number, default: 0 },
  rating: { type: Number, default: 0 },
  totalJobs: { type: Number, default: 0 },
  isApproved: { type: Boolean, default: false },
  documents: [String],
  location: {
    type: { type: String, enum: ['Point'] },
    coordinates: { type: [Number], index: '2dsphere' }
  }
}, { timestamps: true });

ProviderSchema.index({ estates: 1 });
ProviderSchema.index({ categories: 1 });
ProviderSchema.index({ location: '2dsphere' });

// Service Requests
export interface IServiceRequest extends Document {
  _id: string;
  estateId: string;
  residentId: string;
  providerId?: string;
  category: string;
  title: string;
  description: string;
  status: string;
  urgency: string;
  budget: {
    min: number;
    max: number;
    currency: string;
  };
  location: {
    address: string;
    coordinates?: {
      type: 'Point';
      coordinates: [number, number];
    };
  };
  preferredTime?: Date;
  specialInstructions?: string;
  assignedAt?: Date;
  completedAt?: Date;
  rating?: number;
  review?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const ServiceRequestSchema = new Schema<IServiceRequest>({
  estateId: { type: String, required: true },
  residentId: { type: String, required: true },
  providerId: String,
  category: { type: String, enum: Object.values(ServiceCategory), required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  status: { type: String, enum: Object.values(ServiceStatus), default: ServiceStatus.PENDING },
  urgency: { type: String, enum: Object.values(UrgencyLevel), required: true },
  budget: {
    min: { type: Number, required: true },
    max: { type: Number, required: true },
    currency: { type: String, default: 'NGN' }
  },
  location: {
    address: { type: String, required: true },
    coordinates: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number], index: '2dsphere' }
    }
  },
  preferredTime: Date,
  specialInstructions: String,
  assignedAt: Date,
  completedAt: Date,
  rating: { type: Number, min: 1, max: 5 },
  review: String
}, { timestamps: true });

ServiceRequestSchema.index({ estateId: 1, status: 1 });
ServiceRequestSchema.index({ 'location.coordinates': '2dsphere' });
ServiceRequestSchema.index({ providerId: 1 });

// Marketplace Items
export interface IMarketplaceItem extends Document {
  _id: string;
  estateId: string;
  vendorId: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  category: string;
  subcategory?: string;
  stock: number;
  images?: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const MarketplaceItemSchema = new Schema<IMarketplaceItem>({
  estateId: { type: String, required: true },
  vendorId: { type: String, required: true },
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  currency: { type: String, default: 'NGN' },
  category: { type: String, required: true },
  subcategory: String,
  stock: { type: Number, default: 0 },
  images: [String],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

MarketplaceItemSchema.index({ estateId: 1, category: 1 });
MarketplaceItemSchema.index({ vendorId: 1 });

// Orders
export interface IOrder extends Document {
  _id: string;
  estateId: string;
  buyerId: string;
  vendorId: string;
  items: Array<{
    itemId: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  total: number;
  currency: string;
  status: string;
  deliveryAddress: string;
  paymentMethod?: string;
  paymentId?: string;
  dispute?: {
    reason: string;
    status: string;
    resolvedAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

export const OrderSchema = new Schema<IOrder>({
  estateId: { type: String, required: true },
  buyerId: { type: String, required: true },
  vendorId: { type: String, required: true },
  items: [{
    itemId: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true }
  }],
  total: { type: Number, required: true },
  currency: { type: String, default: 'NGN' },
  status: { type: String, enum: Object.values(OrderStatus), default: OrderStatus.PENDING },
  deliveryAddress: { type: String, required: true },
  paymentMethod: String,
  paymentId: String,
  dispute: {
    reason: String,
    status: String,
    resolvedAt: Date
  }
}, { timestamps: true });

OrderSchema.index({ estateId: 1, status: 1 });
OrderSchema.index({ buyerId: 1 });
OrderSchema.index({ vendorId: 1 });

// Categories
export interface ICategory extends Document {
  _id: string;
  scope: 'global' | 'estate';
  estateId?: string;
  name: string;
  key: string;
  description?: string;
  icon?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const CategorySchema = new Schema<ICategory>({
  scope: { type: String, enum: ['global', 'estate'], required: true },
  estateId: String,
  name: { type: String, required: true },
  key: { type: String, required: true },
  description: String,
  icon: String,
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

CategorySchema.index({ scope: 1, estateId: 1, key: 1 }, { unique: true });

// Audit Logs
export interface IAuditLog extends Document {
  _id: string;
  actorId: string;
  estateId?: string;
  action: string;
  target: string;
  targetId: string;
  meta: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export const AuditLogSchema = new Schema<IAuditLog>({
  actorId: { type: String, required: true },
  estateId: String,
  action: { type: String, required: true },
  target: { type: String, required: true },
  targetId: { type: String, required: true },
  meta: { type: Schema.Types.Mixed, default: {} },
  ipAddress: String,
  userAgent: String
}, { timestamps: { updatedAt: false } });

AuditLogSchema.index({ estateId: 1 });
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ actorId: 1 });

// Zod Validation Schemas
export const createEstateSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  address: z.string().min(1),
  coverage: z.object({
    type: z.literal('Polygon'),
    coordinates: z.array(z.array(z.array(z.number())))
  }),
  settings: z.object({
    servicesEnabled: z.array(z.string()),
    marketplaceEnabled: z.boolean().default(true),
    paymentMethods: z.array(z.string()),
    deliveryRules: z.record(z.any())
  }).optional()
});

export const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().min(10).max(15),
  password: z.string().min(8),
  globalRole: z.enum(Object.values(UserRole) as [string, ...string[]]).optional()
});

export const createMembershipSchema = z.object({
  userId: z.string(),
  estateId: z.string(),
  role: z.enum(Object.values(UserRole) as [string, ...string[]]),
  permissions: z.array(z.string()).optional()
});

export const createServiceRequestSchema = z.object({
  estateId: z.string(),
  residentId: z.string(),
  category: z.enum(Object.values(ServiceCategory) as [string, ...string[]]),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  urgency: z.enum(Object.values(UrgencyLevel) as [string, ...string[]]),
  budget: z.object({
    min: z.number().positive(),
    max: z.number().positive(),
    currency: z.string().default('NGN')
  }),
  location: z.object({
    address: z.string().min(1),
    coordinates: z.object({
      type: z.literal('Point'),
      coordinates: z.tuple([z.number(), z.number()])
    }).optional()
  }),
  preferredTime: z.date().optional(),
  specialInstructions: z.string().optional()
});

// Type Exports
export type Estate = IEstate;
export type User = IUser;
export type Membership = IMembership;
export type Provider = IProvider;
export type ServiceRequest = IServiceRequest;
export type MarketplaceItem = IMarketplaceItem;
export type Order = IOrder;
export type Category = ICategory;
export type AuditLog = IAuditLog;

export type CreateEstateInput = z.infer<typeof createEstateSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type CreateMembershipInput = z.infer<typeof createMembershipSchema>;
export type CreateServiceRequestInput = z.infer<typeof createServiceRequestSchema>;