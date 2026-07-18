import { Injectable } from "@nestjs/common";
import { getPrismaClient, type Address } from "@smc/database";

export interface AddressWriteInput {
  label?: string;
  recipientName: string;
  line1: string;
  line2?: string;
  postalCode: string;
  city: string;
  country: string;
  phone?: string;
  isDefaultBilling: boolean;
  isDefaultShipping: boolean;
}

/**
 * Perimetre de cette phase : adresses PERSONNELLES uniquement
 * (`companyId` toujours null cote base pour les lignes creees ici).
 * Aucune methode de ce repository n'accepte de companyId venant de
 * l'appelant (voir section 4 du prompt).
 */
@Injectable()
export class AddressRepository {
  private readonly prisma = getPrismaClient();

  /** Conserve pour les appelants qui ont deja verifie la propriete sur l'objet complet (ex. OrderService). */
  findById(id: string): Promise<Address | null> {
    return this.prisma.address.findUnique({ where: { id } });
  }

  /**
   * Recherche ET verification de propriete dans la MEME requete (voir
   * section 5 du prompt) : jamais un findById suivi d'une comparaison
   * separee, qui laisserait une fenetre de lecture non autorisee.
   */
  findByIdForUser(id: string, userId: string): Promise<Address | null> {
    return this.prisma.address.findFirst({ where: { id, userId } });
  }

  listForUser(userId: string): Promise<Address[]> {
    return this.prisma.address.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  }

  /**
   * Creation transactionnelle : si la nouvelle adresse est marquee par
   * defaut (facturation et/ou livraison), les autres adresses de ce
   * meme utilisateur perdent ce statut dans la MEME transaction — jamais
   * deux requetes separees qui pourraient laisser deux adresses par
   * defaut en cas d'echec partiel.
   */
  async createForUser(userId: string, data: AddressWriteInput): Promise<Address> {
    return this.prisma.$transaction(async (tx) => {
      if (data.isDefaultBilling) {
        await tx.address.updateMany({ where: { userId, isDefaultBilling: true }, data: { isDefaultBilling: false } });
      }
      if (data.isDefaultShipping) {
        await tx.address.updateMany({ where: { userId, isDefaultShipping: true }, data: { isDefaultShipping: false } });
      }
      return tx.address.create({
        data: {
          userId,
          label: data.label,
          recipientName: data.recipientName,
          line1: data.line1,
          line2: data.line2,
          postalCode: data.postalCode,
          city: data.city,
          country: data.country,
          phone: data.phone,
          isDefaultBilling: data.isDefaultBilling,
          isDefaultShipping: data.isDefaultShipping,
        },
      });
    });
  }

  /**
   * Mise a jour transactionnelle avec propriete verifiee A L'INTERIEUR de
   * la transaction (pas avant), pour eliminer toute fenetre de course
   * entre la verification et l'ecriture. Retourne null si l'adresse
   * n'existe pas ou n'appartient pas a cet utilisateur — l'appelant ne
   * doit jamais pouvoir distinguer les deux cas (voir section 5 :
   * n'accepter aucune fuite d'information inter-comptes).
   */
  async updateForUser(id: string, userId: string, data: Partial<AddressWriteInput>): Promise<Address | null> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.address.findFirst({ where: { id, userId } });
      if (!existing) return null;

      if (data.isDefaultBilling) {
        await tx.address.updateMany({ where: { userId, isDefaultBilling: true, id: { not: id } }, data: { isDefaultBilling: false } });
      }
      if (data.isDefaultShipping) {
        await tx.address.updateMany({ where: { userId, isDefaultShipping: true, id: { not: id } }, data: { isDefaultShipping: false } });
      }
      return tx.address.update({ where: { id }, data });
    });
  }

  /** Suppression scopee : la clause WHERE porte l'id ET le proprietaire dans la meme requete. */
  async deleteForUser(id: string, userId: string): Promise<boolean> {
    const result = await this.prisma.address.deleteMany({ where: { id, userId } });
    return result.count === 1;
  }
}
