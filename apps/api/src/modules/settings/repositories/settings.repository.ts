import { Injectable } from "@nestjs/common";
import { getPrismaClient, type Prisma } from "@smc/database";

@Injectable()
export class SettingsRepository {
  private readonly prisma = getPrismaClient();

  findByKey(key: string) {
    return this.prisma.setting.findUnique({ where: { key } });
  }

  listPublic() {
    return this.prisma.setting.findMany({ where: { isPublic: true } });
  }

  async upsert(
    key: string,
    data: {
      valueType: "STRING" | "NUMBER" | "BOOLEAN" | "JSON";
      valueString?: string;
      valueNumber?: number;
      valueBoolean?: boolean;
      valueJson?: Prisma.InputJsonValue;
      isPublic?: boolean;
      description?: string;
      updatedByUserId?: string;
    },
  ) {
    const existing = await this.findByKey(key);
    const updated = await this.prisma.setting.upsert({
      where: { key },
      create: { key, ...data },
      update: data,
    });
    await this.prisma.settingHistory.create({
      data: {
        settingKey: key,
        oldValueJson: existing ? this.extractValue(existing) : undefined,
        newValueJson: this.extractValue(updated),
        changedByUserId: data.updatedByUserId,
      },
    });
    return updated;
  }

  private extractValue(setting: {
    valueType: string;
    valueString: string | null;
    valueNumber: number | null;
    valueBoolean: boolean | null;
    valueJson: unknown;
  }): Prisma.InputJsonValue {
    switch (setting.valueType) {
      case "STRING":
        return setting.valueString as Prisma.InputJsonValue;
      case "NUMBER":
        return setting.valueNumber as Prisma.InputJsonValue;
      case "BOOLEAN":
        return setting.valueBoolean as Prisma.InputJsonValue;
      default:
        return setting.valueJson as Prisma.InputJsonValue;
    }
  }
}
