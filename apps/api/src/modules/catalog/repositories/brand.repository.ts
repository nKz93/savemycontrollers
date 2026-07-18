import { Injectable } from "@nestjs/common";
import { getPrismaClient, type Prisma, type Brand } from "@smc/database";

@Injectable()
export class BrandRepository {
  private readonly prisma = getPrismaClient();

  listActive(): Promise<Brand[]> {
    return this.prisma.brand.findMany({ where: { status: "ACTIVE" }, orderBy: { displayOrder: "asc" } });
  }

  listAll(): Promise<Brand[]> {
    return this.prisma.brand.findMany({ orderBy: { displayOrder: "asc" } });
  }

  findBySlug(slug: string): Promise<Brand | null> {
    return this.prisma.brand.findUnique({ where: { slug } });
  }

  findById(id: string): Promise<Brand | null> {
    return this.prisma.brand.findUnique({ where: { id } });
  }

  create(data: Prisma.BrandCreateInput): Promise<Brand> {
    return this.prisma.brand.create({ data });
  }

  update(id: string, data: Prisma.BrandUpdateInput): Promise<Brand> {
    return this.prisma.brand.update({ where: { id }, data });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.brand.delete({ where: { id } });
  }

  countFamilies(brandId: string): Promise<number> {
    return this.prisma.productFamily.count({ where: { brandId } });
  }
}
