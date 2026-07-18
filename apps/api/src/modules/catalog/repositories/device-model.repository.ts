import { Injectable } from "@nestjs/common";
import { getPrismaClient, type Prisma } from "@smc/database";

type DeviceModelWithVariantsAndFamily = Prisma.DeviceModelGetPayload<{
  include: { variants: { include: { revisions: true } }; family: true };
}>;

type DeviceModelWithDetails = Prisma.DeviceModelGetPayload<{
  include: { variants: { include: { revisions: true } }; family: { include: { brand: true } } };
}>;

type DeviceModelWithVariants = Prisma.DeviceModelGetPayload<{
  include: { variants: { include: { revisions: true } } };
}>;

@Injectable()
export class DeviceModelRepository {
  private readonly prisma = getPrismaClient();

  listActive(): Promise<DeviceModelWithVariantsAndFamily[]> {
    return this.prisma.deviceModel.findMany({
      where: { status: "ACTIVE" },
      include: { variants: { where: { status: "ACTIVE" }, include: { revisions: true } }, family: true },
      orderBy: { displayOrder: "asc" },
    });
  }

  findBySlugWithDetails(familySlug: string, modelSlug: string): Promise<DeviceModelWithDetails | null> {
    return this.prisma.deviceModel.findFirst({
      where: { slug: modelSlug, family: { slug: familySlug } },
      include: { variants: { include: { revisions: true } }, family: { include: { brand: true } } },
    });
  }

  findById(id: string): Promise<DeviceModelWithVariants | null> {
    return this.prisma.deviceModel.findUnique({ where: { id }, include: { variants: { include: { revisions: true } } } });
  }

  async hardwareRevisionBelongsToVariant(deviceVariantId: string, hardwareRevisionId: string): Promise<boolean> {
    const revision = await this.prisma.hardwareRevision.findUnique({ where: { id: hardwareRevisionId } });
    return revision?.deviceVariantId === deviceVariantId;
  }
}
