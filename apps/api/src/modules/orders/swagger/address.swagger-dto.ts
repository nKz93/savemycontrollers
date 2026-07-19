import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { AddressDto, CreateAddressRequest, UpdateAddressRequest } from "@smc/contracts";

/**
 * Classes dediees a la documentation OpenAPI (introspection runtime via
 * @nestjs/swagger + reflect-metadata). Distinctes des interfaces de
 * packages/contracts (qui restent des types purs, sans dependance a
 * @nestjs/swagger, partages avec le frontend).
 *
 * Chaque classe `implements` son interface de contrat correspondante :
 * TypeScript refuse de compiler si un champ est ajoute/retire/retype
 * dans le contrat sans repercussion ici — la synchronisation est donc
 * imposee au moment de la compilation, pas seulement documentee en
 * commentaire (voir aussi le test schema-sync.spec.ts qui verifie la
 * meme garantie pour les schemas imbriques et les corps de requete).
 */
export class AddressResponseDto implements AddressDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) label!: string | null;
  @ApiProperty() recipientName!: string;
  @ApiProperty() line1!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) line2!: string | null;
  @ApiProperty() postalCode!: string;
  @ApiProperty() city!: string;
  @ApiProperty({ example: "FR" }) country!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) phone!: string | null;
  @ApiProperty() isDefaultBilling!: boolean;
  @ApiProperty() isDefaultShipping!: boolean;
}

export class CreateAddressBodyDto implements CreateAddressRequest {
  @ApiPropertyOptional() label?: string;
  @ApiProperty() recipientName!: string;
  @ApiProperty() line1!: string;
  @ApiPropertyOptional() line2?: string;
  @ApiProperty() postalCode!: string;
  @ApiProperty() city!: string;
  @ApiProperty({ example: "FR" }) country!: string;
  @ApiPropertyOptional() phone?: string;
  @ApiProperty({ default: false }) isDefaultBilling!: boolean;
  @ApiProperty({ default: false }) isDefaultShipping!: boolean;
}

export class UpdateAddressBodyDto implements UpdateAddressRequest {
  @ApiPropertyOptional() label?: string;
  @ApiPropertyOptional() recipientName?: string;
  @ApiPropertyOptional() line1?: string;
  @ApiPropertyOptional() line2?: string;
  @ApiPropertyOptional() postalCode?: string;
  @ApiPropertyOptional() city?: string;
  @ApiPropertyOptional({ example: "FR" }) country?: string;
  @ApiPropertyOptional() phone?: string;
  @ApiPropertyOptional() isDefaultBilling?: boolean;
  @ApiPropertyOptional() isDefaultShipping?: boolean;
}
