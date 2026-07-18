import { Injectable } from "@nestjs/common";
import { getPrismaClient } from "@smc/database";
import type { NoteVisibility } from "@smc/database";

@Injectable()
export class RepairNoteRepository {
  private readonly prisma = getPrismaClient();

  create(data: { repairCaseId: string; authorUserId?: string; visibility: NoteVisibility; body: string }) {
    return this.prisma.repairNote.create({ data });
  }

  listForCase(repairCaseId: string, visibilities: NoteVisibility[]) {
    return this.prisma.repairNote.findMany({
      where: { repairCaseId, visibility: { in: visibilities } },
      orderBy: { createdAt: "asc" },
    });
  }
}
