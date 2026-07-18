import { Injectable } from "@nestjs/common";
import { UserRepository } from "./repositories/user.repository.js";

/**
 * Interface publique du module Identity, a utiliser par les autres modules
 * (ex. Orders a besoin de verifier qu'un utilisateur existe) au lieu
 * d'importer UserRepository directement.
 */
@Injectable()
export class IdentityPublicApi {
  constructor(private readonly users: UserRepository) {}

  async userExists(userId: string): Promise<boolean> {
    return (await this.users.findById(userId)) !== null;
  }

  async getBasicProfile(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) return null;
    return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName };
  }

  /**
   * Utilise avant toute affectation de dossier a un technicien (voir
   * section 17 du prompt) : verifie existence, statut actif, et
   * appartenance au personnel SaveMyControllers (accountType STAFF), pour
   * empecher explicitement l'affectation d'un client particulier.
   */
  async getStaffProfileForAssignment(userId: string): Promise<{ id: string; isActive: boolean; accountType: string } | null> {
    const user = await this.users.findById(userId);
    if (!user) return null;
    return { id: user.id, isActive: user.isActive, accountType: user.accountType };
  }
}
