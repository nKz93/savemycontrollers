import { Injectable } from "@nestjs/common";
import { SettingsRepository } from "../repositories/settings.repository.js";
import { NotFoundDomainError } from "../../core/errors/domain-error.js";

/**
 * Point d'acces unique aux parametres configurables depuis l'administration
 * (taxes, transporteurs, delais, textes...). Toute valeur consommee par un
 * autre module doit passer par ce service plutot que par une valeur codee
 * en dur (voir section 33 de l'architecture pour la liste des parametres
 * prevus). Cette phase implemente le mecanisme generique ; le remplissage
 * exhaustif des parametres commerciaux se fera module par module.
 */
@Injectable()
export class SettingsService {
  constructor(private readonly repository: SettingsRepository) {}

  async getString(key: string, fallback?: string): Promise<string> {
    const setting = await this.repository.findByKey(key);
    if (!setting) {
      if (fallback !== undefined) return fallback;
      throw new NotFoundDomainError(`Parametre "${key}" introuvable.`);
    }
    return setting.valueString ?? fallback ?? "";
  }

  async getNumber(key: string, fallback?: number): Promise<number> {
    const setting = await this.repository.findByKey(key);
    if (!setting || setting.valueNumber === null) {
      if (fallback !== undefined) return fallback;
      throw new NotFoundDomainError(`Parametre "${key}" introuvable.`);
    }
    return setting.valueNumber;
  }

  async getBoolean(key: string, fallback?: boolean): Promise<boolean> {
    const setting = await this.repository.findByKey(key);
    if (!setting || setting.valueBoolean === null) {
      if (fallback !== undefined) return fallback;
      throw new NotFoundDomainError(`Parametre "${key}" introuvable.`);
    }
    return setting.valueBoolean;
  }

  listPublicSettings() {
    return this.repository.listPublic();
  }
}
