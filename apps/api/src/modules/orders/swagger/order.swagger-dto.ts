import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type {
  OrderSummaryDto,
  OrderDetailDto,
  OrderAddressSnapshotDto,
  OrderItemDetailDto,
  CreateOrderRequest,
  CartDto,
  CartItemDto,
  AddCartItemRequest,
} from "@smc/contracts";

export class CartItemResponseDto implements CartItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() deviceModelName!: string;
  @ApiProperty() deviceVariantName!: string;
  @ApiProperty({ type: [String] }) serviceNames!: string[];
  @ApiProperty({ type: [String] }) optionNames!: string[];
  @ApiProperty() unitPriceMinor!: number;
  @ApiProperty() discountMinor!: number;
  @ApiProperty() taxAmountMinor!: number;
  @ApiProperty() totalMinor!: number;
  @ApiProperty({ example: "EUR" }) currency!: "EUR";
  @ApiPropertyOptional({ nullable: true }) reportedIssue!: string | null;
}

export class CartResponseDto implements CartDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: [CartItemResponseDto] }) items!: CartItemResponseDto[];
  @ApiProperty() subtotalMinor!: number;
  @ApiProperty() discountMinor!: number;
  @ApiProperty() taxMinor!: number;
  @ApiProperty() totalMinor!: number;
  @ApiProperty({ example: "EUR" }) currency!: "EUR";
}

export class AddCartItemBodyDto implements AddCartItemRequest {
  @ApiProperty() deviceModelId!: string;
  @ApiProperty() deviceVariantId!: string;
  @ApiPropertyOptional() hardwareRevisionId?: string;
  @ApiProperty({ type: [String] }) serviceIds!: string[];
  @ApiProperty({ type: [String], default: [] }) optionIds!: string[];
  @ApiPropertyOptional() reportedIssue?: string;
}

export class EnsureGuestCartResponseDto {
  @ApiProperty() cartId!: string;
}

/**
 * Voir la remarque sur le `implements` obligatoire dans
 * address.swagger-dto.ts : chaque classe ici implemente son interface de
 * contrat correspondante, ce qui fait echouer la compilation si les deux
 * divergent.
 */

export class OrderSummaryResponseDto implements OrderSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() reference!: string;
  @ApiProperty({ enum: ["AWAITING_PAYMENT", "PAID", "PARTIALLY_REFUNDED", "REFUNDED", "CANCELLED"] })
  financialStatus!: OrderSummaryDto["financialStatus"];
  @ApiProperty({
    enum: [
      "CREATED",
      "AWAITING_SHIPMENT_FROM_CLIENT",
      "IN_PROGRESS",
      "PARTIALLY_SHIPPED",
      "SHIPPED",
      "DELIVERED",
      "CLOSED",
      "CANCELLED",
    ],
  })
  operationalStatus!: OrderSummaryDto["operationalStatus"];
  @ApiProperty({ description: "Montant total en centimes (unite mineure)." }) totalMinor!: number;
  @ApiProperty({ example: "EUR" }) currency!: "EUR";
  @ApiProperty() itemCount!: number;
  @ApiProperty() createdAt!: string;
}

export class OrderAddressSnapshotResponseDto implements OrderAddressSnapshotDto {
  @ApiProperty() recipientName!: string;
  @ApiPropertyOptional({ nullable: true }) companyName!: string | null;
  @ApiProperty() line1!: string;
  @ApiPropertyOptional({ nullable: true }) line2!: string | null;
  @ApiProperty() postalCode!: string;
  @ApiProperty() city!: string;
  @ApiProperty() country!: string;
  @ApiPropertyOptional({ nullable: true }) phone!: string | null;
}

class OrderLineComponentResponseDto {
  @ApiProperty() name!: string;
  @ApiProperty() priceMinor!: number;
}

export class OrderItemDetailResponseDto implements OrderItemDetailDto {
  @ApiProperty() id!: string;
  @ApiProperty() deviceModelName!: string;
  @ApiProperty() deviceVariantName!: string;
  @ApiPropertyOptional({ nullable: true }) hardwareRevisionLabel!: string | null;
  @ApiPropertyOptional({ nullable: true }) reportedIssue!: string | null;
  @ApiProperty() unitPriceMinor!: number;
  @ApiProperty() discountMinor!: number;
  @ApiProperty() taxAmountMinor!: number;
  @ApiProperty() totalMinor!: number;
  @ApiProperty({ type: [OrderLineComponentResponseDto] }) services!: OrderLineComponentResponseDto[];
  @ApiProperty({ type: [OrderLineComponentResponseDto] }) options!: OrderLineComponentResponseDto[];
  @ApiPropertyOptional({ nullable: true }) repairCaseId!: string | null;
}

export class OrderDetailResponseDto implements OrderDetailDto {
  @ApiProperty() id!: string;
  @ApiProperty() reference!: string;
  @ApiProperty() financialStatus!: OrderDetailDto["financialStatus"];
  @ApiProperty() operationalStatus!: OrderDetailDto["operationalStatus"];
  @ApiProperty({ type: OrderAddressSnapshotResponseDto }) billingAddress!: OrderAddressSnapshotResponseDto;
  @ApiProperty({ type: OrderAddressSnapshotResponseDto }) shippingAddress!: OrderAddressSnapshotResponseDto;
  @ApiProperty() subtotalMinor!: number;
  @ApiProperty() discountMinor!: number;
  @ApiProperty() taxMinor!: number;
  @ApiProperty() shippingFeeMinor!: number;
  @ApiProperty() totalMinor!: number;
  @ApiProperty({ example: "EUR" }) currency!: "EUR";
  @ApiProperty({ type: [OrderItemDetailResponseDto] }) items!: OrderItemDetailResponseDto[];
  @ApiProperty() createdAt!: string;
}

export class CreateOrderBodyDto implements CreateOrderRequest {
  @ApiProperty() cartId!: string;
  @ApiProperty() billingAddressId!: string;
  @ApiProperty() shippingAddressId!: string;
}

export class MergeCartResponseDto {
  @ApiProperty() merged!: boolean;
  @ApiPropertyOptional({ nullable: true }) cartId!: string | null;
}
