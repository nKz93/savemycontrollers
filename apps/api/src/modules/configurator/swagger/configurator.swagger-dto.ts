import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { ValidateConfigurationRequest, ConfigurationResultDto, ConfigurationIssueDto, ConfigurationRecommendationDto, ConfigurationPriceLineDto } from "@smc/contracts";

export class ValidateConfigurationBodyDto implements ValidateConfigurationRequest {
  @ApiProperty() deviceModelId!: string;
  @ApiProperty() deviceVariantId!: string;
  @ApiPropertyOptional() hardwareRevisionId?: string;
  @ApiProperty({ type: [String] }) serviceIds!: string[];
  @ApiProperty({ type: [String], default: [] }) optionIds!: string[];
}

export class ConfigurationIssueResponseDto implements ConfigurationIssueDto {
  @ApiProperty({ enum: ["INCOMPATIBLE", "REQUIRES", "MISSING_REQUIRED_OPTION"] }) type!: ConfigurationIssueDto["type"];
  @ApiProperty({ enum: ["BLOCKING", "INFO"] }) severity!: ConfigurationIssueDto["severity"];
  @ApiProperty() message!: string;
  @ApiPropertyOptional() relatedServiceId?: string;
  @ApiPropertyOptional() relatedOptionId?: string;
}

export class ConfigurationRecommendationResponseDto implements ConfigurationRecommendationDto {
  @ApiProperty() message!: string;
  @ApiPropertyOptional() relatedServiceId?: string;
  @ApiPropertyOptional() relatedOptionId?: string;
}

export class ConfigurationPriceLineResponseDto implements ConfigurationPriceLineDto {
  @ApiProperty({ enum: ["SERVICE", "OPTION"] }) kind!: ConfigurationPriceLineDto["kind"];
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() unitPriceMinor!: number;
  @ApiProperty({ example: "EUR" }) currency!: "EUR";
}

class ConfigurationPriceResponseDto {
  @ApiProperty() subtotalMinor!: number;
  @ApiProperty() discountMinor!: number;
  @ApiProperty() taxMinor!: number;
  @ApiProperty() totalMinor!: number;
  @ApiProperty({ example: "EUR" }) currency!: "EUR";
  @ApiProperty({ type: [ConfigurationPriceLineResponseDto] }) breakdown!: ConfigurationPriceLineResponseDto[];
}

class EstimatedLeadTimeResponseDto {
  @ApiProperty() min!: number;
  @ApiProperty() max!: number;
}

export class ConfigurationResultResponseDto implements ConfigurationResultDto {
  @ApiProperty() valid!: boolean;
  @ApiProperty({ type: [ConfigurationIssueResponseDto] }) issues!: ConfigurationIssueResponseDto[];
  @ApiProperty({ type: [ConfigurationRecommendationResponseDto] }) recommendations!: ConfigurationRecommendationResponseDto[];
  @ApiProperty({ type: ConfigurationPriceResponseDto }) price!: ConfigurationPriceResponseDto;
  @ApiProperty({ type: EstimatedLeadTimeResponseDto }) estimatedLeadTimeDays!: EstimatedLeadTimeResponseDto;
}
