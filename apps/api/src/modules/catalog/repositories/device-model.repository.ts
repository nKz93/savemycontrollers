import { Injectable } from "@nestjs/common";
import { getPrismaClient } from "@smc/database";

@Injectable()
export class DeviceModelRepository {
  private readonly prisma = getPrismaClient();

  listActive() {
    return this.prisma.deviceModel.findMany({
      where: { status: "ACTIVE" },
      include: { variants: { where: { status: "ACTIVE" }, include: { revisions: true } }, family: true },
      orderBy: { displayOrder: "asc" },
    });
  }

  findBySlugWithDetails(familySlug: string, modelSlug: string) {
    return this.prisma.deviceModel.findFirst({
      where: { slug: modelSlug, family: { slug: familySlug } },
      include: { variants: { include: { revisions: true } }, family: { include: { brand: true } } },
    });
  }

  findById(id: string) {
    return this.prisma.deviceModel.findUnique({ where: { id }, include: { variants: { include: { revisions: true } } } });
  }

  async hardwareRevisionBelongsToVariant(deviceVariantId: string, hardwareRevisionId: string): Promise<boolean> {
    const revision = await this.prisma.hardwareRevision.findUnique({ where: { id: hardwareRevisionId } });
    return revision?.deviceVariantId === deviceVariantId;
  }
}
