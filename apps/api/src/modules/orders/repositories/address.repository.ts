import { Injectable } from "@nestjs/common";
import { getPrismaClient } from "@smc/database";

@Injectable()
export class AddressRepository {
  private readonly prisma = getPrismaClient();

  findById(id: string) {
    return this.prisma.address.findUnique({ where: { id } });
  }
}
