import { Injectable } from "@nestjs/common";
import { getPrismaClient } from "@smc/database";

@Injectable()
export class RoleRepository {
  private readonly prisma = getPrismaClient();

  async getPermissionKeysForUser(userId: string): Promise<Set<string>> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
    });
    const keys = new Set<string>();
    for (const userRole of userRoles) {
      for (const rolePermission of userRole.role.rolePermissions) {
        keys.add(rolePermission.permission.key);
      }
    }
    return keys;
  }

  listRoles() {
    return this.prisma.role.findMany({ orderBy: { label: "asc" } });
  }

  listPermissions() {
    return this.prisma.permission.findMany({ orderBy: { key: "asc" } });
  }
}
