import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { BrandDto, DeviceModelDto, DeviceVariantDto, HardwareRevisionDto, ServiceDto, ServiceOptionDto, DeviceModelDetailDto } from "@smc/contracts";
import { MoneyResponseDto } from "../../core/swagger/money.swagger-dto.js";

export class HardwareRevisionResponseDto implements HardwareRevisionDto {
  @ApiProperty() id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() label!: string;
}

export class DeviceVariantResponseDto implements DeviceVariantDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ["DRAFT", "ACTIVE", "ARCHIVED"] }) status!: DeviceVariantDto["status"];
  @ApiProperty({ type: [HardwareRevisionResponseDto] }) revisions!: HardwareRevisionResponseDto[];
}

export class BrandResponseDto implements BrandDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ["DRAFT", "ACTIVE", "ARCHIVED"] }) status!: BrandDto["status"];
  @ApiProperty() displayOrder!: number;
  @ApiPropertyOptional({ type: String, nullable: true }) shortDescription!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) logoUrl!: string | null;
}

export class DeviceModelResponseDto implements DeviceModelDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty() brandId!: string;
  @ApiProperty() familyId!: string;
  @ApiProperty() familySlug!: string;
  @ApiProperty({ enum: ["DRAFT", "ACTIVE", "ARCHIVED"] }) status!: DeviceModelDto["status"];
  @ApiPropertyOptional({ type: String, nullable: true }) shortDescription!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) longDescription!: string | null;
  @ApiProperty({ type: [DeviceVariantResponseDto] }) variants!: DeviceVariantResponseDto[];
}

class CatalogRefResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
}

export class DeviceModelDetailResponseDto implements DeviceModelDetailDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ["DRAFT", "ACTIVE", "ARCHIVED"] }) status!: DeviceModelDetailDto["status"];
  @ApiPropertyOptional({ type: String, nullable: true }) shortDescription!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) longDescription!: string | null;
  @ApiProperty({ type: CatalogRefResponseDto }) brand!: CatalogRefResponseDto;
  @ApiProperty({ type: CatalogRefResponseDto }) family!: CatalogRefResponseDto;
  @ApiProperty({ type: [DeviceVariantResponseDto] }) variants!: DeviceVariantResponseDto[];
}

export class ServiceOptionResponseDto implements ServiceOptionDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty() isRequired!: boolean;
  @ApiProperty({ type: MoneyResponseDto }) extraPrice!: MoneyResponseDto;
}

export class ServiceResponseDto implements ServiceDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty() categoryId!: string;
  @ApiProperty({ enum: ["DRAFT", "ACTIVE", "ARCHIVED"] }) status!: ServiceDto["status"];
  @ApiProperty({ type: MoneyResponseDto }) basePrice!: MoneyResponseDto;
  @ApiPropertyOptional({ type: String, nullable: true }) shortDescription!: string | null;
  @ApiProperty({ type: [ServiceOptionResponseDto] }) options!: ServiceOptionResponseDto[];
}
