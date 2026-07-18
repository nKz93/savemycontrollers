import { z } from "zod";

export const publishableStatusSchema = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);
export type PublishableStatus = z.infer<typeof publishableStatusSchema>;

export interface BrandDto {
  id: string;
  slug: string;
  name: string;
  status: PublishableStatus;
  displayOrder: number;
  shortDescription: string | null;
  logoUrl: string | null;
}

export interface DeviceModelDto {
  id: string;
  slug: string;
  name: string;
  brandId: string;
  familyId: string;
  status: PublishableStatus;
  shortDescription: string | null;
  longDescription: string | null;
  variants: DeviceVariantDto[];
}

export interface DeviceVariantDto {
  id: string;
  name: string;
  status: PublishableStatus;
  revisions: HardwareRevisionDto[];
}

export interface HardwareRevisionDto {
  id: string;
  code: string;
  label: string;
}

export interface ServiceDto {
  id: string;
  slug: string;
  name: string;
  categoryId: string;
  status: PublishableStatus;
  basePrice: { amountMinor: number; currency: "EUR" };
  shortDescription: string | null;
}

export const createBrandSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(150),
  shortDescription: z.string().max(500).optional(),
  displayOrder: z.number().int().min(0).default(0),
  status: publishableStatusSchema.default("DRAFT"),
});
export type CreateBrandRequest = z.infer<typeof createBrandSchema>;

export const updateBrandSchema = createBrandSchema.partial();
export type UpdateBrandRequest = z.infer<typeof updateBrandSchema>;
