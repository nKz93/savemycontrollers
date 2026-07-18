import { z } from "zod";

export const addCartItemSchema = z.object({
  deviceModelId: z.string().uuid(),
  deviceVariantId: z.string().uuid(),
  hardwareRevisionId: z.string().uuid().optional(),
  serviceIds: z.array(z.string().uuid()).min(1),
  optionIds: z.array(z.string().uuid()).default([]),
  reportedIssue: z.string().max(2000).optional(),
});
export type AddCartItemRequest = z.infer<typeof addCartItemSchema>;

export interface CartItemDto {
  id: string;
  deviceModelName: string;
  deviceVariantName: string;
  serviceNames: string[];
  optionNames: string[];
  unitPriceMinor: number;
  discountMinor: number;
  taxAmountMinor: number;
  totalMinor: number;
  currency: "EUR";
  reportedIssue: string | null;
}

export interface CartDto {
  id: string;
  items: CartItemDto[];
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  currency: "EUR";
}

export const createOrderSchema = z.object({
  cartId: z.string().uuid(),
  billingAddressId: z.string().uuid(),
  shippingAddressId: z.string().uuid(),
  companyId: z.string().uuid().optional(),
});
export type CreateOrderRequest = z.infer<typeof createOrderSchema>;

export type OrderFinancialStatus =
  | "AWAITING_PAYMENT"
  | "PAID"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED"
  | "CANCELLED";

export interface OrderDto {
  id: string;
  reference: string;
  financialStatus: OrderFinancialStatus;
  createdAt: string;
  totalMinor: number;
  currency: "EUR";
  repairCaseIds: string[];
}
