import { z } from "zod";

const toNumber = (value: unknown) => {
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isNaN(n) ? value : n;
  }
  return value;
};

export const createProviderSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  // keep full name optional for back-compat
  name: z.string().optional(),
  email: z.string().email(),
  phone: z.string().optional().default(""),
  password: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().min(6, "Password must be at least 6 characters").optional()
  ),
  company: z.string().optional().default(""),
  categories: z.array(z.string()).min(1, "Select at least one category"),
  experience: z.preprocess(toNumber, z.number().int().nonnegative()).default(0),
  description: z.string().optional().default(""),
  isApproved: z.boolean().default(true),
});


export const providerRequestSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  name: z.string().optional(),
  email: z.string().email(),
  phone: z.string().optional().default(""),
  company: z.string().optional().default(""),
  categories: z.array(z.string()).optional().default([]),
  experience: z.preprocess(toNumber, z.number().int().nonnegative()).default(0),
  description: z.string().optional().default(""),
});

export type ProviderRequestInput = z.infer<typeof providerRequestSchema>;

export type CreateProviderInput = z.infer<typeof createProviderSchema>;

export const createMarketplaceItemSchema = z.object({
  storeId: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().min(1).optional()
  ),
  estateId: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().min(1).optional()
  ),
  vendorId: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().min(1, "Vendor is required").optional()
  ),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().default(""),
  price: z.preprocess(toNumber, z.number().nonnegative()),
  currency: z.string().min(1).default("NGN"),
  category: z.string().min(1, "Category is required"),
  subcategory: z.string().optional().default(""),
  stock: z.preprocess(toNumber, z.number().int().nonnegative()).default(0),
  images: z.array(z.string()).optional().default([]),
  unitOfMeasure: z
    .preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string())
    .optional()
    .default("piece"),
  isActive: z.boolean().optional().default(true),
});

export const updateMarketplaceItemSchema = createMarketplaceItemSchema;

export type CreateMarketplaceItemInput = z.infer<typeof createMarketplaceItemSchema>;
export type UpdateMarketplaceItemInput = z.infer<typeof updateMarketplaceItemSchema>;

export interface IMarketplaceItem {
  _id?: string;
  id?: string;
  vendorId?: string;
  name?: string;
  description?: string;
  price?: number;
  currency?: string;
  category?: string;
  subcategory?: string;
  stock?: number;
  images?: string[];
  isActive?: boolean;
}
