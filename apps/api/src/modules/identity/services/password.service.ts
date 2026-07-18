import { Injectable } from "@nestjs/common";
import * as argon2 from "argon2";

/**
 * Hachage des mots de passe en Argon2id (recommandation OWASP). Les
 * couts sont configurables par variable d'environnement pour pouvoir etre
 * ajustes selon la capacite du serveur de production sans changement de code.
 */
@Injectable()
export class PasswordService {
  private readonly options: argon2.Options;

  constructor() {
    this.options = {
      type: argon2.argon2id,
      memoryCost: Number(process.env.ARGON2_MEMORY_COST ?? 19456),
      timeCost: Number(process.env.ARGON2_TIME_COST ?? 2),
      parallelism: Number(process.env.ARGON2_PARALLELISM ?? 1),
    };
  }

  async hash(plainPassword: string): Promise<string> {
    return argon2.hash(plainPassword, this.options);
  }

  async verify(hash: string, plainPassword: string): Promise<boolean> {
    return argon2.verify(hash, plainPassword);
  }

  /**
   * Politique de mot de passe minimale (longueur). Une politique plus
   * riche (complexite, listes de mots de passe compromis via HaveIBeenPwned)
   * est prevue en configuration ulterieure (Settings) et non codee en dur ici.
   */
  isPasswordAcceptable(plainPassword: string): boolean {
    return plainPassword.length >= 12 && plainPassword.length <= 128;
  }
}
