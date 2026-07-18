import { Injectable } from "@nestjs/common";
import { getPrismaClient } from "@smc/database";
import type { FileVisibility, FileRelatedEntityType } from "@smc/database";

@Injectable()
export class FileRepository {
  private readonly prisma = getPrismaClient();

  create(data: {
    storageKey: string;
    originalFileName: string;
    mimeType: string;
    sizeBytes: number;
    visibility: FileVisibility;
    uploadedByUserId?: string;
    relatedEntityType?: FileRelatedEntityType;
    relatedEntityId?: string;
  }) {
    return this.prisma.fileAsset.create({ data });
  }

  findById(id: string) {
    return this.prisma.fileAsset.findUnique({ where: { id } });
  }
}
