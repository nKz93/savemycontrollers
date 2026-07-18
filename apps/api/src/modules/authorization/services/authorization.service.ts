import { Injectable } from "@nestjs/common";
import { RoleRepository } from "../repositories/role.repository.js";
import type { PermissionKey } from "../constants/permissions.js";

@Injectable()
export class AuthorizationService {
  constructor(private readonly roles: RoleRepository) {}

  async hasPermission(userId: string, permission: PermissionKey): Promise<boolean> {
    const keys = await this.roles.getPermissionKeysForUser(userId);
    return keys.has(permission);
  }

  async hasAnyPermission(userId: string, permissions: PermissionKey[]): Promise<boolean> {
    const keys = await this.roles.getPermissionKeysForUser(userId);
    return permissions.some((permission) => keys.has(permission));
  }

  async hasAllPermissions(userId: string, permissions: PermissionKey[]): Promise<boolean> {
    const keys = await this.roles.getPermissionKeysForUser(userId);
    return permissions.every((permission) => keys.has(permission));
  }
}
