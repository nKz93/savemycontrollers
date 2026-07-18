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
  // Volontairement PAS de companyId ici : il est toujours derive du panier
  // lui-meme cote serveur (cart.companyId, verifie par appartenance active
  // et approuvee), jamais accepte depuis le frontend (voir
  // OrderService.createOrder). Un champ companyId ici serait une surface
  // d'attaque inutile puisqu'il ne serait jamais lu.
});
export type CreateOrderRequest = z.infer<typeof createOrderSchema>;

export type OrderFinancialStatus =
  | "AWAITING_PAYMENT"
  | "PAID"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED"
  | "CANCELLED";

export type OrderOperationalStatus =
  | "CREATED"
  | "AWAITING_SHIPMENT_FROM_CLIENT"
  | "IN_PROGRESS"
  | "PARTIALLY_SHIPPED"
  | "SHIPPED"
  | "DELIVERED"
  | "CLOSED"
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

/**
 * Vue liste (GET /orders) : liste blanche stricte de champs, jamais
 * l'entite Prisma brute (voir section 5 du prompt "durcissement
 * commandes"). Aucun identifiant technique interne (hash, cle etrangere
 * brute) n'est expose.
 */
export interface OrderSummaryDto {
  id: string;
  reference: string;
  financialStatus: OrderFinancialStatus;
  operationalStatus: OrderOperationalStatus;
  totalMinor: number;
  currency: "EUR";
  itemCount: number;
  createdAt: string;
}

export interface OrderAddressSnapshotDto {
  recipientName: string;
  companyName: string | null;
  line1: string;
  line2: string | null;
  postalCode: string;
  city: string;
  country: string;
  phone: string | null;
}

export interface OrderItemDetailDto {
  id: string;
  deviceModelName: string;
  deviceVariantName: string;
  hardwareRevisionLabel: string | null;
  reportedIssue: string | null;
  unitPriceMinor: number;
  discountMinor: number;
  taxAmountMinor: number;
  totalMinor: number;
  services: Array<{ name: string; priceMinor: number }>;
  options: Array<{ name: string; priceMinor: number }>;
  repairCaseId: string | null;
}

/**
 * Vue detail (GET /orders/:id) : ne contient QUE des instantanes
 * (adresses, prix, noms) fixes au moment de la commande — jamais une
 * relecture live de l'adresse ou du catalogue actuels (voir section 4 du
 * prompt : "les commandes doivent utiliser des instantanes, jamais
 * dependre ensuite de l'adresse modifiable").
 */
export interface OrderDetailDto {
  id: string;
  reference: string;
  financialStatus: OrderFinancialStatus;
  operationalStatus: OrderOperationalStatus;
  billingAddress: OrderAddressSnapshotDto;
  shippingAddress: OrderAddressSnapshotDto;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  shippingFeeMinor: number;
  totalMinor: number;
  currency: "EUR";
  items: OrderItemDetailDto[];
  createdAt: string;
}

// --- Adresses -----------------------------------------------------------
// Perimetre de cette phase : adresses personnelles uniquement (aucun
// champ companyId accepte depuis le frontend — voir section 4 du prompt.
// La gestion d'adresses d'entreprise, si necessaire un jour, sera un
// endpoint distinct avec verification d'appartenance active, jamais un
// identifiant libre).

export const createAddressSchema = z.object({
  label: z.string().max(60).optional(),
  recipientName: z.string().min(1).max(200),
  line1: z.string().min(1).max(255),
  line2: z.string().max(255).optional(),
  postalCode: z.string().min(1).max(20),
  city: z.string().min(1).max(120),
  country: z.string().length(2).default("FR"),
  phone: z.string().max(30).optional(),
  isDefaultBilling: z.boolean().default(false),
  isDefaultShipping: z.boolean().default(false),
});
export type CreateAddressRequest = z.infer<typeof createAddressSchema>;

export const updateAddressSchema = createAddressSchema.partial();
export type UpdateAddressRequest = z.infer<typeof updateAddressSchema>;

export interface AddressDto {
  id: string;
  label: string | null;
  recipientName: string;
  line1: string;
  line2: string | null;
  postalCode: string;
  city: string;
  country: string;
  phone: string | null;
  isDefaultBilling: boolean;
  isDefaultShipping: boolean;
}
