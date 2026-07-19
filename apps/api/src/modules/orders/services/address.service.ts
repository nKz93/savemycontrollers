import { Injectable } from "@nestjs/common";
import type { Address } from "@smc/database";
import type { AddressDto, CreateAddressRequest, UpdateAddressRequest } from "@smc/contracts";
import { AddressRepository } from "../repositories/address.repository.js";
import { NotFoundDomainError } from "../../core/errors/domain-error.js";

function toAddressDto(row: Address): AddressDto {
  return {
    id: row.id,
    label: row.label,
    recipientName: row.recipientName,
    line1: row.line1,
    line2: row.line2,
    postalCode: row.postalCode,
    city: row.city,
    country: row.country,
    phone: row.phone,
    isDefaultBilling: row.isDefaultBilling,
    isDefaultShipping: row.isDefaultShipping,
  };
}

/**
 * Perimetre de cette phase : gestion d'adresses PERSONNELLES uniquement.
 * `userId` provient exclusivement du JWT courant sur chaque methode —
 * jamais du corps de la requete (voir section 4 du prompt). Aucune
 * methode ici n'accepte de companyId : une entreprise n'est jamais
 * selectionnable par un identifiant recu du frontend.
 */
@Injectable()
export class AddressService {
  constructor(private readonly addresses: AddressRepository) {}

  async list(userId: string): Promise<AddressDto[]> {
    const rows = await this.addresses.listForUser(userId);
    return rows.map(toAddressDto);
  }

  async get(userId: string, id: string): Promise<AddressDto> {
    const row = await this.addresses.findByIdForUser(id, userId);
    if (!row) throw new NotFoundDomainError("Adresse introuvable.");
    return toAddressDto(row);
  }

  async create(userId: string, input: CreateAddressRequest): Promise<AddressDto> {
    const row = await this.addresses.createForUser(userId, {
      label: input.label,
      recipientName: input.recipientName,
      line1: input.line1,
      line2: input.line2,
      postalCode: input.postalCode,
      city: input.city,
      country: input.country,
      phone: input.phone,
      isDefaultBilling: input.isDefaultBilling,
      isDefaultShipping: input.isDefaultShipping,
    });
    return toAddressDto(row);
  }

  async update(userId: string, id: string, input: UpdateAddressRequest): Promise<AddressDto> {
    const row = await this.addresses.updateForUser(id, userId, input);
    // Meme message que "introuvable" que le proprietaire soit incorrect
    // ou l'id inexistant : aucune fuite d'information sur l'existence
    // d'une adresse appartenant a un autre compte (voir section 5).
    if (!row) throw new NotFoundDomainError("Adresse introuvable.");
    return toAddressDto(row);
  }

  async remove(userId: string, id: string): Promise<void> {
    const deleted = await this.addresses.deleteForUser(id, userId);
    if (!deleted) throw new NotFoundDomainError("Adresse introuvable.");
  }
}
