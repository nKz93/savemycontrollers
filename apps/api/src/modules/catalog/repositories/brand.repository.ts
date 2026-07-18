import { Injectable } from "@nestjs/common";
import { getPrismaClient, type Prisma } from "@smc/database";

@Injectable()
export class BrandRepository {
  private readonly prisma = getPrismaClient();

  listActive() {
    return this.prisma.brand.findMany({ where: { status: "ACTIVE" }, orderBy: { displayOrder: "asc" } });
  }

  listAll() {
    return this.prisma.brand.findMany({ orderBy: { displayOrder: "asc" } });
  }

  findBySlug(slug: string) {
    return this.prisma.brand.findUnique({ where: { slug } });
  }

  findById(id: string) {
    return this.prisma.brand.findUnique({ where: { id } });
  }

  create(data: Prisma.BrandCreateInput) {
    return this.prisma.brand.create({ data });
  }

  update(id: string, data: Prisma.BrandUpdateInput) {
    return this.prisma.brand.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.brand.delete({ where: { id } });
  }

  countFamilies(brandId: string) {
    return this.prisma.productFamily.count({ where: { brandId } });
  }
}
